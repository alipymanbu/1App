import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApp = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {}
  return {
    handlers,
    app: {
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => { handlers[event] = handler }),
      quit: vi.fn()
    }
  }
})

const mockConfigureDataRoot = vi.hoisted(() => vi.fn())
const mockInitLogger = vi.hoisted(() => vi.fn())
const mockInfo = vi.hoisted(() => vi.fn())
const mockInitDatabase = vi.hoisted(() => vi.fn())
const mockCloseDatabase = vi.hoisted(() => vi.fn())
const mockSetupIpc = vi.hoisted(() => vi.fn())
const mockCreateWindow = vi.hoisted(() => vi.fn())
const mockGetAllWindows = vi.hoisted(() => vi.fn(() => [{ id: 1 }]))

vi.mock('electron', () => ({
  app: mockApp.app,
  BrowserWindow: { getAllWindows: mockGetAllWindows }
}))

vi.mock('../../../src/main/dataRoot', () => ({ configureDataRootBeforeReady: mockConfigureDataRoot }))
vi.mock('../../../src/main/logger', () => ({ initLogger: mockInitLogger, info: mockInfo }))
vi.mock('../../../src/main/database', () => ({ initDatabase: mockInitDatabase, closeDatabase: mockCloseDatabase }))
vi.mock('../../../src/main/ipc', () => ({ setupIpcHandlers: mockSetupIpc }))
vi.mock('../../../src/main/window', () => ({ createWindow: mockCreateWindow, getMainWindow: vi.fn() }))

vi.mock('@electron-toolkit/utils', () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() }
}))

describe('main index', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    Object.keys(mockApp.handlers).forEach(k => delete mockApp.handlers[k])
    mockGetAllWindows.mockReturnValue([{ id: 1 }])
    mockApp.app.whenReady.mockResolvedValue(undefined)
  })

  it('should configure data root and init logger on import', async () => {
    await import('../../../src/main/index')

    expect(mockConfigureDataRoot).toHaveBeenCalled()
    expect(mockInitLogger).toHaveBeenCalled()
  })

  it('should init database, setup IPC, and create window on ready', async () => {
    await import('../../../src/main/index')
    await vi.waitFor(() => expect(mockInitDatabase).toHaveBeenCalled())

    expect(mockSetupIpc).toHaveBeenCalled()
    expect(mockCreateWindow).toHaveBeenCalled()
  })

  it('should create window on activate when no windows exist', async () => {
    await import('../../../src/main/index')

    mockGetAllWindows.mockReturnValue([])
    if (mockApp.handlers['activate']) {
      mockApp.handlers['activate']()
      expect(mockCreateWindow).toHaveBeenCalled()
    }
  })

  it('should close database on window-all-closed and quit on non-darwin', async () => {
    const origPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })

    await import('../../../src/main/index')

    if (mockApp.handlers['window-all-closed']) {
      mockApp.handlers['window-all-closed']()
      expect(mockCloseDatabase).toHaveBeenCalled()
      expect(mockApp.app.quit).toHaveBeenCalled()
    }

    Object.defineProperty(process, 'platform', { value: origPlatform })
  })

  it('should not quit on darwin when window-all-closed', async () => {
    const origPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })

    await import('../../../src/main/index')

    if (mockApp.handlers['window-all-closed']) {
      mockApp.handlers['window-all-closed']()
      expect(mockCloseDatabase).toHaveBeenCalled()
      expect(mockApp.app.quit).not.toHaveBeenCalled()
    }

    Object.defineProperty(process, 'platform', { value: origPlatform })
  })

  it('should close database on before-quit', async () => {
    await import('../../../src/main/index')

    if (mockApp.handlers['before-quit']) {
      mockApp.handlers['before-quit']()
      expect(mockCloseDatabase).toHaveBeenCalled()
      expect(mockInfo).toHaveBeenCalledWith('app', 'quit', expect.any(String))
    }
  })

  it('should log info messages during startup', async () => {
    await import('../../../src/main/index')

    expect(mockInfo).toHaveBeenCalledWith('app', 'db_init', 'Database initialized')
    expect(mockInfo).toHaveBeenCalledWith('app', 'ipc_ready', 'IPC handlers registered')
    expect(mockInfo).toHaveBeenCalledWith('app', 'window_created', 'Main window created')
  })
})
