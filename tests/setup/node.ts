import { vi } from 'vitest'

vi.mock('electron', () => {
  const mockApp = {
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
  }

  const mockIpcMain = {
    handle: vi.fn(),
    on: vi.fn()
  }

  const mockSession = {
    fromPartition: vi.fn(() => ({
      cookies: {
        get: vi.fn(() => Promise.resolve([])),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve())
      },
      clearStorageData: vi.fn(() => Promise.resolve()),
      request: vi.fn(() => {
        const req = {
          on: vi.fn((event, handler) => {
            if (event === 'response') {
              const res = {
                on: vi.fn((e, h) => {
                  if (e === 'data') h(Buffer.from('{}'))
                  if (e === 'end') h()
                }),
                statusCode: 200,
                headers: { 'content-type': 'application/json' }
              }
              handler(res)
            }
            return req
          }),
          end: vi.fn(),
          write: vi.fn()
        }
        return req
      })
    }))
  }

  const mockBrowserWindow = vi.fn(() => ({
    loadURL: vi.fn(() => Promise.resolve()),
    webContents: {
      on: vi.fn(),
      executeJavaScript: vi.fn(() => Promise.resolve(null)),
      debugger: { isAttached: vi.fn(() => false), attach: vi.fn(), detach: vi.fn() },
      send: vi.fn(),
      session: mockSession.fromPartition('persist:bilibili')
    },
    on: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    setBounds: vi.fn(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
    focus: vi.fn(),
    show: vi.fn(),
    hide: vi.fn()
  }))

  return {
    app: mockApp,
    ipcMain: mockIpcMain,
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn()
    },
    BrowserWindow: mockBrowserWindow,
    session: mockSession,
    contextBridge: {
      exposeInMainWorld: vi.fn()
    },
    net: {
      request: vi.fn(() => {
        const req = {
          on: vi.fn((event, handler) => {
            if (event === 'response') {
              const res = {
                on: vi.fn((e, h) => {
                  if (e === 'data') h(Buffer.from('{}'))
                  if (e === 'end') h()
                }),
                statusCode: 200,
                headers: { 'content-type': 'application/json' }
              }
              handler(res)
            }
            return req
          }),
          end: vi.fn(),
          write: vi.fn()
        }
        return req
      })
    },
    shell: {
      openPath: vi.fn(() => Promise.resolve(''))
    },
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] }))
    }
  }
})
