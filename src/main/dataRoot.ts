import { app, dialog } from 'electron'
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, rmSync,
  readdirSync, statSync, copyFileSync
} from 'fs'
import { join, normalize } from 'path'
import type { StorageSettings } from '../shared/types'

const POINTER_FILE = 'data-location.json'
const APP_DATA_DIR = '1AppData'
const CACHE_DIR_NAME = 'cache'
const VIDEO_CACHE_SUBDIR = 'bili-video'

let defaultUserDataPath = ''

export function configureDataRootBeforeReady(): void {
  defaultUserDataPath = app.getPath('userData')

  const pointerPath = join(defaultUserDataPath, POINTER_FILE)
  if (existsSync(pointerPath)) {
    try {
      const raw = readFileSync(pointerPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed.dataRoot && typeof parsed.dataRoot === 'string') {
        const newUserData = join(parsed.dataRoot, APP_DATA_DIR)
        app.setPath('userData', newUserData)
        // info only logged to file after initLogger
      }
    } catch (err) {
      console.warn('[dataRoot] failed to read pointer:', err)
    }
  }
}

function getPointerPath(): string {
  return join(defaultUserDataPath, POINTER_FILE)
}

function readPointer(): { dataRoot: string } | null {
  const p = getPointerPath()
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function writePointer(dataRoot: string): void {
  const p = getPointerPath()
  if (!existsSync(defaultUserDataPath)) {
    mkdirSync(defaultUserDataPath, { recursive: true })
  }
  writeFileSync(p, JSON.stringify({ dataRoot }, null, 2), 'utf-8')
}

function removePointer(): void {
  const p = getPointerPath()
  if (existsSync(p)) rmSync(p)
}

function pathsEqual(a: string, b: string): boolean {
  try {
    return normalize(a).toLowerCase() === normalize(b).toLowerCase()
  } catch {
    return a === b
  }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function copyRecursive(src: string, dest: string): void {
  if (!existsSync(src)) return
  ensureDir(dest)
  const entries = readdirSync(src)
  for (const entry of entries) {
    if (entry === POINTER_FILE) continue
    const srcPath = join(src, entry)
    const destPath = join(dest, entry)
    const s = statSync(srcPath)
    if (s.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function removeDir(dir: string): void {
  if (!existsSync(dir)) return
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (err) {
    // dir removal failure — error returned upstream
  }
}

export function getDefaultDataRoot(): string {
  return defaultUserDataPath
}

export function getCurrentDataRoot(): string {
  const pointer = readPointer()
  return pointer?.dataRoot || defaultUserDataPath
}

export function getActualDataDir(): string {
  return app.getPath('userData')
}

export function getVideoCacheDir(): string {
  return join(getActualDataDir(), CACHE_DIR_NAME, VIDEO_CACHE_SUBDIR)
}

export function getSettingsFilePath(): string {
  return join(getActualDataDir(), 'settings.json')
}

export function getStoreFilePath(): string {
  return join(getActualDataDir(), 'feedhub-store.json')
}

export function getStorageSettings(): StorageSettings {
  const dataRoot = getCurrentDataRoot()
  const defRoot = defaultUserDataPath
  return {
    dataRoot,
    defaultDataRoot: defRoot,
    actualDataDir: getActualDataDir(),
    videoCacheDir: getVideoCacheDir(),
    isDefault: pathsEqual(dataRoot, defRoot)
  }
}

export function setDataRoot(
  newDataRoot: string,
  options?: { migrate?: boolean }
): StorageSettings {
  const defRoot = defaultUserDataPath
  const oldAppDataDir = getActualDataDir()
  const newAppDataDir = join(newDataRoot, APP_DATA_DIR)

  if (pathsEqual(oldAppDataDir, newAppDataDir)) {
    return { ...getStorageSettings(), restartRequired: false }
  }

  try {
    ensureDir(newAppDataDir)
    const testPath = join(newAppDataDir, '.write-test')
    writeFileSync(testPath, '')
    rmSync(testPath)
  } catch (err) {
    // not writable — error returned in result
    return { ...getStorageSettings(), restartRequired: false, error: '目标目录不可写，请选择其他位置' }
  }

  if (options?.migrate !== false) {
    try {
      copyRecursive(oldAppDataDir, newAppDataDir)
    } catch (err) {
      // migration failed — error returned in result
      return { ...getStorageSettings(), restartRequired: false, error: '数据迁移失败，请重试' }
    }
  }

  writePointer(newDataRoot)

  return {
    dataRoot: newDataRoot,
    defaultDataRoot: defRoot,
    actualDataDir: newAppDataDir,
    videoCacheDir: join(newAppDataDir, CACHE_DIR_NAME, VIDEO_CACHE_SUBDIR),
    isDefault: pathsEqual(newDataRoot, defRoot),
    restartRequired: true
  }
}

export function resetDataRoot(): StorageSettings {
  return setDataRoot(defaultUserDataPath)
}

export async function chooseDataRoot(): Promise<StorageSettings> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择数据与缓存目录'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { ...getStorageSettings(), restartRequired: false }
  }
  return setDataRoot(result.filePaths[0])
}

export function clearVideoCache(): void {
  removeDir(getVideoCacheDir())
}
