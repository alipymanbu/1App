import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAppGetPath, mockAppSetPath, mockFs } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    mockAppGetPath: vi.fn((name: string) => {
      if (name === 'userData') return 'D:\\mock\\userData'
      if (name === 'desktop') return 'D:\\mock\\desktop'
      return `D:\\mock\\${name}`
    }),
    mockAppSetPath: vi.fn(),
    mockFs: {
      existsSync: vi.fn((p: string) => p in store),
      readFileSync: vi.fn((p: string) => { if (!(p in store)) throw new Error(); return store[p] }),
      writeFileSync: vi.fn((p: string, data: string) => { store[p] = data }),
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      statSync: vi.fn(() => { throw new Error() }),
      copyFileSync: vi.fn(),
      __store: store,
      __resetStore: () => { Object.keys(store).forEach(k => delete store[k]) },
      __setStore: (data: Record<string, string>) => { Object.assign(store, data) }
    }
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: mockAppGetPath,
    setPath: mockAppSetPath,
    on: vi.fn(),
    whenReady: vi.fn(),
    getVersion: vi.fn(() => '1.0.0'),
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn()
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(function () { return { webContents: { on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) } }),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('fs', () => mockFs)

import {
  configureDataRootBeforeReady, getDefaultDataRoot, getCurrentDataRoot, getActualDataDir,
  getVideoCacheDir, getSettingsFilePath, getStoreFilePath, getStorageSettings,
  setDataRoot, resetDataRoot, clearVideoCache, chooseDataRoot
} from '../../../src/main/dataRoot'

function reapplyMocks() {
  mockFs.existsSync.mockImplementation((p: string) => p in mockFs.__store)
  mockFs.readFileSync.mockImplementation((p: string) => {
    if (!(p in mockFs.__store)) throw new Error()
    return mockFs.__store[p]
  })
  mockFs.writeFileSync.mockImplementation((p: string, data: string) => { mockFs.__store[p] = data })
  mockAppGetPath.mockImplementation((name: string) => {
    if (name === 'userData') return 'D:\\mock\\userData'
    if (name === 'desktop') return 'D:\\mock\\desktop'
    return `D:\\mock\\${name}`
  })
}

