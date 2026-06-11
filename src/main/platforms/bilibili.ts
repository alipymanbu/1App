import { net, BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import { getSession } from '../sessions'
import { startPlayback, getManifestUrl, removePlayback, updateSession } from '../videoProxy'
import type { UserProfile, UserStats, FeedItem, LoginState, PlatformId, FollowUser, PageResult, VideoPlaybackInfo, ChangeQualityResult, VideoInteractionState, VideoInteractionResult, FavoriteFolder, FavoriteFolderSelection, CreateFavoriteFolderResult, BiliVideoDetail, BiliVideoComment, BiliVideoCommentsResult, BiliCommentRepliesResult } from '../../shared/types'
import { networkLog } from '../logger'

const PLATFORM: PlatformId = 'bilibili'
const userStatsCache = new Map<string, UserStats>()
const userVideosCache = new Map<string, { result: PageResult<FeedItem>; expiresAt: number }>()
const USER_VIDEOS_CACHE_TTL = 60000
const userVideosInFlight = new Map<string, Promise<PageResult<FeedItem> | null>>()
const legacyCooldowns = new Map<string, number>()
const LEGACY_COOLDOWN_MS = 15000

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await mapper(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function normalizeBilibiliImageUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return url.replace('http://', 'https://')
  return url
}

function parseBilibiliCountText(text: string): number | undefined {
  if (!text) return undefined
  if (text.includes('万')) {
    const num = parseFloat(text.replace('万', ''))
    if (!isNaN(num)) return Math.round(num * 10000)
  }
  const clean = text.replace(/[^0-9.-]/g, '')
  const num = parseInt(clean, 10)
  if (!isNaN(num)) return num
  return undefined
}

function parseBilibiliStatValue(val: unknown): number | undefined {
  if (typeof val === 'number') return val
  if (val === null || val === undefined) return undefined
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if (typeof obj.count === 'number') return obj.count
    if (typeof obj.text === 'string') return parseBilibiliCountText(obj.text)
  }
  return undefined
}

function safeParseJson(apiName: string, data: string): any {
  const trimmed = data.trim()
  if (!trimmed || trimmed.startsWith('<')) {
    console.warn(`[bilibili] ${apiName} invalid response`)
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch (err) {
    console.warn(`[bilibili] ${apiName} JSON parse failed:`, err)
    return null
  }
}

function fetchWithSession(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
  const start = Date.now()
  return new Promise<{ statusCode: number; data: string; headers: Record<string, string> }>((resolve, reject) => {
    const req = net.request({
      method: options?.method || 'GET',
      url,
      session: getSession(PLATFORM),
      useSessionCookies: true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*',
        ...options?.headers
      }
    })

    let data = ''
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        networkLog('bilibili', options?.method || 'GET', url, res.statusCode, Date.now() - start, data.length)
        resolve({
          statusCode: res.statusCode,
          data,
          headers: res.headers as Record<string, string>
        })
      })
    })
    req.on('error', (err) => {
      networkLog('bilibili', options?.method || 'GET', url, 0, Date.now() - start, 0, err)
      reject(err)
    })
    if (options?.body) {
      req.write(options.body)
    }
    req.end()
  })
}

async function getUserStats(uid: string): Promise<UserStats> {
  const cached = userStatsCache.get(uid)
  if (cached) return cached

  const stats: UserStats = {}

  try {
    const [relData, upData] = await Promise.all([
      fetchWithSession(`https://api.bilibili.com/x/relation/stat?vmid=${uid}`),
      fetchWithSession(`https://api.bilibili.com/x/space/upstat?mid=${uid}`)
    ])

    const rel = safeParseJson('getUserStats/relation', relData.data)
    if (rel?.code === 0 && rel?.data) {
      stats.following = rel.data.following as number | undefined
      stats.follower = rel.data.follower as number | undefined
    }

    const up = safeParseJson('getUserStats/upstat', upData.data)
    if (up?.code === 0 && up?.data) {
      stats.likes = up.data.likes as number | undefined
      const archive = (up.data.archive?.view as number) || 0
      const article = (up.data.article?.view as number) || 0
      stats.views = archive + article
    }
  } catch (err) {
    console.warn('[bilibili] getUserStats failed:', err)
  }

  userStatsCache.set(uid, stats)
  return stats
}

