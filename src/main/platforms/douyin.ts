import { net, BrowserWindow } from 'electron'
import { getSession } from '../sessions'
import type { UserProfile, FeedItem, LoginState, PlatformId } from '../../shared/types'
import { networkLog } from '../logger'

const PLATFORM: PlatformId = 'douyin'
const EXTERNAL_PROTOCOL_RE = /^(bytedance|snssdk1128|douyin|aweme):\/\//i

let douyinWorker: BrowserWindow | null = null
let douyinWorkerBusy = false
const douyinSeenFeedIds = new Set<string>()

function getDouyinWorker(): BrowserWindow {
  if (douyinWorker && !douyinWorker.isDestroyed() && !douyinWorkerBusy) {
    return douyinWorker
  }
  if (douyinWorker && !douyinWorker.isDestroyed()) {
    return douyinWorker
  }
  douyinWorker = new BrowserWindow({
    width: 1280,
    height: 900,
    show: true,
    x: -10000,
    y: -10000,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      session: getSession(PLATFORM),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  douyinWorker.on('closed', () => { douyinWorker = null; douyinWorkerBusy = false })

  douyinWorker.webContents.on('will-navigate', (event, url) => {
    if (EXTERNAL_PROTOCOL_RE.test(url)) event.preventDefault()
  })
  douyinWorker.webContents.setWindowOpenHandler(({ url }) => {
    return EXTERNAL_PROTOCOL_RE.test(url) ? { action: 'deny' } : { action: 'allow' }
  })

  return douyinWorker
}

function destroyDouyinWorker(): void {
  douyinWorkerBusy = false
  if (douyinWorker && !douyinWorker.isDestroyed()) {
    try {
      const dbg = douyinWorker.webContents.debugger
      if (dbg.isAttached()) dbg.detach()
    } catch {}
    douyinWorker.close()
  }
  douyinWorker = null
}

function fixDouyinImageUrl(url: string): string {
  if (!url) return ''
  if (url.includes('\\u')) {
    try { url = JSON.parse(`"${url}"`) } catch {}
  }
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return url.replace('http://', 'https://')
  return url
}

function safeParseJson(apiName: string, data: string): any {
  const trimmed = data.trim()
  if (!trimmed || trimmed.startsWith('<')) return null
  try { return JSON.parse(trimmed) } catch { return null }
}

function isDouyinFeedCandidateUrl(url: string): boolean {
  return /\/aweme\/v[12]\/web\/(module\/feed|tab\/feed|general\/feed|aweme\/feed|recommend\b)/i.test(url)
}

function normalizeDouyinFeedItem(raw: any): FeedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.aweme_id || raw.awemeId || raw.item_id || raw.group_id || raw.id_str || '')
  if (!id) return null
  const author = raw.author || raw.authorInfo || raw.user || {}
  const video = raw.video || raw.videoInfo || {}
  const stats = raw.statistics || raw.stats || {}
  const title = raw.desc || raw.title || (raw.share_info && raw.share_info.share_title) || ''
  const cover = video.cover?.url_list?.[0] ||
                video.origin_cover?.url_list?.[0] ||
                video.dynamic_cover?.url_list?.[0] ||
                raw.cover?.url_list?.[0] ||
                raw.poster || raw.thumb_url || ''
  const nickname = author.nickname || ''
  const avatar = author.avatar_thumb?.url_list?.[0] ||
                 author.avatar_medium?.url_list?.[0] ||
                 author.avatar_larger?.url_list?.[0] || ''
  return {
    id: `douyin-${id}`,
    platform: PLATFORM,
    title: title || '',
    cover: fixDouyinImageUrl(cover) || undefined,
    author: nickname,
    avatar: fixDouyinImageUrl(avatar) || undefined,
    url: `https://www.douyin.com/video/${id}`,
    stats: {
      like: stats.digg_count != null ? Number(stats.digg_count) : undefined,
      comment: stats.comment_count != null ? Number(stats.comment_count) : undefined,
      share: stats.share_count != null ? Number(stats.share_count) : undefined,
      play: stats.play_count != null ? Number(stats.play_count) : undefined
    },
    mediaType: 'video'
  } as FeedItem
}

