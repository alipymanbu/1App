import { BrowserWindow } from 'electron'
import type { PlatformId, UserProfile, FeedItem, LoginState, FollowUser, PageResult, VideoPlaybackInfo, ChangeQualityResult, VideoInteractionState, VideoInteractionResult, FavoriteFolder, FavoriteFolderSelection, CreateFavoriteFolderResult, XhsNoteDetail, BiliVideoDetail, BiliVideoCommentsResult, BiliCommentRepliesResult } from '../../shared/types'
import * as bilibiliAdapter from './bilibili'
import * as xhsAdapter from './xhs'
import * as douyinAdapter from './douyin'
import { saveUserProfile, getUserProfile, deleteUserProfile } from '../database'
import { getSession, clearSession } from '../sessions'
import { PLATFORMS } from '../../shared/constants'

interface PlatformModule {
  checkLogin: () => Promise<LoginState>
  getProfile: () => Promise<UserProfile | null>
  getFeed: (page?: number) => Promise<FeedItem[]>
  logout: () => Promise<void>
  getFollowings?: () => Promise<FollowUser[]>
  getFollowingFeed?: () => Promise<FeedItem[]>
  getFollowingsPage?: (page: number, pageSize: number) => Promise<PageResult<FollowUser>>
  getFollowingFeedPage?: (offset: string | undefined, pageSize: number) => Promise<PageResult<FeedItem>>
  getUserVideosPage?: (uid: string, page: number, pageSize: number) => Promise<PageResult<FeedItem>>
  getFavoriteFolders?: () => Promise<FavoriteFolder[]>
  getFavoriteVideosPage?: (mediaId: string, page: number, pageSize: number) => Promise<PageResult<FeedItem>>
  getVideoPlayback?: (bvid: string, qn?: number, existingToken?: string) => Promise<VideoPlaybackInfo>
  changeVideoQuality?: (bvid: string, cid: string, qn: number, token?: string) => Promise<ChangeQualityResult>
  getVideoInteraction?: (bvid: string, aid?: string) => Promise<VideoInteractionState>
  toggleVideoLike?: (bvid: string, like: boolean) => Promise<VideoInteractionResult>
  addVideoCoin?: (bvid: string, aid?: string, multiply?: number, selectLike?: boolean) => Promise<VideoInteractionResult>
  toggleVideoFavorite?: (aid: string, favorite: boolean) => Promise<VideoInteractionResult>
  getVideoFavoriteFolders?: (aid: string) => Promise<FavoriteFolderSelection[]>
  updateVideoFavoriteFolders?: (aid: string, addMediaIds: string[], delMediaIds: string[]) => Promise<VideoInteractionResult>
  createFavoriteFolder?: (title: string) => Promise<CreateFavoriteFolderResult>
  getBiliVideoDetail?: (bvid: string, aid?: string) => Promise<BiliVideoDetail | null>
  getBiliVideoComments?: (aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number) => Promise<BiliVideoCommentsResult>
  getBiliCommentReplies?: (aid: string, rootRpid: string, page?: number, pageSize?: number) => Promise<BiliCommentRepliesResult>
}

const adapters: Record<PlatformId, PlatformModule> = {
  bilibili: bilibiliAdapter,
  xhs: xhsAdapter,
  douyin: douyinAdapter
}

function cleanupXhsCache(): void {
  const cached = getUserProfile('xhs')
  if (cached && (!cached.uid || cached.nickname === '小红书' || 
      /^[0-9a-f]{24}$/i.test(cached.uid) ||
      (cached.avatar && (cached.avatar.includes('favicon') || cached.avatar.includes('logo') || cached.avatar.includes('sprite') || cached.avatar.includes('.svg') || cached.avatar.includes('default-avatar') || cached.avatar.includes('icon'))))) {
    deleteUserProfile('xhs')
  }
}

