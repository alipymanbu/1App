import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getActualDataDir } from './dataRoot'
import { app, shell } from 'electron'
import { platform } from 'os'

const MAX_SIZE = 10 * 1024 * 1024
const MAX_FILES = 20
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const MIRROR_TO_CONSOLE = !!process.env.ONEAPP_LOG_CONSOLE

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogScope = 'app' | 'ipc' | 'network' | 'renderer' | 'videoProxy' | 'platform'

export interface LogEntry {
  level: LogLevel
  scope: LogScope
  event: string
  message?: string
  platform?: string
  url?: string
  method?: string
  statusCode?: number
  durationMs?: number
  bytes?: number
  error?: { name?: string; message: string; stack?: string }
  data?: Record<string, unknown>
}

let logDir = ''
let initialized = false

function getDateStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function resolveLogDir(): string {
  return join(getActualDataDir(), 'logs')
}

function logFilePath(): string {
  return join(logDir, `app-${getDateStr()}.log`)
}

function sanitizeUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url)
    const sensitive = ['csrf', 'token', 'access_key', 'sessionid', 'sid_guard', 'sid_tt', 'uid_tt', 'passport_auth_status', 'SESSDATA', 'DedeUserID', 'bili_jct', 'web_session']
    for (const p of sensitive) {
      if (u.searchParams.has(p)) u.searchParams.set(p, '***')
    }
    return u.toString()
  } catch {
    return url
  }
}

function serialize(entry: LogEntry): string {
  const o: Record<string, unknown> = {
    ts: new Date().toISOString(),
    pid: process.pid,
    level: entry.level,
    scope: entry.scope,
    event: entry.event
  }
  if (entry.message) o.message = entry.message
  if (entry.platform) o.platform = entry.platform
  if (entry.url) o.url = sanitizeUrl(entry.url)
  if (entry.method) o.method = entry.method
  if (entry.statusCode !== undefined) o.statusCode = entry.statusCode
  if (entry.durationMs !== undefined) o.durationMs = entry.durationMs
  if (entry.bytes !== undefined) o.bytes = entry.bytes
  if (entry.error) o.error = { name: entry.error.name, message: entry.error.message, stack: entry.error.stack }
  if (entry.data) {
    for (const [k, v] of Object.entries(entry.data)) o[k] = v
  }
  return JSON.stringify(o)
}

function writeLine(entry: LogEntry): void {
  if (!initialized) return
  const path = logFilePath()
  try {
    if (existsSync(path)) {
      const st = statSync(path)
      if (st.size > MAX_SIZE) {
        copyFileSync(path, path.replace('.log', `.${Date.now()}.log`))
        writeFileSync(path, '', 'utf-8')
      }
    }
    appendFileSync(path, serialize(entry) + '\n', 'utf-8')
  } catch {}
}

function cleanup(): void {
  try {
    if (!existsSync(logDir)) return
    const files = readdirSync(logDir).filter(f => f.startsWith('app-') && f.endsWith('.log')).sort()
    const now = Date.now()
    const expired: string[] = []
    const fresh: string[] = []
    for (const f of files) {
      const fp = join(logDir, f)
      try {
        if (statSync(fp).mtimeMs < now - RETENTION_MS) {
          expired.push(f)
        } else {
          fresh.push(f)
        }
      } catch { fresh.push(f) }
    }
    for (const f of expired) {
      try { unlinkSync(join(logDir, f)) } catch {}
    }
    while (fresh.length > MAX_FILES) {
      const f = fresh.shift()
      if (f) try { unlinkSync(join(logDir, f)) } catch {}
    }
  } catch {}
}

export function initLogger(): void {
  if (initialized) return
  logDir = resolveLogDir()
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
  cleanup()
  initialized = true
  if (MIRROR_TO_CONSOLE) console.info('[logger] initialized:', logDir)
}