describe('dataRoot', () => {
  beforeEach(() => {
    mockFs.__resetStore()
    vi.clearAllMocks()
    reapplyMocks()
  })

  it('should configure with default path', () => {
    configureDataRootBeforeReady()
    expect(getDefaultDataRoot()).toBe('D:\\mock\\userData')
  })

  it('should configure with pointer path when pointer exists', () => {
    mockFs.__setStore({ 'D:\\mock\\userData\\data-location.json': JSON.stringify({ dataRoot: 'D:\\custom' }) })
    configureDataRootBeforeReady()
    expect(mockAppSetPath).toHaveBeenCalledWith('userData', 'D:\\custom\\1AppData')
  })

  it('should handle corrupted pointer gracefully', () => {
    mockFs.__setStore({ 'D:\\mock\\userData\\data-location.json': 'not-json' })
    configureDataRootBeforeReady()
    expect(mockAppSetPath).not.toHaveBeenCalled()
  })

  it('should return default data root', () => {
    configureDataRootBeforeReady()
    expect(getDefaultDataRoot()).toBe('D:\\mock\\userData')
  })

  it('should return current data root as default when no pointer', () => {
    configureDataRootBeforeReady()
    expect(getCurrentDataRoot()).toBe('D:\\mock\\userData')
  })

  it('should get actual data dir', () => {
    expect(getActualDataDir()).toBe('D:\\mock\\userData')
  })

  it('should get video cache dir', () => {
    expect(getVideoCacheDir()).toContain('cache')
  })

  it('should get settings file path', () => {
    expect(getSettingsFilePath()).toContain('settings.json')
  })

  it('should get store file path', () => {
    expect(getStoreFilePath()).toContain('feedhub-store.json')
  })

  it('should get storage settings', () => {
    configureDataRootBeforeReady()
    const s = getStorageSettings()
    expect(s.dataRoot).toBeDefined()
    expect(s.isDefault).toBe(true)
  })

  it('should set data root with migration', () => {
    configureDataRootBeforeReady()
    const result = setDataRoot('D:\\other\\path', { migrate: true })
    expect(result.dataRoot).toBe('D:\\other\\path')
    expect(result.restartRequired).toBe(true)
  })

  it('should handle unwritable target', () => {
    configureDataRootBeforeReady()
    mockFs.writeFileSync = vi.fn(() => { throw new Error('EACCES') })
    const result = setDataRoot('D:\\bad')
    expect(result.error).toBeDefined()
    reapplyMocks()
  })

  it('should reset data root to default', () => {
    configureDataRootBeforeReady()
    const result = resetDataRoot()
    expect(result.dataRoot).toBeDefined()
  })

  it('should clear video cache', () => {
    const cacheDir = getVideoCacheDir()
    mockFs.__setStore({ [cacheDir]: '' })
    clearVideoCache()
    expect(mockFs.rmSync).toHaveBeenCalled()
  })

  it('should skip migration when migrate=false', () => {
    configureDataRootBeforeReady()
    const result = setDataRoot('D:\\other\\path', { migrate: false })
    expect(result.dataRoot).toBe('D:\\other\\path')
    expect(result.restartRequired).toBe(true)
  })

  it('should handle migration failure', () => {
    configureDataRootBeforeReady()
    mockFs.__setStore({ 'D:\\mock\\userData': '', 'D:\\mock\\userData\\somefile': '' })
    mockFs.readdirSync = vi.fn(() => { throw new Error('read error') })
    const result = setDataRoot('D:\\other\\path')
    expect(result.error).toBeDefined()
  })


  it('should handle readPointer parse error', () => {
    configureDataRootBeforeReady()
    mockFs.__setStore({ 'D:\\mock\\userData\\data-location.json': '{invalid}' })
    expect(getCurrentDataRoot()).toBe('D:\\mock\\userData')
  })

  it('getStorageSettings with non-default path', () => {
    configureDataRootBeforeReady()
    setDataRoot('D:\\other\\path')
    const s = getStorageSettings()
    expect(s.isDefault).toBe(false)
  })

  it('chooseDataRoot canceled', async () => {
    const result = await chooseDataRoot()
    expect(result.restartRequired).toBe(false)
  })

  it('chooseDataRoot selected', async () => {
    configureDataRootBeforeReady()
    const { dialog } = await import('electron')
    ;(dialog as any).showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['D:\\chosen'] })
    const result = await chooseDataRoot()
    expect(result.dataRoot).toBe('D:\\chosen')
  })

  it('should return early when data root is already set to same path', () => {
    configureDataRootBeforeReady()
    mockAppGetPath.mockImplementation((name: string) => {
      if (name === 'userData') return 'D:\\mock\\userData\\1AppData'
      return `D:\\mock\\${name}`
    })
    const result = setDataRoot('D:\\mock\\userData')
    expect(result.restartRequired).toBeFalsy()
    reapplyMocks()
  })

  it('should copy files recursively during migration and skip pointer file', () => {
    configureDataRootBeforeReady()
    const src = 'D:\\mock\\userData'
    mockFs.__setStore({
      [src]: '',
      [src + '\\vid.mp4']: 'video',
      [src + '\\sub']: '',
      [src + '\\sub\\pic.jpg']: 'image',
      [src + '\\data-location.json']: 'pointer'
    })
    mockFs.readdirSync = vi.fn((p: string) => {
      if (p === src) return ['vid.mp4', 'sub', 'data-location.json']
      if (p === src + '\\sub') return ['pic.jpg']
      throw new Error('unexpected ' + p)
    })
    const dirs: Record<string, boolean> = {
      [src + '\\vid.mp4']: false,
      [src + '\\sub']: true,
      [src + '\\sub\\pic.jpg']: false,
      [src + '\\data-location.json']: false,
    }
    mockFs.statSync = vi.fn((p: string) => ({
      isDirectory: () => dirs[p] || false,
      size: 10, mtimeMs: Date.now(), mtime: new Date()
    }))
    const result = setDataRoot('D:\\other\\path', { migrate: true })
    expect(result.dataRoot).toBe('D:\\other\\path')
    expect(mockFs.copyFileSync).toHaveBeenCalled()
    expect(mockFs.copyFileSync.mock.calls.some((c: string[]) => c[0].includes('vid.mp4'))).toBe(true)
    expect(mockFs.copyFileSync.mock.calls.some((c: string[]) => c[0].includes('pic.jpg'))).toBe(true)
    expect(mockFs.copyFileSync.mock.calls.some((c: string[]) => c[0].includes('data-location.json'))).toBe(false)
  })

  it('should handle null dataRoot in pointer gracefully', () => {
    mockFs.__setStore({ 'D:\\mock\\userData\\data-location.json': JSON.stringify({ dataRoot: null }) })
    configureDataRootBeforeReady()
    expect(mockAppSetPath).not.toHaveBeenCalled()
    expect(getDefaultDataRoot()).toBe('D:\\mock\\userData')
  })
})
