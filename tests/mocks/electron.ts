import { vi } from 'vitest'

export function createMockElectron() {
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return 'D:\\mock\\userData'
        if (name === 'desktop') return 'D:\\mock\\desktop'
        return `D:\\mock\\${name}`
      }),
      getVersion: vi.fn(() => '1.0.0-test'),
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      quit: vi.fn(),
      exit: vi.fn(),
      relaunch: vi.fn(),
      setPath: vi.fn(),
      setAppUserModelId: vi.fn()
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn()
    },
    BrowserWindow: vi.fn(() => ({
      loadURL: vi.fn(() => Promise.resolve()),
      webContents: {
        on: vi.fn(),
        executeJavaScript: vi.fn(() => Promise.resolve(null)),
        debugger: { isAttached: vi.fn(() => false), attach: vi.fn(), detach: vi.fn() },
        send: vi.fn()
      },
      on: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn(() => false)
    })),
    session: {
      fromPartition: vi.fn(() => ({
        cookies: { get: vi.fn(() => Promise.resolve([])) },
        clearStorageData: vi.fn(() => Promise.resolve())
      }))
    },
    net: {
      request: vi.fn(() => ({
        on: vi.fn(),
        end: vi.fn(),
        write: vi.fn()
      }))
    },
    shell: {
      openPath: vi.fn(() => Promise.resolve(''))
    },
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] }))
    }
  }
}