function fetchWithSession(url: string, options?: { method?: string; headers?: Record<string, string> }) {
  const start = Date.now()
  return new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
    const session = getSession(PLATFORM)
    const req = session.request({
      method: options?.method || 'GET',
      url,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Origin': 'https://www.douyin.com',
        ...options?.headers
      }
    })

    let data = ''
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        networkLog('douyin', options?.method || 'GET', url, res.statusCode, Date.now() - start, data.length)
        resolve({ statusCode: res.statusCode, data })
      })
    })
    req.on('error', (err) => {
      networkLog('douyin', options?.method || 'GET', url, 0, Date.now() - start, 0, err)
      reject(err)
    })
    req.end()
  })
}

async function hasAuthCookie(): Promise<boolean> {
  const s = getSession(PLATFORM)
  const cookies = await s.cookies.get({ url: 'https://www.douyin.com/' })
  const authNames = ['sessionid', 'sid_guard', 'sessionid_ss', 'sid_tt', 'uid_tt', 'passport_auth_status']
  return cookies.some(c => authNames.includes(c.name))
}

function extractDouyinUserFromSSR(parsed: any): UserProfile | null {
  const userInfo = parsed?.app?.userInfo ||
                  parsed?.user?.userInfo ||
                  parsed?.userInfo ||
                  parsed?.store?.UserStore?.userInfo ||
                  parsed?.UserStore?.userInfo ||
                  parsed?.props?.pageProps?.userInfo ||
                  parsed?.pageProps?.userInfo ||
                  parsed?.initialState?.user?.userInfo
  if (!userInfo?.nickname) return null

  const profile: UserProfile = {
    platform: PLATFORM,
    nickname: userInfo.nickname,
    avatar: fixDouyinImageUrl(userInfo.avatar || userInfo.avatar_larger || ''),
    uid: String(userInfo.uid || userInfo.id || userInfo.userId || ''),
    bio: userInfo.signature || userInfo.desc || userInfo.bio || ''
  }
  const stats: UserProfile['stats'] = {}
  if (userInfo.following_count != null) stats.following = userInfo.following_count
  if (userInfo.follower_count != null) stats.follower = userInfo.follower_count
  if (userInfo.like_count != null) stats.likes = userInfo.like_count
  if (Object.keys(stats).length) profile.stats = stats
  return profile
}

async function getProfileViaHomePage(): Promise<UserProfile | null> {
  try {
    const { data } = await fetchWithSession('https://www.douyin.com/')
    const scriptMatch = data.match(/<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/)
    if (scriptMatch) {
      const decoded = decodeURIComponent(scriptMatch[1])
      try {
        const parsed = JSON.parse(decoded)
        const profile = extractDouyinUserFromSSR(parsed)
        if (profile) return profile
      } catch {}
    }
    const initMatch = data.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/)
    if (initMatch) {
      try {
        const parsed = JSON.parse(initMatch[1])
        const profile = extractDouyinUserFromSSR(parsed)
        if (profile) return profile
      } catch {}
    }
    return null
  } catch {
    return null
  }
}