export async function checkLogin(): Promise<LoginState> {
  try {
    const { data } = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')

    const json = safeParseJson('checkLogin', data)
    if (json && json.code === 0 && json.data.isLogin) {
      const uid = String(json.data.mid || '')
      const profile: UserProfile = {
        platform: PLATFORM,
        nickname: json.data.uname || '',
        avatar: normalizeBilibiliImageUrl(json.data.face),
        uid,
        bio: json.data.level_info?.current_level
          ? `Lv${json.data.level_info.current_level}`
          : '',
        stats: await getUserStats(uid)
      }
      return { loggedIn: true, profile }
    }
    return { loggedIn: false, profile: null }
  } catch (err) {
    console.warn('[bilibili] checkLogin failed:', err)
    return { loggedIn: false, profile: null }
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  const state = await checkLogin()
  return state.profile
}

function mapBilibiliVideoItems(items: Record<string, unknown>[]): FeedItem[] {
  return items.map((item, index) => ({
    id: `bilibili-${String(item.bvid || item.aid || item.id || index)}`,
    platform: PLATFORM,
    title: (item.title as string) || '',
    cover: item.pic ? normalizeBilibiliImageUrl(item.pic as string) : undefined,
    author: ((item.owner as Record<string, unknown>)?.name as string) || '',
    avatar: (item.owner as Record<string, unknown>)?.face
      ? normalizeBilibiliImageUrl((item.owner as Record<string, unknown>).face as string)
      : undefined,
    url: `https://www.bilibili.com/video/${String(item.bvid || item.aid || item.id || '')}`,
    createdAt: item.ctime
      ? new Date((item.ctime as number) * 1000).toISOString()
      : item.pubdate
        ? new Date((item.pubdate as number) * 1000).toISOString()
        : undefined,
    stats: {
      like: parseBilibiliStatValue((item.stat as Record<string, unknown>)?.like),
      comment: parseBilibiliStatValue((item.stat as Record<string, unknown>)?.reply),
      share: parseBilibiliStatValue((item.stat as Record<string, unknown>)?.share)
    },
    bvid: (item.bvid as string) || undefined,
    aid: item.aid ? String(item.aid) : undefined,
    mediaType: 'video'
  }))
}

interface FeedEndpoint {
  url: string
  dataKey: string
  name: string
}

function getFeedEndpoints(page = 1): FeedEndpoint[] {
  return [
    { url: `https://api.bilibili.com/x/web-interface/index/top/rcmd?fresh_type=3&version=main&next_page=${page}`, dataKey: 'item', name: 'rcmd' },
    { url: `https://api.bilibili.com/x/web-interface/popular?ps=30&pn=${page}`, dataKey: 'list', name: 'popular' },
    { url: 'https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', dataKey: 'list', name: 'ranking' }
  ]
}

export async function getFeed(page = 1): Promise<FeedItem[]> {
  const endpoints = getFeedEndpoints(page)
  for (const endpoint of endpoints) {
    try {
      const { data, statusCode } = await fetchWithSession(endpoint.url)
      if (statusCode < 200 || statusCode >= 300) {
        if (endpoint.name === 'rcmd') {
          console.info(`[bilibili] getFeed ${endpoint.name} HTTP ${statusCode}`)
        } else {
          console.warn(`[bilibili] getFeed ${endpoint.name} HTTP ${statusCode}`)
        }
        continue
      }
      const json = safeParseJson('getFeed', data)
      if (json && json.code === 0 && json.data?.[endpoint.dataKey]?.length > 0) {
        return mapBilibiliVideoItems(json.data[endpoint.dataKey])
      }
    } catch (err) {
      if (endpoint.name === 'rcmd') {
        console.info(`[bilibili] getFeed ${endpoint.name} failed`)
      } else {
        console.warn(`[bilibili] getFeed ${endpoint.name} failed`, err)
      }
    }
  }
  console.warn('[bilibili] getFeed all endpoints exhausted')
  return []
}

export async function getFollowings(): Promise<FollowUser[]> {
  try {
    const navData = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')
    const navJson = safeParseJson('getFollowings/nav', navData.data)
    if (!navJson || navJson.code !== 0 || !navJson.data?.isLogin) return []
    const uid = String(navJson.data.mid || '')

    const { data } = await fetchWithSession(
      `https://api.bilibili.com/x/relation/followings?vmid=${uid}&pn=1&ps=50&order=desc&order_type=attention`
    )

    const json = safeParseJson('getFollowings/list', data)
    if (!json || json.code !== 0 || !json.data?.list) return []

    return json.data.list.map((item: Record<string, unknown>) => ({
      platform: PLATFORM,
      nickname: (item.uname as string) || '',
      avatar: item.face ? normalizeBilibiliImageUrl(item.face as string) : '',
      uid: String(item.mid || ''),
      bio: (item.sign as string) || '',
      url: `https://space.bilibili.com/${String(item.mid || '')}`
    }))
  } catch (err) {
    console.warn('[bilibili] getFollowings failed:', err)
    return []
  }
}

export async function getFollowingsPage(page = 1, pageSize = 10): Promise<PageResult<FollowUser>> {
  try {
    const navData = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')
    const navJson = safeParseJson('getFollowingsPage/nav', navData.data)
    if (!navJson || navJson.code !== 0 || !navJson.data?.isLogin) {
      return { items: [], page, pageSize, total: 0, hasMore: false }
    }
    const uid = String(navJson.data.mid || '')

    const { data } = await fetchWithSession(
      `https://api.bilibili.com/x/relation/followings?vmid=${uid}&pn=${page}&ps=${pageSize}&order=desc&order_type=attention`
    )

    const json = safeParseJson('getFollowingsPage/list', data)
    if (!json || json.code !== 0 || !json.data?.list) {
      return { items: [], page, pageSize, total: 0, hasMore: false }
    }

    const total = json.data.total || 0
    const raw = json.data.list as Record<string, unknown>[]
    const items = await mapWithConcurrency(raw, 3, async (item) => ({
      platform: PLATFORM,
      nickname: (item.uname as string) || '',
      avatar: item.face ? normalizeBilibiliImageUrl(item.face as string) : '',
      uid: String(item.mid || ''),
      bio: (item.sign as string) || '',
      url: `https://space.bilibili.com/${String(item.mid || '')}`,
      stats: await getUserStats(String(item.mid || ''))
    }))

    return { items, page, pageSize, total, hasMore: page * pageSize < total }
  } catch (err) {
    console.warn('[bilibili] getFollowingsPage failed:', err)
    return { items: [], page, pageSize, total: 0, hasMore: false }
  }
}

export async function getFollowingFeed(): Promise<FeedItem[]> {
  try {
    const { data } = await fetchWithSession(
      'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all&page=1'
    )

    const json = safeParseJson('getFollowingFeed', data)
    if (!json || json.code !== 0 || !json.data?.items) return []

    const items: FeedItem[] = []
    for (const item of json.data.items) {
      const idStr = (item.id_str || item.id || '') as string
      if (!idStr) continue

      const modules = item.modules as Record<string, unknown> | undefined
      if (!modules) continue

      const author = modules.module_author as Record<string, unknown> | undefined
      const dynamic = modules.module_dynamic as Record<string, unknown> | undefined
      const stat = modules.module_stat as Record<string, unknown> | undefined

      const authorName = (author?.name as string) || ''
      const authorFace = author?.face ? normalizeBilibiliImageUrl(author.face as string) : undefined

      let title = ''
      let cover: string | undefined
      let url = ''
      let archiveBvid: string | undefined
      let archiveAid: string | undefined

      const major = dynamic?.major as Record<string, unknown> | undefined

      if (major?.type === 'MAJOR_TYPE_ARCHIVE') {
        const archive = major.archive as Record<string, unknown> | undefined
        if (archive) {
          title = (archive.title as string) || ''
          cover = archive.cover ? normalizeBilibiliImageUrl(archive.cover as string) : undefined
          archiveBvid = (archive.bvid as string) || undefined
          archiveAid = archive.aid ? String(archive.aid) : undefined
          url = `https://www.bilibili.com/video/${String(archive.bvid || archive.aid || '')}`
        }
      } else if (major?.type === 'MAJOR_TYPE_DRAW') {
        const draw = major.draw as Record<string, unknown> | undefined
        const drawItems = draw?.items as Record<string, unknown>[] | undefined
        if (drawItems && drawItems.length > 0) {
          cover = drawItems[0]?.src
            ? normalizeBilibiliImageUrl(drawItems[0].src as string)
            : undefined
        }
        const desc = dynamic?.desc as Record<string, unknown> | undefined
        title = (desc?.text as string) || ''
        url = `https://t.bilibili.com/${idStr}`
      } else if (major?.type === 'MAJOR_TYPE_NONE') {
        const desc = dynamic?.desc as Record<string, unknown> | undefined
        title = (desc?.text as string) || ''
        url = `https://t.bilibili.com/${idStr}`
      }

      if (!title) continue

      items.push({
        id: `bilibili-follow-${idStr}`,
        platform: PLATFORM,
        title: title.slice(0, 200),
        cover,
        author: authorName,
        avatar: authorFace,
        url: url || `https://t.bilibili.com/${idStr}`,
        createdAt: undefined,
        stats: {
          like: parseBilibiliStatValue(stat?.like),
          comment: parseBilibiliStatValue(stat?.comment),
          share: parseBilibiliStatValue(stat?.forward ?? stat?.share ?? stat?.repost)
        },
        bvid: archiveBvid,
        aid: archiveAid,
        mediaType: archiveBvid || archiveAid ? 'video' : undefined
      })

      if (items.length >= 50) break
    }

    return items
  } catch (err) {
    console.warn('[bilibili] getFollowingFeed failed:', err)
    return []
  }
}

export async function getFollowingFeedPage(offset?: string, pageSize = 10): Promise<PageResult<FeedItem>> {
  try {
    let url = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all'
    if (offset) url += `&offset=${offset}`

    const { data } = await fetchWithSession(url)
    const json = safeParseJson('getFollowingFeedPage', data)
    if (!json || json.code !== 0 || !json.data?.items) {
      return { items: [], page: 1, pageSize, hasMore: false }
    }

    const items: FeedItem[] = []
    for (const item of json.data.items) {
      const idStr = (item.id_str || item.id || '') as string
      if (!idStr) continue

      const modules = item.modules as Record<string, unknown> | undefined
      if (!modules) continue

      const author = modules.module_author as Record<string, unknown> | undefined
      const dynamic = modules.module_dynamic as Record<string, unknown> | undefined
      const stat = modules.module_stat as Record<string, unknown> | undefined

      const authorName = (author?.name as string) || ''
      const authorFace = author?.face ? normalizeBilibiliImageUrl(author.face as string) : undefined

      let title = ''
      let cover: string | undefined
      let url = ''
      let archiveBvid: string | undefined
      let archiveAid: string | undefined

      const major = dynamic?.major as Record<string, unknown> | undefined

      if (major?.type === 'MAJOR_TYPE_ARCHIVE') {
        const archive = major.archive as Record<string, unknown> | undefined
        if (archive) {
          title = (archive.title as string) || ''
          cover = archive.cover ? normalizeBilibiliImageUrl(archive.cover as string) : undefined
          archiveBvid = (archive.bvid as string) || undefined
          archiveAid = archive.aid ? String(archive.aid) : undefined
          url = `https://www.bilibili.com/video/${String(archive.bvid || archive.aid || '')}`
        }
      } else if (major?.type === 'MAJOR_TYPE_DRAW') {
        const draw = major.draw as Record<string, unknown> | undefined
        const drawItems = draw?.items as Record<string, unknown>[] | undefined
        if (drawItems && drawItems.length > 0) {
          cover = drawItems[0]?.src
            ? normalizeBilibiliImageUrl(drawItems[0].src as string)
            : undefined
        }
        const desc = dynamic?.desc as Record<string, unknown> | undefined
        title = (desc?.text as string) || ''
        url = `https://t.bilibili.com/${idStr}`
      } else if (major?.type === 'MAJOR_TYPE_NONE') {
        const desc = dynamic?.desc as Record<string, unknown> | undefined
        title = (desc?.text as string) || ''
        url = `https://t.bilibili.com/${idStr}`
      }

      if (!title) continue

      items.push({
        id: `bilibili-follow-${idStr}`,
        platform: PLATFORM,
        title: title.slice(0, 200),
        cover,
        author: authorName,
        avatar: authorFace,
        url: url || `https://t.bilibili.com/${idStr}`,
        createdAt: undefined,
        stats: {
          like: parseBilibiliStatValue(stat?.like),
          comment: parseBilibiliStatValue(stat?.comment),
          share: parseBilibiliStatValue(stat?.forward ?? stat?.share ?? stat?.repost)
        },
        bvid: archiveBvid,
        aid: archiveAid,
        mediaType: archiveBvid || archiveAid ? 'video' : undefined
      })

      if (items.length >= pageSize) break
    }

    return {
      items,
      page: 1,
      pageSize,
      hasMore: !!json.data.has_more,
      nextOffset: json.data.offset as string | undefined
    }
  } catch (err) {
    console.warn('[bilibili] getFollowingFeedPage failed:', err)
    return { items: [], page: 1, pageSize, hasMore: false }
  }
}

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
]

