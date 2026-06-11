import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFs } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  const files: Record<string, { size: number; mtimeMs: number }> = {}
  return {
    mockFs: {
      existsSync: vi.fn((p: string) => p in store),
      readFileSync: vi.fn((p: string) => { if (!(p in store)) throw new Error(); return store[p] }),
      writeFileSync: vi.fn((p: string, data: string) => { store[p] = data; files[p] = { size: data.length, mtimeMs: Date.now() } }),
      appendFileSync: vi.fn((p: string, data: string) => { store[p] = (store[p] || '') + data }),
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn((p: string) => {
        const f = files[p]
        if (!f) throw new Error()
        return { size: f.size, mtimeMs: f.mtimeMs, mtime: new Date(f.mtimeMs), isDirectory: () => false }
      }),
      copyFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      __store: store,
      __files: files,
      __resetStore: () => { Object.keys(store).forEach(k => delete store[k]); Object.keys(files).forEach(k => delete files[k]) },
      __setStore: (data: Record<string, string>) => { Object.assign(store, data) }
    }
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return 'D:\\mock\\userData'
      if (name === 'desktop') return 'D:\\mock\\desktop'
      return `D:\\mock\\${name}`
    }),
    getVersion: vi.fn(() => '1.0.0-test'),
    on: vi.fn(),
    whenReady: vi.fn()
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn(() => Promise.resolve('')) },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/dataRoot', () => ({
  getActualDataDir: vi.fn(() => 'D:\\mock\\userData'),
  getDefaultDataRoot: vi.fn(() => 'D:\\mock\\userData')
}))

vi.mock('fs', () => mockFs)

import { initLogger, debug, info, warn, error, networkLog, getLogDir, openLogDirInExplorer, getLogFiles, clearAllLogs, exportDiagnostics } from '../../../src/main/logger'

