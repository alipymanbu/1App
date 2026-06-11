// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserCard } from '../../../../src/renderer/src/components/UserCard'

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B' + '\u7ad9', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '\ud83d\udcfa' },
    { id: 'xhs', name: '\u5c0f\u7ea2\u4e66', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '\ud83d\udcd5' },
    { id: 'douyin', name: '\u6296\u97f3', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '\ud83c\udfb5' }
  ]
}))

describe('UserCard', () => {
  const baseProfile = {
    platform: 'bilibili' as const,
    nickname: 'TestUser',
    avatar: 'https://example.com/avatar.jpg',
    uid: '12345',
    bio: 'This is my bio',
    stats: { following: 100, follower: 500, likes: 1000, views: 10000 }
  }

  it('should render nickname', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('TestUser')).toBeInTheDocument()
  })

  it('should render avatar image', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    const img = screen.getByAltText('TestUser') as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://example.com/avatar.jpg')
  })

  it('should render avatar fallback when avatar is empty', () => {
    const profile = { ...baseProfile, avatar: '' }
    render(<UserCard profile={profile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('should render platform badge', () => {
    const { container } = render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(container.textContent).toContain('B' + '\u7ad9')
  })

  it('should render uid', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('ID: 12345')).toBeInTheDocument()
  })

  it('should render bio when provided', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('This is my bio')).toBeInTheDocument()
  })

  it('should not render bio when not provided', () => {
    const profile = { ...baseProfile, bio: undefined }
    render(<UserCard profile={profile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.queryByText('This is my bio')).not.toBeInTheDocument()
  })

  it('should render stats when available', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('1.0k')).toBeInTheDocument()
    expect(screen.getByText('1.0w')).toBeInTheDocument()
  })

  it('should render stat labels', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('\u5173\u6ce8')).toBeInTheDocument()
    expect(screen.getByText('\u7c89\u4e1d')).toBeInTheDocument()
    expect(screen.getByText('\u83b7\u8d5e')).toBeInTheDocument()
    expect(screen.getByText('\u64ad\u653e')).toBeInTheDocument()
  })

  it('should not render stats section when no stats', () => {
    const profile = { ...baseProfile, stats: undefined }
    const { container } = render(<UserCard profile={profile} platform='bilibili' onLogout={vi.fn()} />)
    expect(container.querySelectorAll('.border-l.border-gray-200\\/60').length).toBe(0)
  })

  it('should render logout button', () => {
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    expect(screen.getByText('\u9000\u51fa\u767b\u5f55')).toBeInTheDocument()
  })

  it('should call onLogout when logout button clicked', () => {
    const onLogout = vi.fn()
    render(<UserCard profile={baseProfile} platform='bilibili' onLogout={onLogout} />)
    fireEvent.click(screen.getByText('\u9000\u51fa\u767b\u5f55'))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('should render avatar fallback on image error', () => {
    const { container } = render(<UserCard profile={baseProfile} platform='bilibili' onLogout={vi.fn()} />)
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    fireEvent.error(img!)
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('should render for xhs platform', () => {
    const profile = { ...baseProfile, platform: 'xhs' as const }
    const { container } = render(<UserCard profile={profile} platform='xhs' onLogout={vi.fn()} />)
    expect(container.textContent).toContain('\u5c0f\u7ea2\u4e66')
  })
})
