import { net, BrowserWindow } from 'electron'
import { getSession } from '../sessions'
import type { UserProfile, FeedItem, LoginState, PlatformId, XhsNoteDetail, XhsComment } from '../../shared/types'
import { networkLog } from '../logger'

const PLATFORM: PlatformId = 'xhs'
const xhsSeenFeedIds = new Set<string>()

let xhsWorker: BrowserWindow | null = null
let xhsWorkerBusy = false

function getXhsWorker(): BrowserWindow {
  if (xhsWorker && !xhsWorker.isDestroyed() && !xhsWorkerBusy) {
    return xhsWorker
  }
  if (xhsWorker && !xhsWorker.isDestroyed()) {
    return xhsWorker
  }
  xhsWorker = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      session: getSession(PLATFORM),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  xhsWorker.on('closed', () => { xhsWorker = null; xhsWorkerBusy = false })
  return xhsWorker
}

function destroyXhsWorker(): void {
  xhsWorkerBusy = false
  if (xhsWorker && !xhsWorker.isDestroyed()) {
    xhsWorker.close()
  }
  xhsWorker = null
}

function xhsNoteItemMapper(raw: Record<string, unknown>, index?: number): FeedItem | null {
  const note = (raw.noteCard || raw) as Record<string, unknown>
  const noteId = String(note.note_id || note.id || note.noteId || (index ?? ''))
  if (!noteId) return null
  return {
    id: `xhs-${noteId}`,
    platform: PLATFORM,
    title: (note.display_title || note.title || note.desc || '') as string,
    cover: ((note.cover?.urlDefault || note.cover?.url) as string) || undefined,
    author: ((note.user?.nickname || note.author?.nickname || '') as string),
    avatar: ((note.user?.avatar || note.author?.avatar || '') as string) || undefined,
    url: `https://www.xiaohongshu.com/explore/${noteId}`,
    createdAt: note.time || note.create_time ? String(note.time || note.create_time) : undefined,
    stats: {
      like: (note.liked_count || note.likes) as number | undefined,
      comment: (note.comment_count || note.comments) as number | undefined,
      share: (note.share_count || note.shares) as number | undefined
    }
  } as FeedItem
}

function dedupFeedItems(items: FeedItem[]): FeedItem[] {
  const newItems = items.filter(item => !xhsSeenFeedIds.has(item.id))
  if (newItems.length > 0) {
    newItems.forEach(item => xhsSeenFeedIds.add(item.id))
    return newItems
  }
  items.forEach(item => xhsSeenFeedIds.add(item.id))
  return items
}

function fetchWithSession(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
  const start = Date.now()
  return new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
    const req = net.request({
      method: options?.method || 'GET',
      url: url,
      session: getSession(PLATFORM),
      useSessionCookies: true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.xiaohongshu.com/',
        'Origin': 'https://www.xiaohongshu.com',
        ...options?.headers
      }
    })

    let data = ''
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        networkLog('xhs', options?.method || 'GET', url, res.statusCode, Date.now() - start, data.length)
        resolve({ statusCode: res.statusCode, data })
      })
    })
    req.on('error', (err) => {
      networkLog('xhs', options?.method || 'GET', url, 0, Date.now() - start, 0, err)
      reject(err)
    })
    if (options?.body) {
      req.write(options.body)
    }
    req.end()
  })
}

function normalizeAvatar(url: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (url.includes('\\u')) {
    try {
      url = JSON.parse(`"${url}"`)
    } catch {}
  }
  return url
}

function isBadXhsImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false
  const badPatterns = ['favicon', 'qrcode', 'logo', 'sprite', 'icon', 'default-avatar', '/svg/', '.svg', 'static', 'avatar/default']
  return badPatterns.some(p => url.includes(p))
}

export function isValidXhsProfile(profile: UserProfile): boolean {
  if (!profile.nickname || typeof profile.nickname !== 'string') return false
  if (profile.nickname.length === 0 || profile.nickname.length > 50) return false
  if (profile.nickname === '小红书' || profile.nickname === '小红书登录') return false
  if (!profile.uid || profile.uid === 'undefined') return false
  if (/^[0-9a-f]{24}$/i.test(profile.uid)) return false
  if (profile.avatar && isBadXhsImageUrl(profile.avatar)) return false
  return true
}

export function sanitizeXhsProfile(profile: UserProfile): UserProfile {
  if (profile.avatar && isBadXhsImageUrl(profile.avatar)) {
    return { ...profile, avatar: '' }
  }
  return profile
}

async function hasAuthCookie(): Promise<boolean> {
  const s = getSession(PLATFORM)
  const cookies = await s.cookies.get({ url: 'https://www.xiaohongshu.com/' })
  return cookies.some(c => c.name === 'web_session')
}

