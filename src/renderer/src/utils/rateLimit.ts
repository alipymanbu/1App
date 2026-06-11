const RATE_LIMIT_RE = /RATE_LIMITED:(\d+)/

export function isRateLimitError(err: unknown): { isLimited: boolean; retryAfterMs: number } {
  if (!err) return { isLimited: false, retryAfterMs: 0 }
  const message = err instanceof Error ? err.message : String(err)
  const match = message.match(RATE_LIMIT_RE)
  if (match) {
    return { isLimited: true, retryAfterMs: parseInt(match[1], 10) }
  }
  return { isLimited: false, retryAfterMs: 0 }
}

export function formatRateLimitError(err: unknown): string {
  const { isLimited, retryAfterMs } = isRateLimitError(err)
  if (isLimited) {
    const seconds = (retryAfterMs / 1000).toFixed(1)
    return `操作过快，请 ${seconds} 秒后再试`
  }
  return ''
}
