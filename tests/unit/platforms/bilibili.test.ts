import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockNetRequest, shouldFailRef } = vi.hoisted(() => {
  const shouldFailRef = { value: false }
  const mockNetRequest = vi.fn((options: any) => {
    const data = shouldFailRef.value
      ? '{}'
      : JSON.stringify({ code: 0, data: { isLogin: true, mid: 123456, uname: 'TestUser', face: 'https://i0.hdslb.com/bfs/face/avatar.jpg', level_info: { current_level: 5 } } })
    const req = {
      on: vi.fn((event: string, handler: Function) => {
        if (event === 'response') {
          handler({
            on: vi.fn((e: string, h: Function) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }),
            statusCode: shouldFailRef.value ? 0 : 200,
            headers: {}
          })
        }
        return req
      }),
      end: vi.fn(),
      write: vi.fn()
    }
    return req
  })
  return { mockNetRequest, shouldFailRef }
})

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: vi.fn(() => ({ cookies: { get: vi.fn(() => Promise.resolve([])) } })) },
  net: { request: mockNetRequest },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/sessions', () => ({
  getSession: vi.fn(() => ({ cookies: { get: vi.fn(() => Promise.resolve([])) } }))
}))

vi.mock('../../../src/main/logger', () => ({ networkLog: vi.fn() }))

vi.mock('../../../src/main/videoProxy', () => ({
  startPlayback: vi.fn(() => 'mock-token'),
  getManifestUrl: vi.fn(() => 'http://localhost:12345/mpd/mock-token'),
  removePlayback: vi.fn(),
  updateSession: vi.fn(() => true)
}))

import {
  checkLogin, getProfile, getFeed, getFollowings, getFollowingsPage,
  getFollowingFeed, getFollowingFeedPage, getUserVideosPage,
  getVideoPlayback, changeVideoQuality, getVideoInteraction,
  toggleVideoLike, addVideoCoin,
  getVideoFavoriteFolders, updateVideoFavoriteFolders, createFavoriteFolder,
  getFavoriteFolders, getFavoriteVideosPage, getBiliVideoDetail,
  getBiliVideoComments, getBiliCommentReplies, logout
} from '../../../src/main/platforms/bilibili'