function extractBalancedJSON(str: string): string | null {
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

export function extractCurrentUserFromHTML(html: string): UserProfile | null {
  const scriptMatch = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/)
  if (!scriptMatch) return null

  const jsonStr = extractBalancedJSON(scriptMatch[1].trimStart())
  if (!jsonStr) return null

  function buildProfile(info: Record<string, unknown>): UserProfile | null {
    const nickname = info.nickname
    if (!nickname || typeof nickname !== 'string') return null
    if (nickname === '小红书' || nickname === '小红书登录' || nickname === '登录') return null
    const uid = String((info as any).userId || info.id || (info as any).redId || (info as any).red_id || (info as any).user_id || '')
    if (!uid || uid === 'undefined') return null
    const avatar = (info.avatar || info.avatar_url || info.avatarUrl || '') as string
    if (avatar && isBadXhsImageUrl(avatar)) return null
    const profile: UserProfile = {
      platform: PLATFORM,
      nickname: nickname,
      avatar: normalizeAvatar(avatar),
      uid: uid,
      bio: ((info as any).desc || info.signature || info.bio || (info as any).descText || '') as string
    }
    const stats: UserProfile['stats'] = {}
    if (info.followingCount != null) stats.following = info.followingCount as number
    else if (info.follow_count != null) stats.following = info.follow_count as number
    else if (info.following_count != null) stats.following = info.following_count as number
    if (info.followerCount != null) stats.follower = info.followerCount as number
    else if (info.fans_count != null) stats.follower = info.fans_count as number
    else if (info.follower_count != null) stats.follower = info.follower_count as number
    if (info.likedCount != null) stats.likes = info.likedCount as number
    else if (info.like_count != null) stats.likes = info.like_count as number
    else if (info.liked_count != null) stats.likes = info.liked_count as number
    if (Object.keys(stats).length) profile.stats = stats
    return profile
  }

  try {
    const ssr = JSON.parse(jsonStr)
    const info = ssr?.user?.userInfo || ssr?.global?.userInfo || ssr?.userInfo || ssr?.main?.userInfo || ssr?.state?.userInfo
    if (info) {
      const profile = buildProfile(info)
      if (profile) return profile
    }
  } catch {}

  return null
}

async function getProfileViaAPI(): Promise<UserProfile | null> {
  const endpoints = [
    { url: 'https://www.xiaohongshu.com/api/sns/web/v1/user/selfinfo', method: 'POST' as const },
    { url: 'https://www.xiaohongshu.com/api/sns/web/v1/user/me', method: 'POST' as const },
    { url: 'https://edith.xiaohongshu.com/api/sns/web/v1/user/selfinfo', method: 'POST' as const },
  ]
  for (const { url, method } of endpoints) {
    try {
      const { data } = await fetchWithSession(url, {
        method,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      })
      const json = JSON.parse(data)
      const info = json.data || json.user || json
      if (info?.nickname || info?.nick_name) {
        const nickname = info.nickname || info.nick_name
        if (nickname === '小红书' || nickname === '小红书登录' || nickname === '登录') continue
        const uid = String(info.user_id || info.userId || info.id || '')
        if (!uid || uid === 'undefined') continue
        return {
          platform: PLATFORM,
          nickname: nickname,
          avatar: normalizeAvatar(info.avatar || info.avatar_url || info.avatarUrl || ''),
          uid: uid,
          bio: info.desc || info.signature || info.bio || info.descText || ''
        }
      }
    } catch {}
  }
  return null
}

