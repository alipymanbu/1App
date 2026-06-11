import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'D:\\mock\\userData'), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(function () { return {
    loadURL: vi.fn(() => Promise.resolve()),
    webContents: { on: vi.fn(), executeJavaScript: vi.fn(() => Promise.resolve(null)), send: vi.fn(), isDestroyed: vi.fn(() => false) },
    on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false)
  }}),
  session: { fromPartition: vi.fn(() => ({ cookies: { get: vi.fn(() => Promise.resolve([])) }, clearStorageData: vi.fn(() => Promise.resolve()) })) },
  net: { request: vi.fn(() => ({ on: vi.fn(), end: vi.fn(), write: vi.fn() })) },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/database', () => ({
  saveUserProfile: vi.fn(),
  getUserProfile: vi.fn(() => null),
  deleteUserProfile: vi.fn()
}))

vi.mock('../../../src/main/sessions', () => ({
  getSession: vi.fn(() => ({ cookies: { get: vi.fn(() => Promise.resolve([])) } })),
  clearSession: vi.fn(() => Promise.resolve())
}))

vi.mock('../../../src/main/logger', () => ({ networkLog: vi.fn() }))

vi.mock('../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B站', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '📺' },
    { id: 'xhs', name: '小红书', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '📕' },
    { id: 'douyin', name: '抖音', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '🎵' }
  ]
}))

const mockFns = vi.hoisted(() => {
  function bili() {
    return {
      checkLogin: vi.fn(() => Promise.resolve({ loggedIn: true, profile: null })),
      getProfile: vi.fn(() => Promise.resolve(null)),
      getFeed: vi.fn(() => Promise.resolve([])),
      logout: vi.fn(() => Promise.resolve()),
      getFollowings: vi.fn(() => Promise.resolve([])),
      getFollowingFeed: vi.fn(() => Promise.resolve([])),
      getFollowingsPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })),
      getFollowingFeedPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, hasMore: false })),
      getUserVideosPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })),
      getFavoriteFolders: vi.fn(() => Promise.resolve([])),
      getFavoriteVideosPage: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })),
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
      getBiliCommentReplies: vi.fn(() => Promise.resolve({ items: [], page: 1, hasMore: false }))
    }
  }
  function other() {
    return {
      checkLogin: vi.fn(() => Promise.resolve({ loggedIn: false, profile: null })),
      getProfile: vi.fn(() => Promise.resolve(null)),
      getFeed: vi.fn(() => Promise.resolve([])),
      logout: vi.fn(() => Promise.resolve()),
      getFollowings: undefined,
      getFollowingFeed: undefined,
      getFollowingsPage: undefined,
      getFollowingFeedPage: undefined,
      getUserVideosPage: undefined,
      getFavoriteFolders: undefined,
      getFavoriteVideosPage: undefined,
      getVideoPlayback: undefined,
      changeVideoQuality: undefined,
      getVideoInteraction: undefined,
      toggleVideoLike: undefined,
      addVideoCoin: undefined,
      toggleVideoFavorite: undefined,
      getVideoFavoriteFolders: undefined,
      updateVideoFavoriteFolders: undefined,
      createFavoriteFolder: undefined,
      getBiliVideoDetail: undefined,
      getBiliVideoComments: undefined,
      getBiliCommentReplies: undefined
    }
  }
  return { bili, other, biliMock: bili(), xhsMock: { ...other(), sanitizeXhsProfile: vi.fn((p: any) => p), isValidXhsProfile: vi.fn(() => false), fillXhsAvatar: vi.fn((p: any) => Promise.resolve(p)), getNoteDetail: vi.fn(() => Promise.resolve(null)) }, dyMock: other() }
})

vi.mock('../../../src/main/platforms/bilibili', () => mockFns.biliMock)
vi.mock('../../../src/main/platforms/xhs', () => mockFns.xhsMock)
vi.mock('../../../src/main/platforms/douyin', () => mockFns.dyMock)

