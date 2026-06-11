import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAppGetPath, mockAppRelaunch, mockAppExit, mockPlatformFns } = vi.hoisted(() => ({
  mockAppGetPath: vi.fn((name: string) => {
    if (name === 'userData') return 'D:\\mock\\userData'
    if (name === 'desktop') return 'D:\\mock\\desktop'
    return `D:\\mock\\${name}`
  }),
  mockAppRelaunch: vi.fn(),
  mockAppExit: vi.fn(),
  mockPlatformFns: {
    checkLogin: vi.fn((platform: string) => {
      if (platform === 'bilibili') return Promise.resolve({ loggedIn: true, profile: { platform: 'bilibili', nickname: 'BiliUser', avatar: '', uid: '123' } })
      return Promise.resolve({ loggedIn: false, profile: null })
    }),
    getProfile: vi.fn(() => Promise.resolve(null)),
    getFeed: vi.fn(() => Promise.resolve([])),
    getFollowings: vi.fn(() => Promise.resolve([])),
    getFollowingFeed: vi.fn(() => Promise.resolve([])),
    getFollowingsPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })),
    getFollowingFeedPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, hasMore: false })),
    getUserVideosPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })),
    getFavoriteFolders: vi.fn(() => Promise.resolve([])),
    getFavoriteVideosPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })),
    logout: vi.fn(() => Promise.resolve()),
    openLoginWindow: vi.fn(() => Promise.resolve({ loggedIn: true, profile: { platform: 'bilibili', nickname: 'Test', avatar: '', uid: '1' } })),
    getVideoPlayback: vi.fn(() => Promise.resolve({ bvid: '', cid: '', title: '', playable: false, error: '', qualities: [], defaultQuality: 0, manifestUrl: '', externalUrl: '' })),
    changeVideoQuality: vi.fn(() => Promise.resolve({ manifestUrl: '', defaultQuality: 80 })),
    getVideoInteraction: vi.fn(() => Promise.resolve({ liked: false, coined: false, favorited: false, stats: {} })),
    toggleVideoLike: vi.fn(() => Promise.resolve({ success: true })),
    addVideoCoin: vi.fn(() => Promise.resolve({ success: true })),
    toggleVideoFavorite: vi.fn(() => Promise.resolve({ success: true })),
    getVideoFavoriteFolders: vi.fn(() => Promise.resolve([])),
    updateVideoFavoriteFolders: vi.fn(() => Promise.resolve({ success: true })),
    createFavoriteFolder: vi.fn(() => Promise.resolve({ success: true, folder: { id: '1', title: 'Fav', count: 0 } })),
    getBiliVideoDetail: vi.fn(() => Promise.resolve(null)),
    getBiliVideoComments: vi.fn(() => Promise.resolve({ items: [], hasMore: false })),
    getBiliCommentReplies: vi.fn(() => Promise.resolve({ items: [], page: 1, hasMore: false })),
    getNoteDetail: vi.fn(() => Promise.resolve(null))
  }
}))

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  getLogDir: vi.fn(() => 'D:\\mock\\userData\\logs'),
  openLogDirInExplorer: vi.fn(() => Promise.resolve()),
  exportDiagnostics: vi.fn(() => Promise.resolve(null)),
  clearAllLogs: vi.fn()
}))

const mockRateLimiter = vi.hoisted(() => ({
  rateLimitConsume: vi.fn(() => Promise.resolve())
}))

const mockDataRoot = vi.hoisted(() => ({
  getStorageSettings: vi.fn(() => ({ dataRoot: 'D:\\mock\\userData', defaultDataRoot: 'D:\\mock\\userData', actualDataDir: 'D:\\mock\\userData', videoCacheDir: 'D:\\mock\\userData\\cache\\bili-video', isDefault: true, restartRequired: false })),
  chooseDataRoot: vi.fn(() => Promise.resolve({ dataRoot: 'D:\\new', defaultDataRoot: 'D:\\mock', actualDataDir: 'D:\\new\\1AppData', videoCacheDir: 'D:\\new\\1AppData\\cache\\bili-video', isDefault: false, restartRequired: true })),
  resetDataRoot: vi.fn(() => Promise.resolve({ dataRoot: 'D:\\mock\\userData', defaultDataRoot: 'D:\\mock\\userData', actualDataDir: 'D:\\mock\\userData', videoCacheDir: 'D:\\mock\\userData\\cache\\bili-video', isDefault: true, restartRequired: false })),
  clearVideoCache: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: mockAppGetPath,
    setPath: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    getVersion: vi.fn(() => '1.0.0-test'),
    quit: vi.fn(),
    exit: mockAppExit,
    relaunch: mockAppRelaunch
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: Object.assign(
    vi.fn(function () { return {
      loadURL: vi.fn(() => Promise.resolve()),
      webContents: { on: vi.fn(), executeJavaScript: vi.fn(() => Promise.resolve(null)), send: vi.fn(), isDestroyed: vi.fn(() => false) },
      on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false)
    }}),
    { fromWebContents: vi.fn() }
  ),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn(() => Promise.resolve('')) },
  dialog: { showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })) },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/logger', () => mockLogger)