export async function extractProfileFromWindow(win: BrowserWindow): Promise<UserProfile | null> {
  try {
    const result: Record<string, unknown> | null = await win.webContents.executeJavaScript(`
      (function() {
        try {
          var script = document.querySelector('script[id="RENDER_DATA"]');
          if (script) {
            var decoded = decodeURIComponent(script.textContent);
            var data = JSON.parse(decoded);
            var u = (data.app && data.app.userInfo) || (data.user && data.user.userInfo) || data.userInfo || (data.store && data.store.UserStore && data.store.UserStore.userInfo);
            if (u && u.nickname) {
              return {
                nickname: u.nickname,
                avatar: u.avatar || u.avatar_larger || '',
                uid: String(u.uid || u.id || u.userId || ''),
                bio: u.signature || u.desc || '',
                _following: u.following_count,
                _follower: u.follower_count,
                _likes: u.like_count
              };
            }
          }
        } catch(e) {}
        try {
          var data = window.__INITIAL_STATE__;
          if (data) {
            var u = (data.UserStore && data.UserStore.userInfo) || data.userInfo;
            if (u && u.nickname) {
              return {
                nickname: u.nickname,
                avatar: u.avatar || u.avatar_larger || '',
                uid: String(u.uid || u.id || ''),
                bio: u.signature || u.desc || '',
                _following: u.following_count,
                _follower: u.follower_count,
                _likes: u.like_count
              };
            }
          }
        } catch(e) {}
        try {
          var bodyText = document.body ? document.body.innerText || '' : '';
          var title = document.title || '';
          var dyIdMatch = bodyText.match(/抖音号[：:]?\\s*([A-Za-z0-9._-]+)/);
          if (!dyIdMatch) return null;
          var nickname = '';
          var titleMatch = title.match(/^(.+?)的个人主页/);
          if (titleMatch) {
            nickname = titleMatch[1].trim();
          } else {
            nickname = title.replace(/ - .*$/, '').replace(/的个人主页/, '').trim();
          }
          if (!nickname || nickname.length > 50) return null;
          var following = null, follower = null, likes = null;
          var m = bodyText.match(/(\\d[\\d,]*)\\s*关注/);
          if (m) following = parseInt(m[1].replace(/,/g, ''));
          m = bodyText.match(/(\\d[\\d,]*)\\s*粉丝/);
          if (m) follower = parseInt(m[1].replace(/,/g, ''));
          m = bodyText.match(/(\\d[\\d,]*)\\s*获赞/);
          if (m) likes = parseInt(m[1].replace(/,/g, ''));
          var avatar = '';
          var imgs = document.querySelectorAll('img');
          var badPatterns = ['qrcode', 'favicon', 'logo', 'sprite', '.svg', 'default-avatar', 'icon'];
          for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var src = img.src || '';
            if (!src) continue;
            var isBad = false;
            for (var k = 0; k < badPatterns.length; k++) {
              if (src.includes(badPatterns[k])) { isBad = true; break; }
            }
            if (isBad) continue;
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w >= 40 && h >= 40) {
              avatar = src;
              if (w >= 80 && h >= 80) break;
            }
          }
          return {
            nickname: nickname,
            avatar: avatar,
            uid: dyIdMatch[1],
            bio: '',
            _following: following,
            _follower: follower,
            _likes: likes
          };
        } catch(e) {}
        return null;
      })()
    `)
    if (result?.nickname) {
      const profile: UserProfile = {
        platform: PLATFORM,
        nickname: result.nickname as string,
        avatar: fixDouyinImageUrl((result.avatar as string) || ''),
        uid: String(result.uid || ''),
        bio: (result.bio as string) || ''
      }
      const stats: UserProfile['stats'] = {}
      if (result._following != null) stats.following = Number(result._following)
      if (result._follower != null) stats.follower = Number(result._follower)
      if (result._likes != null) stats.likes = Number(result._likes)
      if (Object.keys(stats).length) profile.stats = stats
      return profile
    }
    return null
  } catch {
    return null
  }
}

export async function checkLogin(): Promise<LoginState> {
  try {
    const profile = await getProfileViaHomePage()
    if (profile) return { loggedIn: true, profile }
    const hasCookie = await hasAuthCookie()
    return { loggedIn: hasCookie, profile: null }
  } catch {
    try {
      const hasCookie = await hasAuthCookie()
      return { loggedIn: hasCookie, profile: null }
    } catch {
      return { loggedIn: false, profile: null }
    }
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  return getProfileViaHomePage()
}

function collectAwemeObjects(input: unknown, depth = 0): any[] {
  if (!input || typeof input !== 'object' || depth > 15) return []
  const results: any[] = []
  try {
    const obj = input as Record<string, unknown>
    if (typeof obj.aweme_id === 'string' || typeof obj.aweme_id === 'number' || typeof obj.awemeId === 'string') {
      results.push(input)
      return results
    }
    for (const key of ['url', 'href', 'schema', 'share_url']) {
      const val = obj[key]
      if (typeof val === 'string' && val.includes('/video/')) {
        if (/\/video\/(\d+)/.test(val)) {
          results.push(input)
          return results
        }
      }
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        const collected = collectAwemeObjects(item, depth + 1)
        results.push(...collected)
      }
    } else {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string' && value.length > 20 && (value[0] === '{' || value[0] === '[')) {
          try {
            const parsed = JSON.parse(value)
            const collected = collectAwemeObjects(parsed, depth + 1)
            results.push(...collected)
          } catch {}
        }
        const collected = collectAwemeObjects(value, depth + 1)
        results.push(...collected)
      }
    }
  } catch {}
  return results
}

