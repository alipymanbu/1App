import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { UserProfile, PlatformId, UserStats } from '../shared/types'
import { getStoreFilePath } from './dataRoot'

interface StoreData {
  profiles: Record<string, {
    nickname: string
    avatar: string
    uid: string
    bio?: string
    stats?: UserStats
  }>
}

let storePath: string
let cache: StoreData

export function initDatabase(): void {
  storePath = getStoreFilePath()

  if (existsSync(storePath)) {
    try {
      const raw = readFileSync(storePath, 'utf-8')
      cache = JSON.parse(raw)
    } catch {
      cache = { profiles: {} }
    }
  } else {
    cache = { profiles: {} }
  }
}

function persist(): void {
  try {
    writeFileSync(storePath, JSON.stringify(cache, null, 2), 'utf-8')
  } catch {
    // ignore write errors
  }
}

export function saveUserProfile(profile: UserProfile): void {
  cache.profiles[profile.platform] = {
    nickname: profile.nickname,
    avatar: profile.avatar,
    uid: profile.uid,
    bio: profile.bio,
    stats: profile.stats
  }
  persist()
}

export function getUserProfile(platform: PlatformId): UserProfile | null {
  const data = cache.profiles[platform]
  if (!data) return null
  return {
    platform,
    ...data
  }
}

export function deleteUserProfile(platform: PlatformId): void {
  delete cache.profiles[platform]
  persist()
}

export function closeDatabase(): void {
  persist()
}