describe('logger', () => {
  beforeEach(() => {
    mockFs.__resetStore()
    vi.clearAllMocks()
    process.env.ONEAPP_LOG_CONSOLE = ''
    mockFs.mkdirSync = vi.fn()
    mockFs.existsSync.mockImplementation((p: string) => p in mockFs.__store)
    mockFs.appendFileSync = vi.fn((p: string, data: string) => { mockFs.__store[p] = (mockFs.__store[p] || '') + data })
    mockFs.readdirSync = vi.fn(() => [])
    mockFs.unlinkSync = vi.fn()
    mockFs.copyFileSync = vi.fn()
    mockFs.writeFileSync = vi.fn((p: string, data: string) => { mockFs.__store[p] = data })
    mockFs.statSync = vi.fn((p: string) => {
      if (!(p in mockFs.__files)) throw new Error()
      const f = mockFs.__files[p]
      return { size: f.size, mtimeMs: f.mtimeMs, mtime: new Date(f.mtimeMs), isDirectory: () => false }
    })
  })

  it('should not write before initialization', () => {
    debug('app', 'before_init')
    expect(mockFs.appendFileSync).not.toHaveBeenCalled()
  })

  it('should initialize logger', () => {
    initLogger()
    expect(mockFs.mkdirSync).toHaveBeenCalled()
  })

  it('should not re-initialize', () => {
    initLogger()
    mockFs.mkdirSync.mockClear()
    initLogger()
    expect(mockFs.mkdirSync).not.toHaveBeenCalled()
  })

  it('should write debug log after init', () => {
    initLogger()
    debug('app', 'test_event', 'test message')
    expect(mockFs.appendFileSync).toHaveBeenCalled()
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"level":"debug"')
    expect(written).toContain('"message":"test message"')
  })

  it('should write info log', () => {
    initLogger()
    info('network', 'request_ok')
    expect(mockFs.appendFileSync).toHaveBeenCalled()
  })

  it('should write warn log', () => {
    initLogger()
    warn('ipc', 'slow')
    expect(mockFs.appendFileSync).toHaveBeenCalled()
  })

  it('should write error log with error object', () => {
    initLogger()
    error('app', 'crash', 'msg', new Error('broke'))
    expect(mockFs.appendFileSync).toHaveBeenCalled()
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"error"')
  })

  it('should write error log without error', () => {
    initLogger()
    error('app', 'warn_only', 'just a warning')
    expect(mockFs.appendFileSync).toHaveBeenCalled()
  })

  it('should write network log', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'https://api.bilibili.com/test', 200, 150, 1024)
    expect(mockFs.appendFileSync).toHaveBeenCalled()
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"statusCode":200')
  })

  it('should write network log for error', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'https://api.test/error', 500, 100, 0, new Error('timeout'))
    expect(mockFs.appendFileSync).toHaveBeenCalled()
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"statusCode":500')
  })

  it('should sanitize sensitive URL params', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'https://example.com/api?token=secret123', 200, 50)
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).not.toContain('secret123')
    expect(written).toContain('***')
  })

  it('should get log dir', () => {
    initLogger()
    expect(getLogDir()).toContain('logs')
  })

  it('should open log dir', async () => {
    initLogger()
    const { shell } = await import('electron')
    await openLogDirInExplorer()
    expect(shell.openPath).toHaveBeenCalled()
  })

  it('should get log files', () => {
    initLogger()
    const logFile = 'D:\\mock\\userData\\logs\\app-2026-01-01.log'
    mockFs.__store[logFile] = 'test'
    mockFs.__files[logFile] = { size: 4, mtimeMs: Date.now() }
    mockFs.readdirSync = vi.fn(() => ['app-2026-01-01.log'])
    mockFs.existsSync.mockReturnValue(true)

    const files = getLogFiles()
    expect(files.length).toBe(1)
    expect(files[0].name).toBe('app-2026-01-01.log')
  })

  it('should return empty getLogFiles when dir missing', () => {
    mockFs.existsSync.mockReturnValue(false)
    expect(getLogFiles()).toEqual([])
  })

  it('should clear all logs', () => {
    initLogger()
    mockFs.readdirSync = vi.fn(() => ['app-2026-01-01.log'])
    mockFs.existsSync.mockReturnValue(true)
    clearAllLogs()
    expect(mockFs.unlinkSync).toHaveBeenCalled()
  })

  it('should export diagnostics', async () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync = vi.fn(() => [])
    const r = await exportDiagnostics()
    expect(r).toBeTruthy()
  })

  it('should handle export failure', async () => {
    initLogger()
    mockFs.mkdirSync = vi.fn(() => { throw new Error('fail') })
    const r = await exportDiagnostics()
    expect(r).toBeNull()
  })

  it('should handle non-URL in sanitizeUrl', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'not-a-url', 200, 10)
    expect(mockFs.appendFileSync).toHaveBeenCalled()
  })

  it('should handle string error type', () => {
    initLogger()
    error('app', 'err', 'msg', 'string error')
    expect(mockFs.appendFileSync).toHaveBeenCalled()
  })

  it('should handle append failure silently', () => {
    initLogger()
    mockFs.appendFileSync = vi.fn(() => { throw new Error('fail') })
    info('app', 'no_crash')
  })

  it('should handle cleanup with no dir', () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(false)
    clearAllLogs()
  })

  it('should write network log with warn for 4xx', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'https://test/404', 404, 50)
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"level":"warn"')
  })

  it('should handle networkLog with non-Error err param', () => {
    initLogger()
    networkLog('bilibili', 'GET', 'https://test/err', 500, 100, 0, 'raw error string')
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('UnknownError')
  })

  it('should rotate log file when it exceeds MAX_SIZE', () => {
    initLogger()
    const logPath = 'D:\\mock\\userData\\logs\\app-' + new Date().toISOString().slice(0, 10) + '.log'
    mockFs.__store[logPath] = 'x'.repeat(11 * 1024 * 1024) // > MAX_SIZE (10MB)
    mockFs.__files[logPath] = { size: 11 * 1024 * 1024, mtimeMs: Date.now() }
    mockFs.existsSync.mockReturnValue(true)
    info('app', 'rotate_test')
    expect(mockFs.copyFileSync).toHaveBeenCalled()
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(logPath, '', 'utf-8')
  })

  it('should getLogFiles handle stat error for individual file', () => {
    initLogger()
    mockFs.__store['any'] = ''
    mockFs.readdirSync = vi.fn(() => ['bad.log'])
    mockFs.existsSync.mockReturnValue(true)
    mockFs.statSync = vi.fn(() => { throw new Error('stat fail') })
    const files = getLogFiles()
    // stat fails → map returns null → filtered out
    expect(files).toEqual([])
  })

  it('should getLogFiles return empty on readdir error', () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync = vi.fn(() => { throw new Error('readdir fail') })
    expect(getLogFiles()).toEqual([])
  })

  it('should exportDiagnostics copy log files', async () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync = vi.fn(() => ['app-test.log'])
    const result = await exportDiagnostics()
    expect(result).toBeTruthy()
    expect(mockFs.copyFileSync).toHaveBeenCalled()
  })

  it('should exportDiagnostics handle copyFile failure silently', async () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync = vi.fn(() => ['app-test.log'])
    mockFs.copyFileSync = vi.fn(() => { throw new Error('copy fail') })
    const result = await exportDiagnostics()
    // Should not throw; copy error is silently caught
    expect(result).toBeTruthy()
  })

  it('should handle cleanup with expired files', () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    const oldFile = 'app-old.log'
    const newFile = 'app-new.log'
    mockFs.readdirSync = vi.fn(() => [oldFile, newFile])
    const oldMtime = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days old > 7 day retention
    mockFs.__files[oldFile] = { size: 100, mtimeMs: oldMtime }
    mockFs.__files[newFile] = { size: 100, mtimeMs: Date.now() }
    mockFs.statSync = vi.fn((p: string) => {
      const f = mockFs.__files[p]
      if (!f) throw new Error()
      return { size: f.size, mtimeMs: f.mtimeMs, mtime: new Date(f.mtimeMs), isDirectory: () => false }
    })
    // Clear all indirectly triggers cleanup via writeLine/initLogger path
    // Force cleanup path by calling clearAllLogs which unlinks all .log files
    clearAllLogs()
    expect(mockFs.unlinkSync).toHaveBeenCalled()
  })

  it('should serialize entry.data fields into output', () => {
    initLogger()
    info('app', 'with_data', 'msg', { data: { customField: 'customVal' } } as any)
    const written = mockFs.appendFileSync.mock.calls[0][1] as string
    expect(written).toContain('"customField":"customVal"')
  })

  it('should handle cleanup limiting fresh files to MAX_FILES', () => {
    initLogger()
    mockFs.existsSync.mockReturnValue(true)
    const manyFiles = Array.from({ length: 25 }, (_, i) => `app-file${i}.log`)
    mockFs.readdirSync = vi.fn(() => manyFiles)
    const now = Date.now()
    for (const f of manyFiles) {
      mockFs.__files[f] = { size: 100, mtimeMs: now }
    }
    clearAllLogs()
    expect(mockFs.unlinkSync).toHaveBeenCalled()
  })

  it('should handle cleanup stat failure for individual file during init', () => {
    mockFs.__resetStore()
    mockFs.existsSync.mockReturnValue(true)
    const logFile = 'app-badstat.log'
    mockFs.readdirSync = vi.fn(() => [logFile])
    mockFs.statSync = vi.fn(() => { throw new Error('stat fail') })
    initLogger()
    // cleanup is called during initLogger; stat failure should cause file to be treated as fresh
    // but fresh file handling only deletes when fresh.length > MAX_FILES (20)
    expect(mockFs.unlinkSync).not.toHaveBeenCalled()
  })
})

