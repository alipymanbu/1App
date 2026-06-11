import { ipcMain, BrowserWindow, app } from 'electron'
import type { PlatformId, PlatformLoginEvent, FeedItem, PageResult, VideoPlaybackInfo, ChangeQualityResult, VideoInteractionState, VideoInteractionResult, FavoriteFolder, FavoriteFolderSelection, CreateFavoriteFolderResult, XhsNoteDetail, BiliVideoDetail, BiliVideoCommentsResult, BiliCommentRepliesResult, RendererLogEntry } from '../shared/types'
import {
  checkLogin, getProfile, getFeed, getFollowings, getFollowingFeed, getFollowingsPage, getFollowingFeedPage, getUserVideosPage, getFavoriteFolders, getFavoriteVideosPage, logout, openLoginWindow, getVideoPlayback, changeVideoQuality, getBiliCommentReplies,
  getVideoInteraction, toggleVideoLike, addVideoCoin, toggleVideoFavorite, getVideoFavoriteFolders, updateVideoFavoriteFolders, createFavoriteFolder, getNoteDetail,
  getBiliVideoDetail, getBiliVideoComments
} from './platforms'
import { getStorageSettings, chooseDataRoot, resetDataRoot, clearVideoCache } from './dataRoot'
import { rateLimitConsume } from './rateLimiter'
import { info, warn, error as logError, getLogDir, openLogDirInExplorer, exportDiagnostics, clearAllLogs } from './logger'

async function rateLimitedHandle<T>(platform: PlatformId, scope: string, fn: () => Promise<T>): Promise<T> {
  if (platform !== 'bilibili') return fn()

  await rateLimitConsume(scope)

  return fn()
}

function loggedHandle<T>(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const start = Date.now()
    try {
      const result = await handler(event, ...args)
      info('ipc', 'handle_ok', channel, { data: { durationMs: Date.now() - start } })
      return result
    } catch (err) {
      logError('ipc', 'handle_error', channel, err, { data: { durationMs: Date.now() - start } })
      throw err
    }
  })
}