let wbiKeysCache: { imgKey: string; subKey: string; expiresAt: number } | null = null
const WBI_CACHE_TTL = 60 * 60 * 1000

async function ensureWbiKeys(): Promise<{ imgKey: string; subKey: string } | null> {
  if (wbiKeysCache && Date.now() < wbiKeysCache.expiresAt) {
    return { imgKey: wbiKeysCache.imgKey, subKey: wbiKeysCache.subKey }
  }
  try {
    const { data } = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')
    const json = safeParseJson('ensureWbiKeys', data)
    if (!json?.data?.wbi_img) return null
    const imgUrl = json.data.wbi_img.img_url as string
    const subUrl = json.data.wbi_img.sub_url as string
    const imgKey = imgUrl.split('/').pop()?.split('.')[0] || ''
    const subKey = subUrl.split('/').pop()?.split('.')[0] || ''
    if (!imgKey || !subKey) return null
    wbiKeysCache = { imgKey, subKey, expiresAt: Date.now() + WBI_CACHE_TTL }
    return { imgKey, subKey }
  } catch {
    return null
  }
}

function getMixinKey(orig: string): string {
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += orig[MIXIN_KEY_ENC_TAB[i]] ?? ''
  }
  return result
}

function buildSignedWbiQuery(
  params: Record<string, string>,
  imgKey: string,
  subKey: string
): string {
  const mixinKey = getMixinKey(imgKey + subKey)
  const wts = Math.floor(Date.now() / 1000).toString()

  const allParams = { ...params, wts }
  const sorted = Object.entries(allParams).sort(([a], [b]) => a.localeCompare(b))

  let queryStr = ''
  for (const [k, v] of sorted) {
    const encoded = encodeURIComponent(v)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      .replace(/%20/g, '+')
    queryStr += `${k}=${encoded}&`
  }
  queryStr = queryStr.slice(0, -1)

  const wRid = createHash('md5').update(queryStr + mixinKey).digest('hex')
  return queryStr + `&w_rid=${wRid}`
}

function mapUserVListToFeedItems(vlist: Record<string, unknown>[]): FeedItem[] {
  return vlist.map((item, index) => ({
    id: `bilibili-${String(item.bvid || item.aid || index)}`,
    platform: PLATFORM,
    title: (item.title as string) || '',
    cover: item.pic ? normalizeBilibiliImageUrl(item.pic as string) : undefined,
    author: (item.author as string) || '',
    avatar: undefined,
    url: item.bvid
      ? `https://www.bilibili.com/video/${item.bvid}`
      : item.aid
        ? `https://www.bilibili.com/video/av${item.aid}`
        : '',
    createdAt: item.created
      ? new Date((item.created as number) * 1000).toISOString()
      : undefined,
    stats: {
      play: typeof item.play === 'number' ? item.play : undefined,
      comment: typeof item.video_review === 'number' ? item.video_review
        : typeof item.comment === 'number' ? item.comment
        : undefined
    },
    bvid: (item.bvid as string) || undefined,
    aid: item.aid ? String(item.aid) : undefined,
    mediaType: 'video'
  }))
}

