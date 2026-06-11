const timestamps = new Map<string, number>()

const LIMIT_CONFIG: Record<string, number> = {
  'get-feed': 600,
  'get-followings-page': 800,
  'get-following-feed-page': 800,
  'get-user-videos-page': 1500,
  'get-video-playback': 300,
  'change-video-quality': 300,
  'get-favorite-folders': 800,
  'get-favorite-videos-page': 1000,
  'get-video-interaction': 500,
  'toggle-video-like': 300,
  'add-video-coin': 500,
  'toggle-video-favorite': 500,
  'create-favorite-folder': 800,
  'get-bili-video-detail': 500,
  'get-bili-video-comments': 800,
  'get-bili-comment-replies': 500
}

export async function rateLimitConsume(scope: string): Promise<void> {
  const intervalMs = LIMIT_CONFIG[scope] || 0
  if (intervalMs <= 0) return

  const now = Date.now()
  const last = timestamps.get(scope) || 0
  const elapsed = now - last

  if (elapsed < intervalMs) {
    const waitMs = intervalMs - elapsed
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  timestamps.set(scope, Date.now())
}