export async function checkLogin(): Promise<LoginState> {
  try {
    const hasCookie = await hasAuthCookie()
    if (hasCookie) return { loggedIn: true, profile: null }
    return { loggedIn: false, profile: null }
  } catch {
    return { loggedIn: false, profile: null }
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  const apiProfile = await getProfileViaAPI()
  if (apiProfile) return apiProfile

  return null
}

async function getFeedViaWorker(page = 1): Promise<FeedItem[]> {
  const BATCH = 12
  const INITIAL_WAIT = 1200
  const SCROLL_COUNT = 2
  const SCROLL_INTERVAL = 300
  const POST_SCROLL_WAIT = 600
  const TIMEOUT = 8000
  const EARLY_RETURN = 6

  return new Promise<FeedItem[]>((resolve) => {
    let settled = false
    const win = getXhsWorker()

    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve([]) }
    }, TIMEOUT)

    const finish = (items: FeedItem[]): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const deduped = dedupFeedItems(items)
      resolve(deduped.length > 0 ? deduped : items.length > 0 ? items : [])
    }

    async function extractStateItems(): Promise<FeedItem[]> {
      try {
        const raw = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var data = window.__INITIAL_STATE__;
              if (!data) return null;
              if (typeof data === 'string') data = JSON.parse(data);
              for (var k = 0; k < ['feed','homefeed','explore','note'].length; k++) {
                var f = data[['feed','homefeed','explore','note'][k]];
                if (!f) continue;
                var src = f.note || f.items || [];
                if (Array.isArray(src) && src.length > 0) return JSON.stringify(src.slice(0, ${BATCH}));
              }
            } catch(e) {}
            return null;
          })()
        `)
        if (!raw) return []
        return (JSON.parse(raw) || []).map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
      } catch { return [] }
    }

    async function extractDomItems(): Promise<FeedItem[]> {
      try {
        const raw = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var items = [];
              var seen = new Set();
              var links = document.querySelectorAll('a[href*="/explore/"]');
              for (var i = 0; i < links.length; i++) {
                var href = links[i].getAttribute('href') || '';
                var m = href.match(/\\/explore\\/([a-f0-9]{24,})/);
                if (!m || seen.has(m[1])) continue;
                seen.add(m[1]);
                var card = links[i].closest('section, div, li') || links[i];
                var img = card.querySelector('img[src*="xhscdn"], img[src*="ci.xiaohongshu"]');
                var titleEl = card.querySelector('[class*="title"], [class*="desc"], h3');
                var authorEl = card.querySelector('[class*="author"], [class*="name"]');
                var author = '';
                if (authorEl) author = (authorEl.textContent || '').trim();
                if (!author) { var spans = card.querySelectorAll('span'); for (var s = 0; s < spans.length; s++) { var t = (spans[s].textContent || '').trim(); if (t.length > 0 && t.length < 20) { author = t; break; } } }
                items.push({
                  noteId: m[1],
                  title: titleEl ? (titleEl.textContent || '').trim() : '',
                  cover: img ? img.src : '',
                  author: author
                });
                if (items.length >= ${BATCH}) break;
              }
              return items.length > 0 ? JSON.stringify(items) : null;
            } catch(e) { return null; }
          })()
        `)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return parsed.map((n: Record<string, unknown>) => ({
          id: `xhs-${String(n.noteId || '')}`,
          platform: PLATFORM,
          title: (n.title as string) || '',
          cover: (n.cover as string) || undefined,
          author: (n.author as string) || '',
          url: `https://www.xiaohongshu.com/explore/${String(n.noteId || '')}`,
        })).filter((item: FeedItem) => item.title || item.cover) as FeedItem[]
      } catch { return [] }
    }

    // Check if worker already has a page loaded with data we can use quickly
    ;(async () => {
      const hasPage = await win.webContents.executeJavaScript(`
        (function() { try { return document.readyState === 'complete' ? 'ready' : 'loading'; } catch(e) { return 'closed'; } })()
      `).catch(() => 'closed')

      if (hasPage === 'closed') {
        // Worker was destroyed, navigate fresh
        win.loadURL('https://www.xiaohongshu.com/explore')
      }
    })()

    const onLoad = async (): Promise<void> => {
      if (settled) return

      // Inject feed fetch/XHR hooks
      await win.webContents.executeJavaScript(`
        (function() {
          try {
            var origFetch = window.fetch.bind(window);
            window.fetch = function(url, opts) {
              var u = typeof url === 'string' ? url : (url.url || '');
              if (u.indexOf('edith.xiaohongshu.com') !== -1 && u.indexOf('/api/sns/web') !== -1 && (u.indexOf('feed') !== -1 || u.indexOf('homefeed') !== -1)) {
                return origFetch(url, opts).then(function(resp) {
                  return resp.clone().text().then(function(text) {
                    try { window.__xhsFeedData = text; window.__xhsFeedUrl = u; } catch(e) {}
                    return resp;
                  });
                });
              }
              return origFetch(url, opts);
            };
          } catch(e) {}
          try {
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              var u = typeof url === 'string' ? url : (url.url || url || '');
              if (u.indexOf('edith.xiaohongshu.com') !== -1 && u.indexOf('/api/sns/web') !== -1 && (u.indexOf('feed') !== -1 || u.indexOf('homefeed') !== -1)) {
                this.addEventListener('load', function() {
                  try { window.__xhsFeedData = this.responseText; window.__xhsFeedUrl = u; } catch(e) {}
                });
              }
              return origOpen.apply(this, arguments);
            };
          } catch(e) {}
        })()
      `)

      await new Promise(r => setTimeout(r, INITIAL_WAIT))

      // Phase 1: Check page-captured API response
      const capturedRaw = await win.webContents.executeJavaScript(`
        (function() {
          try {
            if (window.__xhsFeedData) return JSON.stringify({ s: 'api', d: window.__xhsFeedData });
            var data = window.__INITIAL_STATE__;
            if (data) {
              if (typeof data === 'string') data = JSON.parse(data);
              for (var k = 0; k < 4; k++) {
                var f = data[['feed','homefeed','explore','note'][k]];
                if (!f) continue;
                var src = f.note || f.items || [];
                if (Array.isArray(src) && src.length > 0) return JSON.stringify({ s: 'ssr', d: JSON.stringify(src.slice(0, ${BATCH})) });
              }
            }
          } catch(e) {}
          return null;
        })()
      `)
      if (capturedRaw) {
        try {
          const p = JSON.parse(capturedRaw)
          if (p.s === 'api') {
            const json = JSON.parse(p.d)
            const apiItems = json?.data?.items || json?.items || []
            if (Array.isArray(apiItems) && apiItems.length > 0) {
              const items = apiItems.map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
              if (items.length >= EARLY_RETURN) { finish(items); return }
            }
          } else if (p.s === 'ssr') {
            const ssrItems = (JSON.parse(p.d) || []).map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
            if (ssrItems.length > 0) { finish(ssrItems); return }
          }
        } catch {}
      }

      // Phase 2: Traditional state extraction
      let stateItems = await extractStateItems()
      if (stateItems.length >= EARLY_RETURN) { finish(stateItems); return }

      if (page > 1) {
        try {
          for (let s = 0; s < SCROLL_COUNT; s++) {
            await win.webContents.executeJavaScript('window.scrollBy(0, 800)')
            await new Promise(r => setTimeout(r, SCROLL_INTERVAL))
          }
          await new Promise(r => setTimeout(r, POST_SCROLL_WAIT))
        } catch {}

        const postScrollApi = await win.webContents.executeJavaScript(`
          (function() { try { if (window.__xhsFeedData) return window.__xhsFeedData; } catch(e) {} return null; })()
        `)
        if (postScrollApi) {
          try {
            const json = JSON.parse(postScrollApi)
            const items = json?.data?.items || json?.items || []
            if (Array.isArray(items) && items.length > 0) {
              const mapped = items.map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
              if (mapped.length >= EARLY_RETURN) { finish(mapped); return }
            }
          } catch {}
        }

        stateItems = await extractStateItems()
        if (stateItems.length >= EARLY_RETURN) { finish(stateItems); return }
      }

      const domItems = await extractDomItems()
      const combined = [...stateItems, ...domItems]
      if (combined.length > 0) { finish(combined); return }

      finish([])
    }

    if (win.webContents.getURL()?.includes('/explore') && page > 1) {
      // Worker already on explore page, just scroll and capture
      // Remove old listeners, add new ones
      win.webContents.removeAllListeners('did-finish-load')
      win.webContents.on('did-finish-load', onLoad)
      onLoad()
    } else {
      win.webContents.removeAllListeners('did-finish-load')
      win.webContents.on('did-finish-load', onLoad)
      win.loadURL('https://www.xiaohongshu.com/explore')
    }
  })
}

