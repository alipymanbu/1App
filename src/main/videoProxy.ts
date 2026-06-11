import { createServer, IncomingMessage, ServerResponse } from 'http'
import { createHash, randomBytes } from 'crypto'
import * as https from 'https'
import * as dns from 'dns'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getVideoCacheDir } from './dataRoot'
import { info, warn as logWarn, error as logError, networkLog } from './logger'

const warnTimers = new Map<string, number>()
function throttledWarn(key: string, msg: string, interval = 30000): void {
  const now = Date.now()
  const last = warnTimers.get(key)
  if (!last || now - last > interval) {
    warnTimers.set(key, now)
    logWarn('videoProxy', 'throttled_warn', msg)
  }
}

const CACHE_MAX_BYTES = 1024 * 1024 * 1024
let cacheBytes = 0

function getCacheDir(): string {
  return getVideoCacheDir()
}

interface StreamEntry {
  baseUrl: string
  backupUrl?: string
  mimeType: string
  codecs: string
  bandwidth: number
  width?: number
  height?: number
  frameRate?: string
  segmentBase: {
    Initialization: string
    indexRange: string
  }
}

interface PlaybackSession {
  bvid: string
  cid: string
  qn: number
  created: number
  qualities: { qn: number; description: string }[]
  videoStreams: StreamEntry[]
  audioStreams: StreamEntry[]
  duration: number
}

const sessions = new Map<string, PlaybackSession>()

let server: ReturnType<typeof createServer> | null = null
let serverPort = 0
let started = false

