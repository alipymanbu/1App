import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    existsSync: vi.fn((p: string) => p in store),
    readFileSync: vi.fn((p: string) => {
      if (!(p in store)) throw new Error('ENOENT')
      return store[p]
    }),
    writeFileSync: vi.fn((p: string, data: string) => { store[p] = data }),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    __store: store,
    __setStore: (data: Record<string, string>) => { Object.assign(store, data) },
    __resetStore: () => { Object.keys(store).forEach(k => delete store[k]) }
  }
})

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'D:\\mock\\userData'), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

vi.mock('fs', () => mockFs)

vi.mock('../../../src/main/dataRoot', () => ({
  getStoreFilePath: vi.fn(() => '/mock/store.json')
}))

import { initDatabase, saveUserProfile, getUserProfile, deleteUserProfile, closeDatabase } from '../../../src/main/database'

describe('database', () => {
  beforeEach(() => {
    mockFs.__resetStore()
    vi.clearAllMocks()
    mockFs.existsSync.mockReturnValue(false)
  })

  it('should init with empty cache when no file exists', () => {
    initDatabase()
    const profile = getUserProfile('bilibili')
    expect(profile).toBeNull()
  })

  it('should init with existing valid store', () => {
    const existingData = JSON.stringify({
      profiles: {
        bilibili: { nickname: 'BiliUser', avatar: 'https://avatar.jpg', uid: '123' }
      }
    })
    mockFs.__setStore({ '/mock/store.json': existingData })
    mockFs.existsSync.mockImplementation((p: string) => p === '/mock/store.json')
    mockFs.readFileSync.mockImplementation((p: string) => {
      if (p === '/mock/store.json') return existingData
      throw new Error('ENOENT')
    })

    initDatabase()
    const profile = getUserProfile('bilibili')
    expect(profile).not.toBeNull()
    expect(profile!.nickname).toBe('BiliUser')
  })

  it('should handle corrupted store gracefully', () => {
    mockFs.__setStore({ '/mock/store.json': 'corrupted{json' })
    mockFs.existsSync.mockImplementation((p: string) => p === '/mock/store.json')
    mockFs.readFileSync.mockImplementation((p: string) => {
      if (p === '/mock/store.json') return 'corrupted{json'
      throw new Error('ENOENT')
    })

    initDatabase()
    const profile = getUserProfile('bilibili')
    expect(profile).toBeNull()
  })

  it('should save and retrieve user profile', () => {
    initDatabase()

    saveUserProfile({
      platform: 'bilibili',
      nickname: 'NewUser',
      avatar: 'https://avatar.jpg',
      uid: '456',
      bio: 'Hello'
    })

    const profile = getUserProfile('bilibili')
    expect(profile).not.toBeNull()
    expect(profile!.nickname).toBe('NewUser')
    expect(profile!.uid).toBe('456')
    expect(profile!.bio).toBe('Hello')
    expect(mockFs.writeFileSync).toHaveBeenCalled()
  })

  it('should delete user profile', () => {
    initDatabase()

    saveUserProfile({
      platform: 'bilibili',
      nickname: 'ToDelete',
      avatar: '',
      uid: '789'
    })

    deleteUserProfile('bilibili')
    const profile = getUserProfile('bilibili')
    expect(profile).toBeNull()
  })

  it('should persist on closeDatabase', () => {
    initDatabase()

    saveUserProfile({
      platform: 'xhs',
      nickname: 'XHS',
      avatar: '',
      uid: 'xhs_1'
    })

    closeDatabase()
    expect(mockFs.writeFileSync).toHaveBeenCalled()
  })

  it('should return null for non-existent platform', () => {
    initDatabase()

    const profile = getUserProfile('douyin')
    expect(profile).toBeNull()
  })

  it('should handle profile with stats', () => {
    initDatabase()

    saveUserProfile({
      platform: 'bilibili',
      nickname: 'StatsUser',
      avatar: '',
      uid: '999',
      stats: { following: 10, follower: 20, likes: 100, views: 500 }
    })

    const profile = getUserProfile('bilibili')
    expect(profile!.stats).toBeDefined()
    expect(profile!.stats!.following).toBe(10)
    expect(profile!.stats!.follower).toBe(20)
  })

  it('should handle profile with bio', () => {
    initDatabase()

    saveUserProfile({
      platform: 'xhs',
      nickname: 'XHS_Profile',
      avatar: '',
      uid: 'xhs_2',
      bio: 'My bio',
      stats: { likes: 50 }
    })

    const profile = getUserProfile('xhs')
    expect(profile!.bio).toBe('My bio')
    expect(profile!.stats!.likes).toBe(50)
  })

  it('should handle write errors gracefully', () => {
    initDatabase()
    mockFs.writeFileSync = vi.fn(() => { throw new Error('permission denied') })

    saveUserProfile({
      platform: 'bilibili',
      nickname: 'ErrorUser',
      avatar: '',
      uid: 'err'
    })
  })
})
