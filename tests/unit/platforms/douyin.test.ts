import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockHasCookie, mockNavResult } = vi.hoisted(() => ({
  mockHasCookie: { value: true },
  mockNavResult: { value: null as { x: number; y: number } | null }
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(function () { return {
    loadURL: vi.fn(() => Promise.resolve()),
    webContents: {
      on: vi.fn(),
      executeJavaScript: vi.fn(() => Promise.resolve(mockNavResult.value)),
      send: vi.fn(),
      debugger: { isAttached: vi.fn(() => false), detach: vi.fn() },
      isDestroyed: vi.fn(() => false),
      focus: vi.fn(),
      sendInputEvent: vi.fn()
    },
    on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false), focus: vi.fn()
  }}),
  session: {
    fromPartition: vi.fn(() => ({
      cookies: {
        get: vi.fn(() => {
          if (mockHasCookie.value) return Promise.resolve([{ name: 'sessionid', value: 'abc' }])
          return Promise.resolve([])
        })
      },
      request: vi.fn(() => ({ on: vi.fn(() => {}), end: vi.fn() }) as any),
      clearStorageData: vi.fn(() => Promise.resolve())
    }))
  },
  net: { request: vi.fn(() => ({ on: vi.fn(), end: vi.fn() })) },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/sessions', () => ({
  getSession: vi.fn(() => ({
    cookies: { get: vi.fn(() => {
      if (mockHasCookie.value) return Promise.resolve([{ name: 'sessionid', value: 'abc' }])
      return Promise.resolve([])
    })}
  }))
}))

vi.mock('../../../src/main/logger', () => ({ networkLog: vi.fn() }))

import { checkLogin, getProfile, getFeed, extractProfileFromWindow, logout, navigateToMyProfile } from '../../../src/main/platforms/douyin'