async function tryFetchUserVideos(uid: string, page: number, pageSize: number, useWbi: boolean): Promise<PageResult<FeedItem> | null> {
  try {
    let url: string
    if (useWbi) {
      const keys = await ensureWbiKeys()
      if (!keys) {
        console.warn('[bilibili] tryFetchUserVideos/wbi: failed to get WBI keys')
        return null
      }
      const query = buildSignedWbiQuery(
        {
          mid: uid, pn: String(page), ps: String(pageSize),
          tid: '0', keyword: '', order: 'pubdate',
          platform: 'web', web_location: '1550101', order_avoided: 'true'
        },
        keys.imgKey, keys.subKey
      )
      url = `https://api.bilibili.com/x/space/wbi/arc/search?${query}`
    } else {
      const now = Date.now()
      const lastCall = legacyCooldowns.get(uid) ?? 0
      if (now - lastCall < LEGACY_COOLDOWN_MS) {
        console.warn(`[bilibili] tryFetchUserVideos/legacy: cooldown for uid=${uid}, remaining=${LEGACY_COOLDOWN_MS - (now - lastCall)}ms`)
        return {
          items: [], page, pageSize, total: 0, hasMore: false,
          errorCode: -1,
          error: `请求过于频繁，请稍后再试（冷却中）`
        }
      }
      legacyCooldowns.set(uid, now)
      url = `https://api.bilibili.com/x/space/arc/search?mid=${uid}&pn=${page}&ps=${pageSize}&order=pubdate`
    }

    const { data, statusCode } = await fetchWithSession(url)
    const apiTag = `getUserVideosPage/${useWbi ? 'wbi' : 'legacy'}`

    const json = safeParseJson(apiTag, data)
    if (!json) {
      console.warn(`[bilibili] ${apiTag}: no JSON (status ${statusCode}), preview: ${data.slice(0, 200)}`)
      return null
    }
    if (json.code !== 0) {
      const msg = json.message || json.msg || ''
      console.warn(`[bilibili] ${apiTag}: API error code=${json.code}, message=${msg}`)
      return { items: [], page, pageSize, total: 0, hasMore: false, errorCode: json.code, error: msg }
    }
    if (!json.data?.list?.vlist?.length) {
      console.warn(`[bilibili] ${apiTag}: empty vlist (total=${json.data?.page?.count || 0})`)
      return null
    }

    const total = json.data.page?.count || json.data.list.vlist.length
    const vlist = json.data.list.vlist as Record<string, unknown>[]

    return {
      items: mapUserVListToFeedItems(vlist),
      page, pageSize, total,
      hasMore: page * pageSize < total
    }
  } catch (err) {
    console.warn(`[bilibili] tryFetchUserVideos/${useWbi ? 'wbi' : 'legacy'}: exception`, err)
    return null
  }
}

async function fetchUserVideosViaBrowser(uid: string, page: number, pageSize: number): Promise<PageResult<FeedItem> | null> {
  let win: BrowserWindow | null = null
  let settled = false

  const finish = (result: PageResult<FeedItem> | null): Promise<PageResult<FeedItem> | null> => {
    if (settled) return Promise.resolve(result)
    settled = true
    if (win && !win.isDestroyed()) {
      try { win.close() } catch {}
    }
    return Promise.resolve(result)
  }

  const spaceUrl = `https://space.bilibili.com/${uid}/video`
  win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: getSession(PLATFORM),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  return new Promise<PageResult<FeedItem> | null>((resolve) => {
    if (!win) return resolve(null)

    const onFail = () => resolve(finish(null))

    win.webContents.on('did-finish-load', async () => {
      try {
        // Wait for page JS to initialize cookies (buvid3, buvid4, etc.)
        await new Promise((r) => setTimeout(r, 2000))

        // Step 1: Get WBI keys from the page context (same-origin /nav)
        const keysResult = await win!.webContents.executeJavaScript(`
          (async () => {
            try {
              const r = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' })
              const d = await r.json()
              if (!d?.data?.wbi_img) return { error: 'no wbi_img' }
              const ik = d.data.wbi_img.img_url.split('/').pop().split('.')[0]
              const sk = d.data.wbi_img.sub_url.split('/').pop().split('.')[0]
              return { imgKey: ik, subKey: sk }
            } catch (e) {
              return { error: e.message || String(e) }
            }
          })()
        `)

        if (!keysResult || keysResult.error) {
          console.warn('[bilibili] fetchUserVideosViaBrowser: WBI key fetch failed', keysResult?.error)
          return resolve(finish(null))
        }

        // Step 2: Compute WBI signature via shared function (same algo as net.request)
        const signedQuery = buildSignedWbiQuery(
          {
            mid: uid, pn: String(page), ps: String(pageSize),
            tid: '0', keyword: '', order: 'pubdate',
            platform: 'web', web_location: '1550101', order_avoided: 'true'
          },
          keysResult.imgKey, keysResult.subKey
        )

        // Step 3: Execute the API call from the page context (correct Referer + cookies)
        const apiText = await win!.webContents.executeJavaScript(`
          (async () => {
            try {
              const r = await fetch('https://api.bilibili.com/x/space/wbi/arc/search?${signedQuery}', { credentials: 'include' })
              return await r.text()
            } catch (e) {
              return JSON.stringify({ _fetchError: e.message || String(e) })
            }
          })()
        `)

        const json = JSON.parse(apiText)

        if (json._fetchError) {
          console.warn('[bilibili] fetchUserVideosViaBrowser fetch error:', json._fetchError)
          return resolve(finish(null))
        }
        if (json.code !== 0) {
          const msg = json.message || json.msg || ''
          console.warn(`[bilibili] fetchUserVideosViaBrowser: API error code=${json.code}, message=${msg}`)
          return resolve(finish({
            items: [], page, pageSize, total: 0, hasMore: false,
            errorCode: json.code, error: msg
          }))
        }
        if (!json.data?.list?.vlist?.length) {
          return resolve(finish(null))
        }

        const total = json.data.page?.count || json.data.list.vlist.length
        const vlist = json.data.list.vlist as Record<string, unknown>[]
        return resolve(finish({
          items: mapUserVListToFeedItems(vlist),
          page, pageSize, total,
          hasMore: page * pageSize < total
        }))
      } catch (e) {
        console.warn('[bilibili] fetchUserVideosViaBrowser exception:', e)
        return resolve(finish(null))
      }
    })

    win.webContents.on('did-fail-load', onFail)
    win.webContents.on('crashed', onFail)

    win.loadURL(spaceUrl)

    // Safety timeout
    setTimeout(() => resolve(finish(null)), 30000)
  })
}

export async function getUserVideosPage(
  uid: string,
  page = 1,
  pageSize = 10
): Promise<PageResult<FeedItem>> {
  const cacheKey = `${uid}:${page}:${pageSize}`

  // Check in-flight
  const inFlight = userVideosInFlight.get(cacheKey)
  if (inFlight) {
    const result = await inFlight
    return result ?? { items: [], page, pageSize, total: 0, hasMore: false }
  }

  // Check cache
  const cached = userVideosCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result
  }

  // Fetch with dedup
  const promise = (async (): Promise<PageResult<FeedItem> | null> => {
    // 1st attempt: net.request + WBI (fastest, no window overhead)
    const wbiResult = await tryFetchUserVideos(uid, page, pageSize, true)
    if (wbiResult && wbiResult.items.length > 0) {
      userVideosCache.set(cacheKey, { result: wbiResult, expiresAt: Date.now() + USER_VIDEOS_CACHE_TTL })
      return wbiResult
    }

    // If WBI returned -403 (access denied, likely signature/context issue), try browser approach
    if (wbiResult?.errorCode === -403) {
      console.log('[bilibili] getUserVideosPage: WBI -403, trying browser context...')
      const browserResult = await fetchUserVideosViaBrowser(uid, page, pageSize)
      if (browserResult && browserResult.items.length > 0) {
        userVideosCache.set(cacheKey, { result: browserResult, expiresAt: Date.now() + USER_VIDEOS_CACHE_TTL })
        return browserResult
      }
      // Browser also failed with -403 → invalidate WBI keys and retry net.request once
      if (browserResult?.errorCode === -403) {
        console.warn('[bilibili] getUserVideosPage: browser also returned -403, invalidating WBI cache and retrying...')
        wbiKeysCache = null
        const retryResult = await tryFetchUserVideos(uid, page, pageSize, true)
        if (retryResult && retryResult.items.length > 0) {
          userVideosCache.set(cacheKey, { result: retryResult, expiresAt: Date.now() + USER_VIDEOS_CACHE_TTL })
          return retryResult
        }
        if (retryResult?.errorCode) return retryResult
        if (browserResult?.errorCode) return browserResult
      }
      // Browser returned a non-403 error or no error
      if (browserResult?.errorCode) return browserResult
    }

    // For non-403 WBI errors (e.g. -799), return immediately
    if (wbiResult?.errorCode) return wbiResult

    // 3rd attempt: legacy with cooldown
    const legacyResult = await tryFetchUserVideos(uid, page, pageSize, false)
    if (legacyResult && legacyResult.items.length > 0) {
      userVideosCache.set(cacheKey, { result: legacyResult, expiresAt: Date.now() + USER_VIDEOS_CACHE_TTL })
      return legacyResult
    }

    return wbiResult ?? legacyResult ?? null
  })()

  userVideosInFlight.set(cacheKey, promise)

  try {
    const result = await promise
    return result ?? { items: [], page, pageSize, total: 0, hasMore: false }
  } finally {
    userVideosInFlight.delete(cacheKey)
  }
}