export async function getFeed(page?: number): Promise<FeedItem[]> {
  if (!page || page <= 1) {
    xhsSeenFeedIds.clear()
  }

  function extractNotesFromState(json: Record<string, unknown>): FeedItem[] {
    const paths = [
      (json as any).feed?.note,
      (json as any).homefeed?.note,
      (json as any).explore?.note,
      (json as any).note?.note,
      (json as any).feed?.items,
      (json as any).homefeed?.items,
      (json as any).explore?.items
    ]
    for (const src of paths) {
      if (Array.isArray(src) && src.length > 0) {
        const items = src.map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
        if (items.length > 0) return items
      }
    }
    return []
  }

  // Source 1: Persistent worker with page-context API hooks (fastest, uses real signatures)
  try {
    const items = await getFeedViaWorker(page || 1)
    if (items.length > 0) return items
  } catch {}

  // Source 2: API direct call (fallback if worker fails)
  try {
    const { data } = await fetchWithSession('https://edith.xiaohongshu.com/api/sns/web/v1/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({})
    })
    const json = JSON.parse(data)
    const apiItems = json?.data?.items || []
    if (Array.isArray(apiItems) && apiItems.length > 0) {
      const items = apiItems.map((n: Record<string, unknown>, i: number) => xhsNoteItemMapper(n, i)).filter(Boolean) as FeedItem[]
      const deduped = dedupFeedItems(items)
      if (deduped.length > 0) return deduped
    }
  } catch {}

  // Source 3: Explore page SSR (only for initial load)
  if (!page || page <= 1) {
    try {
      const { data } = await fetchWithSession('https://www.xiaohongshu.com/explore')
      const m = data.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*([\s\S]*?)<\/script>/)
      if (m) {
        const jsonStr = extractBalancedJSON(m[1].trimStart())
        if (jsonStr) {
          const items = extractNotesFromState(JSON.parse(jsonStr))
          if (items.length > 0) return items
        }
      }
    } catch {}
  }

  return []
}

function unwrapNote(raw: any, depth = 0): any {
  if (!raw || typeof raw !== 'object' || depth > 3) return raw
  const w = raw.note_card || raw.noteCard || raw.card?.note_card || raw.card?.noteCard || raw.note
  if (w && w !== raw) return unwrapNote(w, depth + 1)
  return raw
}