async function extractFeedFromDom(win: BrowserWindow): Promise<FeedItem[]> {
  try {
    const raw = await win.webContents.executeJavaScript(`
      (function() {
        try {
          var diag = {};
          diag.url = location.href;
          diag.title = document.title;
          diag.visState = document.visibilityState;
          diag.readyState = document.readyState;
          diag.bodyLen = document.body ? document.body.innerText.length : 0;
          diag.linkCount = document.querySelectorAll('a[href*="/video/"]').length;
          diag.videoCount = document.querySelectorAll('video').length;
          diag.imgCount = document.querySelectorAll('img').length;
          diag.scriptCount = document.querySelectorAll('script').length;

          var items = [];
          var seen = new Set();

          // Method 1: direct video links
          var links = document.querySelectorAll('a[href*="/video/"]');
          for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            var m = href.match(/\\/video\\/(\\d+)/);
            if (!m || seen.has(m[1])) continue;
            seen.add(m[1]);
            var card = links[i].closest('[class*="card"]') || links[i].parentElement || links[i];
            var imgSrc = '';
            var imgs = card.querySelectorAll('img');
            for (var j = 0; j < imgs.length; j++) {
              var s = imgs[j].src || '';
              if (s && s.indexOf('favicon') === -1 && s.indexOf('logo') === -1 && s.indexOf('.svg') === -1 && s.indexOf('default-avatar') === -1 && s.indexOf('icon') === -1) { imgSrc = s; break; }
            }
            var titleEl = card.querySelector('[class*="title"], [class*="desc"], h3, h4');
            items.push({ id: m[1], title: titleEl ? (titleEl.textContent || '').trim().substring(0, 200) : '', cover: imgSrc, author: '' });
            if (items.length >= 12) break;
          }

          // Method 2: script tags containing aweme_ids
          if (items.length < 6) {
            var scripts = document.querySelectorAll('script');
            for (var si = 0; si < scripts.length; si++) {
              var content = scripts[si].textContent || '';
              if (content.length > 200 && (content.indexOf('aweme_id') !== -1 || content.indexOf('awemeId') !== -1)) {
                var reA = /"aweme_id"\\s*:\\s*"(\\d+)"/g;
                var mmA;
                while ((mmA = reA.exec(content)) !== null) {
                  if (!seen.has(mmA[1])) { seen.add(mmA[1]); items.push({ id: mmA[1], title: '', cover: '', author: '' }); }
                  if (items.length >= 12) break;
                }
              }
              var type = scripts[si].type || '';
              if (type === 'application/json' || type === 'application/ld+json') {
                try {
                  var jsonData = JSON.parse(content);
                  if (jsonData && typeof jsonData === 'object') {
                    var strData = JSON.stringify(jsonData);
                    var reJ = /(aweme_id|video_id|item_id)\\s*["':]\\s*"(\\d+)"/g;
                    var mmJ;
                    while ((mmJ = reJ.exec(strData)) !== null) {
                      if (!seen.has(mmJ[2])) { seen.add(mmJ[2]); items.push({ id: mmJ[2], title: '', cover: '', author: '' }); }
                      if (items.length >= 12) break;
                    }
                  }
                } catch(e) {}
              }
              if (items.length >= 12) break;
            }
          }

          // Method 3: SSR RENDER_DATA
          if (items.length < 6) {
            var renderScript = document.querySelector('script[id="RENDER_DATA"]');
            if (renderScript) {
              try {
                var decoded = decodeURIComponent(renderScript.textContent);
                var re2 = /"aweme_id"\\s*:\\s*"(\\d+)"/g;
                var mm2;
                while ((mm2 = re2.exec(decoded)) !== null) {
                  if (!seen.has(mm2[1])) { seen.add(mm2[1]); items.push({ id: mm2[1], title: '', cover: '', author: '' }); }
                  if (items.length >= 12) break;
                }
              } catch(e) {}
            }
          }

          // Method 4: __INITIAL_STATE__
          if (items.length < 6) {
            try {
              var initData = window.__INITIAL_STATE__;
              if (initData) {
                var rawInit = JSON.stringify(initData);
                var re3 = /"aweme_id"\\s*:\\s*"(\\d+)"/g;
                var mm3;
                while ((mm3 = re3.exec(rawInit)) !== null) {
                  if (!seen.has(mm3[1])) { seen.add(mm3[1]); items.push({ id: mm3[1], title: '', cover: '', author: '' }); }
                  if (items.length >= 12) break;
                }
              }
            } catch(e) {}
          }

          diag.foundItems = items.length;
          return JSON.stringify({ d: diag, items: items.length > 0 ? items : null });
        } catch(e) { return JSON.stringify({ d: { error: e.message }, items: null }); }
      })()
    `)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const diag = parsed.d || {}
    console.info('[douyin]', `DOM extract: url=${diag.url || ''} title=${diag.title || ''} vis=${diag.visState || ''} links=${diag.linkCount || 0} videos=${diag.videoCount || 0} imgs=${diag.imgCount || 0} scripts=${diag.scriptCount || 0} found=${diag.foundItems || 0}`)
    if (!parsed.items) return []
    return (parsed.items as Array<Record<string, unknown>>).map((n) => ({
      id: `douyin-${String(n.id || '')}`,
      platform: PLATFORM,
      title: (n.title as string) || '',
      cover: (n.cover as string) || undefined,
      author: (n.author as string) || '',
      url: `https://www.douyin.com/video/${String(n.id || '')}`,
      stats: {},
      mediaType: 'video' as const
    })).filter((item: FeedItem) => item.title || item.cover || item.id) as FeedItem[]
  } catch {
    return []
  }
}