const playViewCache = new Map<string, { cid: number; title: string; pic: string; pages: Record<string, unknown>[]; aid: number; expiresAt: number }>()
const playViewCacheExpiry = 300000
const playurlCache = new Map<string, { dashData: Record<string, unknown>; qualities: { qn: number; description: string }[]; expiresAt: number }>()
const playurlCacheExpiry = 600000

const activePlaybackSessions = new Map<string, string>()

function clearPlayurlCache(): void {
  const now = Date.now()
  for (const [key, entry] of playurlCache) {
    if (now > entry.expiresAt) playurlCache.delete(key)
  }
  for (const [key, entry] of playViewCache) {
    if (now > entry.expiresAt) playViewCache.delete(key)
  }
}

setInterval(clearPlayurlCache, 120000)

export async function getVideoPlayback(bvid: string, qn?: number, existingToken?: string): Promise<VideoPlaybackInfo> {
  try {
    const viewCacheKey = `view:${bvid}`
    const viewParam = bvid.startsWith('BV') ? `bvid=${bvid}` : `aid=${bvid}`
    let viewData = playViewCache.get(viewCacheKey)
    if (!viewData || Date.now() > viewData.expiresAt) {
      const { data: viewRaw } = await fetchWithSession(`https://api.bilibili.com/x/web-interface/view?${viewParam}`)
      const viewJson = safeParseJson('getVideoPlayback/view', viewRaw)
      if (!viewJson || viewJson.code !== 0 || !viewJson.data) {
        return { bvid, aid: '', cid: '', title: '', playable: false, error: '视频信息获取失败', qualities: [], defaultQuality: 0, manifestUrl: '', externalUrl: `https://www.bilibili.com/video/${bvid}` }
      }
      const d = viewJson.data
      viewData = {
        cid: d.cid as number || (d.pages?.[0]?.cid as number) || 0,
        title: (d.title as string) || '',
        pic: (d.pic as string) || '',
        pages: (d.pages as Record<string, unknown>[]) || [],
        aid: (d.aid as number) || 0,
        expiresAt: Date.now() + playViewCacheExpiry
      }
      playViewCache.set(viewCacheKey, viewData)
    }

    const cid = viewData.cid
    if (!cid) {
      return { bvid, aid: String(viewData.aid || ''), cid: String(cid), title: viewData.title, playable: false, error: '视频 CID 获取失败', qualities: [], defaultQuality: 0, manifestUrl: '', externalUrl: `https://www.bilibili.com/video/${bvid}` }
    }

    const selectedQn = qn || 80
    const keys = await ensureWbiKeys()

    async function fetchPlayurl(qnVal: number) {
      const playCacheKey = `playurl:${bvid}:${cid}:${qnVal}`
      let playEntry = playurlCache.get(playCacheKey)
      if (playEntry && Date.now() < playEntry.expiresAt) return playEntry
      if (!keys) return null
      const playurlParams: Record<string, string> = { cid: String(cid), qn: String(qnVal), fnval: '4048', fourk: '1' }
      if (bvid.startsWith('BV')) playurlParams.bvid = bvid
      else playurlParams.aid = bvid
      const query = buildSignedWbiQuery(playurlParams, keys.imgKey, keys.subKey)
      const { data: playRaw } = await fetchWithSession(`https://api.bilibili.com/x/player/wbi/playurl?${query}`)
      const playJson = safeParseJson('getVideoPlayback/playurl', playRaw)
      if (playJson && playJson.code === 0 && playJson.data) {
        const dashData = (playJson.data.dash as Record<string, unknown>) || null
        const acceptQn = (playJson.data.accept_quality as number[]) || []
        const acceptDesc = (playJson.data.accept_description as string[]) || []
        const qualities = acceptQn.map((qnVal: number, i: number) => ({
          qn: qnVal,
          description: acceptDesc[i] || String(qnVal)
        }))
        const entry = { dashData: dashData || {}, qualities, expiresAt: Date.now() + playurlCacheExpiry }
        playurlCache.set(playCacheKey, entry)
        return entry
      }
      return null
    }

    const primary = await fetchPlayurl(selectedQn)
    const dashData = primary?.dashData || null
    const qualities = primary?.qualities || []

    if (!dashData) {
      return { bvid, aid: String(viewData.aid || ''), cid: String(cid), title: viewData.title, playable: false, error: '播放地址获取失败，可能是大会员专属视频', qualities, defaultQuality: selectedQn, manifestUrl: '', externalUrl: `https://www.bilibili.com/video/${bvid}` }
    }

    const duration = (dashData.duration as number) || 0

    function pickBackupUrl(v: Record<string, unknown>): string | undefined {
      const bu = v.backupUrl ?? v.backup_url
      if (Array.isArray(bu)) return bu[0] as string
      if (typeof bu === 'string') return bu
      return undefined
    }

    function extractVideoStreams(d: Record<string, unknown>): {
      baseUrl: string; backupUrl?: string; mimeType: string; codecs: string
      bandwidth: number; width?: number; height?: number; frameRate?: string
      segmentBase: { Initialization: string; indexRange: string }
    }[] {
      const arr = (d.video as Record<string, unknown>[]) || []
      return arr.map((v) => ({
        baseUrl: (v.baseUrl as string) || (v.base_url as string) || '',
        backupUrl: pickBackupUrl(v),
        mimeType: (v.mimeType as string) || (v.mime_type as string) || 'video/mp4',
        codecs: (v.codecs as string) || '',
        bandwidth: (v.bandwidth as number) || 0,
        width: (v.width as number) || 0,
        height: (v.height as number) || 0,
        frameRate: (v.frameRate as string) || (v.frame_rate as string) || undefined,
        segmentBase: {
          Initialization: ((v.SegmentBase as Record<string, unknown>)?.Initialization as string) || '0-0',
          indexRange: ((v.SegmentBase as Record<string, unknown>)?.indexRange as string) || '0-0'
        }
      }))
    }

    function extractAudioStreams(d: Record<string, unknown>): {
      baseUrl: string; backupUrl?: string; mimeType: string; codecs: string; bandwidth: number
      segmentBase: { Initialization: string; indexRange: string }
    }[] {
      const arr = (d.audio as Record<string, unknown>[]) || []
      return arr.map((a) => ({
        baseUrl: (a.baseUrl as string) || (a.base_url as string) || '',
        backupUrl: pickBackupUrl(a),
        mimeType: (a.mimeType as string) || (a.mime_type as string) || 'audio/mp4',
        codecs: (a.codecs as string) || '',
        bandwidth: (a.bandwidth as number) || 0,
        segmentBase: {
          Initialization: ((a.SegmentBase as Record<string, unknown>)?.Initialization as string) || '0-0',
          indexRange: ((a.SegmentBase as Record<string, unknown>)?.indexRange as string) || '0-0'
        }
      }))
    }

    const allVideoStreams = extractVideoStreams(dashData)
    const allAudioStreams = extractAudioStreams(dashData)

    if (allVideoStreams.length === 0 && allAudioStreams.length === 0) {
      return { bvid, aid: String(viewData.aid || ''), cid: String(cid), title: viewData.title, playable: false, error: '未找到可播放的视频流', qualities, defaultQuality: selectedQn, manifestUrl: '', externalUrl: `https://www.bilibili.com/video/${bvid}` }
    }

    const additionalQns = qualities.filter(q => q.qn !== selectedQn && q.qn !== 120).slice(0, 2)
    if (additionalQns.length > 0) {
      const results = await Promise.allSettled(additionalQns.map(q => fetchPlayurl(q.qn)))
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.dashData) {
          allVideoStreams.push(...extractVideoStreams(r.value.dashData))
        }
      }
    }

    let token: string
    if (existingToken && updateSession(
      existingToken,
      allVideoStreams,
      allAudioStreams,
      qualities,
      selectedQn
    )) {
      token = existingToken
    } else {
      token = startPlayback(
        bvid,
        String(cid),
        selectedQn,
        qualities,
        allVideoStreams,
        allAudioStreams,
        duration
      )
    }

    const manifestUrl = getManifestUrl(token)
    const cover = viewData.pic ? normalizeBilibiliImageUrl(viewData.pic) : undefined

    activePlaybackSessions.set(bvid, token)

    return {
      bvid,
      aid: String(viewData.aid || ''),
      cid: String(cid),
      title: viewData.title,
      cover,
      qualities,
      defaultQuality: selectedQn,
      manifestUrl,
      externalUrl: `https://www.bilibili.com/video/${bvid}`,
      duration,
      playable: true
    }
  } catch (err) {
    console.warn('[bilibili] getVideoPlayback failed:', err)
    return { bvid, aid: '', cid: '', title: '', playable: false, error: '播放解析异常', qualities: [], defaultQuality: 0, manifestUrl: '', externalUrl: `https://www.bilibili.com/video/${bvid}` }
  }
}

