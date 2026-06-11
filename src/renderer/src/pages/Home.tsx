import { useState, useEffect, useCallback } from 'react'
import type { PlatformId, UserProfile, FeedItem, FollowUser, PageResult, VideoPlaybackInfo, ChangeQualityResult, StorageSettings, VideoInteractionState, VideoInteractionResult, FavoriteFolder, FavoriteFolderSelection, CreateFavoriteFolderResult, XhsNoteDetail, BiliVideoDetail, BiliVideoCommentsResult, BiliCommentRepliesResult } from '../../../shared/types'
import { PlatformTabs } from '../components/PlatformTabs'
import { UserCard } from '../components/UserCard'
import { FeedGrid } from '../components/FeedGrid'
import { FollowGrid } from '../components/FollowGrid'
import { Pagination } from '../components/Pagination'
import { LoginView } from './LoginView'
import { VideoPlayerModal } from '../components/VideoPlayerModal'
import { XhsNoteModal } from '../components/XhsNoteModal'
import { SettingsModal } from '../components/SettingsModal'
import { PLATFORMS } from '../../../shared/constants'
import { isRateLimitError, formatRateLimitError } from '../utils/rateLimit'

declare global {
  interface Window {
    electronApi: {
      checkLogin: (platform: PlatformId) => Promise<{ loggedIn: boolean; profile: UserProfile | null }>
      openLogin: (platform: PlatformId) => Promise<{ loggedIn: boolean; profile: UserProfile | null }>
      getProfile: (platform: PlatformId) => Promise<UserProfile | null>
      getFeed: (platform: PlatformId, page?: number) => Promise<FeedItem[]>
      logout: (platform: PlatformId) => Promise<void>
      getFollowings: (platform: PlatformId) => Promise<FollowUser[]>
      getFollowingFeed: (platform: PlatformId) => Promise<FeedItem[]>
      getFollowingsPage: (platform: PlatformId, page: number, pageSize: number) => Promise<PageResult<FollowUser>>
      getFollowingFeedPage: (platform: PlatformId, offset?: string, pageSize?: number) => Promise<PageResult<FeedItem>>
      getUserVideosPage: (platform: PlatformId, uid: string, page: number, pageSize: number) => Promise<PageResult<FeedItem>>
      onLoginStatusChanged: (callback: (event: { platform: PlatformId; success: boolean; profile?: UserProfile }) => void) => () => void
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
      getStorageSettings: () => Promise<StorageSettings>
      chooseDataRoot: () => Promise<StorageSettings>
      resetDataRoot: () => Promise<StorageSettings>
      clearVideoCache: () => Promise<void>
      getXhsNoteDetail: (noteId: string, url?: string) => Promise<XhsNoteDetail | null>
      getBiliVideoDetail: (bvid: string, aid?: string) => Promise<BiliVideoDetail | null>
      getBiliVideoComments: (aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number) => Promise<BiliVideoCommentsResult>
      getBiliCommentReplies: (aid: string, rootRpid: string, page?: number, pageSize?: number) => Promise<BiliCommentRepliesResult>
      restartApp: () => Promise<void>
      getLogDir: () => Promise<string>
      logRenderer: (entry: { level: string; message: string; stack?: string; context?: string }) => void
      openLogDir: () => Promise<void>
      exportLogs: () => Promise<string | null>
      clearLogs: () => Promise<void>
    }
  }
}