function tryBuildNoteDetail(raw: any, noteId: string): XhsNoteDetail | null {
  let note: any = null

  try {
    if (raw?.note?.noteDetailMap?.[noteId]) {
      note = raw.note.noteDetailMap[noteId]
    } else if (raw?.data?.note && (raw.data.note.note_id === noteId || raw.data.note.id === noteId)) {
      note = raw.data.note
    } else if (raw?.data?.items) {
      for (const item of raw.data.items) {
        const n = unwrapNote(item)
        const id = String(n?.note_id || n?.id || n?.noteId || '')
        if (id === noteId || id.endsWith(noteId) || noteId.endsWith(id)) { note = n; break }
      }
    } else if (raw?.items) {
      for (const item of raw.items) {
        const n = unwrapNote(item)
        const id = String(n?.note_id || n?.id || n?.noteId || '')
        if (id === noteId || id.endsWith(noteId) || noteId.endsWith(id)) { note = n; break }
      }
    } else if (raw?.global?.note && (raw.global.note.note_id === noteId || raw.global.note.id === noteId)) {
      note = raw.global.note
    } else if (raw?.note?.note && (raw.note.note.note_id === noteId || raw.note.note.id === noteId)) {
      note = raw.note.note
    } else if (raw?.note?.noteDetailMap) {
      const keys = Object.keys(raw.note.noteDetailMap)
      for (const key of keys) {
        const n = raw.note.noteDetailMap[key]
        const id = String(n?.note_id || n?.id || '')
        if (id === noteId || id.endsWith(noteId) || noteId.endsWith(id)) { note = n; break }
      }
    }
  } catch {}

  if (!note) return null
  if (typeof note === 'string') { try { note = JSON.parse(note) } catch { return null } }
  note = unwrapNote(note)

  const realNoteId = String(note.note_id || note.id || noteId)
  const title = note.display_title || note.title || ''
  const desc = note.desc || note.desc_text || note.description || ''

  let images: string[] = []
  try {
    const list = note.image_list || note.imageList || note.images_list || []
    if (Array.isArray(list)) {
      images = list.map((img: any) => {
        if (typeof img === 'string') return img
        return img.urlDefault || img.url || img.infoList?.[0]?.url || ''
      }).filter(Boolean)
    }
  } catch {}
  if (images.length === 0 && note.cover) {
    const c = note.cover.urlDefault || note.cover.url
    if (c) images = [c]
  }

  let video: XhsNoteDetail['video'] = undefined
  try {
    const v = note.video || note.video_info
    if (v) {
      const streams = v?.media?.stream?.h264 || v?.stream?.h264 || v?.stream || []
      const videoUrl = Array.isArray(streams) ? (streams[0]?.url || streams[0]?.master_url || '') : ''
      video = {
        url: videoUrl,
        poster: note.cover?.urlDefault || note.cover?.url || '',
        duration: v?.duration || v?.time || undefined
      }
    }
  } catch {}

  const type: 'image' | 'video' | 'text' | 'unknown' = video ? 'video' : images.length > 0 ? 'image' : (title || desc) ? 'text' : 'unknown'

  const user = note.user || note.author || {}
  const interact = note.interact_info || note.interactInfo || note.stats || {}
  const stats: XhsNoteDetail['stats'] = {}
  if (interact.liked_count != null) stats.like = interact.liked_count
  else if (interact.likedCount != null) stats.like = interact.likedCount
  else if (interact.likes != null) stats.like = interact.likes
  if (interact.comment_count != null) stats.comment = interact.comment_count
  else if (interact.commentCount != null) stats.comment = interact.commentCount
  else if (interact.comments != null) stats.comment = interact.comments
  if (interact.collected_count != null) stats.collect = interact.collected_count
  else if (interact.collectedCount != null) stats.collect = interact.collectedCount
  if (interact.share_count != null) stats.share = interact.share_count
  else if (interact.shareCount != null) stats.share = interact.shareCount
  else if (interact.shares != null) stats.share = interact.shares

  return {
    noteId: realNoteId,
    type,
    title,
    desc,
    images,
    video: video?.url ? video : undefined,
    author: {
      nickname: user.nickname || user.nick_name || '',
      avatar: user.avatar || user.avatar_url || user.avatarUrl || '',
      uid: String(user.user_id || user.userId || user.id || '')
    },
    stats: Object.keys(stats).length > 0 ? stats : undefined,
    comments: [],
    url: `https://www.xiaohongshu.com/explore/${realNoteId}`
  }
}

function tryBuildComments(raw: any, _noteId?: string): XhsComment[] {
  try {
    let items: any[] = []
    const paths = ['data.comments', 'data.comment_list', 'comments', 'comment_list', 'data.data.comments', 'data.comments.list']
    for (const p of paths) {
      try {
        const val = p.split('.').reduce((o, k) => o?.[k], raw)
        if (Array.isArray(val) && val.length > 0) { items = val; break }
      } catch {}
    }
    return items.map((c: any) => ({
      id: String(c.id || c.comment_id || ''),
      nickname: c.user_info?.nickname || c.user?.nickname || c.nickname || '',
      avatar: c.user_info?.avatar || c.user?.avatar || c.avatar || '',
      content: c.content || c.text || '',
      likes: c.like_count || c.likes || c.liked_count || 0,
      time: String(c.create_time || c.time || c.created_at || '')
    }))
  } catch { return [] }
}