export async function changeVideoQuality(bvid: string, cid: string, qn: number, token?: string): Promise<ChangeQualityResult> {
  try {
    const result = await getVideoPlayback(bvid, qn, token)
    if (result.playable) {
      return { manifestUrl: result.manifestUrl, defaultQuality: qn, token }
    }
    return { manifestUrl: '', defaultQuality: qn, error: result.error || '切换清晰度失败' }
  } catch (err) {
    console.warn('[bilibili] changeVideoQuality failed:', err)
    return { manifestUrl: '', defaultQuality: qn, error: '切换清晰度异常' }
  }
}

async function getBiliCsrf(): Promise<string> {
  try {
    const sess = getSession(PLATFORM)
    const cookies = await sess.cookies.get({ name: 'bili_jct' })
    return cookies[0]?.value || ''
  } catch {
    return ''
  }
}

export async function getVideoInteraction(bvid: string, aid?: string): Promise<VideoInteractionState> {
  const state: VideoInteractionState = { liked: false, coined: false, favorited: false, stats: {} }
  try {
    const [likeRaw, coinRaw, favRaw] = await Promise.all([
      fetchWithSession(`https://api.bilibili.com/x/web-interface/archive/has/like?bvid=${bvid}`),
      fetchWithSession(`https://api.bilibili.com/x/web-interface/archive/coins?bvid=${bvid}`),
      aid ? fetchWithSession(`https://api.bilibili.com/x/v2/fav/video/favoured?aid=${aid}`) : Promise.resolve(null)
    ])

    const likeJson = safeParseJson('getVideoInteraction/like', likeRaw.data)
    if (likeJson && likeJson.code === 0) {
      state.liked = likeJson.data === 1
    }

    const coinJson = safeParseJson('getVideoInteraction/coin', coinRaw.data)
    if (coinJson && coinJson.code === 0) {
      state.coined = (coinJson.data?.multiply as number || 0) > 0
    }

    if (favRaw) {
      const favJson = safeParseJson('getVideoInteraction/fav', favRaw.data)
      if (favJson && favJson.code === 0) {
        state.favorited = favJson.data?.favoured === true
      }
    }

    // Read stats from view cache fallback
    const viewCacheKey = `view:${bvid}`
    const viewEntry = playViewCache.get(viewCacheKey)
    if (viewEntry) {
      const stat = {} as Record<string, unknown>
      // stats are not in the view cache, we need another API call for them.
      // Use the /view API which we already fetched during getVideoPlayback
      const viewParam = bvid.startsWith('BV') ? `bvid=${bvid}` : `aid=${bvid}`
      const { data } = await fetchWithSession(`https://api.bilibili.com/x/web-interface/view?${viewParam}`)
      const viewJson = safeParseJson('getVideoInteraction/view', data)
      if (viewJson && viewJson.code === 0 && viewJson.data?.stat) {
        const s = viewJson.data.stat as Record<string, unknown>
        state.stats.like = s.like as number || 0
        state.stats.coin = s.coin as number || 0
        state.stats.favorite = s.favorite as number || 0
      }
    }
  } catch (err) {
    console.warn('[bilibili] getVideoInteraction failed:', err)
  }
  return state
}

export async function toggleVideoLike(bvid: string, like: boolean): Promise<VideoInteractionResult> {
  try {
    const csrf = await getBiliCsrf()
    if (!csrf) return { success: false, error: '无法获取 CSRF Token' }
    const { data } = await fetchWithSession('https://api.bilibili.com/x/web-interface/archive/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `bvid=${bvid}&like=${like ? 1 : 2}&csrf=${csrf}`
    })
    const json = safeParseJson('toggleVideoLike', data)
    if (json && json.code === 0) return { success: true }
    return { success: false, error: json?.message || json?.msg || '点赞失败' }
  } catch (err) {
    console.warn('[bilibili] toggleVideoLike failed:', err)
    return { success: false, error: '点赞请求异常' }
  }
}