export function setupIpcHandlers(): void {
  ipcMain.on('log-renderer', (_event, entry: RendererLogEntry) => {
    const fn = entry.level === 'error' ? logError : entry.level === 'warn' ? warn : info
    fn('renderer', entry.context || 'message', entry.message, entry.stack ? { data: { stack: entry.stack } } : undefined)
  })

  loggedHandle('open-log-dir', async () => {
    await openLogDirInExplorer()
  })

  loggedHandle('export-logs', async () => {
    return exportDiagnostics()
  })

  loggedHandle('clear-logs', async () => {
    clearAllLogs()
  })

  loggedHandle('get-log-dir', async () => {
    return getLogDir()
  })

  loggedHandle('check-login', async (_event, platform: PlatformId) => {
    return checkLogin(platform)
  })

  loggedHandle('open-login', async (event, platform: PlatformId) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    const state = await openLoginWindow(platform)
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      const loginEvent: PlatformLoginEvent = {
        platform,
        success: state.loggedIn,
        profile: state.profile || undefined
      }
      mainWindow.webContents.send('login-status-changed', loginEvent)
    }
    return state
  })

  loggedHandle('get-profile', async (_event, platform: PlatformId) => {
    return getProfile(platform)
  })

  loggedHandle('get-feed', async (_event, platform: PlatformId, page?: number): Promise<FeedItem[]> => {
    return rateLimitedHandle(platform, 'get-feed', () => getFeed(platform, page))
  })

  loggedHandle('get-followings', async (_event, platform: PlatformId) => {
    return getFollowings(platform)
  })

  loggedHandle('get-following-feed', async (_event, platform: PlatformId) => {
    return getFollowingFeed(platform)
  })

  loggedHandle('get-followings-page', async (_event, platform: PlatformId, page: number, pageSize: number) => {
    return rateLimitedHandle(platform, 'get-followings-page', () => getFollowingsPage(platform, page, pageSize))
  })

  loggedHandle('get-following-feed-page', async (_event, platform: PlatformId, offset?: string, pageSize?: number) => {
    return rateLimitedHandle(platform, 'get-following-feed-page', () => getFollowingFeedPage(platform, offset, pageSize))
  })

  loggedHandle('get-user-videos-page', async (_event, platform: PlatformId, uid: string, page: number, pageSize: number) => {
    return rateLimitedHandle(platform, 'get-user-videos-page', () => getUserVideosPage(platform, uid, page, pageSize))
  })

  loggedHandle('get-favorite-folders', async (_event, platform: PlatformId): Promise<FavoriteFolder[]> => {
    return rateLimitedHandle(platform, 'get-favorite-folders', () => getFavoriteFolders(platform))
  })

  loggedHandle('get-favorite-videos-page', async (_event, platform: PlatformId, mediaId: string, page: number, pageSize: number): Promise<PageResult<FeedItem>> => {
    return rateLimitedHandle(platform, 'get-favorite-videos-page', () => getFavoriteVideosPage(platform, mediaId, page, pageSize))
  })

  loggedHandle('get-storage-settings', async () => {
    return getStorageSettings()
  })

  loggedHandle('choose-data-root', async () => {
    return chooseDataRoot()
  })

  loggedHandle('reset-data-root', async () => {
    return resetDataRoot()
  })

  loggedHandle('clear-video-cache', async () => {
    return clearVideoCache()
  })

  loggedHandle('restart-app', async () => {
    app.relaunch()
    app.exit(0)
  })

  loggedHandle('get-xhs-note-detail', async (_event, noteId: string, url?: string): Promise<XhsNoteDetail | null> => {
    return getNoteDetail('xhs', noteId, url)
  })

  loggedHandle('get-video-playback', async (_event, platform: PlatformId, bvid: string, qn?: number): Promise<VideoPlaybackInfo> => {
    return rateLimitedHandle(platform, 'get-video-playback', () => getVideoPlayback(platform, bvid, qn))
  })

  loggedHandle('change-video-quality', async (_event, platform: PlatformId, bvid: string, cid: string, qn: number, token?: string): Promise<ChangeQualityResult> => {
    return rateLimitedHandle(platform, 'change-video-quality', () => changeVideoQuality(platform, bvid, cid, qn, token))
  })

  loggedHandle('get-video-interaction', async (_event, platform: PlatformId, bvid: string, aid?: string): Promise<VideoInteractionState> => {
    return rateLimitedHandle(platform, 'get-video-interaction', () => getVideoInteraction(platform, bvid, aid))
  })

  loggedHandle('toggle-video-like', async (_event, platform: PlatformId, bvid: string, like: boolean): Promise<VideoInteractionResult> => {
    return rateLimitedHandle(platform, 'toggle-video-like', () => toggleVideoLike(platform, bvid, like))
  })

  loggedHandle('add-video-coin', async (_event, platform: PlatformId, bvid: string, aid?: string, multiply?: number, selectLike?: boolean): Promise<VideoInteractionResult> => {
    return rateLimitedHandle(platform, 'add-video-coin', () => addVideoCoin(platform, bvid, aid, multiply, selectLike))
  })

  loggedHandle('toggle-video-favorite', async (_event, platform: PlatformId, aid: string, favorite: boolean): Promise<VideoInteractionResult> => {
    return rateLimitedHandle(platform, 'toggle-video-favorite', () => toggleVideoFavorite(platform, aid, favorite))
  })

  loggedHandle('get-video-favorite-folders', async (_event, platform: PlatformId, aid: string): Promise<FavoriteFolderSelection[]> => {
    return rateLimitedHandle(platform, 'get-video-favorite-folders', () => getVideoFavoriteFolders(platform, aid))
  })

  loggedHandle('update-video-favorite-folders', async (_event, platform: PlatformId, aid: string, addMediaIds: string[], delMediaIds: string[]): Promise<VideoInteractionResult> => {
    return rateLimitedHandle(platform, 'update-video-favorite-folders', () => updateVideoFavoriteFolders(platform, aid, addMediaIds, delMediaIds))
  })

  loggedHandle('create-favorite-folder', async (_event, platform: PlatformId, title: string): Promise<CreateFavoriteFolderResult> => {
    return rateLimitedHandle(platform, 'create-favorite-folder', () => createFavoriteFolder(platform, title))
  })

  loggedHandle('get-bili-video-detail', async (_event, platform: PlatformId, bvid: string, aid?: string): Promise<BiliVideoDetail | null> => {
    return rateLimitedHandle(platform, 'get-bili-video-detail', () => getBiliVideoDetail(platform, bvid, aid))
  })

  loggedHandle('get-bili-video-comments', async (_event, platform: PlatformId, aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number): Promise<BiliVideoCommentsResult> => {
    return rateLimitedHandle(platform, 'get-bili-video-comments', () => getBiliVideoComments(platform, aid, sort, cursor, pageSize))
  })

  loggedHandle('get-bili-comment-replies', async (_event, platform: PlatformId, aid: string, rootRpid: string, page?: number, pageSize?: number): Promise<BiliCommentRepliesResult> => {
    return rateLimitedHandle(platform, 'get-bili-comment-replies', () => getBiliCommentReplies(platform, aid, rootRpid, page, pageSize))
  })

  loggedHandle('logout', async (event, platform: PlatformId) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    await logout(platform)
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      const loginEvent: PlatformLoginEvent = { platform, success: false }
      mainWindow.webContents.send('login-status-changed', loginEvent)
    }
  })
}
