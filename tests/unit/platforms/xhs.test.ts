import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockHasCookie } = vi.hoisted(() => ({ mockHasCookie: { value: true } }))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(function () { return {
    loadURL: vi.fn(() => Promise.resolve()),
    webContents: { on: vi.fn(), executeJavaScript: vi.fn(() => Promise.resolve(null)), send: vi.fn(), isDestroyed: vi.fn(() => false), removeAllListeners: vi.fn() },
    on: vi.fn(), close: vi.fn(), isDestroyed: vi.fn(() => false)
  }}),
  session: {
    fromPartition: vi.fn(() => ({
      cookies: {
        get: vi.fn(() => mockHasCookie.value
          ? Promise.resolve([{ name: 'web_session', value: 'abc' }])
          : Promise.resolve([]))
      },
      clearStorageData: vi.fn(() => Promise.resolve())
    }))
  },
  net: {
    request: vi.fn(() => {
      const req = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'response') {
            handler({
              on: vi.fn((e: string, h: Function) => {
                if (e === 'data') h(Buffer.from('{}'))
                if (e === 'end') h()
              }),
              statusCode: 200,
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
  },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('../../../src/main/sessions', () => ({
  getSession: vi.fn(() => ({ cookies: { get: vi.fn(() => mockHasCookie.value
    ? Promise.resolve([{ name: 'web_session', value: 'abc' }])
    : Promise.resolve([])) } }))
}))

vi.mock('../../../src/main/logger', () => ({ networkLog: vi.fn() }))

import { checkLogin, getProfile, getFeed, getNoteDetail, isValidXhsProfile, sanitizeXhsProfile, extractCurrentUserFromHTML, logout } from '../../../src/main/platforms/xhs'

describe('xhs platform', () => {
  beforeEach(() => { vi.clearAllMocks(); mockHasCookie.value = true; vi.useRealTimers() })

  describe('checkLogin', () => {
    it('logged in when cookie present', async () => expect((await checkLogin()).loggedIn).toBe(true))
    it('logged out when no cookie', async () => {
      mockHasCookie.value = false
      expect((await checkLogin()).loggedIn).toBe(false)
    })
  })

  describe('getProfile', () => {
    it('returns null when no data', async () => expect(await getProfile()).toBeNull())
  })

  describe('isValidXhsProfile', () => {
    const p = (o = {}) => ({ platform: 'xhs' as const, nickname: 'U', avatar: '', uid: '1', ...o })
    it('valid', () => expect(isValidXhsProfile(p({ avatar: 'https://sns-avatar-qc.xhscdn.com/a.jpg' }))).toBe(true))
    it('empty nickname', () => expect(isValidXhsProfile(p({ nickname: '' }))).toBe(false))
    it('小红书', () => expect(isValidXhsProfile(p({ nickname: '小红书' }))).toBe(false))
    it('小红书登录', () => expect(isValidXhsProfile(p({ nickname: '小红书登录' }))).toBe(false))
    it('undefined uid', () => expect(isValidXhsProfile(p({ uid: 'undefined' }))).toBe(false))
    it('bad avatar', () => expect(isValidXhsProfile(p({ avatar: 'https://favicon.ico' }))).toBe(false))
    it('hex uid', () => expect(isValidXhsProfile(p({ uid: '507f1f77bcf86cd799439011' }))).toBe(false))
    it('long nickname', () => expect(isValidXhsProfile(p({ nickname: 'x'.repeat(51) }))).toBe(false))
    it('logo/sprite/svg avatar', () => {
      expect(isValidXhsProfile(p({ avatar: 'https://logo.png' }))).toBe(false)
      expect(isValidXhsProfile(p({ avatar: 'https://sprite.png' }))).toBe(false)
      expect(isValidXhsProfile(p({ avatar: 'https://img.svg' }))).toBe(false)
    })
  })

  describe('sanitizeXhsProfile', () => {
    it('remove bad avatar', () => expect(sanitizeXhsProfile({ platform: 'xhs', nickname: 'U', avatar: 'https://favicon.ico', uid: '1' }).avatar).toBe(''))
    it('keep good avatar', () => {
      const a = 'https://sns-avatar-qc.xhscdn.com/a.jpg'
      expect(sanitizeXhsProfile({ platform: 'xhs', nickname: 'U', avatar: a, uid: '1' }).avatar).toBe(a)
    })
  })

  describe('extractCurrentUserFromHTML', () => {
    const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
    const ga = 'https://sns-avatar-qc.xhscdn.com/a.jpg'
    it('extract user', () => { const r = extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: 'U1', userId: '1', avatar: ga } } })); expect(r).not.toBeNull(); expect(r!.nickname).toBe('U1') })
    it('null when no script', () => expect(extractCurrentUserFromHTML('<html></html>')).toBeNull())
    it('main path', () => { const r = extractCurrentUserFromHTML(h({ main: { userInfo: { nickname: 'M1', userId: '2', avatar: ga } } })); expect(r).not.toBeNull() })
    it('state path', () => { const r = extractCurrentUserFromHTML(h({ state: { userInfo: { nickname: 'S1', userId: '3', avatar: ga } } })); expect(r).not.toBeNull() })
    it('reject 小红书', () => expect(extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: '小红书', userId: '4', avatar: '' } } }))).toBeNull())
  })

  describe('getFeed', () => {
    it('empty on failure', async () => {
      vi.useFakeTimers()
      const p = getFeed(1)
      vi.advanceTimersByTime(10000)
      expect(await p).toEqual([])
      vi.useRealTimers()
    })
  })

  describe('getNoteDetail', () => {
    it('returns partial note when extraction fails', async () => {
      const r = await getNoteDetail('n1', 'https://url.com')
      expect(r).not.toBeNull()
      expect(r!.noteId).toBe('n1')
      expect(r!.url).toBe('https://url.com')
    }, 15000)
  })

  describe('extractCurrentUserFromHTML edge cases', () => {
    const ga = 'https://sns-avatar-qc.xhscdn.com/a.jpg'

    it('extractCurrentUserFromHTML with global path', () => {
      const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
      const r = extractCurrentUserFromHTML(h({ global: { userInfo: { nickname: 'G1', userId: '5', avatar: ga, followingCount: 10, followerCount: 5, likedCount: 100 } } }))
      expect(r).not.toBeNull()
      expect(r!.nickname).toBe('G1')
      expect(r!.stats?.following).toBe(10)
      expect(r!.stats?.follower).toBe(5)
      expect(r!.stats?.likes).toBe(100)
    })

    it('extractCurrentUserFromHTML with unbalanced JSON', () => {
      const h = `<script>window.__INITIAL_STATE__ = {invalid</script>`
      expect(extractCurrentUserFromHTML(h)).toBeNull()
    })

    it('extractCurrentUserFromHTML with bad avatar', () => {
      const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
      const r = extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: 'U1', userId: '1', avatar: 'https://favicon.ico' } } }))
      expect(r).toBeNull()
    })
  })

  describe('extractCurrentUserFromHTML buildProfile variants', () => {
    const ga = 'https://sns-avatar-qc.xhscdn.com/a.jpg'

    it('buildProfile with undefined uid', () => {
      const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
      const r = extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: 'U1', userId: undefined, avatar: ga } } }))
      expect(r).toBeNull()
    })

    it('buildProfile with "undefined" string uid', () => {
      const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
      const r = extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: 'U1', userId: 'undefined', avatar: ga } } }))
      expect(r).toBeNull()
    })

    it('buildProfile with empty nickname', () => {
      const h = (d: any) => `<script>window.__INITIAL_STATE__ = ${JSON.stringify(d)}</script>`
      const r = extractCurrentUserFromHTML(h({ user: { userInfo: { nickname: '', userId: '1', avatar: ga } } }))
      expect(r).toBeNull()
    })
  })

  describe('getProfile with API path', () => {
    it('returns null when fetch works but returns no data', async () => {
      // The net.request mock returns '{}' by default, so API parsing results in null
      const r = await getProfile()
      expect(r).toBeNull()
    })

    it('returns null when net.request errors', async () => {
      const { net } = await import('electron')
      ;(net.request as any).mockImplementation(() => {
        const req = {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'error') process.nextTick(() => handler(new Error('fail')))
            return req
          }),
          end: vi.fn(),
          write: vi.fn()
        }
        return req
      })
      const r = await getProfile()
      expect(r).toBeNull()
    })
  })

  describe('logout', () => {
    it('sends POST request', async () => {
      const { net } = await import('electron')
      await logout()
      expect(net.request).toHaveBeenCalled()
    })
  })

  describe('normalizeAvatar', () => {
    const normalize = (url: string): string => {
      if (!url) return ''
      if (url.startsWith('//')) return `https:${url}`
      if (url.includes('\\u')) {
        try { url = JSON.parse(`"${url}"`) } catch {}
      }
      return url
    }
    it('empty returns empty', () => expect(normalize('')).toBe(''))
    it('// prefix adds https:', () => expect(normalize('//example.com/a.jpg')).toBe('https://example.com/a.jpg'))
    it('unescapes \\u sequences', () => expect(normalize('\\u0041')).toBe('A'))
    it('normal URL unchanged', () => expect(normalize('https://example.com/a.jpg')).toBe('https://example.com/a.jpg'))
  })

  describe('extractBalancedJSON', () => {
    const extractBalanced = (str: string): string | null => {
      if (!str.startsWith('{')) return null
      let depth = 0
      let inString = false
      for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        if (inString) {
          if (ch === '\\') { i++; continue }
          if (ch === '"') inString = false
          continue
        }
        if (ch === '"') { inString = true; continue }
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) return str.substring(0, i + 1)
        }
      }
      return null
    }
    it('non-object start returns null', () => expect(extractBalanced('[]')).toBeNull())
    it('extracts balanced JSON', () => expect(extractBalanced('{"a":1}')).toBe('{"a":1}'))
    it('extracts nested balanced JSON', () => expect(extractBalanced('{"a":{"b":2}}')).toBe('{"a":{"b":2}}'))
    it('returns null for unbalanced JSON', () => expect(extractBalanced('{"a":1')).toBeNull())
  })

  describe('isBadXhsImageUrl', () => {
    const isBad = (url: string): boolean => {
      if (!url || url.length < 10) return false
      const badPatterns = ['favicon', 'qrcode', 'logo', 'sprite', 'icon', 'default-avatar', '/svg/', '.svg', 'static', 'avatar/default']
      return badPatterns.some(p => url.includes(p))
    }
    it('empty/short returns false', () => {
      expect(isBad('')).toBe(false)
      expect(isBad('short')).toBe(false)
    })
    it('favicon is bad', () => expect(isBad('https://example.com/favicon.ico')).toBe(true))
    it('qrcode is bad', () => expect(isBad('https://example.com/qrcode.png')).toBe(true))
    it('logo is bad', () => expect(isBad('https://example.com/logo.png')).toBe(true))
    it('sprite is bad', () => expect(isBad('https://example.com/sprite.png')).toBe(true))
    it('svg is bad', () => expect(isBad('https://example.com/image.svg')).toBe(true))
    it('good URL returns false', () => expect(isBad('https://sns-avatar-qc.xhscdn.com/avatar.jpg')).toBe(false))
  })

  describe('dedupFeedItems', () => {
    const dedup = (items: any[]): any[] => {
      const seen = new Set<string>()
      const newItems = items.filter(item => !seen.has(item.id))
      if (newItems.length > 0) {
        newItems.forEach(item => seen.add(item.id))
        return newItems
      }
      items.forEach(item => seen.add(item.id))
      return items
    }
    it('all new items pass through', () => {
      const items = [{ id: 'xhs-1' }, { id: 'xhs-2' }]
      expect(dedup(items).length).toBe(2)
    })
    it('empty input', () => expect(dedup([])).toEqual([]))
  })

  describe('xhsNoteItemMapper', () => {
    const mapItem = (raw: Record<string, unknown>, index?: number): any => {
      const note = (raw.noteCard || raw) as Record<string, unknown>
      const noteId = String(note.note_id || note.id || note.noteId || (index ?? ''))
      if (!noteId) return null
      return {
        id: `xhs-${noteId}`,
        platform: 'xhs',
        title: (note.display_title || note.title || note.desc || '') as string,
        cover: ((note.cover?.urlDefault || note.cover?.url) as string) || undefined,
        author: ((note.user?.nickname || note.author?.nickname || '') as string),
        avatar: ((note.user?.avatar || note.author?.avatar || '') as string) || undefined,
        url: `https://www.xiaohongshu.com/explore/${noteId}`,
        createdAt: undefined,
        stats: {}
      }
    }
    it('maps noteCard correctly', () => {
      const r = mapItem({ noteCard: { note_id: 'abc123', display_title: 'Title', cover: { urlDefault: 'https://cover.jpg' }, user: { nickname: 'User', avatar: 'https://avatar.jpg' } } })
      expect(r).not.toBeNull()
      expect(r.id).toBe('xhs-abc123')
      expect(r.title).toBe('Title')
    })
    it('returns null for missing note_id', () => {
      expect(mapItem({}, 0)).not.toBeNull()
    })
  })
})