async function resolveLoginState(platform: PlatformId): Promise<LoginState> {
  if (platform === 'xhs') {
    cleanupXhsCache()
  }

  const state = await adapters[platform].checkLogin()

  if (!state.loggedIn) {
    return { loggedIn: false, profile: null }
  }

  if (state.profile) {
    const sp = platform === 'xhs' ? xhsAdapter.sanitizeXhsProfile(state.profile) : state.profile
    if (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(sp)) {
      saveUserProfile(sp)
    }
    return { loggedIn: true, profile: sp }
  }

  const profile = await adapters[platform].getProfile()
  if (profile) {
    const sp = platform === 'xhs' ? xhsAdapter.sanitizeXhsProfile(profile) : profile
    if (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(sp)) {
      saveUserProfile(sp)
    }
    return { loggedIn: true, profile: sp }
  }

  if (platform === 'xhs') {
    const cached = getUserProfile('xhs')
    if (cached) {
      const sp = xhsAdapter.sanitizeXhsProfile(cached)
      if (xhsAdapter.isValidXhsProfile(sp)) {
        return { loggedIn: true, profile: sp }
      }
    }
  }

  if (platform === 'douyin') {
    const cached = getUserProfile('douyin')
    if (cached) return { loggedIn: true, profile: cached }
    return { loggedIn: false, profile: null }
  }

  return { loggedIn: true, profile: null }
}

export async function checkLogin(platform: PlatformId): Promise<LoginState> {
  return resolveLoginState(platform)
}

export async function getProfile(platform: PlatformId): Promise<UserProfile | null> {
  const profile = await adapters[platform].getProfile()
  if (profile) {
    const sp = platform === 'xhs' ? xhsAdapter.sanitizeXhsProfile(profile) : profile
    if (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(sp)) {
      saveUserProfile(sp)
      if (platform === 'xhs' && !sp.avatar) {
        const filled = await xhsAdapter.fillXhsAvatar(sp)
        if (filled.avatar) {
          saveUserProfile(filled)
          return filled
        }
      }
      return sp
    }
  }
  return null
}

export async function getFeed(platform: PlatformId, page?: number): Promise<FeedItem[]> {
  return adapters[platform].getFeed(page)
}

export async function getNoteDetail(platform: PlatformId, noteId: string, url?: string): Promise<XhsNoteDetail | null> {
  if (platform !== 'xhs') return null
  return xhsAdapter.getNoteDetail(noteId, url)
}

export async function getFollowings(platform: PlatformId): Promise<FollowUser[]> {
  return adapters[platform].getFollowings?.() ?? []
}

export async function getFollowingFeed(platform: PlatformId): Promise<FeedItem[]> {
  return adapters[platform].getFollowingFeed?.() ?? []
}

export async function getFollowingsPage(platform: PlatformId, page: number, pageSize: number): Promise<PageResult<FollowUser>> {
  return adapters[platform].getFollowingsPage?.(page, pageSize) ?? { items: [], page, pageSize, total: 0, hasMore: false }
}

export async function getFollowingFeedPage(platform: PlatformId, offset?: string, pageSize?: number): Promise<PageResult<FeedItem>> {
  return adapters[platform].getFollowingFeedPage?.(offset, pageSize ?? 10) ?? { items: [], page: 1, pageSize: pageSize ?? 10, hasMore: false }
}

export async function getUserVideosPage(platform: PlatformId, uid: string, page: number, pageSize: number): Promise<PageResult<FeedItem>> {
  return adapters[platform].getUserVideosPage?.(uid, page, pageSize) ?? { items: [], page, pageSize, total: 0, hasMore: false }
}

export async function getFavoriteFolders(platform: PlatformId): Promise<FavoriteFolder[]> {
  return adapters[platform].getFavoriteFolders?.() ?? []
}

export async function getFavoriteVideosPage(platform: PlatformId, mediaId: string, page: number, pageSize: number): Promise<PageResult<FeedItem>> {
  return adapters[platform].getFavoriteVideosPage?.(mediaId, page, pageSize) ?? { items: [], page, pageSize, total: 0, hasMore: false }
}

export async function logout(platform: PlatformId): Promise<void> {
  await adapters[platform].logout()
  deleteUserProfile(platform)
  await clearSession(platform)
}

export async function getVideoPlayback(platform: PlatformId, bvid: string, qn?: number): Promise<VideoPlaybackInfo> {
  const fn = adapters[platform].getVideoPlayback
  if (!fn) {
    return { bvid, cid: '', title: '', playable: false, error: '该平台不支持内置播放', qualities: [], defaultQuality: 0, manifestUrl: '', externalUrl: '' }
  }
  return fn(bvid, qn)
}

export async function changeVideoQuality(platform: PlatformId, bvid: string, cid: string, qn: number, token?: string): Promise<ChangeQualityResult> {
  const fn = adapters[platform].changeVideoQuality
  if (!fn) {
    return { manifestUrl: '', defaultQuality: qn, error: '该平台不支持切换清晰度' }
  }
  return fn(bvid, cid, qn, token)
}

