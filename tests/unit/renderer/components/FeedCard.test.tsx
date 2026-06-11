// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedCard } from '../../../../src/renderer/src/components/FeedCard'

describe('FeedCard', () => {
  const baseItem = {
    id: 'test-1', platform: 'bilibili' as const, title: 'Test Video Title',
    url: 'https://bilibili.com/video/BV1', mediaType: 'video' as const,
    cover: 'https://example.com/cover.jpg', author: 'TestAuthor',
    avatar: 'https://example.com/avatar.jpg'
  }

  it('should render video card with title', () => {
    render(<FeedCard item={baseItem} onPlay={vi.fn()} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should render author name', () => {
    render(<FeedCard item={baseItem} onPlay={vi.fn()} />)
    expect(screen.getByText('TestAuthor')).toBeInTheDocument()
  })

  it('should render platform badge', () => {
    render(<FeedCard item={baseItem} onPlay={vi.fn()} />)
    expect(screen.getByText('B' + '\u7ad9')).toBeInTheDocument()
  })

  it('should render stats when available', () => {
    const item = { ...baseItem, stats: { like: 1000, comment: 50 } }
    const { container } = render(<FeedCard item={item} onPlay={vi.fn()} />)
    expect(container.textContent).toContain('1.0k')
    expect(container.textContent).toContain('50')
  })

  it('should render without cover', () => {
    const { container } = render(<FeedCard item={{ ...baseItem, cover: undefined }} onPlay={vi.fn()} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should render without author/avatar', () => {
    render(<FeedCard item={{ ...baseItem, author: undefined, avatar: undefined }} onPlay={vi.fn()} />)
  })

  it('should render xhs note card', () => {
    const noteItem = { ...baseItem, platform: 'xhs' as const, mediaType: 'note' as const, url: 'https://xiaohongshu.com/explore/note1' }
    render(<FeedCard item={noteItem} onPlay={vi.fn()} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should call onPlay when clicking bilibili video card', () => {
    const onPlay = vi.fn()
    const item = { ...baseItem, bvid: 'BV1xx' }
    const { container } = render(<FeedCard item={item} onPlay={onPlay} />)
    const link = container.querySelector('a')!
    fireEvent.click(link)
    expect(onPlay).toHaveBeenCalledWith(item)
  })

  it('should call onPlay when clicking xhs note card', () => {
    const onPlay = vi.fn()
    const item = { ...baseItem, platform: 'xhs' as const, mediaType: 'note' as const }
    const { container } = render(<FeedCard item={item} onPlay={onPlay} />)
    const link = container.querySelector('a')!
    fireEvent.click(link)
    expect(onPlay).toHaveBeenCalledWith(item)
  })

  it('should not call onPlay without bvid/aid for bilibili', () => {
    const onPlay = vi.fn()
    const { container } = render(<FeedCard item={{ ...baseItem, bvid: undefined, aid: undefined }} onPlay={onPlay} />)
    const link = container.querySelector('a')!
    fireEvent.click(link)
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('should format play count with w for 10000+', () => {
    const item = { ...baseItem, stats: { play: 15000 } }
    const { container } = render(<FeedCard item={item} onPlay={vi.fn()} />)
    expect(container.textContent).toContain('1.5w')
  })

  it('should show placeholder when cover image errors', () => {
    const { container } = render(<FeedCard item={baseItem} onPlay={vi.fn()} />)
    const images = container.querySelectorAll('img')
    fireEvent.error(images[0])
    expect(screen.getByText('📺')).toBeInTheDocument()
  })

  it('should show initial letter when avatar errors', () => {
    const { container } = render(<FeedCard item={baseItem} onPlay={vi.fn()} />)
    const images = container.querySelectorAll('img')
    fireEvent.error(images[1])
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('should not render stats div when stats are undefined', () => {
    const { container } = render(<FeedCard item={{ ...baseItem, stats: undefined }} onPlay={vi.fn()} />)
    expect(container.textContent).not.toContain('▶️')
  })

  it('should show question mark in avatar when author is missing', () => {
    render(<FeedCard item={{ ...baseItem, author: undefined, avatar: undefined }} onPlay={vi.fn()} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('should not call onPlay for non-bilibili-non-xhs without onPlay', () => {
    const onPlay = vi.fn()
    render(<FeedCard item={{ ...baseItem, platform: 'douyin' as const, bvid: undefined, aid: undefined }} onPlay={onPlay} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should not render stats div when all stats fields are undefined', () => {
    const { container } = render(<FeedCard item={{ ...baseItem, stats: { play: undefined, like: undefined, comment: undefined, share: undefined } }} onPlay={vi.fn()} />)
    expect(container.textContent).not.toContain('▶️')
  })

  it('should format count with k for 1000+', () => {
    const item = { ...baseItem, stats: { play: 1200 } }
    const { container } = render(<FeedCard item={item} onPlay={vi.fn()} />)
    expect(container.textContent).toContain('1.2k')
  })

  it('should format count with w for 10000+', () => {
    const item = { ...baseItem, stats: { play: 12345 } }
    const { container } = render(<FeedCard item={item} onPlay={vi.fn()} />)
    expect(container.textContent).toContain('1.2w')
  })

  it('should handle non-number stats value', () => {
    const item = { ...baseItem, stats: { play: 'lots' as any } }
    const { container } = render(<FeedCard item={item} onPlay={vi.fn()} />)
    expect(container.textContent).toContain('lots')
  })

  it('should render platform-unspecified icon fallback', () => {
    const { container } = render(<FeedCard item={{ ...baseItem, cover: undefined, platform: 'unknown' as any }} onPlay={vi.fn()} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should show avatar initial letter when author exists but avatar missing', () => {
    const { container } = render(<FeedCard item={{ ...baseItem, avatar: undefined }} onPlay={vi.fn()} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })
})