describe('douyin platform', () => {
  beforeEach(() => { vi.clearAllMocks(); mockHasCookie.value = true; mockNavResult.value = null })

  describe('checkLogin', () => {
    it('logged in when cookie present', async () => expect((await checkLogin()).loggedIn).toBe(true))
    it('logged out when no cookie', async () => {
      mockHasCookie.value = false
      expect((await checkLogin()).loggedIn).toBe(false)
    })
  })

  describe('getProfile', () => {
    it('returns null', async () => expect(await getProfile()).toBeNull())
  })

  describe('extractProfileFromWindow', () => {
    it('null when no profile', async () => {
      const w = { webContents: { executeJavaScript: vi.fn(() => Promise.resolve(null)), on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) }
      expect(await extractProfileFromWindow(w as any)).toBeNull()
    })
  })

  describe('getFeed', () => {
    it('empty', async () => expect(await getFeed(1)).toEqual([]))
  })

  describe('logout', () => {
    it('completes', async () => { await logout() })
  })

  describe('getFeed SSR fallback', () => {
    it('handles malformed SSR data gracefully', async () => {
      // Mock session.request to return HTML with RENDER_DATA
      const mockReq = (cb: Function) => {
        const req = {
          on: vi.fn((event: string, handler: any) => {
            if (event === 'response') {
              handler({
                on: vi.fn((e: string, h: any) => {
                  if (e === 'data') h(Buffer.from('<html></html>'))
                  if (e === 'end') h()
                }),
                statusCode: 200,
                headers: {}
              })
            }
            return req
          }),
          end: vi.fn()
        }
        return req
      }
      const { getSession } = await import('../../../src/main/sessions')
      ;(getSession as any).mockReturnValueOnce({
        request: mockReq,
        cookies: { get: vi.fn(() => Promise.resolve([])) }
      })
      const items = await getFeed(1)
      expect(items).toEqual([])
    })
  })

  describe('extractProfileFromWindow with profile', () => {
    it('returns null when execute result is null', async () => {
      const w = { webContents: { executeJavaScript: vi.fn(() => Promise.resolve(null)), on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) }
      expect(await extractProfileFromWindow(w as any)).toBeNull()
    })
    it('returns profile when valid data found', async () => {
      const profileData = {
        nickname: 'TestUser',
        avatar: 'https://avatar.com/1.jpg',
        uid: '12345',
        bio: 'Hello',
        _following: 100,
        _follower: 50,
        _likes: 200
      }
      const w = { webContents: { executeJavaScript: vi.fn(() => Promise.resolve(profileData)), on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) }
      const r = await extractProfileFromWindow(w as any)
      expect(r).not.toBeNull()
      expect(r!.nickname).toBe('TestUser')
      expect(r!.stats).toBeDefined()
    })
  })

  describe('navigateToMyProfile', () => {
    it('navigates', async () => {
      mockNavResult.value = { x: 100, y: 200 }
      const w = {
        webContents: {
          executeJavaScript: vi.fn(() => Promise.resolve(mockNavResult.value)),
          on: vi.fn(),
          isDestroyed: vi.fn(() => false),
          focus: vi.fn(),
          sendInputEvent: vi.fn()
        },
        isDestroyed: vi.fn(() => false),
        on: vi.fn(), close: vi.fn(), focus: vi.fn()
      }
      expect(await navigateToMyProfile(w as any)).toBe(true)
    })
    it('returns false when no nav target', async () => {
      const w = {
        webContents: { executeJavaScript: vi.fn(() => Promise.resolve(null)), on: vi.fn(), isDestroyed: vi.fn(() => false), focus: vi.fn(), sendInputEvent: vi.fn() },
        isDestroyed: vi.fn(() => false), on: vi.fn(), close: vi.fn(), focus: vi.fn()
      }
      expect(await navigateToMyProfile(w as any)).toBe(false)
    })
  })

  describe('extractProfileFromWindow URL normalization', () => {
    it('handles http:// avatar URL', async () => {
      const result = {
        nickname: 'User',
        avatar: 'http://avatar.com/1.jpg',
        uid: '123',
        bio: ''
      }
      const w = { webContents: { executeJavaScript: vi.fn(() => Promise.resolve(result)), on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) }
      const r = await extractProfileFromWindow(w as any)
      expect(r).not.toBeNull()
      expect(r!.avatar).toBe('https://avatar.com/1.jpg')
    })
    it('handles // avatar URL', async () => {
      const result = {
        nickname: 'User',
        avatar: '//avatar.com/2.jpg',
        uid: '124',
        bio: ''
      }
      const w = { webContents: { executeJavaScript: vi.fn(() => Promise.resolve(result)), on: vi.fn() }, on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false) }
      const r = await extractProfileFromWindow(w as any)
      expect(r).not.toBeNull()
      expect(r!.avatar).toBe('https://avatar.com/2.jpg')
    })
  })

  describe('checkLogin profile path', () => {
    it('returns profile when getProfileViaHomePage succeeds', async () => {
      // Mock session.request to return HTML with valid RENDER_DATA
      const ssrHtml = '<html><script id="RENDER_DATA">' + encodeURIComponent(JSON.stringify({ app: { userInfo: { nickname: 'SSRUser', avatar: 'https://avatar.jpg', uid: '999' } } })) + '</script></html>'
      const { getSession } = await import('../../../src/main/sessions')
      ;(getSession as any).mockReturnValueOnce({
        request: vi.fn(() => ({
          on: vi.fn((event: string, handler: any) => {
            if (event === 'response') {
              handler({
                on: vi.fn((e: string, h: any) => {
                  if (e === 'data') h(Buffer.from(ssrHtml))
                  if (e === 'end') h()
                }),
                statusCode: 200,
                headers: {}
              })
            }
            return { on: vi.fn(), end: vi.fn() }
          }),
          end: vi.fn()
        })),
        cookies: { get: vi.fn(() => Promise.resolve([{ name: 'sessionid', value: 'x' }])) }
      })
      const r = await checkLogin()
      expect(r.loggedIn).toBe(true)
      expect(r.profile?.nickname).toBe('SSRUser')
    })
  })
})
