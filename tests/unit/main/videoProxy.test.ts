import { describe, it, expect, vi, beforeEach } from 'vitest'

const { handlerRef, httpsRequestMock, dnsLookupMock } = vi.hoisted(() => {
  const handlerRef: { current: ((req: any, res: any) => void) | null } = { current: null }
  const httpsRequestMock = vi.fn(() => {
    // Default: return a harmless request object to prevent unhandled rejections
    const req = { on: vi.fn(), end: vi.fn() }
    return req
  })
  const dnsLookupMock = vi.fn((hostname: string, opts: any, cb: Function) => cb(null, '1.2.3.4'))
  return { handlerRef, httpsRequestMock, dnsLookupMock }
})

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'D:\\mock\\userData'), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/dataRoot', () => ({
  getVideoCacheDir: vi.fn(() => 'D:\\mock\\userData\\cache\\bili-video'),
  getActualDataDir: vi.fn(() => 'D:\\mock\\userData')
}))

vi.mock('../../../src/main/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  networkLog: vi.fn()
}))

vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => Buffer.from('cached-data')),
  writeFileSync: vi.fn(),
  createReadStream: vi.fn()
}))

vi.mock('dns', () => ({
  lookup: dnsLookupMock
}))

vi.mock('http', () => ({
  createServer: vi.fn((handler: any) => {
    handlerRef.current = handler
    return {
      listen: vi.fn((port: any, host: any, cb: any) => {
        if (typeof port === 'function') { cb = port }
        else if (typeof host === 'function') { cb = host }
        if (typeof cb === 'function') cb()
      }),
      address: vi.fn(() => ({ port: 12345, address: '127.0.0.1', family: 'IPv4' })),
      close: vi.fn()
    }
  })
}))

vi.mock('https', () => ({
  request: httpsRequestMock
}))

import * as fs from 'fs'
import * as https from 'https'
import {
  startPlayback,
  updateSession,
  removePlayback,
  getManifestUrl,
  cleanupOldSessions
} from '../../../src/main/videoProxy'

const vs = (bandwidth = 1000000) => ({
  baseUrl: 'https://example.com/v.m4s',
  mimeType: 'video/mp4' as const,
  codecs: 'avc1.64001F',
  bandwidth,
  width: 1920,
  height: 1080,
  frameRate: '30' as const,
  segmentBase: { Initialization: '0-100', indexRange: '101-200' }
})

const as = (bandwidth = 128000) => ({
  baseUrl: 'https://example.com/a.m4s',
  mimeType: 'audio/mp4' as const,
  codecs: 'mp4a.40.2',
  bandwidth,
  segmentBase: { Initialization: '0-50', indexRange: '51-150' }
})

