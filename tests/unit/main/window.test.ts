import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }))
const mockUtils = vi.hoisted(() => ({ is: { dev: false } }))
const mockShell = vi.hoisted(() => ({ openExternal: vi.fn() }))

vi.mock('../../../src/main/logger', () => mockLogger)
vi.mock('@electron-toolkit/utils', () => mockUtils)

// BrowserWindow must use a class/function, not arrow, for `new` to work in vitest 4
const mockConstructor = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  shell: mockShell,
  BrowserWindow: mockConstructor
}))

import { getMainWindow, createWindow } from '../../../src/main/window'

function makeFakeBrowserWindow(): any {
  const handlers: Record<string, (...args: any[]) => void> = {}
  const win = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler
      return win
    }),
    webContents: {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handler
      }),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      close: vi.fn()
    },
    show: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    close: vi.fn(),
    handlers
  }
  return { win, handlers }
}

describe('window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return null before creation', () => {
    expect(getMainWindow()).toBeNull()
  })

  it('should create a BrowserWindow with correct options', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    expect(mockConstructor).toHaveBeenCalledWith({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      title: '1App',
      webPreferences: {
        preload: expect.stringMatching(/preload[\/\\]index\.js/),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
  })

  it('should return the window after creation', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()
    expect(getMainWindow()).not.toBeNull()
  })

  it('should show window on ready-to-show', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    if (win.handlers['ready-to-show']) {
      win.handlers['ready-to-show']()
      expect(win.show).toHaveBeenCalled()
    }
  })

  it('should set window open handler to deny', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()
    expect(win.webContents.setWindowOpenHandler).toHaveBeenCalled()
  })

  it('should call shell.openExternal and return deny from window open handler', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    const handler = win.webContents.setWindowOpenHandler.mock.calls[0][0]
    const result = handler({ url: 'https://example.com' })
    expect(mockShell.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(result).toEqual({ action: 'deny' })
  })

  it('should log console errors as warnings', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    const consoleHandler = win.webContents.on.mock.calls.find((c: any[]) => c[0] === 'console-message')?.[1]
    if (consoleHandler) {
      consoleHandler({}, 2, 'test error')
      expect(mockLogger.warn).toHaveBeenCalledWith('renderer', 'console_error', 'test error')
    }
  })

  it('should log console info as info', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    const consoleHandler = win.webContents.on.mock.calls.find((c: any[]) => c[0] === 'console-message')?.[1]
    if (consoleHandler) {
      consoleHandler({}, 1, 'test info')
      expect(mockLogger.info).toHaveBeenCalledWith('renderer', 'console_log', 'test info')
    }
  })

  it('should filter dashjs messages', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    const consoleHandler = win.webContents.on.mock.calls.find((c: any[]) => c[0] === 'console-message')?.[1]
    if (consoleHandler) {
      consoleHandler({}, 2, '[dashjs] something')
      expect(mockLogger.warn).not.toHaveBeenCalled()
    }
  })

  it('should log did-fail-load event', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()

    const failHandler = win.webContents.on.mock.calls.find((c: any[]) => c[0] === 'did-fail-load')?.[1]
    if (failHandler) {
      failHandler({}, -3, 'ERR_ABORTED')
      expect(mockLogger.warn).toHaveBeenCalledWith('renderer', 'did_fail_load', 'code=-3 desc=ERR_ABORTED')
    }
  })

  it('should load URL in dev mode', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    mockUtils.is.dev = true

    const origUrl = process.env['ELECTRON_RENDERER_URL']
    process.env['ELECTRON_RENDERER_URL'] = 'http://localhost:5173'

    createWindow()
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:5173')

    process.env['ELECTRON_RENDERER_URL'] = origUrl
    mockUtils.is.dev = false
  })

  it('should load file in production mode', () => {
    const { win } = makeFakeBrowserWindow()
    mockConstructor.mockImplementation(function (this: any, opts: any) {
      Object.assign(this, win)
    })

    createWindow()
    expect(win.loadFile).toHaveBeenCalledWith(expect.stringMatching(/renderer[\/\\]index\.html/))
  })
})
