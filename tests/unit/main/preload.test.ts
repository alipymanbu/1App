import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExposeInMainWorld = vi.hoisted(() => vi.fn())
const mockInvoke = vi.hoisted(() => vi.fn())
const mockOn = vi.hoisted(() => vi.fn())
const mockRemoveListener = vi.hoisted(() => vi.fn())
const mockSend = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
  ipcRenderer: { invoke: mockInvoke, on: mockOn, removeListener: mockRemoveListener, send: mockSend }
}))

async function importPreload() {
  await import('../../../src/preload/index')
  return mockExposeInMainWorld.mock.calls[0]?.[1]
}

describe('preload', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should expose electronApi via contextBridge', async () => {
    const api = await importPreload()

    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(mockExposeInMainWorld).toHaveBeenCalledWith('electronApi', expect.any(Object))
    expect(api).toBeDefined()
  })

  it('should expose all expected API methods', async () => {
    const api = await importPreload()

    const expectedMethods = [
      'checkLogin', 'openLogin', 'getProfile', 'getFeed',
      'getXhsNoteDetail', 'getBiliVideoDetail', 'getBiliVideoComments',
      'getBiliCommentReplies', 'logout', 'getFollowings',
      'getFollowingFeed', 'getFollowingsPage', 'getFollowingFeedPage',
      'getUserVideosPage', 'getFavoriteFolders', 'getFavoriteVideosPage',
      'getVideoPlayback', 'changeVideoQuality', 'getVideoInteraction',
      'toggleVideoLike', 'addVideoCoin', 'toggleVideoFavorite',
      'getVideoFavoriteFolders', 'updateVideoFavoriteFolders',
      'createFavoriteFolder', 'getStorageSettings', 'chooseDataRoot',
      'resetDataRoot', 'clearVideoCache', 'restartApp',
      'onLoginStatusChanged', 'logRenderer', 'openLogDir',
      'exportLogs', 'clearLogs', 'getLogDir'
    ]

    for (const method of expectedMethods) {
      expect(api).toHaveProperty(method)
      expect(typeof api[method]).toBe('function')
    }
  })

  it('checkLogin should invoke check-login IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ loggedIn: false })
    const result = await api.checkLogin('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('check-login', 'bilibili')
    expect(result).toEqual({ loggedIn: false })
  })

  it('openLogin should invoke open-login IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ loggedIn: true })
    const result = await api.openLogin('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('open-login', 'bilibili')
    expect(result).toEqual({ loggedIn: true })
  })

  it('getProfile should invoke get-profile IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ nickname: 'Test', uid: '123' })
    const result = await api.getProfile('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('get-profile', 'bilibili')
    expect(result).toEqual({ nickname: 'Test', uid: '123' })
  })

  it('getFeed should invoke get-feed IPC with page', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce([])
    await api.getFeed('bilibili', 2)
    expect(mockInvoke).toHaveBeenCalledWith('get-feed', 'bilibili', 2)
  })

  it('logout should invoke logout IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce(undefined)
    await api.logout('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('logout', 'bilibili')
  })

  it('getFollowings should invoke get-followings IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce([])
    await api.getFollowings('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('get-followings', 'bilibili')
  })

  it('getVideoPlayback should invoke get-video-playback IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ playable: true })
    const result = await api.getVideoPlayback('BV1xx', 80)
    expect(mockInvoke).toHaveBeenCalledWith('get-video-playback', 'bilibili', 'BV1xx', 80)
    expect(result).toEqual({ playable: true })
  })

  it('getStorageSettings should invoke get-storage-settings IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ dataRoot: '/data' })
    const result = await api.getStorageSettings()
    expect(mockInvoke).toHaveBeenCalledWith('get-storage-settings')
    expect(result).toEqual({ dataRoot: '/data' })
  })

  it('restartApp should invoke restart-app IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce(undefined)
    await api.restartApp()
    expect(mockInvoke).toHaveBeenCalledWith('restart-app')
  })

  it('onLoginStatusChanged should register and return cleanup', async () => {
    const api = await importPreload()
    const callback = vi.fn()
    const cleanup = api.onLoginStatusChanged(callback)

    expect(mockOn).toHaveBeenCalledWith('login-status-changed', expect.any(Function))

    const handler = mockOn.mock.calls[0][1]
    handler({}, { platform: 'bilibili', loggedIn: true })
    expect(callback).toHaveBeenCalledWith({ platform: 'bilibili', loggedIn: true })

    cleanup()
    expect(mockRemoveListener).toHaveBeenCalledWith('login-status-changed', handler)
  })

  it('logRenderer should send log-renderer IPC', async () => {
    const api = await importPreload()
    const entry = { level: 'info' as const, message: 'test', context: 'test' }
    api.logRenderer(entry)
    expect(mockSend).toHaveBeenCalledWith('log-renderer', entry)
  })

  it('changeVideoQuality should invoke change-video-quality IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ manifestUrl: 'test.mpd' })
    const result = await api.changeVideoQuality('BV1xx', 'cid123', 80, 'token123')
    expect(mockInvoke).toHaveBeenCalledWith('change-video-quality', 'bilibili', 'BV1xx', 'cid123', 80, 'token123')
    expect(result).toEqual({ manifestUrl: 'test.mpd' })
  })

  it('getXhsNoteDetail should invoke get-xhs-note-detail IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ title: 'Note' })
    await api.getXhsNoteDetail('note1', 'https://url.com')
    expect(mockInvoke).toHaveBeenCalledWith('get-xhs-note-detail', 'note1', 'https://url.com')
  })

  it('getBiliVideoComments should invoke get-bili-video-comments IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], hasMore: false })
    await api.getBiliVideoComments('aid123', 'hot', 'cursor', 20)
    expect(mockInvoke).toHaveBeenCalledWith('get-bili-video-comments', 'bilibili', 'aid123', 'hot', 'cursor', 20)
  })

  it('clearVideoCache should invoke clear-video-cache IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce(undefined)
    await api.clearVideoCache()
    expect(mockInvoke).toHaveBeenCalledWith('clear-video-cache')
  })

  it('chooseDataRoot should invoke choose-data-root IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ dataRoot: '/new/data' })
    await api.chooseDataRoot()
    expect(mockInvoke).toHaveBeenCalledWith('choose-data-root')
  })

  it('openLogDir should invoke open-log-dir IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce(undefined)
    await api.openLogDir()
    expect(mockInvoke).toHaveBeenCalledWith('open-log-dir')
  })

  it('exportLogs should invoke export-logs IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce('/path/to/export')
    await api.exportLogs()
    expect(mockInvoke).toHaveBeenCalledWith('export-logs')
  })

  it('getLogDir should invoke get-log-dir IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce('/logs')
    await api.getLogDir()
    expect(mockInvoke).toHaveBeenCalledWith('get-log-dir')
  })

  it('getBiliVideoDetail should invoke get-bili-video-detail IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ title: 'Video' })
    const result = await api.getBiliVideoDetail('BV1xx', 'aid123')
    expect(mockInvoke).toHaveBeenCalledWith('get-bili-video-detail', 'bilibili', 'BV1xx', 'aid123')
    expect(result).toEqual({ title: 'Video' })
  })

  it('getBiliCommentReplies should invoke get-bili-comment-replies IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], hasMore: false })
    const result = await api.getBiliCommentReplies('aid123', 'rpid1', 2, 20)
    expect(mockInvoke).toHaveBeenCalledWith('get-bili-comment-replies', 'bilibili', 'aid123', 'rpid1', 2, 20)
    expect(result).toEqual({ items: [], hasMore: false })
  })

  it('getFollowingFeed should invoke get-following-feed IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce([])
    await api.getFollowingFeed('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('get-following-feed', 'bilibili')
  })

  it('getFollowingsPage should invoke get-followings-page IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
    const result = await api.getFollowingsPage('bilibili', 1, 20)
    expect(mockInvoke).toHaveBeenCalledWith('get-followings-page', 'bilibili', 1, 20)
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
  })

  it('getFollowingFeedPage should invoke get-following-feed-page IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], hasMore: false })
    const result = await api.getFollowingFeedPage('bilibili', 'offset1', 10)
    expect(mockInvoke).toHaveBeenCalledWith('get-following-feed-page', 'bilibili', 'offset1', 10)
    expect(result).toEqual({ items: [], hasMore: false })
  })

  it('getUserVideosPage should invoke get-user-videos-page IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
    const result = await api.getUserVideosPage('bilibili', 'uid1', 1, 20)
    expect(mockInvoke).toHaveBeenCalledWith('get-user-videos-page', 'bilibili', 'uid1', 1, 20)
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
  })

  it('getFavoriteFolders should invoke get-favorite-folders IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce([])
    await api.getFavoriteFolders('bilibili')
    expect(mockInvoke).toHaveBeenCalledWith('get-favorite-folders', 'bilibili')
  })

  it('getFavoriteVideosPage should invoke get-favorite-videos-page IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
    const result = await api.getFavoriteVideosPage('bilibili', 'media1', 1, 20)
    expect(mockInvoke).toHaveBeenCalledWith('get-favorite-videos-page', 'bilibili', 'media1', 1, 20)
    expect(result).toEqual({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
  })

  it('getVideoInteraction should invoke get-video-interaction IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ liked: false, coined: false, favorited: false, stats: {} })
    const result = await api.getVideoInteraction('BV1xx', 'aid1')
    expect(mockInvoke).toHaveBeenCalledWith('get-video-interaction', 'bilibili', 'BV1xx', 'aid1')
    expect(result).toEqual({ liked: false, coined: false, favorited: false, stats: {} })
  })

  it('toggleVideoLike should invoke toggle-video-like IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ success: true })
    const result = await api.toggleVideoLike('BV1xx', true)
    expect(mockInvoke).toHaveBeenCalledWith('toggle-video-like', 'bilibili', 'BV1xx', true)
    expect(result).toEqual({ success: true })
  })

  it('addVideoCoin should invoke add-video-coin IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ success: true })
    const result = await api.addVideoCoin('BV1xx', 'aid1', 2, true)
    expect(mockInvoke).toHaveBeenCalledWith('add-video-coin', 'bilibili', 'BV1xx', 'aid1', 2, true)
    expect(result).toEqual({ success: true })
  })

  it('toggleVideoFavorite should invoke toggle-video-favorite IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ success: true })
    const result = await api.toggleVideoFavorite('aid1', true)
    expect(mockInvoke).toHaveBeenCalledWith('toggle-video-favorite', 'bilibili', 'aid1', true)
    expect(result).toEqual({ success: true })
  })

  it('getVideoFavoriteFolders should invoke get-video-favorite-folders IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce([])
    await api.getVideoFavoriteFolders('aid1')
    expect(mockInvoke).toHaveBeenCalledWith('get-video-favorite-folders', 'bilibili', 'aid1')
  })

  it('updateVideoFavoriteFolders should invoke update-video-favorite-folders IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ success: true })
    const result = await api.updateVideoFavoriteFolders('aid1', ['add1'], ['del1'])
    expect(mockInvoke).toHaveBeenCalledWith('update-video-favorite-folders', 'bilibili', 'aid1', ['add1'], ['del1'])
    expect(result).toEqual({ success: true })
  })

  it('createFavoriteFolder should invoke create-favorite-folder IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ success: true, id: 1 })
    const result = await api.createFavoriteFolder('test folder')
    expect(mockInvoke).toHaveBeenCalledWith('create-favorite-folder', 'bilibili', 'test folder')
    expect(result).toEqual({ success: true, id: 1 })
  })

  it('resetDataRoot should invoke reset-data-root IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce({ dataRoot: '/default' })
    await api.resetDataRoot()
    expect(mockInvoke).toHaveBeenCalledWith('reset-data-root')
  })

  it('clearLogs should invoke clear-logs IPC', async () => {
    const api = await importPreload()
    mockInvoke.mockResolvedValueOnce(undefined)
    await api.clearLogs()
    expect(mockInvoke).toHaveBeenCalledWith('clear-logs')
  })
})
