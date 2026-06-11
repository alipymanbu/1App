// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FollowGrid } from '../../../../src/renderer/src/components/FollowGrid'

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B' + '\u7ad9', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '\ud83d\udcfa' },
    { id: 'xhs', name: '\u5c0f\u7ea2\u4e66', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '\ud83d\udcd5' },
    { id: 'douyin', name: '\u6296\u97f3', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '\ud83c\udfb5' }
  ]
}))

describe('FollowGrid', () => {
  const baseUser = {
    platform: 'bilibili' as const,
    nickname: 'FollowUser',
    avatar: 'https://example.com/avatar.jpg',
    uid: '67890',
    bio: 'A content creator',
    url: 'https://bilibili.com/space/67890',
    stats: { following: 10, follower: 200, likes: 1500, views: 50000 }
  }

  it('should render loading skeleton when loading', () => {
    const { container } = render(<FollowGrid items={[]} loading={true} />)
    const pulses = container.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(6)
  })

  it('should render empty state when no items and no error', () => {
    render(<FollowGrid items={[]} loading={false} />)
    expect(screen.getByText('\u6682\u65e0\u5173\u6ce8')).toBeInTheDocument()
  })

  it('should render error state when error provided and no items', () => {
    render(<FollowGrid items={[]} loading={false} error='Request rate limited' />)
    expect(screen.getByText('Request rate limited')).toBeInTheDocument()
  })

  it('should render user cards when items provided', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('FollowUser')).toBeInTheDocument()
  })

  it('should render multiple users', () => {
    const items = [
      baseUser,
      { ...baseUser, uid: '999', nickname: 'SecondUser' }
    ]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('FollowUser')).toBeInTheDocument()
    expect(screen.getByText('SecondUser')).toBeInTheDocument()
  })

  it('should render bio when provided', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('A content creator')).toBeInTheDocument()
  })

  it('should render stats badges when available', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('1.5k')).toBeInTheDocument()
    expect(screen.getByText('5.0w')).toBeInTheDocument()
  })

  it('should render stat labels', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('\u5173\u6ce8')).toBeInTheDocument()
    expect(screen.getByText('\u7c89\u4e1d')).toBeInTheDocument()
    expect(screen.getByText('\u83b7\u8d5e')).toBeInTheDocument()
    expect(screen.getByText('\u64ad\u653e')).toBeInTheDocument()
  })

  it('should render platform name', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('B' + '\u7ad9')).toBeInTheDocument()
  })

  it('should render profile link', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('\u7a7a\u95f4')).toBeInTheDocument()
  })

  it('should call onSelectUser when card clicked', () => {
    const onSelectUser = vi.fn()
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} onSelectUser={onSelectUser} />)
    fireEvent.click(screen.getByText('FollowUser'))
    expect(onSelectUser).toHaveBeenCalledWith(baseUser)
  })

  it('should render avatar image', () => {
    const items = [baseUser]
    render(<FollowGrid items={items} loading={false} />)
    const img = screen.getAllByRole('img')[0] as HTMLImageElement
    expect(img.src).toBe('https://example.com/avatar.jpg')
  })

  it('should render avatar fallback when avatar is empty', () => {
    const items = [{ ...baseUser, avatar: '' }]
    render(<FollowGrid items={items} loading={false} />)
    expect(screen.getByText('F')).toBeInTheDocument()
  })
})
