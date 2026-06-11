import { session } from 'electron'
import type { PlatformId } from '../shared/types'

const SESSION_NAMES: Record<PlatformId, string> = {
  xhs: 'persist:xhs',
  bilibili: 'persist:bilibili',
  douyin: 'persist:douyin'
}

const LOGIN_CHECK_DOMAINS: Record<PlatformId, string[]> = {
  xhs: ['xiaohongshu.com', 'xhscdn.com'],
  bilibili: ['bilibili.com', 'hdslb.com'],
  douyin: ['douyin.com', 'amemv.com']
}

export function getSession(platform: PlatformId): Electron.Session {
  return session.fromPartition(SESSION_NAMES[platform])
}

export async function clearSession(platform: PlatformId): Promise<void> {
  const s = getSession(platform)
  await s.clearStorageData()
}

export function getLoginCheckDomains(platform: PlatformId): string[] {
  return LOGIN_CHECK_DOMAINS[platform]
}