export async function addVideoCoin(bvid: string, aid?: string, multiply: number = 1, selectLike: boolean = false): Promise<VideoInteractionResult> {
  try {
    const csrf = await getBiliCsrf()
    if (!csrf) return { success: false, error: '无法获取 CSRF Token' }
    let body = `bvid=${bvid}&multiply=${multiply}&select_like=${selectLike ? 1 : 0}&csrf=${csrf}`
    if (aid) body += `&aid=${aid}`
    const { data } = await fetchWithSession('https://api.bilibili.com/x/web-interface/coin/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const json = safeParseJson('addVideoCoin', data)
    if (json && json.code === 0) return { success: true }
    return { success: false, error: json?.message || json?.msg || '投币失败' }
  } catch (err) {
    console.warn('[bilibili] addVideoCoin failed:', err)
    return { success: false, error: '投币请求异常' }
  }
}

export async function getVideoFavoriteFolders(aid: string): Promise<FavoriteFolderSelection[]> {
  try {
    const navData = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')
    const navJson = safeParseJson('getVideoFavoriteFolders/nav', navData.data)
    if (!navJson || navJson.code !== 0 || !navJson.data) return []
    const mid = navJson.data.mid as number
    if (!mid) return []

    const folderRes = await fetchWithSession(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}&type=2&_=${Date.now()}`)
    const folderJson = safeParseJson('getVideoFavoriteFolders/list', folderRes.data)
    if (!folderJson || folderJson.code !== 0 || !folderJson.data?.list) return []

    const favouredRes = await fetchWithSession(`https://api.bilibili.com/x/v3/fav/resource/favoured?rid=${aid}&type=2&_=${Date.now()}`)
    const favouredJson = safeParseJson('getVideoFavoriteFolders/favoured', favouredRes.data)
    const favouredIds: number[] = (favouredJson?.code === 0 && Array.isArray(favouredJson.data)) ? favouredJson.data : []

    const list = folderJson.data.list as Record<string, unknown>[]
    return list.map(f => ({
      id: String(f.id || f.media_id || ''),
      title: (f.title as string) || '',
      count: (f.media_count as number) || (f.count as number) || undefined,
      checked: favouredIds.includes(Number(f.id || f.media_id))
    }))
  } catch (err) {
    console.warn('[bilibili] getVideoFavoriteFolders failed:', err)
    return []
  }
}

export async function updateVideoFavoriteFolders(aid: string, addMediaIds: string[], delMediaIds: string[]): Promise<VideoInteractionResult> {
  try {
    const csrf = await getBiliCsrf()
    if (!csrf) return { success: false, error: '无法获取 CSRF Token' }

    const { data } = await fetchWithSession('https://api.bilibili.com/x/v3/fav/resource/deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `rid=${aid}&type=2&add_media_ids=${addMediaIds.join(',')}&del_media_ids=${delMediaIds.join(',')}&csrf=${csrf}`
    })

    const json = safeParseJson('updateVideoFavoriteFolders', data)
    if (json && json.code === 0) return { success: true }
    return { success: false, error: json?.message || json?.msg || '收藏更新失败' }
  } catch (err) {
    console.warn('[bilibili] updateVideoFavoriteFolders failed:', err)
    return { success: false, error: '收藏请求异常' }
  }
}

export async function createFavoriteFolder(title: string): Promise<CreateFavoriteFolderResult> {
  try {
    const trimmed = title.trim()
    if (!trimmed) return { success: false, error: '收藏夹名称不能为空' }
    if (trimmed.length > 20) return { success: false, error: '收藏夹名称最多20个字' }

    const csrf = await getBiliCsrf()
    if (!csrf) return { success: false, error: '无法获取 CSRF Token' }

    const { data } = await fetchWithSession('https://api.bilibili.com/x/v3/fav/folder/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `title=${encodeURIComponent(trimmed)}&intro=&privacy=0&csrf=${csrf}`
    })
    const json = safeParseJson('createFavoriteFolder', data)
    if (json && json.code === 0) {
      let folderId = String(json.data?.id || json.data?.media_id || '')
      if (!folderId) {
        const folders = await getFavoriteFolders()
        const matched = folders.find(f => f.title === trimmed)
        if (matched) {
          folderId = matched.id
        }
      }
      if (!folderId) {
        return { success: false, error: '创建成功但无法获取收藏夹ID，请重新打开收藏弹窗' }
      }
      return {
        success: true,
        folder: {
          id: folderId,
          title: trimmed,
          count: 0,
          checked: true
        }
      }
    }
    return { success: false, error: json?.message || json?.msg || '创建收藏夹失败' }
  } catch (err) {
    console.warn('[bilibili] createFavoriteFolder failed:', err)
    return { success: false, error: '创建收藏夹请求异常' }
  }
}

export async function getFavoriteFolders(): Promise<FavoriteFolder[]> {
  try {
    const navData = await fetchWithSession('https://api.bilibili.com/x/web-interface/nav')
    const navJson = safeParseJson('getFavoriteFolders/nav', navData.data)
    if (!navJson || navJson.code !== 0 || !navJson.data) return []
    const mid = navJson.data.mid as number
    if (!mid) return []

    const folderRes = await fetchWithSession(`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${mid}&type=2&_=${Date.now()}`)
    const folderJson = safeParseJson('getFavoriteFolders/list', folderRes.data)
    if (!folderJson || folderJson.code !== 0 || !folderJson.data?.list) return []

    const list = folderJson.data.list as Record<string, unknown>[]
    return list.map((f) => ({
      id: String(f.id || f.media_id || ''),
      title: (f.title as string) || '',
      count: (f.media_count as number) || (f.count as number) || undefined
    }))
  } catch (err) {
    console.warn('[bilibili] getFavoriteFolders failed:', err)
    return []
  }
}

export async function getFavoriteVideosPage(mediaId: string, page = 1, pageSize = 20): Promise<PageResult<FeedItem>> {
  try {
    const { data } = await fetchWithSession(
      `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${mediaId}&pn=${page}&ps=${pageSize}&keyword=&order=m_time&type=0&tid=0&platform=web`
    )
    const json = safeParseJson('getFavoriteVideosPage', data)
    if (!json || json.code !== 0) {
      return { items: [], page, pageSize, total: 0, hasMore: false }
    }

    const medias = json.data?.medias as Record<string, unknown>[] || []
    const total = json.data?.info?.media_count as number || medias.length

    const items: FeedItem[] = []
    for (const m of medias) {
      const bvid = (m.bvid as string) || ''
      const aid = m.aid ? String(m.aid) : ''
      if (!bvid && !aid) continue

      const upper = m.upper as Record<string, unknown> | undefined
      const cntInfo = m.cnt_info as Record<string, unknown> | undefined

      items.push({
        id: `bilibili-fav-${mediaId}-${bvid || aid}`,
        platform: PLATFORM,
        title: (m.title as string) || '',
        cover: (m.cover as string) ? normalizeBilibiliImageUrl(m.cover as string) : undefined,
        author: upper?.name as string || '',
        avatar: upper?.face ? normalizeBilibiliImageUrl(upper.face as string) : undefined,
        url: `https://www.bilibili.com/video/${bvid || `av${aid}`}`,
        stats: {
          play: cntInfo?.play as number || undefined,
          like: cntInfo?.like as number || undefined,
          comment: cntInfo?.reply as number || undefined
        },
        bvid: bvid || undefined,
        aid: aid || undefined,
        mediaType: 'video'
      })
    }

    return { items, page, pageSize, total, hasMore: page * pageSize < total }
  } catch (err) {
    console.warn('[bilibili] getFavoriteVideosPage failed:', err)
    return { items: [], page, pageSize, total: 0, hasMore: false }
  }
}