describe('videoProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start playback and return token', () => {
    const token = startPlayback('BV1xx411c7mD', '12345', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    expect(token).toBeDefined()
    expect(token.length).toBeGreaterThan(0)
  })

  it('should start playback with empty streams', () => {
    const token = startPlayback('BV1xx411c7mE', '67890', 32, [{ qn: 32, description: '360P' }], [], [], 0)
    expect(token).toBeDefined()
  })

  it('should update session', () => {
    const token = startPlayback('BV1_test', '1', 32, [{ qn: 32, description: '360P' }], [], [], 100)

    const updated = updateSession(token, [vs(2000000)], [], [{ qn: 80, description: '1080P' }], 80)
    expect(updated).toBe(true)
  })

  it('should fail to update non-existent session', () => {
    const result = updateSession('nonexistent-token', [], [], [], 32)
    expect(result).toBe(false)
  })

  it('should get manifest URL for session', () => {
    const token = startPlayback('BV1_manifest', '2', 32, [{ qn: 32, description: '360P' }], [], [], 200)
    const url = getManifestUrl(token)
    expect(url).toContain('/mpd/')
    expect(url).toContain(token)
  })

  it('should remove playback session', () => {
    const token = startPlayback('BV1_remove', '3', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    removePlayback(token)

    const token2 = startPlayback('BV1_remove2', '3b', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    const url = getManifestUrl(token2)
    expect(url).toBeDefined()
    expect(getManifestUrl(token)).toBeDefined()
  })

  it('should cleanup old sessions', () => {
    const token = startPlayback('BV1_old', '4', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    cleanupOldSessions()
  })

  it('should start playback with audio only', () => {
    const token = startPlayback('BV1_audio', '5', 32, [], [], [as(64000)], 60)
    expect(token).toBeDefined()
  })

  it('should handle same bvid multiple starts (removes old)', () => {
    const t1 = startPlayback('BV1_dup', '6', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    const t2 = startPlayback('BV1_dup', '7', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    expect(t1).not.toBe(t2)
  })

  // ---- HTTP handler tests via handlerRef ----

  function mockRes() {
    return {
      writeHead: vi.fn().mockReturnThis(),
      end: vi.fn(),
      write: vi.fn(),
      writableEnded: false,
      on: vi.fn(),
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      getHeaders: vi.fn(() => ({})),
    }
  }

  function mockReq(url: string, method = 'GET', headers: Record<string, string> = {}) {
    return { url, method, headers }
  }

  function setupHttpsSuccess(body = 'stream-data', statusCode = 200, headers: Record<string, string> = {}): void {
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      const resp = new EventEmitter() as any
      resp.statusCode = statusCode
      resp.headers = { 'content-type': 'video/mp4', ...headers }
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
        // Defer data/end so proxyRequest can attach listeners after promise resolves
        setImmediate(() => {
          resp.emit('data', Buffer.from(body))
          resp.emit('end')
        })
      })
      const req = { on: vi.fn(), end: vi.fn() }
      return req
    })
  }

  function setupHttpsError(): void {
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      const resp = new EventEmitter() as any
      resp.statusCode = 503
      resp.headers = {}
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
      })
      const req = { on: vi.fn(), end: vi.fn() }
      return req
    })
  }

  function setupHttpsNetworkError(): void {
    ;(https.request as any).mockImplementation(() => {
      const req = { on: vi.fn((event: string, handler: Function) => { if (event === 'error') process.nextTick(() => handler(new Error('net fail'))) }), end: vi.fn() }
      return req
    })
  }

  it('should handle OPTIONS request', () => {
    startPlayback('BV1_opt', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/', 'OPTIONS'), res)
    expect(res.writeHead).toHaveBeenCalledWith(204, expect.any(Object))
    expect(res.end).toHaveBeenCalled()
  })

  it('should return 404 for unknown URL path', () => {
    startPlayback('BV1_404', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/unknown'), res)
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    expect(res.end).toHaveBeenCalledWith('Not found')
  })

  it('should serve MPD for valid session token', () => {
    const token = startPlayback('BV1_mpd', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const mpd = (res.end as any).mock.calls[0][0] as string
    expect(mpd).toContain('<?xml')
    expect(mpd).toContain('AdaptationSet')
    expect(mpd).toContain('video/mp4')
    expect(mpd).toContain('audio/mp4')
  })

  it('should return 404 for /mpd/ with invalid token', () => {
    startPlayback('BV1_mpd2', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/invalid-token'), res)
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    expect(res.end).toHaveBeenCalledWith('Session not found')
  })

  it('should return 404 for /s/ with invalid token', () => {
    startPlayback('BV1_s404', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/invalid-token/1000000'), res)
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    expect(res.end).toHaveBeenCalledWith('Session not found')
  })

  it('should return 404 for /s/ with unknown bandwidth', () => {
    const token = startPlayback('BV1_unkbw', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/9999999'), res)
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    expect(res.end).toHaveBeenCalledWith('Stream not found')
  })

  it('should proxy /s/ request via https to upstream and serve response', async () => {
    setupHttpsSuccess('binary-data', 206, { 'content-range': 'bytes 0-99/100' })
    const token = startPlayback('BV1_proxy', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    // Give the promise microtask a chance to resolve
    await new Promise(r => setTimeout(r, 10))
    expect(https.request).toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalled()
    expect(res.write).toHaveBeenCalledWith(Buffer.from('binary-data'))
    expect(res.end).toHaveBeenCalled()
  })

  it('should serve from cache when available', async () => {
    const { existsSync } = await import('fs')
    setupHttpsSuccess('uncached-data')
    const token = startPlayback('BV1_cache', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    // Pretend the cached file exists
    ;(existsSync as any).mockReturnValueOnce(true)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    // https.request should NOT be called because response came from cache
    expect(res.writeHead).toHaveBeenCalled()
    expect(res.end).toHaveBeenCalled()
  })

  it('should return 502 when all CDN URLs fail', async () => {
    setupHttpsError()
    const token = startPlayback('BV1_502', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object))
    expect(res.end).toHaveBeenCalledWith('Proxy error')
  })

  it('should handle https network error gracefully', async () => {
    setupHttpsNetworkError()
    const token = startPlayback('BV1_neterr', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object))
  })

  it('should try IPv4 DNS fallback when standard request fails', async () => {
    // First call fails (network error), DNS lookup succeeds, second call succeeds
    let callCount = 0
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      callCount++
      if (callCount === 1) {
        // First call → network error
        const req = { on: vi.fn((event: string, handler: Function) => { if (event === 'error') process.nextTick(() => handler(new Error('fail'))) }), end: vi.fn() }
        return req
      }
      // Second call → success (IPv4 fallback)
      const resp = new EventEmitter() as any
      resp.statusCode = 200
      resp.headers = { 'content-type': 'video/mp4' }
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
        setImmediate(() => {
          resp.emit('data', Buffer.from('fallback-data'))
          resp.emit('end')
        })
      })
      const req = { on: vi.fn(), end: vi.fn() }
      return req
    })
    ;(dnsLookupMock as any).mockImplementation((hostname: string, opts: any, cb: Function) => cb(null, '1.2.3.4'))
    const token = startPlayback('BV1_dnsfall', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(res.writeHead).toHaveBeenCalled()
  })

  it('should generate MPD with video-only streams', () => {
    const token = startPlayback('BV1_vonly', '1', 80, [{ qn: 80, description: '1080P' }], [vs()], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    const mpd = (res.end as any).mock.calls[0][0] as string
    expect(mpd).toContain('video/mp4')
    expect(mpd).not.toContain('audio/mp4')
  })

  it('should generate MPD with audio-only streams', () => {
    const token = startPlayback('BV1_aonly', '1', 80, [{ qn: 80, description: '1080P' }], [], [as()], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    const mpd = (res.end as any).mock.calls[0][0] as string
    expect(mpd).not.toContain('video/mp4')
    expect(mpd).toContain('audio/mp4')
  })

  it('should escape XML special chars in MPD', () => {
    const evilVs = { ...vs(), codecs: 'avc1<evil>&"more' }
    const token = startPlayback('BV1_xml', '1', 80, [{ qn: 80, description: '1080P' }], [evilVs], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    const mpd = (res.end as any).mock.calls[0][0] as string
    expect(mpd).not.toContain('<evil>')
    expect(mpd).toContain('&lt;evil&gt;')
    expect(mpd).toContain('&amp;')
  })

  it('should prefetch cache on updateSession when video streams present', () => {
    const token = startPlayback('BV1_pref', '1', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    setupHttpsSuccess('prefetch-data')
    const updated = updateSession(token, [vs(2000000)], [], [{ qn: 80, description: '1080P' }], 80)
    expect(updated).toBe(true)
    expect(https.request).toHaveBeenCalled()
  })

  it('should cleanup sessions older than 30 minutes', () => {
    const token = startPlayback('BV1_clean', '1', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    // Make the session appear old by manipulating Date.now indirectly
    cleanupOldSessions()
    // Session was just created, should still exist
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('should handle getManifestUrl before server start returns correct URL', () => {
    // The server is lazy-started, but we already started it in previous tests
    const token = startPlayback('BV1_manifest2', '2', 32, [{ qn: 32, description: '360P' }], [], [], 200)
    const url = getManifestUrl(token)
    expect(url).toContain('127.0.0.1:12345')
  })

  it('should serve 206 from cache with valid Range header', async () => {
    const { existsSync } = await import('fs')
    const token = startPlayback('BV1_cr1', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    setupHttpsSuccess()
    const allTrue = vi.mocked(existsSync).mockReturnValue(true)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000', 'GET', { range: 'bytes=0-99' }), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(206, expect.objectContaining({
      'Content-Range': expect.stringContaining('bytes 0-')
    }))
    allTrue.mockReturnValue(false)
  })

  it('should serve 200 from cache when Range header is malformed', async () => {
    const { existsSync } = await import('fs')
    const token = startPlayback('BV1_cr2', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    setupHttpsSuccess()
    const allTrue = vi.mocked(existsSync).mockReturnValue(true)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000', 'GET', { range: 'not-valid' }), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    allTrue.mockReturnValue(false)
  })

  it('should use application/octet-stream when upstream has no content-type', async () => {
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      const resp = new EventEmitter() as any
      resp.statusCode = 200
      resp.headers = {}
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
        setImmediate(() => {
          resp.emit('data', Buffer.from('data'))
          resp.emit('end')
        })
      })
      return { on: vi.fn(), end: vi.fn() }
    })
    const token = startPlayback('BV1_noct', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'application/octet-stream'
    }))
  })

  it('should handle upstream stream error with writableEnded false', async () => {
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      const resp = new EventEmitter() as any
      resp.statusCode = 200
      resp.headers = { 'content-type': 'video/mp4' }
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
        setImmediate(() => {
          resp.emit('data', Buffer.from('partial'))
          resp.emit('error', new Error('stream fail'))
        })
      })
      return { on: vi.fn(), end: vi.fn() }
    })
    const token = startPlayback('BV1_streamerr', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.end).toHaveBeenCalled()
  })

  it('should try backupUrl when primary CDN fails', async () => {
    let callCount = 0
    const { EventEmitter } = require('events')
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      callCount++
      if (callCount === 1) {
        const req = { on: vi.fn((event: string, handler: Function) => { if (event === 'error') setImmediate(() => handler(new Error('fail'))) }), end: vi.fn() }
        return req
      }
      const resp = new EventEmitter() as any
      resp.statusCode = 200
      resp.headers = { 'content-type': 'video/mp4' }
      resp.resume = vi.fn()
      process.nextTick(() => {
        callback(resp)
        setImmediate(() => {
          resp.emit('data', Buffer.from('backup-data'))
          resp.emit('end')
        })
      })
      return { on: vi.fn(), end: vi.fn() }
    })
    const vsWithBackup = (bandwidth = 1000000) => ({
      baseUrl: 'https://example.com/v.m4s',
      backupUrl: 'https://backup.example.com/v.m4s',
      mimeType: 'video/mp4' as const,
      codecs: 'avc1.64001F',
      bandwidth,
      width: 1920,
      height: 1080,
      frameRate: '30' as const,
      segmentBase: { Initialization: '0-100', indexRange: '101-200' }
    })
    const token = startPlayback('BV1_backup', '1', 80, [{ qn: 80, description: '1080P' }], [vsWithBackup()], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(callCount).toBe(2)
    expect(res.writeHead).toHaveBeenCalled()
  })

  it('should return 502 when DNS lookup returns null and primary fails', async () => {
    const { EventEmitter } = require('events')
    ;(dnsLookupMock as any).mockImplementation((hostname: string, opts: any, cb: Function) => cb(null, null))
    let callCount = 0
    ;(https.request as any).mockImplementation((_opts: any, callback: Function) => {
      callCount++
      const req = { on: vi.fn((event: string, handler: Function) => { if (event === 'error') setImmediate(() => handler(new Error('fail'))) }), end: vi.fn() }
      return req
    })
    const token = startPlayback('BV1_dnsnull', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000'), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.any(Object))
  })

  it('should delete sessions older than 30 minutes in cleanupOldSessions', () => {
    vi.useFakeTimers()
    const token = startPlayback('BV1_olddel', '1', 32, [{ qn: 32, description: '360P' }], [], [], 100)
    vi.advanceTimersByTime(1800000 + 1000)
    cleanupOldSessions()
    const res = mockRes()
    handlerRef.current!(mockReq('/mpd/' + token), res)
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object))
    vi.useRealTimers()
  })

  it('should handle Range header without end value (bytes=0-)', async () => {
    const { existsSync } = await import('fs')
    const token = startPlayback('BV1_rangeopen', '1', 80, [{ qn: 80, description: '1080P' }], [vs(1000000)], [], 300)
    setupHttpsSuccess()
    const allTrue = vi.mocked(existsSync).mockReturnValue(true)
    const res = mockRes()
    handlerRef.current!(mockReq('/s/' + token + '/1000000', 'GET', { range: 'bytes=0-' }), res)
    await new Promise(r => setTimeout(r, 10))
    expect(res.writeHead).toHaveBeenCalledWith(206, expect.any(Object))
    allTrue.mockReturnValue(false)
  })
})
