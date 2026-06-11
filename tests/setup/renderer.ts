import { expect, vi } from 'vitest'
import * as jestDomMatchers from '@testing-library/jest-dom/matchers'
expect.extend(jestDomMatchers)

Object.defineProperty(window, 'electronApi', {
  value: {
    checkLogin: vi.fn(),
    openLogin: vi.fn(),
    getProfile: vi.fn(),
    getFeed: vi.fn(),
    logout: vi.fn(),
    getFollowings: vi.fn(),
    getFollowingFeed: vi.fn(),
    getFollowingsPage: vi.fn(),
    getFollowingFeedPage: vi.fn(),
    getUserVideosPage: vi.fn(),
    onLoginStatusChanged: vi.fn(() => vi.fn()),
    getFavoriteFolders: vi.fn(),
    getFavoriteVideosPage: vi.fn(),
    getVideoPlayback: vi.fn(),
    changeVideoQuality: vi.fn(),
    getVideoInteraction: vi.fn(),
    toggleVideoLike: vi.fn(),
    addVideoCoin: vi.fn(),
    toggleVideoFavorite: vi.fn(),
    getVideoFavoriteFolders: vi.fn(),
    updateVideoFavoriteFolders: vi.fn(),
    createFavoriteFolder: vi.fn(),
    getStorageSettings: vi.fn(),
    chooseDataRoot: vi.fn(),
    resetDataRoot: vi.fn(),
    clearVideoCache: vi.fn(),
    getXhsNoteDetail: vi.fn(),
    getBiliVideoDetail: vi.fn(),
    getBiliVideoComments: vi.fn(),
    getBiliCommentReplies: vi.fn(),
    restartApp: vi.fn(),
    getLogDir: vi.fn(),
    logRenderer: vi.fn(),
    openLogDir: vi.fn(),
    exportLogs: vi.fn(),
    clearLogs: vi.fn()
  },
  writable: true
})

Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })),
  writable: true
})