export async function getVideoInteraction(platform: PlatformId, bvid: string, aid?: string): Promise<VideoInteractionState> {
  const fn = adapters[platform].getVideoInteraction
  if (!fn) return { liked: false, coined: false, favorited: false, stats: {} }
  return fn(bvid, aid)
}

export async function toggleVideoLike(platform: PlatformId, bvid: string, like: boolean): Promise<VideoInteractionResult> {
  const fn = adapters[platform].toggleVideoLike
  if (!fn) return { success: false, error: '该平台不支持点赞' }
  return fn(bvid, like)
}

export async function addVideoCoin(platform: PlatformId, bvid: string, aid?: string, multiply?: number, selectLike?: boolean): Promise<VideoInteractionResult> {
  const fn = adapters[platform].addVideoCoin
  if (!fn) return { success: false, error: '该平台不支持投币' }
  return fn(bvid, aid, multiply, selectLike)
}

export async function toggleVideoFavorite(platform: PlatformId, aid: string, favorite: boolean): Promise<VideoInteractionResult> {
  const fn = adapters[platform].toggleVideoFavorite
  if (!fn) return { success: false, error: '该平台不支持收藏' }
  return fn(aid, favorite)
}

export async function getVideoFavoriteFolders(platform: PlatformId, aid: string): Promise<FavoriteFolderSelection[]> {
  return adapters[platform].getVideoFavoriteFolders?.(aid) ?? []
}

export async function updateVideoFavoriteFolders(platform: PlatformId, aid: string, addMediaIds: string[], delMediaIds: string[]): Promise<VideoInteractionResult> {
  const fn = adapters[platform].updateVideoFavoriteFolders
  if (!fn) return { success: false, error: '该平台不支持收藏管理' }
  return fn(aid, addMediaIds, delMediaIds)
}

export async function createFavoriteFolder(platform: PlatformId, title: string): Promise<CreateFavoriteFolderResult> {
  const fn = adapters[platform].createFavoriteFolder
  if (!fn) return { success: false, error: '该平台不支持创建收藏夹' }
  return fn(title)
}

export async function getBiliVideoDetail(platform: PlatformId, bvid: string, aid?: string): Promise<BiliVideoDetail | null> {
  const fn = adapters[platform].getBiliVideoDetail
  if (!fn) return null
  return fn(bvid, aid)
}

export async function getBiliVideoComments(platform: PlatformId, aid: string, sort?: 'hot' | 'time', cursor?: string, pageSize?: number): Promise<BiliVideoCommentsResult> {
  const fn = adapters[platform].getBiliVideoComments
  if (!fn) return { items: [], hasMore: false, error: '该平台不支持评论' }
  return fn(aid, sort, cursor, pageSize)
}

export async function getBiliCommentReplies(platform: PlatformId, aid: string, rootRpid: string, page?: number, pageSize?: number): Promise<BiliCommentRepliesResult> {
  const fn = adapters[platform].getBiliCommentReplies
  if (!fn) return { items: [], page: page || 1, hasMore: false, error: '该平台不支持评论回复' }
  return fn(aid, rootRpid, page, pageSize)
}

