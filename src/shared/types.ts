export type PlatformId = 'xhs' | 'bilibili' | 'douyin'

export interface UserStats {
  following?: number
  follower?: number
  likes?: number
  views?: number
}

export interface UserProfile {
  platform: PlatformId
  nickname: string
  avatar: string
  uid: string
  bio?: string
  stats?: UserStats
}

export interface FollowUser {
  platform: PlatformId
  nickname: string
  avatar: string
  uid: string
  bio?: string
  url: string
  stats?: UserStats
}

export interface FeedItem {
  id: string
  platform: PlatformId
  title: string
  cover?: string
  author: string
  avatar?: string
  url: string
  createdAt?: string
  stats?: {
    like?: number
    comment?: number
    share?: number
    play?: number
  }
  bvid?: string
  aid?: string
  cid?: string
  mediaType?: 'video' | 'image' | 'unknown'
}

export interface VideoQuality {
  qn: number
  description: string
}

export interface VideoPlaybackInfo {
  bvid: string
  aid?: string
  cid: string
  title: string
  cover?: string
  qualities: VideoQuality[]
  defaultQuality: number
  manifestUrl: string
  externalUrl: string
  duration?: number
  playable: boolean
  error?: string
}

export interface ChangeQualityResult {
  manifestUrl: string
  defaultQuality: number
  error?: string
  token?: string
}

export interface VideoInteractionState {
  liked: boolean
  coined: boolean
  favorited: boolean
  stats: {
    like?: number
    coin?: number
    favorite?: number
  }
}

export interface VideoInteractionResult {
  success: boolean
  error?: string
}

export interface StorageSettings {
  dataRoot: string
  defaultDataRoot: string
  actualDataDir: string
  videoCacheDir: string
  isDefault: boolean
  restartRequired?: boolean
  error?: string
}

export interface LoginState {
  loggedIn: boolean
  profile: UserProfile | null
}

export interface PlatformLoginEvent {
  platform: PlatformId
  success: boolean
  profile?: UserProfile
  error?: string
}

export interface FavoriteFolder {
  id: string
  title: string
  count?: number
}

export interface FavoriteFolderSelection extends FavoriteFolder {
  checked: boolean
}

export interface CreateFavoriteFolderResult {
  success: boolean
  folder?: FavoriteFolderSelection
  error?: string
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total?: number
  hasMore: boolean
  nextOffset?: string
  errorCode?: number
  error?: string
}

export interface PlatformConfig {
  id: PlatformId
  name: string
  color: string
  loginUrl: string
  icon: string
}

export interface XhsComment {
  id: string
  nickname: string
  avatar: string
  content: string
  likes: number
  time: string
  replies?: XhsComment[]
}

export interface XhsNoteDetail {
  noteId: string
  type: 'image' | 'video' | 'text' | 'unknown'
  title: string
  desc: string
  images: string[]
  video?: {
    url: string
    poster?: string
    duration?: number
  }
  author: {
    nickname: string
    avatar: string
    uid?: string
  }
  stats?: {
    like?: number
    comment?: number
    collect?: number
    share?: number
  }
  comments: XhsComment[]
  url: string
}

export interface BiliVideoDetail {
  bvid: string
  aid: string
  title: string
  desc: string
  cover?: string
  pubdate?: number
  duration?: number
  owner: {
    mid: string
    name: string
    face?: string
  }
  stats: {
    view?: number
    danmaku?: number
    reply?: number
    favorite?: number
    coin?: number
    share?: number
    like?: number
  }
  tags: string[]
}

export interface BiliVideoComment {
  id: string
  rpid: string
  mid: string
  nickname: string
  avatar?: string
  content: string
  ctime?: number
  like?: number
  isUp?: boolean
  level?: number
  replyCount?: number
  parent?: string
}

export interface BiliVideoCommentsResult {
  items: BiliVideoComment[]
  total?: number
  cursor?: string
  hasMore: boolean
  error?: string
}

export interface BiliCommentRepliesResult {
  items: BiliVideoComment[]
  total?: number
  page: number
  hasMore: boolean
  error?: string
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface RendererLogEntry {
  level: LogLevel
  message: string
  stack?: string
  context?: string
}

export interface LogFileInfo {
  name: string
  size: number
  mtime: string
}

export interface IpcApi {
  checkLogin: (platform: PlatformId) => Promise<LoginState>
  openLogin: (platform: PlatformId) => Promise<LoginState>
  getProfile: (platform: PlatformId) => Promise<UserProfile | null>
  getFeed: (platform: PlatformId, page?: number) => Promise<FeedItem[]>
  logout: (platform: PlatformId) => Promise<void>
  onLoginStatusChanged: (callback: (event: PlatformLoginEvent) => void) => () => void
  getFollowings: (platform: PlatformId) => Promise<FollowUser[]>
  getFollowingFeed: (platform: PlatformId) => Promise<FeedItem[]>
  getFollowingsPage: (platform: PlatformId, page: number, pageSize: number) => Promise<PageResult<FollowUser>>
  getFollowingFeedPage: (platform: PlatformId, offset?: string, pageSize?: number) => Promise<PageResult<FeedItem>>
  getUserVideosPage: (platform: PlatformId, uid: string, page: number, pageSize: number) => Promise<PageResult<FeedItem>>
  getFavoriteFolders: (platform: PlatformId) => Promise<FavoriteFolder[]>
  getFavoriteVideosPage: (platform: PlatformId, mediaId: string, page: number, pageSize: number) => Promise<PageResult<FeedItem>>
  getVideoPlayback: (bvid: string, qn?: number) => Promise<VideoPlaybackInfo>
  changeVideoQuality: (bvid: string, cid: string, qn: number, token?: string) => Promise<ChangeQualityResult>
  getVideoInteraction: (bvid: string, aid?: string) => Promise<VideoInteractionState>
  toggleVideoLike: (bvid: string, like: boolean) => Promise<VideoInteractionResult>
  addVideoCoin: (bvid: string, aid?: string, multiply?: number, selectLike?: boolean) => Promise<VideoInteractionResult>
  toggleVideoFavorite: (aid: string, favorite: boolean) => Promise<VideoInteractionResult>
  getVideoFavoriteFolders: (aid: string) => Promise<FavoriteFolderSelection[]>
  updateVideoFavoriteFolders: (aid: string, addMediaIds: string[], delMediaIds: string[]) => Promise<VideoInteractionResult>
  createFavoriteFolder: (title: string) => Promise<CreateFavoriteFolderResult>
  getXhsNoteDetail: (noteId: string, url?: string) => Promise<XhsNoteDetail | null>
  getBiliVideoDetail: (bvid: string, aid?: string) => Promise<BiliVideoDetail | null>
  getBiliVideoComments: (aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number) => Promise<BiliVideoCommentsResult>
  getBiliCommentReplies: (aid: string, rootRpid: string, page?: number, pageSize?: number) => Promise<BiliCommentRepliesResult>
  getStorageSettings: () => Promise<StorageSettings>
  chooseDataRoot: () => Promise<StorageSettings>
  resetDataRoot: () => Promise<StorageSettings>
  clearVideoCache: () => Promise<void>
  restartApp: () => Promise<void>
}