async function getFeedViaWorker(page = 1): Promise<FeedItem[]> {
  const INITIAL_WAIT = 6000
  const SCROLL_COUNT = 5
  const SCROLL_INTERVAL = 1000
  const TIMEOUT = 40000
  const EARLY_RETURN = 6

  const win = getDouyinWorker()
  douyinWorkerBusy = true
  console.info('[douyin]', `getFeedViaWorker page=${page} starting`)

  const capturedBodies: Array<{ url: string; body: string }> = []
  let settled = false
  let dbg: any = null
  let timer: NodeJS.Timeout | null = null

  const finish = (items: FeedItem[]): Promise<FeedItem[]> => {
    if (settled) return Promise.resolve(items)
    settled = true
    if (timer) clearTimeout(timer)
    douyinWorkerBusy = false
    console.info('[douyin]', `finish with ${items.length} items`)
    try {
      if (dbg && dbg.isAttached()) {
        dbg.removeListener('message', onMessage)
        dbg.detach()
      }
    } catch {}
    return Promise.resolve(items)
  }

  // Attach CDP debugger
  try {
    dbg = win.webContents.debugger
    if (dbg.isAttached()) dbg.detach()
    dbg.attach('1.3')
    console.info('[douyin]', 'CDP debugger attached')
  } catch {
    return finish([])
  }

  // Inject persistent page scripts (click guard + fetch hooks) — await to ensure registered before navigation
  try {
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        (function(){
          if (window.__douyinFeedScripts) return;
          window.__douyinFeedScripts = true;
          window.__douyinFeedBodies = [];
          document.addEventListener('click',function(e){
            var a=e.target.closest?e.target.closest('a'):null;
            if(a&&/^(bytedance|snssdk1128|douyin|aweme):\\/\\//i.test(a.getAttribute('href')||'')){
              e.preventDefault();e.stopPropagation();
            }
          },true);
          var _f=window.fetch.bind(window);
          window.fetch=function(u,o){var ur=typeof u==='string'?u:(u.url||'');if(ur.indexOf('douyin.com')!==-1&&(ur.indexOf('/aweme/')!==-1||ur.indexOf('/feed/')!==-1||ur.indexOf('/recommend/')!==-1)){return _f(u,o).then(function(r){if(r.ok){r.clone().text().then(function(t){try{window.__douyinFeedBodies.push({url:ur,body:t,ts:Date.now()})}catch(e){}}).catch(function(){})}return r})}return _f(u,o)};
          var _ox=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){this.__dyU=typeof u==='string'?u:(u.url||'');return _ox.apply(this,arguments)};
          var _xs=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){var u=this.__dyU||'';if(u.indexOf('douyin.com')!==-1&&(u.indexOf('/aweme/')!==-1||u.indexOf('/feed/')!==-1||u.indexOf('/recommend/')!==-1)){this.addEventListener('load',function(){try{window.__douyinFeedBodies.push({url:u,body:this.responseText,ts:Date.now()})}catch(e){}})}return _xs.apply(this,arguments)};
        })();
      `,
      runImmediately: true
    })
  } catch {}

  // Enable Fetch domain to capture response bodies for feed requests
  try {
    await dbg.sendCommand('Fetch.enable', {
      patterns: [{ urlPattern: '*douyin.com/aweme/*feed*', requestStage: 'Response' }]
    })
    console.info('[douyin]', 'Fetch domain enabled')
  } catch {}

  // Enable Network domain for URL logging (non-feed requests)
  const onMessage = (_event: any, method: string, params: any) => {
    if (method === 'Network.responseReceived') {
      const url = params.response?.url || ''
      if (url.includes('douyin.com') && !url.match(/\.(png|jpg|jpeg|gif|svg|ico|css|woff2?|ttf|eot|js)\b/i)) {
        console.info('[douyin]', `CDP URL: ${url.substring(0, 120)}`)
      }
    } else if (method === 'Fetch.requestPaused') {
      const url = params.request?.url || ''
      const requestId = params.requestId
      const doContinue = () => {
        dbg.sendCommand('Fetch.continueRequest', { requestId }).catch(() => {})
      }
      if (url.includes('/feed/') || url.includes('/recommend/')) {
        dbg.sendCommand('Fetch.getResponseBody', { requestId })
          .then((result: any) => {
            if (result?.body) {
              const body = result.base64Encoded ? Buffer.from(result.body, 'base64').toString('utf-8') : result.body
              console.info('[douyin]', `Fetch captured: ${url.substring(0, 80)} (${body.length}B)`)
              capturedBodies.push({ url, body })
            }
            doContinue()
          })
          .catch(() => { doContinue() })
      } else {
        doContinue()
      }
    }
  }
  try {
    dbg.on('message', onMessage)
    await dbg.sendCommand('Network.enable')
  } catch {
    return finish([])
  }

  // Parse hook-captured bodies from window.__douyinFeedBodies
  async function readHookBodies(): Promise<FeedItem[]> {
    try {
      const raw = await win.webContents.executeJavaScript(`
        (function(){try{if(!window.__douyinFeedBodies||window.__douyinFeedBodies.length===0)return null;return JSON.stringify(window.__douyinFeedBodies)}catch(e){return null}})()
      `)
      if (!raw) return []
      const bodies = JSON.parse(raw) as Array<{ url: string; body: string }>
      console.info('[douyin]', `hooks: ${bodies.length} captured responses`)
      const allAwemes: any[] = []
      const seen = new Set<string>()
      for (const entry of bodies) {
        try {
          const json = JSON.parse(entry.body)
          const awemes = collectAwemeObjects(json)
          for (const aw of awemes) {
            const aid = String(aw.aweme_id || aw.awemeId || aw.item_id || aw.group_id || '')
            if (!aid || seen.has(aid)) continue
            seen.add(aid)
            allAwemes.push(aw)
          }
        } catch {}
      }
      console.info('[douyin]', `hooks parsed: ${allAwemes.length} aweme`)
      win.webContents.executeJavaScript('window.__douyinFeedBodies=[]').catch(() => {})
      return allAwemes.map(aw => normalizeDouyinFeedItem(aw)).filter(Boolean) as FeedItem[]
    } catch { return [] }
  }

  // Parse Fetch-captured bodies
  function parseFetchBodies(): FeedItem[] {
    if (capturedBodies.length === 0) return []
    const allAwemes: any[] = []
    const seen = new Set<string>()
    for (const entry of capturedBodies) {
      try {
        const json = JSON.parse(entry.body)
        const awemes = collectAwemeObjects(json)
        for (const aw of awemes) {
          const aid = String(aw.aweme_id || aw.awemeId || aw.item_id || aw.group_id || '')
          if (!aid || seen.has(aid)) continue
          seen.add(aid)
          allAwemes.push(aw)
        }
      } catch {}
    }
    console.info('[douyin]', `Fetch parsed: ${allAwemes.length} aweme from ${capturedBodies.length} bodies`)
    return allAwemes.map(aw => normalizeDouyinFeedItem(aw)).filter(Boolean) as FeedItem[]
  }

  // Scroll helper
  async function scrollPage(count: number): Promise<void> {
    for (let s = 0; s < count && !settled; s++) {
      try {
        await win.webContents.executeJavaScript('window.scrollBy(0,900);true')
        win.webContents.sendInputEvent({ type: 'mouseWheel', x: 640, y: 450, deltaX: 0, deltaY: 900, canScroll: true })
      } catch {}
      await new Promise(r => setTimeout(r, SCROLL_INTERVAL))
    }
  }

  // Overall timeout guard
  timer = setTimeout(() => { if (!settled) finish([]) }, TIMEOUT)

  // Load the page — sequential: await loadURL, then start processing
  try {
    await win.loadURL('https://www.douyin.com/')
  } catch {
    return finish([])
  }

  // Wait for page to settle and hooks to capture
  await new Promise(r => setTimeout(r, INITIAL_WAIT))
  if (settled) return finish([])

  // Initial read
  const resultItems: FeedItem[] = []
  resultItems.push(...await readHookBodies())
  resultItems.push(...parseFetchBodies())
  console.info('[douyin]', `initial total: ${resultItems.length} items`)
  if (resultItems.length >= EARLY_RETURN) return finish(resultItems)

  // Scroll and collect more
  const scrollTimes = page > 1 ? SCROLL_COUNT : Math.max(SCROLL_COUNT, 3)
  await scrollPage(scrollTimes)
  if (settled) return finish([])

  const moreHooks: FeedItem[] = await readHookBodies()
  const moreFetch: FeedItem[] = parseFetchBodies()
  resultItems.push(...moreHooks, ...moreFetch)
  console.info('[douyin]', `after scroll: ${resultItems.length} items (hooks+${moreHooks.length}, fetch+${moreFetch.length})`)
  if (resultItems.length >= EARLY_RETURN) return finish(resultItems)

  // DOM fallback
  const domItems = await extractFeedFromDom(win)
  console.info('[douyin]', `DOM fallback: ${domItems.length} items`)
  return finish([...resultItems, ...domItems])
}

export async function getFeed(page = 1): Promise<FeedItem[]> {
  if (page <= 1) douyinSeenFeedIds.clear()

  try {
    const items = await getFeedViaWorker(page)
    console.info('[douyin]', `getFeed worker returned ${items.length} items`)
    if (items.length > 0) return items
  } catch {}

  try {
    console.info('[douyin]', 'worker returned 0 items, trying SSR fallback')
    const { data } = await fetchWithSession('https://www.douyin.com/')
    const scriptMatch = data.match(/<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) return []
    const decoded = decodeURIComponent(scriptMatch[1])
    const videoRegex = /"aweme_id":"(\d+)","desc":"([^"]+)"(?:[^}]*?"author":{"nickname":"([^"]+)")?/g
    const items: FeedItem[] = []
    let match: RegExpExecArray | null
    const seen = new Set<string>()
    while ((match = videoRegex.exec(decoded)) !== null) {
      const id = match[1]
      if (seen.has(id)) continue
      seen.add(id)
      items.push({
        id: `douyin-${id}`,
        platform: PLATFORM,
        title: match[2],
        author: match[3] || '',
        url: `https://www.douyin.com/video/${id}`,
        stats: {}
      })
      if (items.length >= 30) break
    }
    return items
  } catch {
    return []
  }
}

