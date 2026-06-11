import { describe, it, expect } from 'vitest'
import { isRateLimitError, formatRateLimitError } from '../../../src/renderer/src/utils/rateLimit'

describe('renderer rateLimit utils', () => {
  describe('isRateLimitError', () => {
    it('should detect rate limit error from Error object', () => {
      const r = isRateLimitError(new Error('RATE_LIMITED:5000'))
      expect(r.isLimited).toBe(true)
      expect(r.retryAfterMs).toBe(5000)
    })

    it('should detect rate limit error from string', () => {
      const r = isRateLimitError('RATE_LIMITED:3000')
      expect(r.isLimited).toBe(true)
      expect(r.retryAfterMs).toBe(3000)
    })

    it('should return false for non-rate-limit error', () => {
      expect(isRateLimitError(new Error('other')).isLimited).toBe(false)
    })

    it('should return false for null', () => {
      expect(isRateLimitError(null).isLimited).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isRateLimitError(undefined).isLimited).toBe(false)
    })

    it('should handle error with no message', () => {
      expect(isRateLimitError({}).isLimited).toBe(false)
    })

    it('should handle RATE_LIMITED with no number', () => {
      expect(isRateLimitError('RATE_LIMITED:').isLimited).toBe(false)
    })

    it('should handle non-standard object error', () => {
      expect(isRateLimitError({ custom: 'error' }).isLimited).toBe(false)
    })
  })

  describe('formatRateLimitError', () => {
    it('should format rate limit error', () => {
      expect(formatRateLimitError(new Error('RATE_LIMITED:5000'))).toBe('操作过快，请 5.0 秒后再试')
    })

    it('should return empty string for non-rate-limit error', () => {
      expect(formatRateLimitError(new Error('other'))).toBe('')
    })

    it('should return empty string for null', () => {
      expect(formatRateLimitError(null)).toBe('')
    })
  })
})