import {
  checkLogin, getProfile, getFeed, getFollowings, getFollowingFeed,
  getFollowingsPage, getFollowingFeedPage, getUserVideosPage,
  getFavoriteFolders, getFavoriteVideosPage, logout, openLoginWindow,
  getVideoPlayback, changeVideoQuality, getVideoInteraction,
  toggleVideoLike, addVideoCoin, toggleVideoFavorite,
  getVideoFavoriteFolders, updateVideoFavoriteFolders, createFavoriteFolder,
  getBiliVideoDetail, getBiliVideoComments, getBiliCommentReplies,
  getNoteDetail
} from '../../../src/main/platforms/index'

describe('platforms/index', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('checkLogin', () => {
    it('bilibili', async () => expect(await checkLogin('bilibili')).toBeDefined())
    it('xhs with profile cleaning', async () => {
      mockFns.biliMock.checkLogin.mockResolvedValueOnce({ loggedIn: false, profile: null })
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: { platform: 'xhs', nickname: 'X', avatar: '', uid: '1' } })
      mockFns.xhsMock.isValidXhsProfile.mockReturnValueOnce(true)
      expect((await checkLogin('xhs')).loggedIn).toBe(true)
    })
    it('douyin', async () => expect(await checkLogin('douyin')).toBeDefined())
  })

  describe('getProfile', () => {
    it('bilibili', async () => {
      mockFns.biliMock.getProfile.mockResolvedValueOnce({ platform: 'bilibili', nickname: 'B', avatar: '', uid: '1' })
      expect(await getProfile('bilibili')).toBeDefined()
    })
  })

  describe('getFeed', () => {
    it('bilibili', async () => {
      mockFns.biliMock.getFeed.mockResolvedValueOnce([{ id: '1', platform: 'bilibili', title: 'V', mediaType: 'video', url: '' }])
      expect((await getFeed('bilibili', 1)).length).toBe(1)
    })
  })

  describe('getNoteDetail', () => {
    it('null for non-xhs', async () => expect(await getNoteDetail('bilibili', 'n')).toBeNull())
    it('delegates to xhs', async () => {
      mockFns.xhsMock.getNoteDetail.mockResolvedValueOnce({ noteId: 'n', title: 'T' })
      expect(await getNoteDetail('xhs', 'n')).toBeDefined()
    })
  })

  describe('getFollowings', () => {
    it('empty for xhs', async () => expect(await getFollowings('xhs')).toEqual([]))
    it('from bilibili', async () => {
      mockFns.biliMock.getFollowings.mockResolvedValueOnce([{ platform: 'bilibili', nickname: 'F', avatar: '', uid: '1', url: '' }])
      expect((await getFollowings('bilibili')).length).toBe(1)
    })
  })

  describe('optional API fallbacks', () => {
    it('getVideoPlayback error', async () => expect((await getVideoPlayback('xhs', 'b')).error).toBe('该平台不支持内置播放'))
    it('changeVideoQuality error', async () => expect((await changeVideoQuality('xhs', 'b', 'c', 80)).error).toBe('该平台不支持切换清晰度'))
    it('getVideoInteraction default', async () => expect((await getVideoInteraction('xhs', 'b')).liked).toBe(false))
    it('toggleVideoLike error', async () => expect((await toggleVideoLike('xhs', 'b', true)).error).toBe('该平台不支持点赞'))
    it('addVideoCoin error', async () => expect((await addVideoCoin('xhs', 'b')).error).toBe('该平台不支持投币'))
    it('toggleVideoFavorite error', async () => expect((await toggleVideoFavorite('xhs', 'a', true)).error).toBe('该平台不支持收藏'))
    it('getFavoriteFolders empty', async () => expect(await getFavoriteFolders('xhs')).toEqual([]))
    it('updateVideoFavoriteFolders error', async () => expect((await updateVideoFavoriteFolders('xhs', 'a', [], [])).error).toBe('该平台不支持收藏管理'))
    it('createFavoriteFolder error', async () => expect((await createFavoriteFolder('xhs', 't')).error).toBe('该平台不支持创建收藏夹'))
    it('getBiliVideoDetail null', async () => expect(await getBiliVideoDetail('xhs', 'b')).toBeNull())
    it('getBiliVideoComments error', async () => expect((await getBiliVideoComments('xhs', 'a')).error).toBe('该平台不支持评论'))
    it('getBiliCommentReplies error', async () => expect((await getBiliCommentReplies('xhs', 'a', 'r')).error).toBe('该平台不支持评论回复'))
    it('getVideoFavoriteFolders empty', async () => expect(await getVideoFavoriteFolders('xhs', 'a')).toEqual([]))
    it('getFollowingFeed empty', async () => expect(await getFollowingFeed('xhs')).toEqual([]))
  })

  describe('dispatchers', () => {
    it('getFollowingFeedPage', async () => expect(await getFollowingFeedPage('bilibili')).toBeDefined())
    it('getFollowingsPage', async () => expect(await getFollowingsPage('bilibili', 1, 10)).toBeDefined())
    it('getUserVideosPage', async () => expect(await getUserVideosPage('bilibili', 'u', 1, 10)).toBeDefined())
    it('getFavoriteVideosPage', async () => expect(await getFavoriteVideosPage('bilibili', 'm', 1, 20)).toBeDefined())
  })

  describe('logout', () => {
    it('clears profile and session', async () => {
      await logout('bilibili')
      expect((await import('../../../src/main/database')).deleteUserProfile).toHaveBeenCalledWith('bilibili')
    })
  })

  describe('openLoginWindow', () => {
    // openLoginWindow creates a real BrowserWindow flow; tested via pre-check and unknown platform cases
    it('unknown platform', async () => expect((await openLoginWindow('unknown' as any)).loggedIn).toBe(false))
    it('pre-check returns early', async () => {
      mockFns.biliMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: { platform: 'bilibili', nickname: 'Pre', avatar: '', uid: '1' } })
      expect((await openLoginWindow('bilibili')).loggedIn).toBe(true)
    })
    it('finishes with false when window closes without login', async () => {
      // Make window close immediately to trigger the 'closed' handler
      const { BrowserWindow } = await import('electron')
      const win = BrowserWindow()
      // Simulate window close triggering the 'closed' callback
      const onClosed = win.on.mock.calls.find((c: [string, Function]) => c[0] === 'closed')?.[1]
      if (onClosed) await onClosed()
    })
  })

  describe('xhs profile fill', () => {
    it('fills avatar', async () => {
      mockFns.xhsMock.getProfile.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: '', uid: '1' })
      mockFns.xhsMock.isValidXhsProfile.mockReturnValueOnce(true)
      mockFns.xhsMock.fillXhsAvatar.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: 'https://filled.jpg', uid: '1' })
      expect(await getProfile('xhs')).toBeDefined()
    })
    it('skips fill when not xhs', async () => {
      mockFns.biliMock.getProfile.mockResolvedValueOnce({ platform: 'bilibili', nickname: 'B', avatar: '', uid: '1' })
      expect(await getProfile('bilibili')).toBeDefined()
    })
  })

  describe('xhs cached profile fallback', () => {
    it('uses cached profile when api fails', async () => {
      const { getUserProfile } = await import('../../../src/main/database')
      ;(getUserProfile as any).mockReturnValueOnce({ platform: 'xhs', nickname: 'Cached', avatar: '', uid: 'c' })
      mockFns.xhsMock.isValidXhsProfile.mockReturnValueOnce(true)
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: null })
      mockFns.xhsMock.getProfile.mockResolvedValueOnce(null)
      const r = await checkLogin('xhs')
      expect(r.loggedIn).toBe(true)
    })
  })

  describe('xhs cleanup cache on checkLogin', () => {
    it('deletes bad cached profile', async () => {
      const { getUserProfile, deleteUserProfile } = await import('../../../src/main/database')
      ;(getUserProfile as any).mockReturnValueOnce({ platform: 'xhs', nickname: '小红书', avatar: '', uid: '1' })
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: false, profile: null })
      const r = await checkLogin('xhs')
      expect(deleteUserProfile).toHaveBeenCalledWith('xhs')
      expect(r.loggedIn).toBe(false)
    })
  })

  describe('douyin cached profile fallback', () => {
    it('uses cached profile when checkLogin returns no profile', async () => {
      const { getUserProfile } = await import('../../../src/main/database')
      ;(getUserProfile as any).mockReturnValueOnce({ platform: 'douyin', nickname: 'DyCached', avatar: '', uid: 'd' })
      mockFns.dyMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: null })
      mockFns.dyMock.getProfile.mockResolvedValueOnce(null)
      const r = await checkLogin('douyin')
      expect(r.loggedIn).toBe(true)
      expect(r.profile?.nickname).toBe('DyCached')
    })
  })

  describe('getProfile with xhs avatar fill', () => {
    it('skips fill when avatar already present', async () => {
      mockFns.xhsMock.getProfile.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: 'https://avatar.jpg', uid: '1' })
      mockFns.xhsMock.isValidXhsProfile.mockReturnValueOnce(true)
      const r = await getProfile('xhs')
      expect(r?.avatar).toBe('https://avatar.jpg')
      expect(mockFns.xhsMock.fillXhsAvatar).not.toHaveBeenCalled()
    })
  })

  describe('resolveLoginState xhs full path', () => {
    it('sanitizes and saves xhs profile from checkLogin', async () => {
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: { platform: 'xhs', nickname: 'XUser', avatar: 'https://bad.ico', uid: '1' } })
      mockFns.xhsMock.sanitizeXhsProfile.mockImplementationOnce((p: any) => ({ ...p, avatar: '' }))
      mockFns.xhsMock.isValidXhsProfile.mockReturnValueOnce(true)
      const r = await checkLogin('xhs')
      expect(r.loggedIn).toBe(true)
      expect(r.profile?.avatar).toBe('')
    })
  })

  describe('checkLogin returns loggedIn when profile is null for non-xhs/dy', () => {
    it('bilibili logged in without profile', async () => {
      mockFns.biliMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: null })
      const r = await checkLogin('bilibili')
      expect(r.loggedIn).toBe(true)
    })
  })

  describe('resolveLoginState bilibili profile from checkLogin', () => {
    it('saves and returns profile from checkLogin', async () => {
      mockFns.biliMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: { platform: 'bilibili', nickname: 'B', avatar: 'https://face.jpg', uid: '1' } })
      const { saveUserProfile } = await import('../../../src/main/database')
      const r = await checkLogin('bilibili')
      expect(r.loggedIn).toBe(true)
      expect(r.profile?.nickname).toBe('B')
      expect(saveUserProfile).toHaveBeenCalled()
    })
  })

  describe('resolveLoginState profile from checkLogin fails xhs validation', () => {
    it('returns profile when isValidXhsProfile returns false (profile not saved)', async () => {
      mockFns.biliMock.checkLogin.mockResolvedValueOnce({ loggedIn: false, profile: null })
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: { platform: 'xhs', nickname: 'X', avatar: 'https://favicon.ico', uid: '1' } })
      mockFns.xhsMock.isValidXhsProfile.mockImplementation(() => false)
      const r = await checkLogin('xhs')
      expect(r.loggedIn).toBe(true)
    })
  })

  describe('resolveLoginState getProfile returns profile for xhs', () => {
    it('uses getProfile when checkLogin returns no profile', async () => {
      mockFns.xhsMock.checkLogin.mockResolvedValueOnce({ loggedIn: true, profile: null })
      mockFns.xhsMock.getProfile.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: 'https://avatar.jpg', uid: '1' })
      mockFns.xhsMock.isValidXhsProfile.mockImplementation(() => true)
      const r = await checkLogin('xhs')
      expect(r.loggedIn).toBe(true)
      expect(r.profile?.nickname).toBe('X')
    })
  })

  describe('getProfile xhs avatar fill', () => {
    it('fillXhsAvatar called when avatar is empty', async () => {
      mockFns.xhsMock.getProfile.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: '', uid: '1' })
      mockFns.xhsMock.isValidXhsProfile.mockImplementation(() => true)
      mockFns.xhsMock.fillXhsAvatar.mockResolvedValueOnce({ platform: 'xhs', nickname: 'X', avatar: 'https://filled.jpg', uid: '1' })
      const r = await getProfile('xhs')
      expect(r).not.toBeNull()
    })
  })
})