export async function navigateToMyProfile(win: BrowserWindow): Promise<boolean> {
  try {
    const result: { x: number; y: number } | null = await win.webContents.executeJavaScript(`
      (function() {
        try {
          var items = document.querySelectorAll('a, span, div, li, button');
          for (var i = 0; i < items.length; i++) {
            var el = items[i];
            var txt = (el.textContent || '').trim();
            if (txt !== '我的' || el.offsetParent === null) continue;
            var rect = el.getBoundingClientRect();
            if (rect.left >= 200) continue;
            var anchor = el.tagName === 'A' ? el : (el.closest ? el.closest('a') : null);
            if (anchor) {
              var href = anchor.getAttribute('href') || '';
              if (/^(bytedance|snssdk1128|douyin|aweme):\\/\\//i.test(href)) continue;
            }
            return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
          }
          return null;
        } catch(e) { return null; }
      })()
    `)
    if (result?.x != null && result?.y != null) {
      win.webContents.focus()
      win.focus()
      win.webContents.sendInputEvent({ type: 'mouseDown', x: result.x, y: result.y, button: 'left' })
      win.webContents.sendInputEvent({ type: 'mouseUp', x: result.x, y: result.y, button: 'left' })
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  destroyDouyinWorker()
  try {
    await fetchWithSession('https://www.douyin.com/logout/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  } catch {
    //
  }
}
