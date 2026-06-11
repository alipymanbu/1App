import { describe, it, expect } from 'vitest'
import { PLATFORMS, APP_NAME, DB_NAME, SESSION_PREFIX } from '../../../src/shared/constants'

describe('constants', () => {
  it('should export PLATFORMS array with 3 platforms', () => {
    expect(PLATFORMS).toHaveLength(3)
  })

  it('should have correct platform ids', () => {
    const ids = PLATFORMS.map(p => p.id)
    expect(ids).toEqual(['xhs', 'bilibili', 'douyin'])
  })

  it('should have platform configs with required fields', () => {
    for (const p of PLATFORMS) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('color')
      expect(p).toHaveProperty('loginUrl')
      expect(p).toHaveProperty('icon')
    }
  })

  it('should export APP_NAME', () => {
    expect(APP_NAME).toBe('1App')
  })

  it('should export DB_NAME', () => {
    expect(DB_NAME).toBe('1app.db')
  })

  it('should export SESSION_PREFIX', () => {
    expect(SESSION_PREFIX).toBe('persist:')
  })
})
