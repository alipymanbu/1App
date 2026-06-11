// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedGrid } from '../../../../src/renderer/src/components/FeedGrid'

describe('FeedGrid', () => {
  const baseItem = {
    id: 'test-1',
    platform: 'bilibili' as const,
    title: 'Test Video Title',
    url: 'https://bilibili.com/video/BV1',
    mediaType: 'video' as const,
    cover: 'https://example.com/cover.jpg',
    author: 'TestAuthor',
    avatar: 'https://example.com/avatar.jpg'
  }

  it('should render loading skeleton when loading', () => {
    const { container } = render(<FeedGrid items={[]} loading={true} />)
    const pulses = container.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(6)
  })

  it('should render empty state when no items and no error', () => {
    render(<FeedGrid items={[]} loading={false} />)
    expect(screen.getByText('\u6682\u65e0\u5185\u5bb9')).toBeInTheDocument()
  })

  it('should render error state when error provided and no items', () => {
    render(<FeedGrid items={[]} loading={false} error='Failed to load content' />)
    expect(screen.getByText('Failed to load content')).toBeInTheDocument()
  })

  it('should render items when provided', () => {
    const items = [baseItem]
    render(<FeedGrid items={items} loading={false} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should render multiple items', () => {
    const items = [
      baseItem,
      { ...baseItem, id: 'test-2', title: 'Second Video' }
    ]
    render(<FeedGrid items={items} loading={false} />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
    expect(screen.getByText('Second Video')).toBeInTheDocument()
  })

  it('should render items even when error is present', () => {
    const items = [baseItem]
    render(<FeedGrid items={items} loading={false} error='Network error' />)
    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
    expect(screen.queryByText('\u6682\u65e0\u5185\u5bb9')).not.toBeInTheDocument()
  })
})
