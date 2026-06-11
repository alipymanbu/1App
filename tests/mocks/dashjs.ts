import { vi } from 'vitest'

export function createMockDashjs() {
  const mockPlayer = {
    initialize: vi.fn(),
    attachSource: vi.fn(),
    attachView: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    reset: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    updateSettings: vi.fn(),
    getDebug: vi.fn(() => ({ log: vi.fn() })),
    getSource: vi.fn(() => ''),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    time: vi.fn(() => ({})),
    getTracksFor: vi.fn(() => []),
    setCurrentTime: vi.fn(),
    setAutoPlay: vi.fn(),
    setPlaybackRate: vi.fn()
  }

  return {
    MediaPlayer: vi.fn(() => ({
      create: vi.fn(() => mockPlayer)
    })),
    errors: {
      manifest: { code: 1, message: 'Manifest error' }
    }
  }
}