function isValidXhsNoteDetail(detail: XhsNoteDetail | null, noteId: string): boolean {
  if (!detail) return false
  if (!detail.noteId || !noteId) return false
  const idMatch = detail.noteId === noteId || detail.noteId.endsWith(noteId) || noteId.endsWith(detail.noteId) || detail.noteId.includes(noteId) || noteId.includes(detail.noteId)
  if (!idMatch) return false
  const badTitles = ['当前笔记暂时无法浏览', '页面不存在', '页面未找到', '小红书', '404']
  const title = detail.title || ''
  for (const bt of badTitles) { if (title.includes(bt)) return false }
  if (!detail.title && !detail.desc && detail.images.length === 0 && !detail.video?.url) return false
  return true
}

export async function getNoteDetail(noteId: string, url?: string): Promise<XhsNoteDetail | null> {
  return new Promise<XhsNoteDetail | null>((resolve) => {
    let settled = false
    let pollingStarted = false
    const capturedResponses: Array<{url: string, body: string}> = []
    const pendingUrls: Record<string, string> = {}

    const targetUrl = url || `https://www.xiaohongshu.com/explore/${noteId}`

    // Dedicated detail worker - fresh window per request, no shared worker race
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        session: getSession(PLATFORM),
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    const cleanup = (): void => {
      if (!win.isDestroyed()) {
        try { win.webContents.debugger.detach() } catch {}
        win.close()
      }
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        cleanup()
        resolve({
          noteId,
          type: 'unknown',
          title: '',
          desc: '',
          images: [],
          author: { nickname: '', avatar: '' },
          comments: [],
          url: targetUrl
        })
      }
    }, 15000)

    const finish = (detail: XhsNoteDetail | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      resolve(detail)
    }

    // Setup Electron Debugger BEFORE navigation to capture all network responses
    try {
      const dbg = win.webContents.debugger
      try { dbg.detach() } catch {}
      dbg.attach('1.3')
      dbg.on('message', (_event, method, params) => {
        if (method === 'Network.responseReceived') {
          const { requestId, response } = params
          const respUrl = response?.url || ''
          if ((respUrl.includes('edith.xiaohongshu.com') || respUrl.includes('www.xiaohongshu.com')) && respUrl.includes('/api/sns/web') &&
              (respUrl.includes('note') || respUrl.includes('feed') || respUrl.includes('comment'))) {
            pendingUrls[requestId] = respUrl
          }
        } else if (method === 'Network.loadingFinished') {
          const { requestId } = params
          const respUrl = pendingUrls[requestId]
          if (respUrl) {
            delete pendingUrls[requestId]
            setTimeout(async () => {
              try {
                const body = await dbg.sendCommand('Network.getResponseBody', { requestId })
                if (body?.body) capturedResponses.push({ url: respUrl, body: body.body })
              } catch {}
            }, 50)
          }
        }
      })
      dbg.sendCommand('Network.enable')
    } catch {}

    // ---- Poll helpers ----

    function peekDebugger(): XhsNoteDetail | null {
      for (const resp of capturedResponses) {
        try {
          const detail = tryBuildNoteDetail(JSON.parse(resp.body), noteId)
          if (isValidXhsNoteDetail(detail, noteId)) {
            const allComments: XhsComment[] = []
            for (const r of capturedResponses) {
              try { allComments.push(...tryBuildComments(JSON.parse(r.body), noteId)) } catch {}
            }
            if (allComments.length > 0) detail.comments = allComments
            return detail
          }
        } catch {}
      }
      return null
    }

    async function peekHook(): Promise<XhsNoteDetail | null> {
      try {
        const raw = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var list = window.__xhsDetailResp;
              if (list && list.length > 0) {
                for (var i = list.length - 1; i >= 0; i--) {
                  try {
                    var parsed = JSON.parse(list[i].data);
                    if (parsed && (parsed.data || parsed.items)) return JSON.stringify(parsed);
                  } catch(e) {}
                }
              }
            } catch(e) {}
            return null;
          })()
        `)
        if (raw) {
          const detail = tryBuildNoteDetail(JSON.parse(raw), noteId)
          if (isValidXhsNoteDetail(detail, noteId)) {
            const allComments: XhsComment[] = []
            for (const r of capturedResponses) {
              try { allComments.push(...tryBuildComments(JSON.parse(r.body), noteId)) } catch {}
            }
            if (allComments.length > 0) detail.comments = allComments
            return detail
          }
        }
      } catch {}
      return null
    }

    async function peekSSR(): Promise<XhsNoteDetail | null> {
      try {
        const raw = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var data = window.__INITIAL_STATE__;
              if (typeof data === 'string') data = JSON.parse(data);
              if (data) return JSON.stringify(data);
            } catch(e) {}
            return null;
          })()
        `)
        if (raw) {
          const detail = tryBuildNoteDetail(JSON.parse(raw), noteId)
          if (isValidXhsNoteDetail(detail, noteId)) return detail
        }
      } catch {}
      return null
    }

    async function peekDOM(): Promise<XhsNoteDetail | null> {
      try {
        const raw = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var pageTitle = document.title || '';
              if (pageTitle.indexOf('当前笔记') !== -1 || pageTitle.indexOf('页面不存在') !== -1 || pageTitle.indexOf('404') !== -1) return null;

              var title = '', desc = '', author = '', avatar = '';
              var images = [];
              var hasVideo = false;

              var titleEl = document.querySelector('h1') || document.querySelector('[class*="title"]');
              if (titleEl) title = titleEl.textContent.trim();

              if (!title || title.indexOf('无法浏览') !== -1 || title.indexOf('不存在') !== -1 || title.indexOf('404') !== -1 || title.indexOf('暂时无法') !== -1) return null;

              var descEl = document.querySelector('[class*="desc"]') || document.querySelector('[class*="content"]') || document.querySelector('article');
              if (descEl) desc = descEl.textContent.trim();

              var authorEl = document.querySelector('[class*="username"]') || document.querySelector('[class*="name"] span');
              if (authorEl) author = authorEl.textContent.trim();

              var avatarEl = document.querySelector('img[class*="avatar"]');
              if (avatarEl) avatar = avatarEl.src;

              var allImgs = document.querySelectorAll('img[src*="xhscdn"], img[src*="ci.xiaohongshu"]');
              for (var i = 0; i < allImgs.length; i++) {
                var src = allImgs[i].src || '';
                if (src && src.indexOf('favicon') === -1 && src.indexOf('logo') === -1 && src.indexOf('qrcode') === -1) {
                  if (images.indexOf(src) === -1) images.push(src);
                }
              }

              var videoEl = document.querySelector('video');
              hasVideo = !!videoEl;

              if (!title && !desc && images.length === 0) return null;

              return JSON.stringify({title: title, desc: desc, author: author, avatar: avatar, images: images.slice(0, 30), hasVideo: hasVideo});
            } catch(e) { return null; }
          })()
        `)
        if (raw) {
          const d = JSON.parse(raw)
          if (d.title || d.desc || d.images.length > 0) {
            return {
              noteId,
              type: d.hasVideo ? 'video' : d.images.length > 0 ? 'image' : 'text',
              title: d.title || '',
              desc: d.desc || '',
              images: d.images || [],
              author: { nickname: d.author || '', avatar: d.avatar || '' },
              comments: [],
              url: targetUrl
            }
          }
        }
      } catch {}
      return null
    }

    // Active comment loading via API
    async function tryFetchComments(): Promise<XhsComment[]> {
      const endpoints = [
        'https://edith.xiaohongshu.com/api/sns/web/v2/comment/page',
        'https://www.xiaohongshu.com/api/sns/web/v2/comment/page',
        'https://edith.xiaohongshu.com/api/sns/web/v1/comment/page',
      ]
      for (const ep of endpoints) {
        try {
          const { data } = await fetchWithSession(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            body: JSON.stringify({ note_id: noteId, cursor: '', top_comment_id: '' })
          })
          const json = JSON.parse(data)
          const comments = tryBuildComments(json, noteId)
          if (comments.length > 0) return comments
        } catch {}
      }
      return []
    }

    async function resolveWithComments(detail: XhsNoteDetail): Promise<void> {
      try {
        const comments = await Promise.race([
          tryFetchComments(),
          new Promise<XhsComment[]>((r) => setTimeout(() => r([]), 2000))
        ])
        if (comments.length > 0) detail.comments = comments
      } catch {}
      finish(detail)
    }

    // ---- Polling engine ----

    const loadAndPoll = async (): Promise<void> => {
      if (pollingStarted) return
      pollingStarted = true

      // Inject fetch/XHR hooks
      await win.webContents.executeJavaScript(`
        (function() {
          try {
            var origFetch = window.fetch.bind(window);
            window.fetch = function(url, opts) {
              var u = typeof url === 'string' ? url : (url.url || '');
              if ((u.indexOf('edith.xiaohongshu.com') !== -1 || u.indexOf('www.xiaohongshu.com') !== -1) && u.indexOf('/api/sns/web') !== -1 && (u.indexOf('note') !== -1 || u.indexOf('feed') !== -1 || u.indexOf('comment') !== -1)) {
                return origFetch(url, opts).then(function(resp) {
                  return resp.clone().text().then(function(text) {
                    try { window.__xhsDetailResp = window.__xhsDetailResp || []; window.__xhsDetailResp.push({url: u, data: text}); } catch(e) {}
                    return resp;
                  });
                });
              }
              return origFetch(url, opts);
            };
          } catch(e) {}
          try {
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              var u = typeof url === 'string' ? url : (url.url || url || '');
              if ((u.indexOf('edith.xiaohongshu.com') !== -1 || u.indexOf('www.xiaohongshu.com') !== -1) && u.indexOf('/api/sns/web') !== -1 && (u.indexOf('note') !== -1 || u.indexOf('feed') !== -1 || u.indexOf('comment') !== -1)) {
                this.addEventListener('load', function() {
                  try { window.__xhsDetailResp = window.__xhsDetailResp || []; window.__xhsDetailResp.push({url: u, data: this.responseText}); } catch(e) {}
                });
              }
              return origOpen.apply(this, arguments);
            };
          } catch(e) {}
        })()
      `)

      const pollStart = Date.now()
      while (true) {
        if (settled) return

        const d1 = peekDebugger()
        if (d1) { await resolveWithComments(d1); return }

        const elapsed = Date.now() - pollStart

        if (elapsed > 1000) { const d2 = await peekHook(); if (d2) { await resolveWithComments(d2); return } }
        if (elapsed > 2000) { const d3 = await peekSSR(); if (d3) { await resolveWithComments(d3); return } }
        if (elapsed > 3000) { const d4 = await peekDOM(); if (d4) { await resolveWithComments(d4); return } }

        if (elapsed > 10000) break
        await new Promise(r => setTimeout(r, 300))
      }

      // Final attempt at all sources
      for (const fn of [peekDebugger, peekHook, peekSSR, peekDOM]) {
        if (settled) return
        const result = fn === peekDebugger ? fn() : await (fn as () => Promise<XhsNoteDetail | null>)()
        if (result) { await resolveWithComments(result); return }
      }

      // Partial fallback - never return null
      finish({
        noteId,
        type: 'unknown',
        title: '',
        desc: '',
        images: [],
        author: { nickname: '', avatar: '' },
        comments: [],
        url: targetUrl
      })
    }

    // Primary trigger: did-finish-load
    win.webContents.on('did-finish-load', () => {
      if (!settled) loadAndPoll()
    })

    // Safety trigger: if did-finish-load never fires, start polling after 3s
    setTimeout(() => {
      if (!settled) loadAndPoll()
    }, 3000)

    win.loadURL(targetUrl)
  })
}

export async function fillXhsAvatar(profile: UserProfile): Promise<UserProfile> {
  if (profile.avatar) return profile

  return new Promise<UserProfile>((resolve) => {
    let settled = false
    const win = getXhsWorker()

    const timer = setTimeout(() => {
      if (!settled) { settled = true; resolve(profile) }
    }, 10000)

    const done = (avatar: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (avatar && !isBadXhsImageUrl(avatar)) {
        resolve({ ...profile, avatar: normalizeAvatar(avatar) })
      } else {
        resolve(profile)
      }
    }

    win.webContents.removeAllListeners('did-finish-load')
    win.webContents.on('did-finish-load', async () => {
      if (settled) return
      await new Promise(r => setTimeout(r, 2000))

      // Try __INITIAL_STATE__ user info
      try {
        const avatar: string = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var data = window.__INITIAL_STATE__;
              if (!data) return '';
              if (typeof data === 'string') data = JSON.parse(data);
              var info = data.userInfo || data.user || data.profile || data.currentUser || data.userProfile || null;
              if (info) {
                if (info.userInfo) info = info.userInfo;
                return info.avatar || info.avatar_url || info.avatarUrl || info.user_avatar || info.portrait || '';
              }
              info = (data.user && data.user.userInfo) || (data.global && data.global.userInfo) || (data.main && data.main.userInfo) || null;
              if (info) return info.avatar || info.avatar_url || info.avatarUrl || '';
            } catch(e) {}
            return '';
          })()
        `)
        if (avatar) { done(avatar); return }
      } catch {}

      // DOM fallback: find user avatar image
      try {
        const avatar: string = await win.webContents.executeJavaScript(`
          (function() {
            try {
              var imgs = document.querySelectorAll('img');
              var best = '';
              for (var i = 0; i < imgs.length; i++) {
                var src = imgs[i].src || '';
                if (!src || src.includes('favicon') || src.includes('qrcode') || src.includes('logo')) continue;
                if (src.includes('xhscdn') || src.includes('ci.xiaohongshu') || src.includes('sns-webpic')) {
                  var w = imgs[i].naturalWidth || imgs[i].width || 0;
                  var h = imgs[i].naturalHeight || imgs[i].height || 0;
                  if (w >= 48 && h >= 48) { best = src; break; }
                }
              }
              return best;
            } catch(e) { return ''; }
          })()
        `)
        if (avatar) { done(avatar); return }
      } catch {}

      done('')
    })

    win.loadURL('https://www.xiaohongshu.com/')
  })
}

export async function logout(): Promise<void> {
  try {
    await fetchWithSession('https://www.xiaohongshu.com/api/sns/web/v1/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    })
  } catch {}
  destroyXhsWorker()
}