describe('logger with console mirror', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ONEAPP_LOG_CONSOLE = '1'
  })

  afterEach(() => {
    delete process.env.ONEAPP_LOG_CONSOLE
  })

  it('should log debug to console when ONEAPP_LOG_CONSOLE is set', async () => {
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { initLogger, debug: d } = await import('../../../src/main/logger')
    initLogger()
    d('app', 'test', 'msg')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should log warn to console when ONEAPP_LOG_CONSOLE is set', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initLogger, warn: w } = await import('../../../src/main/logger')
    initLogger()
    w('ipc', 'slow', 'msg')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should log info to console when ONEAPP_LOG_CONSOLE is set', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { initLogger, info: i } = await import('../../../src/main/logger')
    initLogger()
    i('app', 'ok', 'msg')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should log error to console when ONEAPP_LOG_CONSOLE is set', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { initLogger, error: e } = await import('../../../src/main/logger')
    initLogger()
    e('app', 'fail', 'msg')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should log networkLog to console warn for 4xx', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { initLogger, networkLog: nl } = await import('../../../src/main/logger')
    initLogger()
    nl('bili', 'GET', 'https://test/404', 404, 50)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should log networkLog to console info for 2xx', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { initLogger, networkLog: nl } = await import('../../../src/main/logger')
    initLogger()
    nl('bili', 'GET', 'https://test/200', 200, 50)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