export function Home() {
  const [activePlatform, setActivePlatform] = useState<PlatformId>('bilibili')
  const [loginStates, setLoginStates] = useState<Record<PlatformId, boolean>>({
    xhs: false,
    bilibili: false,
    douyin: false
  })
  const [profiles, setProfiles] = useState<Record<PlatformId, UserProfile | null>>({
    xhs: null,
    bilibili: null,
    douyin: null
  })
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [feedType, setFeedType] = useState<'recommend' | 'following' | 'followings' | 'favorites'>('recommend')
  const [recommendPage, setRecommendPage] = useState(1)
  const [recommendRefreshing, setRecommendRefreshing] = useState(false)
  const [followItems, setFollowItems] = useState<FollowUser[]>([])
  const [followLoading, setFollowLoading] = useState(false)
  const [followingFeedItems, setFollowingFeedItems] = useState<FeedItem[]>([])
  const [followingFeedLoading, setFollowingFeedLoading] = useState(false)
  const [followPage, setFollowPage] = useState(1)
  const [followTotal, setFollowTotal] = useState(0)
  const [followError, setFollowError] = useState('')
  const [dynamicPage, setDynamicPage] = useState(1)
  const [dynamicOffsets, setDynamicOffsets] = useState<Record<number, string | undefined>>({ 1: undefined })
  const [dynamicHasMore, setDynamicHasMore] = useState(false)
  const [followingFeedError, setFollowingFeedError] = useState('')
  const [selectedUp, setSelectedUp] = useState<FollowUser | null>(null)
  const [upVideoItems, setUpVideoItems] = useState<FeedItem[]>([])
  const [upVideoLoading, setUpVideoLoading] = useState(false)
  const [upVideoPage, setUpVideoPage] = useState(1)
  const [upVideoTotal, setUpVideoTotal] = useState(0)
  const [upVideoError, setUpVideoError] = useState('')
  const [playingVideo, setPlayingVideo] = useState<FeedItem | null>(null)
  const [selectedXhsItem, setSelectedXhsItem] = useState<FeedItem | null>(null)
const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>([])
const [selectedFolderId, setSelectedFolderId] = useState('')
const [favoriteItems, setFavoriteItems] = useState<FeedItem[]>([])
const [favoritePage, setFavoritePage] = useState(1)
const [favoriteTotal, setFavoriteTotal] = useState(0)
const [favoriteLoading, setFavoriteLoading] = useState(false)
const [favoriteError, setFavoriteError] = useState('')
const [settingsOpen, setSettingsOpen] = useState(false)

  const checkAllLoginStates = useCallback(async () => {
    const results = await Promise.all(
      (['xhs', 'bilibili', 'douyin'] as PlatformId[]).map(async (platform) => {
        const state = await window.electronApi.checkLogin(platform)
        return { platform, state }
      })
    )

    const newStates: Record<PlatformId, boolean> = { xhs: false, bilibili: false, douyin: false }
    const newProfiles: Record<PlatformId, UserProfile | null> = { xhs: null, bilibili: null, douyin: null }

    for (const { platform, state } of results) {
      newStates[platform] = state.loggedIn
      newProfiles[platform] = state.profile || null
    }

    setLoginStates(newStates)
    setProfiles(newProfiles)
  }, [])

  const loadFavoriteFolders = useCallback(async (platform: PlatformId, loadVideos: boolean = false, preferredFolderId?: string) => {
    setFavoriteLoading(true)
    setFavoriteError('')
    try {
      const folders = await window.electronApi.getFavoriteFolders(platform)
      setFavoriteFolders(folders)
      if (folders.length > 0) {
        const targetId = preferredFolderId && folders.some(f => f.id === preferredFolderId)
          ? preferredFolderId
          : folders[0].id
        setSelectedFolderId(targetId)
        if (loadVideos) {
          const result = await window.electronApi.getFavoriteVideosPage(platform, targetId, 1, 20)
          setFavoriteItems(result.items)
          setFavoriteTotal(result.total ?? 0)
        }
      } else {
        setSelectedFolderId('')
        setFavoriteItems([])
        setFavoriteTotal(0)
      }
    } catch {
      setFavoriteFolders([])
      setFavoriteItems([])
      setFavoriteTotal(0)
      setFavoriteError('收藏加载失败')
    } finally {
      setFavoriteLoading(false)
    }
  }, [])

  const loadFeed = useCallback(async (platform: PlatformId, type: string, feedPage = 1) => {
    if (type === 'followings') {
      setFollowPage(1)
      setFollowTotal(0)
      setFollowError('')
      setFollowLoading(true)
      try {
        const result = await window.electronApi.getFollowingsPage(platform, 1, 10)
        setFollowItems(result.items)
        setFollowTotal(result.total ?? 0)
      } catch (err) {
        const { isLimited } = isRateLimitError(err)
        if (isLimited) {
          setFollowError(formatRateLimitError(err))
        } else {
          setFollowItems([])
          setFollowTotal(0)
        }
      } finally {
        setFollowLoading(false)
      }
    } else if (type === 'following') {
      setDynamicPage(1)
      setDynamicOffsets({ 1: undefined })
      setDynamicHasMore(false)
      setFollowingFeedError('')
      setFollowingFeedLoading(true)
      try {
        const result = await window.electronApi.getFollowingFeedPage(platform, undefined, 10)
        setFollowingFeedItems(result.items)
        setDynamicOffsets({ 1: undefined, 2: result.nextOffset })
        setDynamicHasMore(result.hasMore)
      } catch (err) {
        const { isLimited } = isRateLimitError(err)
        if (isLimited) {
          setFollowingFeedError(formatRateLimitError(err))
        } else {
          setFollowingFeedItems([])
          setDynamicHasMore(false)
        }
      } finally {
        setFollowingFeedLoading(false)
      }
    } else if (type === 'favorites') {
      await loadFavoriteFolders(platform, true)
    } else {
      setFeedLoading(true)
      setFeedError('')
      try {
        const page = type === 'recommend' ? feedPage : 1
        const items = await window.electronApi.getFeed(platform, page)
        if (items.length > 0) {
          setFeedItems(items)
          setFeedError('')
        } else if (feedItems.length === 0) {
          setFeedError(platform === 'xhs' ? '推荐内容暂不可用，数据获取异常' : '推荐内容暂不可用，已尝试多个数据源')
        }
      } catch {
        setFeedError('推荐内容加载失败')
      } finally {
        setFeedLoading(false)
      }
    }
  }, [])

  const handleFavoriteFoldersChanged = useCallback(() => {
    loadFavoriteFolders(activePlatform, feedType === 'favorites', selectedFolderId)
  }, [activePlatform, feedType, selectedFolderId])

  useEffect(() => {
    checkAllLoginStates()
  }, [checkAllLoginStates])

  useEffect(() => {
    const unsubscribe = window.electronApi.onLoginStatusChanged((event) => {
      setLoginStates((prev) => ({
        ...prev,
        [event.platform]: event.success
      }))
      if (event.profile) {
        setProfiles((prev) => ({
          ...prev,
          [event.platform]: event.profile!
        }))
      } else if (!event.success) {
        setProfiles((prev) => ({
          ...prev,
          [event.platform]: null
        }))
      } else {
        window.electronApi.getProfile(event.platform).then((profile) => {
          if (profile) {
            setProfiles((prev) => ({
              ...prev,
              [event.platform]: profile
            }))
          }
        })
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!loginStates[activePlatform] || !profiles[activePlatform]) return
    loadFeed(activePlatform, feedType, feedType === 'recommend' ? recommendPage : undefined)
  }, [activePlatform, feedType, loginStates, profiles, loadFeed])

  const handlePlatformSelect = (platform: PlatformId) => {
    setActivePlatform(platform)
    setFeedType('recommend')
    setFeedItems([])
    setFeedError('')
    setRecommendPage(1)
    setFollowItems([])
    setFollowError('')
    setFollowPage(1)
    setFollowTotal(0)
    setFollowingFeedItems([])
    setFollowingFeedError('')
    setDynamicPage(1)
    setDynamicOffsets({ 1: undefined })
    setDynamicHasMore(false)
    setSelectedUp(null)
    setUpVideoItems([])
    setUpVideoPage(1)
    setUpVideoTotal(0)
    setUpVideoError('')
    setFavoriteFolders([])
    setSelectedFolderId('')
    setFavoriteItems([])
    setFavoritePage(1)
    setFavoriteTotal(0)
    setFavoriteLoading(false)
    setFavoriteError('')
  }

  const handleFollowPageChange = async (newPage: number) => {
    if (followLoading) return
    if (newPage === followPage) return
    const totalPages = Math.ceil(followTotal / 10)
    if (newPage < 1 || newPage > totalPages) return
    setFollowPage(newPage)
    setFollowLoading(true)
    try {
      const result = await window.electronApi.getFollowingsPage(activePlatform, newPage, 10)
      setFollowItems(result.items)
      setFollowTotal(result.total ?? 0)
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      if (isLimited) {
        setFollowError(formatRateLimitError(err))
      } else {
        setFollowItems([])
        setFollowTotal(0)
      }
    } finally {
      setFollowLoading(false)
    }
  }

  const handleDynamicPageChange = async (newPage: number) => {
    if (followingFeedLoading) return
    setDynamicPage(newPage)
    setFollowingFeedLoading(true)
    try {
      const offset = dynamicOffsets[newPage]
      const result = await window.electronApi.getFollowingFeedPage(activePlatform, offset, 10)
      setFollowingFeedItems(result.items)
      setDynamicOffsets((prev) => ({ ...prev, [newPage + 1]: result.nextOffset }))
      setDynamicHasMore(result.hasMore)
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      if (isLimited) {
        setFollowingFeedError(formatRateLimitError(err))
      } else {
        setFollowingFeedItems([])
        setDynamicHasMore(false)
      }
    } finally {
      setFollowingFeedLoading(false)
    }
  }

  function formatVideoError(result: PageResult<FeedItem>): string {
    if (result.errorCode) {
      if (result.errorCode === -403) return '投稿接口鉴权失败，正在尝试其他方式...'
      if (result.errorCode === -799) return '请求过于频繁，请稍后再试'
      return `投稿接口错误 (${result.errorCode})`
    }
    return '该 UP 主暂无公开视频'
  }

  const handleSelectUp = async (user: FollowUser) => {
    setSelectedUp(user)
    setUpVideoPage(1)
    setUpVideoLoading(true)
    setUpVideoError('')
    try {
      const result = await window.electronApi.getUserVideosPage('bilibili', user.uid, 1, 10)
      setUpVideoItems(result.items)
      setUpVideoTotal(result.total ?? 0)
      if (result.items.length === 0) {
        setUpVideoError(formatVideoError(result))
      }
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      if (isLimited) {
        setUpVideoError(formatRateLimitError(err))
      } else {
        setUpVideoItems([])
        setUpVideoTotal(0)
        setUpVideoError('投稿加载失败')
      }
    } finally {
      setUpVideoLoading(false)
    }
  }

  const handleUpVideoPageChange = async (newPage: number) => {
    if (upVideoLoading) return
    if (!selectedUp || newPage === upVideoPage) return
    const totalPages = Math.ceil(upVideoTotal / 10)
    if (newPage < 1 || newPage > totalPages) return
    setUpVideoPage(newPage)
    setUpVideoLoading(true)
    setUpVideoError('')
    try {
      const result = await window.electronApi.getUserVideosPage('bilibili', selectedUp.uid, newPage, 10)
      setUpVideoItems(result.items)
      setUpVideoTotal(result.total ?? 0)
      if (result.items.length === 0) {
        setUpVideoError(formatVideoError(result))
      }
    } catch (err) {
      const { isLimited } = isRateLimitError(err)
      if (isLimited) {
        setUpVideoError(formatRateLimitError(err))
      } else {
        setUpVideoItems([])
        setUpVideoTotal(0)
        setUpVideoError('投稿加载失败')
      }
    } finally {
      setUpVideoLoading(false)
    }
  }

  const handleRefreshRecommend = async () => {
    if (feedLoading || recommendRefreshing) return
    const nextPage = recommendPage + 1
    setRecommendRefreshing(true)
    try {
      const items = await window.electronApi.getFeed(activePlatform, nextPage)
      if (items.length > 0) {
        setFeedItems(items)
        setRecommendPage(nextPage)
        setFeedError('')
      } else {
        setFeedError('暂时没有更多推荐内容')
      }
    } catch {
      setFeedError('换一批失败，请稍后再试')
    } finally {
      setRecommendRefreshing(false)
    }
  }

  const handleSelectFavoriteFolder = async (folderId: string) => {
    if (favoriteLoading || folderId === selectedFolderId) return
    setSelectedFolderId(folderId)
    setFavoritePage(1)
    setFavoriteLoading(true)
    setFavoriteError('')
    try {
      const result = await window.electronApi.getFavoriteVideosPage(activePlatform, folderId, 1, 20)
      setFavoriteItems(result.items)
      setFavoriteTotal(result.total ?? 0)
    } catch {
      setFavoriteItems([])
      setFavoriteTotal(0)
      setFavoriteError('收藏视频加载失败')
    } finally {
      setFavoriteLoading(false)
    }
  }

  const handleFavoritePageChange = async (newPage: number) => {
    if (favoriteLoading || !selectedFolderId) return
    setFavoritePage(newPage)
    setFavoriteLoading(true)
    try {
      const result = await window.electronApi.getFavoriteVideosPage(activePlatform, selectedFolderId, newPage, 20)
      setFavoriteItems(result.items)
      setFavoriteTotal(result.total ?? 0)
    } catch {
      setFavoriteItems([])
      setFavoriteTotal(0)
      setFavoriteError('收藏视频加载失败')
    } finally {
      setFavoriteLoading(false)
    }
  }

  const handlePlay = (item: FeedItem) => {
    if (item.platform === 'bilibili' && (item.bvid || item.aid)) {
      setPlayingVideo(item)
    } else if (item.platform === 'xhs') {
      setSelectedXhsItem(item)
    } else {
      window.open(item.url, '_blank')
    }
  }

  const handleClosePlayer = () => {
    setPlayingVideo(null)
  }

  const handleCloseXhsNote = () => {
    setSelectedXhsItem(null)
  }

  const handleLogin = async () => {
    const state = await window.electronApi.openLogin(activePlatform)
    if (state.loggedIn) {
      setLoginStates((prev) => ({ ...prev, [activePlatform]: true }))
      let profile = state.profile
      if (!profile) {
        profile = await window.electronApi.getProfile(activePlatform)
      }
      if (profile) {
        setProfiles((prev) => ({ ...prev, [activePlatform]: profile! }))
      }
      loadFeed(activePlatform, feedType, feedType === 'recommend' ? recommendPage : undefined)
    }
  }

  const handleRetryProfile = async () => {
    const profile = await window.electronApi.getProfile(activePlatform)
    if (profile) {
      setProfiles((prev) => ({ ...prev, [activePlatform]: profile }))
      loadFeed(activePlatform, feedType, feedType === 'recommend' ? recommendPage : undefined)
    }
  }

  const handleLogout = async () => {
    await window.electronApi.logout(activePlatform)
    setLoginStates((prev) => ({ ...prev, [activePlatform]: false }))
    setProfiles((prev) => ({ ...prev, [activePlatform]: null }))
    setFeedItems([])
    setFeedError('')
    setRecommendPage(1)
    setFollowItems([])
    setFollowError('')
    setFollowPage(1)
    setFollowTotal(0)
    setFollowingFeedItems([])
    setFollowingFeedError('')
    setDynamicPage(1)
    setDynamicOffsets({ 1: undefined })
    setDynamicHasMore(false)
    setSelectedUp(null)
    setUpVideoItems([])
    setUpVideoPage(1)
    setUpVideoTotal(0)
    setUpVideoError('')
    setFavoriteFolders([])
    setSelectedFolderId('')
    setFavoriteItems([])
    setFavoritePage(1)
    setFavoriteTotal(0)
    setFavoriteLoading(false)
    setFavoriteError('')
    setFeedType('recommend')
  }

  const isLoggedIn = loginStates[activePlatform]
  const profile = profiles[activePlatform]
  const platformInfo = PLATFORMS.find((p) => p.id === activePlatform)

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fa]">
      <header className="bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
              1
            </div>
            <h1 className="text-sm font-semibold text-gray-900">1App</h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="设置"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <PlatformTabs
        selected={activePlatform}
        onSelect={handlePlatformSelect}
        loginStates={loginStates}
      />

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoggedIn && profile ? (
          <div className="max-w-[1600px] mx-auto w-full min-h-full flex flex-col">
            <div className="px-4 pt-2 pb-1">
              <UserCard profile={profile} platform={activePlatform} onLogout={handleLogout} />
            </div>

            {activePlatform === 'bilibili' && (
              <div className="px-4 py-2 flex gap-2">
                <button
                  onClick={() => setFeedType('recommend')}
                  className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${
                    feedType === 'recommend'
                      ? 'bg-[#00A1D6] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  推荐内容
                </button>
                <button
                  onClick={() => setFeedType('following')}
                  className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${
                    feedType === 'following'
                      ? 'bg-[#00A1D6] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  关注动态
                </button>
                <button
                  onClick={() => setFeedType('followings')}
                  className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${
                    feedType === 'followings'
                      ? 'bg-[#00A1D6] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  关注列表
                </button>
                <button
                  onClick={() => setFeedType('favorites')}
                  className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${
                    feedType === 'favorites'
                      ? 'bg-[#00A1D6] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  我的收藏
                </button>
              </div>
            )}

            {feedType === 'followings' ? (
              selectedUp ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedUp(null)
                        setUpVideoItems([])
                        setUpVideoPage(1)
                        setUpVideoTotal(0)
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
                    >
                      ← 返回关注列表
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedUp.avatar ? (
                        <img src={selectedUp.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 shrink-0">
                          {selectedUp.nickname.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">{selectedUp.nickname}</span>
                      <span className="text-xs text-gray-400 shrink-0">的视频</span>
                    </div>
                  </div>
                  <FeedGrid items={upVideoItems} loading={upVideoLoading} error={upVideoError} onPlay={handlePlay} />
                  <Pagination
                    page={upVideoPage}
                    pageSize={10}
                    total={upVideoTotal}
                    loading={upVideoLoading}
                    onPageChange={handleUpVideoPageChange}
                  />
                </>
              ) : (
                <>
                  <FollowGrid items={followItems} loading={followLoading} error={followError} onSelectUser={handleSelectUp} />
                  <Pagination
                    page={followPage}
                    pageSize={10}
                    total={followTotal}
                    loading={followLoading}
                    onPageChange={handleFollowPageChange}
                  />
                </>
              )
            ) : feedType === 'favorites' ? (
              <>
                {favoriteFolders.length > 0 && (
                  <div className="px-4 py-2 flex gap-2 overflow-x-auto">
                    {favoriteFolders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleSelectFavoriteFolder(folder.id)}
                        className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition-colors shrink-0 ${
                          selectedFolderId === folder.id
                            ? 'bg-[#00A1D6] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {folder.title}
                        {folder.count !== undefined ? ` (${folder.count})` : ''}
                      </button>
                    ))}
                  </div>
                )}
                <FeedGrid items={favoriteItems} loading={favoriteLoading} error={favoriteError} onPlay={handlePlay} />
                {favoriteTotal > 0 && (
                  <Pagination
                    page={favoritePage}
                    pageSize={20}
                    total={favoriteTotal}
                    loading={favoriteLoading}
                    onPageChange={handleFavoritePageChange}
                  />
                )}
              </>
            ) : (
              <>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-gray-500 px-1">
                    {platformInfo?.name || ''} {feedType === 'following' ? '关注动态' : '推荐内容'}
                  </h2>
                  {feedType === 'recommend' && (platformInfo?.id === 'bilibili' || platformInfo?.id === 'xhs' || platformInfo?.id === 'douyin') && (
                    <button
                      onClick={handleRefreshRecommend}
                      disabled={feedLoading || recommendRefreshing}
                      className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 
                                 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-40 
                                 disabled:cursor-not-allowed transition-colors shrink-0 mr-1"
                    >
                      {recommendRefreshing ? '换一批中...' : '换一批'}
                    </button>
                  )}
                </div>
                <FeedGrid
                  items={feedType === 'following' ? followingFeedItems : feedItems}
                  loading={feedType === 'following' ? followingFeedLoading : feedLoading}
                  error={feedType === 'following' ? followingFeedError : feedError}
                  onPlay={handlePlay}
                />
                {feedType === 'following' && (followingFeedItems.length > 0 || dynamicHasMore) && (
                  <div className="flex items-center justify-center gap-4 px-4 pb-6">
                    <button
                      onClick={() => handleDynamicPageChange(dynamicPage - 1)}
                      disabled={dynamicPage <= 1}
                      className="px-4 py-1.5 text-sm rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      上一页
                    </button>
                    <span className="text-sm text-gray-500">第 {dynamicPage} 页</span>
                    <button
                      onClick={() => handleDynamicPageChange(dynamicPage + 1)}
                      disabled={!dynamicHasMore}
                      className="px-4 py-1.5 text-sm rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : isLoggedIn ? (
          <div className="max-w-md mx-auto p-8 text-center">
            <p className="text-gray-500">已登录，但用户资料读取失败</p>
            <p className="text-xs text-gray-400 mt-1">请尝试重新读取资料或重新登录</p>
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={handleRetryProfile}
                className="px-4 py-2 text-sm text-blue-500 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
              >
                重新读取资料
              </button>
              <button
                onClick={handleLogin}
                className="px-4 py-2 text-sm text-orange-500 hover:text-orange-600 rounded-xl hover:bg-orange-50 transition-colors"
              >
                重新登录
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <LoginView platform={activePlatform} onLogin={handleLogin} />
          </div>
        )}
      </div>
      {playingVideo && (
        <VideoPlayerModal
          item={playingVideo}
          onClose={handleClosePlayer}
          onFavoriteFoldersChanged={handleFavoriteFoldersChanged}
        />
      )}
      {selectedXhsItem && (
        <XhsNoteModal
          item={selectedXhsItem}
          onClose={handleCloseXhsNote}
        />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