export function debug(scope: LogScope, event: string, message?: string, extra?: Partial<LogEntry>): void {
  if (!initialized) return
  if (MIRROR_TO_CONSOLE) console.debug(`[${scope}] ${event}:`, message || '')
  writeLine({ level: 'debug', scope, event, message, ...extra })
}

export function info(scope: LogScope, event: string, message?: string, extra?: Partial<LogEntry>): void {
  if (!initialized) return
  if (MIRROR_TO_CONSOLE) console.info(`[${scope}] ${event}:`, message || '')
  writeLine({ level: 'info', scope, event, message, ...extra })
}

export function warn(scope: LogScope, event: string, message?: string, extra?: Partial<LogEntry>): void {
  if (!initialized) return
  if (MIRROR_TO_CONSOLE) console.warn(`[${scope}] ${event}:`, message || '')
  writeLine({ level: 'warn', scope, event, message, ...extra })
}

export function error(scope: LogScope, event: string, message?: string, err?: unknown, extra?: Partial<LogEntry>): void {
  if (!initialized) return
  const errObj = err instanceof Error
    ? { name: err.name, message: err.message, stack: err.stack }
    : err
      ? { name: 'UnknownError', message: String(err) }
      : undefined
  if (MIRROR_TO_CONSOLE) console.error(`[${scope}] ${event}:`, message || '', err || '')
  writeLine({ level: 'error', scope, event, message, error: errObj, ...extra })
}

export function networkLog(
  platform: string,
  method: string,
  url: string,
  statusCode: number,
  durationMs: number,
  bytes?: number,
  err?: unknown
): void {
  const level: LogLevel = statusCode >= 400 ? 'warn' : 'info'
  const entry: LogEntry = {
    level,
    scope: 'network',
    event: err ? 'request_error' : 'request_complete',
    platform,
    url,
    method,
    statusCode,
    durationMs,
    bytes
  }
  if (err) {
    entry.error = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { name: 'UnknownError', message: String(err) }
  }
  const prefix = `[${platform}] ${method} ${statusCode} ${err ? 'ERROR' : durationMs + 'ms'} ${url}`
  if (MIRROR_TO_CONSOLE) {
    if (level === 'warn') console.warn(prefix, err || '')
    else console.info(prefix)
  }
  writeLine(entry)
}

export function getLogDir(): string {
  return logDir
}

export async function openLogDirInExplorer(): Promise<void> {
  await shell.openPath(logDir)
}

export function getLogFiles(): { name: string; size: number; mtime: Date }[] {
  try {
    if (!existsSync(logDir)) return []
    return readdirSync(logDir).filter(f => f.endsWith('.log')).map(f => {
      try {
        const s = statSync(join(logDir, f))
        return { name: f, size: s.size, mtime: s.mtime }
      } catch { return null }
    }).filter(Boolean) as { name: string; size: number; mtime: Date }[]
  } catch { return [] }
}

export function clearAllLogs(): void {
  try {
    if (!existsSync(logDir)) return
    for (const f of readdirSync(logDir).filter(f => f.endsWith('.log'))) {
      try { unlinkSync(join(logDir, f)) } catch {}
    }
    info('app', 'logs_cleared', 'All log files cleared')
  } catch {}
}

export async function exportDiagnostics(): Promise<string | null> {
  const desktop = join(app.getPath('desktop'), `1App-diagnostics-${Date.now()}`)
  try {
    if (!existsSync(desktop)) mkdirSync(desktop, { recursive: true })
    if (existsSync(logDir)) {
      for (const f of readdirSync(logDir).filter(f => f.endsWith('.log'))) {
        try { copyFileSync(join(logDir, f), join(desktop, f)) } catch {}
      }
    }
    const sysInfo = {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: platform(),
      arch: process.arch,
      logDir,
      dataDir: getActualDataDir(),
      timestamp: new Date().toISOString()
    }
    writeFileSync(join(desktop, 'system-info.json'), JSON.stringify(sysInfo, null, 2), 'utf-8')
    return desktop
  } catch { return null }
}
