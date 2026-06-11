import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: vi.fn() },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

import { rateLimitConsume } from '../../../src/main/rateLimiter'

describe('rateLimiter', () => {
  it('should not wait for unknown scope', async () => {
    const start = Date.now()
    await rateLimitConsume('unknown-scope')
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('should not wait on first call for known scope', async () => {
    const start = Date.now()
    await rateLimitConsume('get-feed')
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('should wait when calling same scope too quickly', async () => {
    await rateLimitConsume('get-video-playback')
    const start = Date.now()
    await rateLimitConsume('get-video-playback')
    expect(Date.now() - start).toBeGreaterThanOrEqual(250)
  })

  it('should not wait for different scopes', async () => {
    await rateLimitConsume('get-feed')
    await rateLimitConsume('get-followings-page')
    const start = Date.now()
    await rateLimitConsume('get-feed')
    expect(Date.now() - start).toBeGreaterThanOrEqual(550)
  })

  it('should work for all configured scopes', async () => {
    const scopes = [
      'get-feed', 'get-followings-page', 'get-following-feed-page',
      'get-user-videos-page', 'get-video-playback', 'change-video-quality',
      'get-favorite-folders', 'get-favorite-videos-page', 'get-video-interaction',
      'toggle-video-like', 'add-video-coin', 'toggle-video-favorite',
      'create-favorite-folder', 'get-bili-video-detail', 'get-bili-video-comments',
      'get-bili-comment-replies'
    ]
    for (const s of scopes) {
      await rateLimitConsume(s)
    }
  })
})