export async function getBiliVideoDetail(bvid: string, aid?: string): Promise<BiliVideoDetail | null> {
  try {
    const viewParam = bvid.startsWith('BV') ? `bvid=${bvid}` : `aid=${bvid}`
    const { data } = await fetchWithSession(`https://api.bilibili.com/x/web-interface/view?${viewParam}`)
    const json = safeParseJson('getBiliVideoDetail', data)
    if (!json || json.code !== 0 || !json.data) return null

    const d = json.data

    let tags: string[] = []
    try {
      const tagRes = await fetchWithSession(`https://api.bilibili.com/x/tag/archive/tags?bvid=${bvid}`)
      const tagJson = safeParseJson('getBiliVideoDetail/tags', tagRes.data)
      if (tagJson && tagJson.code === 0 && Array.isArray(tagJson.data)) {
        tags = tagJson.data.map((t: Record<string, unknown>) => String(t.tag_name || ''))
      }
    } catch {
      // tags are optional, silently ignore
    }

    const stat = (d.stat as Record<string, unknown>) || {}

    let desc = (d.desc as string) || ''
    if (!desc || desc === '-' || !desc.trim()) {
      const descV2 = d.desc_v2 as Array<{ raw_text?: string }> | undefined
      if (Array.isArray(descV2) && descV2.length > 0) {
        desc = descV2.map((item: { raw_text?: string }) => item.raw_text || '').join('').trim()
      }
    }
    if (!desc || desc === '-') desc = ''

    const rawFace = (d.owner as Record<string, unknown>)?.face as string | undefined

    return {
      bvid,
      aid: String(d.aid || aid || ''),
      title: (d.title as string) || '',
      desc,
      cover: (d.pic as string) || undefined,
      pubdate: (d.pubdate as number) || undefined,
      duration: (d.duration as number) || undefined,
      owner: {
        mid: String((d.owner as Record<string, unknown>)?.mid || ''),
        name: String((d.owner as Record<string, unknown>)?.name || ''),
        face: rawFace ? normalizeBilibiliImageUrl(rawFace) : undefined,
      },
      stats: {
        view: stat.view as number || undefined,
        danmaku: stat.danmaku as number || undefined,
        reply: stat.reply as number || undefined,
        favorite: stat.favorite as number || undefined,
        coin: stat.coin as number || undefined,
        share: stat.share as number || undefined,
        like: stat.like as number || undefined,
      },
      tags
    }
  } catch (err) {
    console.warn('[bilibili] getBiliVideoDetail failed:', err)
    return null
  }
}

export async function getBiliVideoComments(aid: string, sort: 'hot' | 'time' = 'hot', cursor?: string, pageSize = 20): Promise<BiliVideoCommentsResult> {
  try {
    const pn = cursor ? parseInt(cursor, 10) || 1 : 1
    const sortVal = sort === 'time' ? 1 : 2
    const { data } = await fetchWithSession(
      `https://api.bilibili.com/x/v2/reply?type=1&oid=${aid}&sort=${sortVal}&pn=${pn}&ps=${pageSize}`
    )
    const json = safeParseJson('getBiliVideoComments', data)
    if (!json || json.code !== 0 || !json.data) {
      return { items: [], hasMore: false, error: json?.message || json?.msg || '评论加载失败' }
    }

    const d = json.data
    const total = (d.page as Record<string, unknown>)?.total as number | undefined
    const replies = (d.replies as Record<string, unknown>[]) || []
    const upMid = String((d.upper as Record<string, unknown>)?.mid || '')

    const items: BiliVideoComment[] = replies.map(r => {
      const member = (r.member as Record<string, unknown>) || {}
      const contentObj = (r.content as Record<string, unknown>) || {}
      return {
        id: String(r.rpid || r.id || ''),
        rpid: String(r.rpid || ''),
        mid: String(member.mid || ''),
        nickname: String(member.uname || ''),
        avatar: member.avatar ? normalizeBilibiliImageUrl(member.avatar as string) : undefined,
        content: String(contentObj.message || ''),
        ctime: r.ctime as number || undefined,
        like: r.like as number || 0,
        isUp: upMid ? String(member.mid || '') === upMid : false,
        level: (member.level_info as Record<string, unknown>)?.current_level as number || undefined,
        replyCount: (r.rcount as number) || undefined,
      }
    })

    const currentP = (d.page as Record<string, unknown>)?.num as number || pn
    const totalP = (d.page as Record<string, unknown>)?.total_page as number | undefined
    const hasMore = totalP ? currentP < totalP : items.length >= pageSize

    return {
      items,
      total,
      cursor: hasMore ? String(currentP + 1) : undefined,
      hasMore,
    }
  } catch (err) {
    console.warn('[bilibili] getBiliVideoComments failed:', err)
    return { items: [], hasMore: false, error: '评论请求异常' }
  }
}

export async function getBiliCommentReplies(aid: string, rootRpid: string, page: number = 1, pageSize: number = 10): Promise<BiliCommentRepliesResult> {
  try {
    const { data } = await fetchWithSession(
      `https://api.bilibili.com/x/v2/reply/reply?type=1&oid=${aid}&root=${rootRpid}&pn=${page}&ps=${pageSize}`
    )
    const json = safeParseJson('getBiliCommentReplies', data)
    if (!json || json.code !== 0 || !json.data) {
      return { items: [], page, hasMore: false, error: json?.message || json?.msg || '回复加载失败' }
    }

    const d = json.data
    const replies = (d.replies as Record<string, unknown>[]) || []
    const upMid = String((d.upper as Record<string, unknown>)?.mid || '')

    const items: BiliVideoComment[] = replies.map(r => {
      const member = (r.member as Record<string, unknown>) || {}
      const contentObj = (r.content as Record<string, unknown>) || {}
      return {
        id: String(r.rpid || r.id || ''),
        rpid: String(r.rpid || ''),
        mid: String(member.mid || ''),
        nickname: String(member.uname || ''),
        avatar: member.avatar ? normalizeBilibiliImageUrl(member.avatar as string) : undefined,
        content: String(contentObj.message || ''),
        ctime: r.ctime as number || undefined,
        like: r.like as number || 0,
        isUp: upMid ? String(member.mid || '') === upMid : false,
        level: (member.level_info as Record<string, unknown>)?.current_level as number || undefined,
        parent: r.parent ? String(r.parent) : undefined,
      }
    })

    const count = (d.page as Record<string, unknown>)?.count as number || (d.page as Record<string, unknown>)?.total as number || undefined
    const hasMore = count ? items.length < count : items.length >= pageSize

    return { items, total: count, page, hasMore }
  } catch (err) {
    console.warn('[bilibili] getBiliCommentReplies failed:', err)
    return { items: [], page, hasMore: false, error: '回复请求异常' }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetchWithSession('https://passport.bilibili.com/login/exit/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  } catch (err) {
    console.warn('[bilibili] logout failed:', err)
  }
}