describe('bilibili platform', () => {
  beforeEach(() => { vi.clearAllMocks(); shouldFailRef.value = false })

  describe('checkLogin', () => {
    it('logged in with profile', async () => {
      const r = await checkLogin()
      expect(r.loggedIn).toBe(true)
      expect(r.profile!.nickname).toBe('TestUser')
    })
    it('fetch failure', async () => {
      shouldFailRef.value = true
      expect((await checkLogin()).loggedIn).toBe(false)
    })
    it('not logged in', async () => {
      mockNetRequest.mockImplementationOnce((options: any) => {
        const data = JSON.stringify({ code: 0, data: { isLogin: false } })
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      expect((await checkLogin()).loggedIn).toBe(false)
    })
  })

  describe('getProfile', () => {
    it('returns profile', async () => expect(await getProfile()).toBeDefined())
  })

  describe('safeParseJson', () => {
    it('returns null for HTML response', async () => {
      shouldFailRef.value = true
      const r = await checkLogin()
      expect(r.loggedIn).toBe(false)
    })
  })

  describe('getFeed', () => {
    it('returns items from rcmd', async () => {
      mockNetRequest.mockImplementationOnce((options: any) => {
        const data = JSON.stringify({ code: 0, data: { item: [{ bvid: 'BV1', title: 'V1', pic: '', owner: { mid: 1, name: 'A', face: '' }, stat: {}, ctime: 1000000000, aid: 1 }] } })
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      expect((await getFeed(1)).length).toBe(1)
    })
    it('empty on failure', async () => {
      shouldFailRef.value = true
      expect(await getFeed(1)).toEqual([])
    })
  })

  describe('getFollowings', () => {
    it('returns following list', async () => expect(await getFollowings()).toEqual([]))
    it('empty when not logged in', async () => {
      mockNetRequest.mockImplementationOnce((options: any) => {
        const data = JSON.stringify({ code: 0, data: { isLogin: false } })
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      expect(await getFollowings()).toEqual([])
    })
  })

  describe('getFollowingsPage', () => {
    it('error', async () => {
      shouldFailRef.value = true
      expect((await getFollowingsPage(1, 10)).items).toEqual([])
    })
  })

  describe('getFollowingFeed', () => {
    it('empty on failure', async () => {
      shouldFailRef.value = true
      expect(await getFollowingFeed()).toEqual([])
    })
  })

  describe('getFollowingFeedPage', () => {
    it('error', async () => {
      shouldFailRef.value = true
      expect((await getFollowingFeedPage()).items).toEqual([])
    })
  })

  describe('interaction methods', () => {
    it('getVideoPlayback', async () => expect(await getVideoPlayback('BV1', 80)).toBeDefined())
    it('changeVideoQuality', async () => expect(await changeVideoQuality('BV1', 'c', 80, 't')).toBeDefined())
    it('getVideoInteraction', async () => expect(await getVideoInteraction('BV1', '1')).toBeDefined())
    it('toggleVideoLike', async () => expect(await toggleVideoLike('BV1', true)).toBeDefined())
    it('addVideoCoin', async () => expect(await addVideoCoin('BV1', '1', 2, true)).toBeDefined())
    it('getVideoFavoriteFolders', async () => expect(await getVideoFavoriteFolders('1')).toBeDefined())
    it('updateVideoFavoriteFolders', async () => expect(await updateVideoFavoriteFolders('1', ['a'], ['d'])).toBeDefined())
    it('createFavoriteFolder', async () => expect(await createFavoriteFolder('New')).toBeDefined())
    it('getFavoriteFolders', async () => expect(await getFavoriteFolders()).toEqual([]))
    it('getFavoriteVideosPage', async () => expect(await getFavoriteVideosPage('m', 1, 20)).toBeDefined())
    it('getBiliVideoDetail', async () => expect(await getBiliVideoDetail('BV1', '1')).toBeDefined())
    it('getBiliVideoComments', async () => expect(await getBiliVideoComments('1')).toBeDefined())
    it('getBiliCommentReplies', async () => expect(await getBiliCommentReplies('1', 'r')).toBeDefined())
    it('getUserVideosPage', async () => expect(await getUserVideosPage('123', 1, 10)).toBeDefined())
    it('logout', async () => { await logout() })
  })

  describe('error branches', () => {
    it('createFavoriteFolder with empty title', async () => {
      const r = await createFavoriteFolder('')
      expect(r.success).toBe(false)
    })
    it('createFavoriteFolder with too-long title', async () => {
      const r = await createFavoriteFolder('x'.repeat(21))
      expect(r.success).toBe(false)
    })
    it('getFeed tries popular endpoint when rcmd fails HTTP', async () => {
      const rcmdData = JSON.stringify({ code: 0, data: { item: [] } })
      const popData = JSON.stringify({ code: 0, data: { list: [{ bvid: 'BVpop', title: 'Popular', pic: '', owner: { mid: 1, name: 'P', face: '' }, stat: {}, ctime: 1000000000, aid: 1 }] } })
      mockNetRequest
        .mockImplementationOnce((options: any) => {
          const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(rcmdData)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
          return req
        })
        .mockImplementationOnce((options: any) => {
          const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(popData)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
          return req
        })
      const items = await getFeed(1)
      expect(items.length).toBe(1)
    })
    it('getVideoPlayback fails gracefully when view API returns no data', async () => {
      mockNetRequest.mockImplementation((options: any) => {
        const data = JSON.stringify({ code: -1, message: 'not found' })
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      const r = await getVideoPlayback('BV1_fail', 80)
      expect(r.playable).toBe(false)
    })
    it('changeVideoQuality fails when getVideoPlayback returns not playable', async () => {
      const r = await changeVideoQuality('BV1_bad', 'c', 80, 'tok')
      expect(r).toBeDefined()
    })
    it('getFeed returns empty when all endpoints fail', async () => {
      const emptyData = JSON.stringify({ code: -1 })
      mockNetRequest.mockImplementation((options: any) => {
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(emptyData)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      expect(await getFeed(1)).toEqual([])
    })
    it('getFollowings handles empty API response', async () => {
      mockNetRequest.mockImplementation((options: any) => {
        const data = JSON.stringify({ code: -1 })
        const req = { on: vi.fn((event, handler) => { if (event === 'response') handler({ on: vi.fn((e, h) => { if (e === 'data') h(Buffer.from(data)); if (e === 'end') h() }), statusCode: 200, headers: {} }); return req }), end: vi.fn(), write: vi.fn() }
        return req
      })
      expect(await getFollowings()).toEqual([])
    })
  })
})