export async function openLoginWindow(platform: PlatformId): Promise<LoginState> {
  const info = PLATFORMS.find((p) => p.id === platform)
  if (!info) return { loggedIn: false, profile: null }

  const preCheck = await resolveLoginState(platform)
  if (preCheck.loggedIn && preCheck.profile) {
    return preCheck
  }

  return new Promise<LoginState>((resolve) => {
    let settled = false
    let checking = false
    let loginAttempts = 0

    const finish = (state: LoginState): void => {
      if (settled) return
      settled = true
      clearInterval(checkLoginInterval)
      if (!loginWindow.isDestroyed()) {
        loginWindow.close()
      }
      resolve(state)
    }

    const extractFromLoginWindow = async (): Promise<UserProfile | null> => {
      try {
        if (platform === 'xhs') {
          const result: Record<string, unknown> | null = await loginWindow.webContents.executeJavaScript(`
            (function() {
              try {
                var data = window.__INITIAL_STATE__;
                if (!data) return null;
                if (typeof data === 'string') { try { data = JSON.parse(data); } catch(e) { return null; } }
                var info = (data.user && data.user.userInfo) || (data.global && data.global.userInfo) || data.userInfo || (data.main && data.main.userInfo) || (data.state && data.state.userInfo);
                if (info && info.nickname) {
                  return {
                    nickname: info.nickname,
                    avatar: info.avatar || info.avatar_url || '',
                    uid: String(info.userId || info.redId || info.id || ''),
                    bio: info.desc || info.signature || info.bio || '',
                    _following: info.followingCount != null ? info.followingCount : (info.follow_count || undefined),
                    _follower: info.followerCount != null ? info.followerCount : (info.fans_count || undefined),
                    _likes: info.likedCount != null ? info.likedCount : (info.like_count || undefined)
                  };
                }
              } catch(e) {}
              return null;
            })()
          `)
          if (result?.nickname && result?.uid && result.nickname !== '小红书' && result.nickname !== '小红书登录') {
            const profile: UserProfile = {
              platform: 'xhs',
              nickname: result.nickname as string,
              avatar: (result.avatar as string) || '',
              uid: (result.uid as string) || '',
              bio: (result.bio as string) || ''
            }
            const stats: UserProfile['stats'] = {}
            if (result._following != null) stats.following = result._following as number
            if (result._follower != null) stats.follower = result._follower as number
            if (result._likes != null) stats.likes = result._likes as number
            if (Object.keys(stats).length) profile.stats = stats
            return profile
          }

          const domInfo: Record<string, unknown> | null = await loginWindow.webContents.executeJavaScript(`
            (function() {
              try {
                var bodyText = document.body ? document.body.innerText || '' : '';
                var title = document.title || '';
                var uidMatch = bodyText.match(/小红书号[：:]\\s*([A-Za-z0-9_-]+)/);
                if (!uidMatch || !uidMatch[1]) return null;
                var uid = uidMatch[1];
                if (uid.length > 20) return null;
                var nickname = '';
                var t = title.replace(/的个人主页/, '').replace(/ - .*$/, '').trim();
                if (t && t.length > 0 && t.length < 50) nickname = t;
                var following = null, follower = null, likes = null;
                var m = bodyText.match(/(\\d[\\d,]*)\\s*关注/);
                if (m) following = parseInt(m[1].replace(/,/g, ''));
                m = bodyText.match(/(\\d[\\d,]*)\\s*粉丝/);
                if (m) follower = parseInt(m[1].replace(/,/g, ''));
                m = bodyText.match(/(\\d[\\d,]*)\\s*获赞与收藏/);
                if (m) likes = parseInt(m[1].replace(/,/g, ''));
                var avatar = '';
                var imgs = document.querySelectorAll('img');
                var badPatterns = ['qrcode', 'favicon', 'logo', 'sprite', '.svg', 'default-avatar'];
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
                  if (w >= 64 && h >= 64) {
                    var el = img;
                    var nearUserInfo = false;
                    for (var j = 0; j < 5 && el; j++) {
                      var t = el.innerText || '';
                      if (t.includes('小红书号') || (t.includes('关注') && t.includes('粉丝'))) {
                        nearUserInfo = true;
                        break;
                      }
                      el = el.parentElement;
                    }
                    if (nearUserInfo) { avatar = src; break; }
                  }
                }
                if (nickname) {
                  return { nickname: nickname, uid: uid, avatar: avatar, bio: '', _following: following, _follower: follower, _likes: likes };
                }
              } catch(e) {}
              return null;
            })()
          `)
          if (domInfo?.nickname && domInfo?.uid && !/^[0-9a-f]{24}$/i.test(domInfo.uid as string) && domInfo.nickname !== '小红书' && domInfo.nickname !== '小红书登录') {
            const profile: UserProfile = {
              platform: 'xhs',
              nickname: domInfo.nickname as string,
              avatar: (domInfo.avatar as string) || '',
              uid: (domInfo.uid as string) || '',
              bio: (domInfo.bio as string) || ''
            }
            const stats: UserProfile['stats'] = {}
            if (domInfo._following != null) stats.following = domInfo._following as number
            if (domInfo._follower != null) stats.follower = domInfo._follower as number
            if (domInfo._likes != null) stats.likes = domInfo._likes as number
            if (Object.keys(stats).length) profile.stats = stats
            return profile
          }

          const html: string = await loginWindow.webContents.executeJavaScript('document.documentElement.outerHTML')
          return xhsAdapter.extractCurrentUserFromHTML(html)
        }

        if (platform === 'douyin') {
          const profile = await douyinAdapter.extractProfileFromWindow(loginWindow)
          if (profile) return profile
          try {
            const url = loginWindow.webContents.getURL()
            if (url.includes('/login') || !url.includes('douyin.com')) {
              await loginWindow.loadURL('https://www.douyin.com/')
              return douyinAdapter.extractProfileFromWindow(loginWindow)
            }
          } catch {}
          return null
        }
      } catch {}
      return null
    }

    const doCheck = async (): Promise<void> => {
      if (checking || settled) return
      checking = true
      try {
        if (platform === 'douyin') {
          const windowProfile = await extractFromLoginWindow()
          if (windowProfile) {
            saveUserProfile(windowProfile)
            finish({ loggedIn: true, profile: windowProfile })
            return
          }
        }

        const state = await adapters[platform].checkLogin()
        if (state.loggedIn) {
          let profile = state.profile
          if (!profile) {
            if (platform === 'xhs') {
              profile = await extractFromLoginWindow()
              if (!profile) {
                profile = await adapters[platform].getProfile()
              }
            } else {
              profile = await adapters[platform].getProfile()
              if (!profile) {
                profile = await extractFromLoginWindow()
              }
            }
            if (profile) {
              const sp = platform === 'xhs' ? xhsAdapter.sanitizeXhsProfile(profile) : profile
              if (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(sp)) {
                saveUserProfile(sp)
              }
              profile = sp
            }
          } else {
            const sp = platform === 'xhs' ? xhsAdapter.sanitizeXhsProfile(profile) : profile
            if (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(sp)) {
              saveUserProfile(sp)
            }
            profile = sp
          }
      if (profile && (platform !== 'xhs' || xhsAdapter.isValidXhsProfile(profile))) {
        finish({ loggedIn: true, profile })
      } else if (platform !== 'xhs') {
        if (platform === 'douyin') {
          if (++loginAttempts >= 25) {
            finish({ loggedIn: false, profile: null })
          } else if (loginAttempts >= 2 && loginAttempts % 2 === 0) {
            douyinAdapter.navigateToMyProfile(loginWindow).catch(() => {})
          }
        } else if (++loginAttempts >= 15) {
          finish({ loggedIn: true, profile: null })
        }
      }
        } else if (platform === 'douyin') {
          if (++loginAttempts >= 25) {
            finish({ loggedIn: false, profile: null })
          }
        }
      } finally {
        checking = false
      }
    }

    const loginWindow = new BrowserWindow({
      width: 520,
      height: 680,
      resizable: false,
      frame: true,
      autoHideMenuBar: true,
      webPreferences: {
        session: getSession(platform),
        nodeIntegration: false,
        contextIsolation: true
      },
      title: `${info.name} - 扫码登录`
    })

    loginWindow.webContents.on('will-navigate', (event, url) => {
      if (/^(bytedance|snssdk1128|douyin|aweme):\/\//.test(url)) {
        event.preventDefault()
      }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      loginWindow.webContents.executeJavaScript(`
        (function() {
          try {
            document.addEventListener('click', function(e) {
              var a = e.target.closest('a');
              if (a && /^(bytedance|snssdk1128|douyin|aweme):\\/\\//i.test(a.getAttribute('href') || '')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
          } catch(e) {}
        })()
      `).catch(() => {})
    })

    loginWindow.webContents.on('did-finish-load', () => { doCheck() })
    loginWindow.webContents.on('did-navigate', () => { doCheck() })

    const checkLoginInterval = setInterval(doCheck, 2000)

    doCheck()

    if (platform === 'douyin') {
      let loginClickAttempted = false
      loginWindow.webContents.on('did-finish-load', () => {
        if (settled || loginClickAttempted) return
        loginClickAttempted = true
        setTimeout(() => {
          if (settled) return
          loginWindow.webContents.executeJavaScript(`
            (function() {
              try {
                var all = document.querySelectorAll('button, span, a, div[role="button"]');
                for (var i = 0; i < all.length; i++) {
                  var el = all[i];
                  var txt = (el.textContent || '').trim();
                  if (txt === '登录' && el.offsetParent !== null) {
                    el.click();
                    return 'clicked';
                  }
                }
                return 'not_found';
              } catch(e) { return 'error'; }
            })()
          `).catch(() => {})
        }, 1200)
      })
    }

    loginWindow.loadURL(info.loginUrl)

    loginWindow.on('closed', async () => {
      if (!settled) {
        clearInterval(checkLoginInterval)
        const finalState = await resolveLoginState(platform)
        if (finalState.loggedIn && finalState.profile) {
          finish(finalState)
        } else {
          finish({ loggedIn: false, profile: null })
        }
      }
    })
  })
}