function ensureCacheDir(): void {
  const dir = getCacheDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function cacheKey(url: string, range: string): string {
  return createHash('sha256').update(`${url}|${range}`).digest('hex')
}

function getCachePath(key: string): string {
  return join(getCacheDir(), key.slice(0, 2), key)
}

function getFromCache(url: string, range: string): Buffer | null {
  const key = cacheKey(url, range)
  const p = getCachePath(key)
  if (existsSync(p)) {
    return readFileSync(p)
  }
  return null
}

function writeToCache(url: string, range: string, data: Buffer): void {
  ensureCacheDir()
  const key = cacheKey(url, range)
  const p = getCachePath(key)
  const dir = join(getCacheDir(), key.slice(0, 2))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  try {
    writeFileSync(p, data)
  } catch {}
}

function generateMpd(session: PlaybackSession, baseUrl: string): string {
  const duration = session.duration || 0
  const durationStr = duration > 0 ? `PT${duration}S` : 'PT0S'

  let mpd = `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:mpeg:dash:schema:mpd:2011" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" type="static" mediaPresentationDuration="${durationStr}" minBufferTime="PT1.500S" profiles="urn:mpeg:dash:profile:isoff-main-2011">
 <Period>`

  const token = findTokenForSession(session)

  if (session.videoStreams.length > 0) {
    mpd += `
  <AdaptationSet mimeType="video/mp4" contentType="video" segmentAlignment="true" startWithSAP="1" subsegmentAlignment="true">`
    for (const vs of session.videoStreams) {
      mpd += `
    <Representation bandwidth="${vs.bandwidth}"${vs.width ? ` width="${vs.width}"` : ''}${vs.height ? ` height="${vs.height}"` : ''}${vs.frameRate ? ` frameRate="${vs.frameRate}"` : ''} codecs="${escapeXml(vs.codecs)}" id="v-${vs.bandwidth}">
     <BaseURL>${baseUrl}/s/${token}/${vs.bandwidth}</BaseURL>
     <SegmentBase indexRange="${vs.segmentBase.indexRange}" timescale="1000">
      <Initialization range="${vs.segmentBase.Initialization}" />
     </SegmentBase>
    </Representation>`
    }
    mpd += `
  </AdaptationSet>`
  }

  if (session.audioStreams.length > 0) {
    mpd += `
  <AdaptationSet mimeType="audio/mp4" contentType="audio" segmentAlignment="true" startWithSAP="1" subsegmentAlignment="true">`
    for (const as of session.audioStreams) {
      mpd += `
    <Representation bandwidth="${as.bandwidth}" codecs="${escapeXml(as.codecs)}" id="a-${as.bandwidth}">
     <BaseURL>${baseUrl}/s/${token}/${as.bandwidth}</BaseURL>
     <SegmentBase indexRange="${as.segmentBase.indexRange}" timescale="1000">
      <Initialization range="${as.segmentBase.Initialization}" />
     </SegmentBase>
    </Representation>`
    }
    mpd += `
  </AdaptationSet>`
  }

  mpd += `
 </Period>
</MPD>`

  return mpd
}

function findTokenForSession(session: PlaybackSession): string {
  for (const [t, s] of sessions) {
    if (s === session) return t
  }
  return ''
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function parseRangeHeader(range: string): { start: number; end: number } | null {
  const match = range.match(/^bytes=(\d+)-(\d*)$/)
  if (!match) return null
  return { start: parseInt(match[1], 10), end: match[2] ? parseInt(match[2], 10) : -1 }
}

function pickBackupUrl(v: Record<string, unknown>): string | undefined {
  const bu = v.backupUrl ?? v.backup_url
  if (Array.isArray(bu)) return bu[0] as string
  if (typeof bu === 'string') return bu
  return undefined
}

async function tryStreamUrl(
  url: string,
  range: string | undefined
): Promise<{ stream: NodeJS.ReadableStream; statusCode: number; headers: Record<string, string> } | null> {
  const parsed = new URL(url)
  const originalHostname = parsed.hostname
  const port = parsed.port ? parseInt(parsed.port, 10) : 443
  const path = parsed.pathname + parsed.search

  function doRequest(resolvedAddress?: string): Promise<{ stream: NodeJS.ReadableStream; statusCode: number; headers: Record<string, string> } | null> {
    return new Promise((resolve) => {
      const opts: https.RequestOptions = {
        method: 'GET',
        hostname: resolvedAddress || originalHostname,
        port,
        path,
        headers: {
          'Host': originalHostname,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.bilibili.com/',
          ...(range ? { Range: range } : {})
        }
      }
      if (resolvedAddress) {
        opts.servername = originalHostname
      }

      const req = https.request(opts, (resp) => {
        if (resp.statusCode && resp.statusCode >= 400) {
          resp.resume()
          resolve(null)
          return
        }
        resolve({
          stream: resp,
          statusCode: resp.statusCode || 200,
          headers: resp.headers as Record<string, string>
        })
      })
      req.on('error', () => resolve(null))
      req.end()
    })
  }

  let result = await doRequest()
  if (result) {
    logWarn('videoProxy', 'cdn_retry_success', `Standard request succeeded for ${originalHostname}`)
    return result
  }

  throttledWarn('req-' + originalHostname, `[videoProxy] standard request failed for ${originalHostname}, trying IPv4...`)
  const address = await new Promise<string | null>((resolve) => {
    dns.lookup(originalHostname, { family: 4, all: false }, (err, addr) => {
      resolve(err ? null : addr)
    })
  })
  if (address) {
    result = await doRequest(address)
    if (result) {
      logWarn('videoProxy', 'cdn_ipv4_success', `IPv4 fallback succeeded for ${originalHostname}`)
      return result
    }
    throttledWarn('ipv4-' + originalHostname, `[videoProxy] IPv4 fallback also failed for ${originalHostname}`)
  }

  return null
}

async function prefetchCache(url: string, backupUrl: string | undefined, range: string): Promise<void> {
  if (getFromCache(url, range)) return
  const urls = backupUrl ? [url, backupUrl] : [url]
  for (const u of urls) {
    const result = await tryStreamUrl(u, range)
    if (!result) continue
    const chunks: Buffer[] = []
    result.stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    result.stream.on('end', () => {
      if (chunks.length > 0) {
        writeToCache(url, range, Buffer.concat(chunks))
      }
    })
    result.stream.on('error', () => {})
    return
  }
}

async function proxyRequest(
  baseUrl: string,
  backupUrl: string | undefined,
  range: string | undefined,
  res: ServerResponse
): Promise<void> {
  const cached = getFromCache(baseUrl, range || '')
  if (cached) {
    info('videoProxy', 'cache_hit', `Served from cache: ${baseUrl.slice(0, 80)}...`)
    if (range) {
      const parsed = parseRangeHeader(range)
      if (parsed) {
        const total = parsed.start + cached.length
        res.writeHead(206, {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${parsed.start}-${parsed.start + cached.length - 1}/${total}`,
          'Content-Length': cached.length,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        })
      } else {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': cached.length,
          'Access-Control-Allow-Origin': '*'
        })
      }
    } else {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': cached.length,
        'Access-Control-Allow-Origin': '*'
      })
    }
    res.end(cached)
    return
  }

  const urls = backupUrl ? [baseUrl, backupUrl] : [baseUrl]
  let attempt: { stream: NodeJS.ReadableStream; statusCode: number; headers: Record<string, string> } | null = null

  for (const url of urls) {
    attempt = await tryStreamUrl(url, range)
    if (attempt) break
  }

  if (!attempt) {
    throttledWarn('cdn-' + baseUrl.slice(0, 80), `[videoProxy] all CDN URLs failed for ${baseUrl.slice(0, 80)}...`)
    logWarn('videoProxy', 'all_cdn_failed', `All CDN URLs failed for ${baseUrl.slice(0, 80)}...`)
    res.writeHead(502, { 'Access-Control-Allow-Origin': '*' })
    res.end('Proxy error')
    return
  }

  const respHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
  }
  if (attempt.headers['content-type']) {
    respHeaders['Content-Type'] = attempt.headers['content-type']
  } else {
    respHeaders['Content-Type'] = 'application/octet-stream'
  }
  if (attempt.statusCode === 206 && attempt.headers['content-range']) {
    respHeaders['Content-Range'] = attempt.headers['content-range'] as string
    respHeaders['Accept-Ranges'] = 'bytes'
  }

  res.writeHead(attempt.statusCode, respHeaders)

  const chunks: Buffer[] = []
  attempt.stream.on('data', (chunk: Buffer) => {
    res.write(chunk)
    chunks.push(chunk)
  })
  attempt.stream.on('end', () => {
    res.end()
    if (range && chunks.length > 0) {
      writeToCache(baseUrl, range, Buffer.concat(chunks))
    }
  })
  attempt.stream.on('error', () => {
    if (!res.writableEnded) {
      res.end()
    }
  })
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url || '/'
  const method = req.method || 'GET'

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type'
    })
    res.end()
    return
  }

  const baseUrl = `http://127.0.0.1:${serverPort}`

  if (url.startsWith('/mpd/')) {
    const token = url.slice(5)
    const session = sessions.get(token)
    if (!session) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
      res.end('Session not found')
      return
    }
    const mpd = generateMpd(session, baseUrl)
    res.writeHead(200, {
      'Content-Type': 'application/dash+xml',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    })
    res.end(mpd)
    return
  }

  if (url.startsWith('/s/')) {
    const parts = url.slice(3).split('/')
    const token = parts[0]
    const bandwidth = parts[1]

    const session = sessions.get(token)
    if (!session) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
      res.end('Session not found')
      return
    }

    const allStreams = [...session.videoStreams, ...session.audioStreams]
    const stream = allStreams.find(s => s.bandwidth === parseInt(bandwidth, 10))
    if (!stream) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
      res.end('Stream not found')
      return
    }

    const range = req.headers['range'] as string | undefined
    proxyRequest(stream.baseUrl, stream.backupUrl, range, res)
    return
  }

  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
  res.end('Not found')
}

function lazyStartServer(): void {
  if (started) return
  started = true

  ensureCacheDir()

  server = createServer(handleRequest)

  server.listen(0, '127.0.0.1', () => {
    const addr = server?.address()
    if (addr && typeof addr === 'object') {
      serverPort = addr.port
      info('videoProxy', 'server_start', `Listening on 127.0.0.1:${serverPort}`)
    }
  })
}

export function startPlayback(
  bvid: string,
  cid: string,
  qn: number,
  qualities: { qn: number; description: string }[],
  videoStreams: StreamEntry[],
  audioStreams: StreamEntry[],
  duration: number
): string {
  lazyStartServer()

  for (const [t, s] of sessions) {
    if (s.bvid === bvid) {
      sessions.delete(t)
    }
  }

  const token = randomBytes(16).toString('hex')

  const session: PlaybackSession = {
    bvid,
    cid,
    qn,
    created: Date.now(),
    qualities,
    videoStreams,
    audioStreams,
    duration
  }

  sessions.set(token, session)

  info('videoProxy', 'playback_start', `bvid=${bvid} cid=${cid} qn=${qn} streams=${videoStreams.length+audioStreams.length}`)
  return token
}

export function updateSession(
  token: string,
  videoStreams: StreamEntry[],
  audioStreams: StreamEntry[],
  qualities: { qn: number; description: string }[],
  qn: number
): boolean {
  const session = sessions.get(token)
  if (!session) return false
  session.videoStreams = videoStreams
  session.audioStreams = audioStreams
  session.qualities = qualities
  session.qn = qn
  session.created = Date.now()
  if (videoStreams.length > 0) {
    const s = videoStreams[0]
    prefetchCache(s.baseUrl, s.backupUrl, `bytes=${s.segmentBase.Initialization}`)
  }
  return true
}

export function getManifestUrl(token: string): string {
  return `http://127.0.0.1:${serverPort}/mpd/${token}`
}

export function removePlayback(token: string): void {
  sessions.delete(token)
}

export function cleanupOldSessions(): void {
  const now = Date.now()
  for (const [token, session] of sessions) {
    if (now - session.created > 1800000) {
      sessions.delete(token)
    }
  }
}

setInterval(cleanupOldSessions, 600000)
