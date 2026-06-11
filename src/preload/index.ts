import { contextBridge, ipcRenderer } from 'electron'
import type { PlatformId, UserProfile, FeedItem, LoginState, PlatformLoginEvent, FollowUser, PageResult, VideoPlaybackInfo, ChangeQualityResult, StorageSettings, VideoInteractionState, VideoInteractionResult, FavoriteFolder, FavoriteFolderSelection, CreateFavoriteFolderResult, XhsNoteDetail, BiliVideoDetail, BiliVideoCommentsResult, BiliCommentRepliesResult, LogLevel, RendererLogEntry, LogFileInfo } from '../shared/types'

const api = {
  checkLogin: (platform: PlatformId): Promise<LoginState> =>
    ipcRenderer.invoke('check-login', platform),

  openLogin: (platform: PlatformId): Promise<LoginState> =>
    ipcRenderer.invoke('open-login', platform),

  getProfile: (platform: PlatformId): Promise<UserProfile | null> =>
    ipcRenderer.invoke('get-profile', platform),

  getFeed: (platform: PlatformId, page?: number): Promise<FeedItem[]> =>
    ipcRenderer.invoke('get-feed', platform, page),

  getXhsNoteDetail: (noteId: string, url?: string): Promise<XhsNoteDetail | null> =>
    ipcRenderer.invoke('get-xhs-note-detail', noteId, url),

  getBiliVideoDetail: (bvid: string, aid?: string): Promise<BiliVideoDetail | null> =>
    ipcRenderer.invoke('get-bili-video-detail', 'bilibili', bvid, aid),

  getBiliVideoComments: (aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number): Promise<BiliVideoCommentsResult> =>
    ipcRenderer.invoke('get-bili-video-comments', 'bilibili', aid, sort, cursor, pageSize),

  getBiliCommentReplies: (aid: string, rootRpid: string, page?: number, pageSize?: number): Promise<BiliCommentRepliesResult> =>
    ipcRenderer.invoke('get-bili-comment-replies', 'bilibili', aid, rootRpid, page, pageSize),

  logout: (platform: PlatformId): Promise<void> =>
    ipcRenderer.invoke('logout', platform),

  getFollowings: (platform: PlatformId): Promise<FollowUser[]> =>
    ipcRenderer.invoke('get-followings', platform),

  getFollowingFeed: (platform: PlatformId): Promise<FeedItem[]> =>
    ipcRenderer.invoke('get-following-feed', platform),

  getFollowingsPage: (platform: PlatformId, page: number, pageSize: number): Promise<PageResult<FollowUser>> =>
    ipcRenderer.invoke('get-followings-page', platform, page, pageSize),

  getFollowingFeedPage: (platform: PlatformId, offset?: string, pageSize?: number): Promise<PageResult<FeedItem>> =>
    ipcRenderer.invoke('get-following-feed-page', platform, offset, pageSize),

  getUserVideosPage: (platform: PlatformId, uid: string, page: number, pageSize: number): Promise<PageResult<FeedItem>> =>
    ipcRenderer.invoke('get-user-videos-page', platform, uid, page, pageSize),

  getFavoriteFolders: (platform: PlatformId): Promise<FavoriteFolder[]> =>
    ipcRenderer.invoke('get-favorite-folders', platform),

  getFavoriteVideosPage: (platform: PlatformId, mediaId: string, page: number, pageSize: number): Promise<PageResult<FeedItem>> =>
    ipcRenderer.invoke('get-favorite-videos-page', platform, mediaId, page, pageSize),

  getVideoPlayback: (bvid: string, qn?: number): Promise<VideoPlaybackInfo> =>
    ipcRenderer.invoke('get-video-playback', 'bilibili', bvid, qn),

  changeVideoQuality: (bvid: string, cid: string, qn: number, token?: string): Promise<ChangeQualityResult> =>
    ipcRenderer.invoke('change-video-quality', 'bilibili', bvid, cid, qn, token),

  getVideoInteraction: (bvid: string, aid?: string): Promise<VideoInteractionState> =>
    ipcRenderer.invoke('get-video-interaction', 'bilibili', bvid, aid),

  toggleVideoLike: (bvid: string, like: boolean): Promise<VideoInteractionResult> =>
    ipcRenderer.invoke('toggle-video-like', 'bilibili', bvid, like),

  addVideoCoin: (bvid: string, aid?: string, multiply?: number, selectLike?: boolean): Promise<VideoInteractionResult> =>
    ipcRenderer.invoke('add-video-coin', 'bilibili', bvid, aid, multiply, selectLike),

  toggleVideoFavorite: (aid: string, favorite: boolean): Promise<VideoInteractionResult> =>
    ipcRenderer.invoke('toggle-video-favorite', 'bilibili', aid, favorite),

  getVideoFavoriteFolders: (aid: string): Promise<FavoriteFolderSelection[]> =>
    ipcRenderer.invoke('get-video-favorite-folders', 'bilibili', aid),

  updateVideoFavoriteFolders: (aid: string, addMediaIds: string[], delMediaIds: string[]): Promise<VideoInteractionResult> =>
    ipcRenderer.invoke('update-video-favorite-folders', 'bilibili', aid, addMediaIds, delMediaIds),

  createFavoriteFolder: (title: string): Promise<CreateFavoriteFolderResult> =>
    ipcRenderer.invoke('create-favorite-folder', 'bilibili', title),

  getStorageSettings: (): Promise<StorageSettings> =>
    ipcRenderer.invoke('get-storage-settings'),

  chooseDataRoot: (): Promise<StorageSettings> =>
    ipcRenderer.invoke('choose-data-root'),

  resetDataRoot: (): Promise<StorageSettings> =>
    ipcRenderer.invoke('reset-data-root'),

  clearVideoCache: (): Promise<void> =>
    ipcRenderer.invoke('clear-video-cache'),

  restartApp: (): Promise<void> =>
    ipcRenderer.invoke('restart-app'),

  onLoginStatusChanged: (callback: (event: PlatformLoginEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: PlatformLoginEvent): void => {
      callback(data)
    }
    ipcRenderer.on('login-status-changed', handler)
    return () => {
      ipcRenderer.removeListener('login-status-changed', handler)
    }
  },

  logRenderer: (entry: RendererLogEntry): void => {
    ipcRenderer.send('log-renderer', entry)
  },

  openLogDir: (): Promise<void> =>
    ipcRenderer.invoke('open-log-dir'),

  exportLogs: (): Promise<string | null> =>
    ipcRenderer.invoke('export-logs'),

  clearLogs: (): Promise<void> =>
    ipcRenderer.invoke('clear-logs'),

  getLogDir: (): Promise<string> =>
    ipcRenderer.invoke('get-log-dir')
}

contextBridge.exposeInMainWorld('electronApi', api)