vi.mock('../../../src/main/rateLimiter', () => mockRateLimiter)
vi.mock('../../../src/main/platforms', () => mockPlatformFns)
vi.mock('../../../src/main/dataRoot', () => mockDataRoot)

import { setupIpcHandlers } from '../../../src/main/ipc'

describe('ipc', () => {
  let ipcMain: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const electron = await import('electron')
    ipcMain = electron.ipcMain
    setupIpcHandlers()
  })

  function h(channel: string) {
    return ipcMain.handle.mock.calls.find((c: [string, Function]) => c[0] === channel)
  }

  function o(channel: string) {
    return ipcMain.on.mock.calls.find((c: [string, Function]) => c[0] === channel)
  }

  it('should register log-renderer', () => expect(o('log-renderer')).toBeDefined())

  it('log-renderer calls info for info level', () => {
    o('log-renderer')[1]({}, { level: 'info', message: 'test' })
    expect(mockLogger.info).toHaveBeenCalled()
  })

  it('log-renderer calls error for error level', () => {
    o('log-renderer')[1]({}, { level: 'error', message: 'err', stack: 's' })
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('log-renderer calls warn for warn level', () => {
    o('log-renderer')[1]({}, { level: 'warn', message: 'warn' })
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('should register all IPC handlers', () => {
    const chs = [
      'open-log-dir', 'export-logs', 'clear-logs', 'get-log-dir',
      'check-login', 'open-login', 'get-profile', 'get-feed',
      'get-followings', 'get-following-feed', 'get-followings-page',
      'get-following-feed-page', 'get-user-videos-page',
      'get-favorite-folders', 'get-favorite-videos-page',
      'get-storage-settings', 'choose-data-root', 'reset-data-root',
      'clear-video-cache', 'restart-app', 'get-xhs-note-detail',
      'get-video-playback', 'change-video-quality',
      'get-video-interaction', 'toggle-video-like', 'add-video-coin',
      'toggle-video-favorite', 'get-video-favorite-folders',
      'update-video-favorite-folders', 'create-favorite-folder',
      'get-bili-video-detail', 'get-bili-video-comments',
      'get-bili-comment-replies', 'logout'
    ]
    chs.forEach(ch => expect(h(ch)).toBeDefined())
  })

  it('get-feed with rate limiting for bilibili', async () => {
    await h('get-feed')[1]({}, 'bilibili', 1)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-feed')
  })

  it('get-feed without rate limiting for non-bilibili', async () => {
    await h('get-feed')[1]({}, 'xhs', 1)
    expect(mockRateLimiter.rateLimitConsume).not.toHaveBeenCalledWith('get-feed')
  })

  it('restart-app should relaunch and exit', async () => {
    await h('restart-app')[1]({})
    expect(mockAppRelaunch).toHaveBeenCalled()
    expect(mockAppExit).toHaveBeenCalledWith(0)
  })

  it('open-login should notify renderer', async () => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow()
    ;(BrowserWindow.fromWebContents as any).mockReturnValue(win)

    const event = { sender: { id: 1 } }
    await h('open-login')[1](event, 'bilibili')
    expect(win.webContents.send).toHaveBeenCalled()
  })

  it('logout should notify renderer', async () => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow()
    ;(BrowserWindow.fromWebContents as any).mockReturnValue(win)

    const event = { sender: { id: 1 } }
    await h('logout')[1](event, 'bilibili')
    expect(win.webContents.send).toHaveBeenCalledWith('login-status-changed', { platform: 'bilibili', success: false })
  })

  it('should log errors from handlers', async () => {
    mockPlatformFns.getFeed.mockRejectedValueOnce(new Error('net fail'))
    try { await h('get-feed')[1]({}, 'bilibili', 1) } catch {}
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('open-log-dir delegates', async () => {
    await h('open-log-dir')[1]({})
    expect(mockLogger.openLogDirInExplorer).toHaveBeenCalled()
  })

  it('export-logs delegates', async () => {
    mockLogger.exportDiagnostics.mockResolvedValueOnce('/tmp/diag')
    const result = await h('export-logs')[1]({})
    expect(mockLogger.exportDiagnostics).toHaveBeenCalled()
    expect(result).toBe('/tmp/diag')
  })

  it('clear-logs delegates', async () => {
    await h('clear-logs')[1]({})
    expect(mockLogger.clearAllLogs).toHaveBeenCalled()
  })

  it('get-log-dir delegates', async () => {
    const result = await h('get-log-dir')[1]({})
    expect(mockLogger.getLogDir).toHaveBeenCalled()
    expect(result).toBe('D:\\mock\\userData\\logs')
  })

  it('check-login delegates', async () => {
    const result = await h('check-login')[1]({}, 'bilibili')
    expect(mockPlatformFns.checkLogin).toHaveBeenCalledWith('bilibili')
    expect(result.loggedIn).toBe(true)
  })

  it('check-login with xhs', async () => {
    const result = await h('check-login')[1]({}, 'xhs')
    expect(mockPlatformFns.checkLogin).toHaveBeenCalledWith('xhs')
    expect(result.loggedIn).toBe(false)
  })

  it('get-profile delegates', async () => {
    await h('get-profile')[1]({}, 'bilibili')
    expect(mockPlatformFns.getProfile).toHaveBeenCalledWith('bilibili')
  })

  it('get-followings delegates', async () => {
    await h('get-followings')[1]({}, 'bilibili')
    expect(mockPlatformFns.getFollowings).toHaveBeenCalledWith('bilibili')
  })

  it('get-following-feed delegates', async () => {
    await h('get-following-feed')[1]({}, 'bilibili')
    expect(mockPlatformFns.getFollowingFeed).toHaveBeenCalledWith('bilibili')
  })

  it('get-followings-page delegates', async () => {
    await h('get-followings-page')[1]({}, 'bilibili', 1, 20)
    expect(mockPlatformFns.getFollowingsPage).toHaveBeenCalledWith('bilibili', 1, 20)
  })

  it('get-following-feed-page delegates', async () => {
    await h('get-following-feed-page')[1]({}, 'bilibili', 'offset', 15)
    expect(mockPlatformFns.getFollowingFeedPage).toHaveBeenCalledWith('bilibili', 'offset', 15)
  })

  it('get-user-videos-page delegates', async () => {
    await h('get-user-videos-page')[1]({}, 'bilibili', 'uid1', 2, 10)
    expect(mockPlatformFns.getUserVideosPage).toHaveBeenCalledWith('bilibili', 'uid1', 2, 10)
  })

  it('get-favorite-folders delegates', async () => {
    await h('get-favorite-folders')[1]({}, 'bilibili')
    expect(mockPlatformFns.getFavoriteFolders).toHaveBeenCalledWith('bilibili')
  })

  it('get-favorite-videos-page delegates', async () => {
    await h('get-favorite-videos-page')[1]({}, 'bilibili', 'm1', 2, 20)
    expect(mockPlatformFns.getFavoriteVideosPage).toHaveBeenCalledWith('bilibili', 'm1', 2, 20)
  })

  it('get-storage-settings delegates', async () => {
    const result = await h('get-storage-settings')[1]({})
    expect(mockDataRoot.getStorageSettings).toHaveBeenCalled()
    expect(result.dataRoot).toBe('D:\\mock\\userData')
  })

  it('choose-data-root delegates', async () => {
    const result = await h('choose-data-root')[1]({})
    expect(mockDataRoot.chooseDataRoot).toHaveBeenCalled()
    expect(result.restartRequired).toBe(true)
  })

  it('reset-data-root delegates', async () => {
    await h('reset-data-root')[1]({})
    expect(mockDataRoot.resetDataRoot).toHaveBeenCalled()
  })

  it('clear-video-cache delegates', async () => {
    await h('clear-video-cache')[1]({})
    expect(mockDataRoot.clearVideoCache).toHaveBeenCalled()
  })

  it('get-xhs-note-detail delegates', async () => {
    const result = await h('get-xhs-note-detail')[1]({}, 'n1', 'https://url')
    expect(mockPlatformFns.getNoteDetail).toHaveBeenCalledWith('xhs', 'n1', 'https://url')
    expect(result).toBeNull()
  })

  it('get-video-playback delegates', async () => {
    await h('get-video-playback')[1]({}, 'bilibili', 'BV1', 80)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-video-playback')
    expect(mockPlatformFns.getVideoPlayback).toHaveBeenCalledWith('bilibili', 'BV1', 80)
  })

  it('change-video-quality delegates', async () => {
    await h('change-video-quality')[1]({}, 'bilibili', 'BV1', 'c1', 80, 'tok')
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('change-video-quality')
    expect(mockPlatformFns.changeVideoQuality).toHaveBeenCalledWith('bilibili', 'BV1', 'c1', 80, 'tok')
  })

  it('get-video-interaction delegates', async () => {
    await h('get-video-interaction')[1]({}, 'bilibili', 'BV1', '1')
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-video-interaction')
    expect(mockPlatformFns.getVideoInteraction).toHaveBeenCalledWith('bilibili', 'BV1', '1')
  })

  it('toggle-video-like delegates', async () => {
    await h('toggle-video-like')[1]({}, 'bilibili', 'BV1', true)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('toggle-video-like')
    expect(mockPlatformFns.toggleVideoLike).toHaveBeenCalledWith('bilibili', 'BV1', true)
  })

  it('add-video-coin delegates', async () => {
    await h('add-video-coin')[1]({}, 'bilibili', 'BV1', '1', 2, true)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('add-video-coin')
    expect(mockPlatformFns.addVideoCoin).toHaveBeenCalledWith('bilibili', 'BV1', '1', 2, true)
  })

  it('toggle-video-favorite delegates', async () => {
    await h('toggle-video-favorite')[1]({}, 'bilibili', '1', true)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('toggle-video-favorite')
    expect(mockPlatformFns.toggleVideoFavorite).toHaveBeenCalledWith('bilibili', '1', true)
  })

  it('get-video-favorite-folders delegates', async () => {
    await h('get-video-favorite-folders')[1]({}, 'bilibili', '1')
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-video-favorite-folders')
    expect(mockPlatformFns.getVideoFavoriteFolders).toHaveBeenCalledWith('bilibili', '1')
  })

  it('update-video-favorite-folders delegates', async () => {
    await h('update-video-favorite-folders')[1]({}, 'bilibili', '1', ['add1'], ['del1'])
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('update-video-favorite-folders')
    expect(mockPlatformFns.updateVideoFavoriteFolders).toHaveBeenCalledWith('bilibili', '1', ['add1'], ['del1'])
  })

  it('create-favorite-folder delegates', async () => {
    await h('create-favorite-folder')[1]({}, 'bilibili', 'NewFolder')
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('create-favorite-folder')
    expect(mockPlatformFns.createFavoriteFolder).toHaveBeenCalledWith('bilibili', 'NewFolder')
  })

  it('get-bili-video-detail delegates', async () => {
    await h('get-bili-video-detail')[1]({}, 'bilibili', 'BV1', '1')
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-bili-video-detail')
    expect(mockPlatformFns.getBiliVideoDetail).toHaveBeenCalledWith('bilibili', 'BV1', '1')
  })

  it('get-bili-video-comments delegates', async () => {
    await h('get-bili-video-comments')[1]({}, 'bilibili', '1', 'hot', 'cursor', 20)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-bili-video-comments')
    expect(mockPlatformFns.getBiliVideoComments).toHaveBeenCalledWith('bilibili', '1', 'hot', 'cursor', 20)
  })

  it('get-bili-comment-replies delegates', async () => {
    await h('get-bili-comment-replies')[1]({}, 'bilibili', '1', 'r1', 2, 10)
    expect(mockRateLimiter.rateLimitConsume).toHaveBeenCalledWith('get-bili-comment-replies')
    expect(mockPlatformFns.getBiliCommentReplies).toHaveBeenCalledWith('bilibili', '1', 'r1', 2, 10)
  })

  it('should skip rate limiting for non-bilibili', async () => {
    await h('get-following-feed-page')[1]({}, 'xhs', 'o', 10)
    expect(mockRateLimiter.rateLimitConsume).not.toHaveBeenCalled()
    expect(mockPlatformFns.getFollowingFeedPage).toHaveBeenCalledWith('xhs', 'o', 10)
  })

  it('should handle handler errors without breaking other handlers', async () => {
    mockPlatformFns.checkLogin.mockRejectedValueOnce(new Error('login fail'))
    try { await h('check-login')[1]({}, 'bilibili') } catch {}
    expect(mockLogger.error).toHaveBeenCalled()
  })
})
