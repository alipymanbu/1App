// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BiliVideoSidePanel } from '../../../../src/renderer/src/components/BiliVideoSidePanel'

const { mockDetail, mockComments, mockReplies } = vi.hoisted(() => ({
  mockDetail: {
    bvid: 'BV1xx',
    aid: '123',
    title: 'Test Video Title',
    desc: 'A'.repeat(200),
    pubdate: 1700000000,
    owner: { mid: '12345', name: 'TestOwner', face: 'https://example.com/face.jpg' },
    stats: { view: 10000, like: 500, coin: 100, favorite: 200, reply: 50 },
    tags: ['tag1', 'tag2', 'tag3']
  },
  mockComments: {
    items: [
      {
        id: 'c1', rpid: 'rp1', mid: 'm1', nickname: 'Commenter1',
        avatar: 'https://example.com/av1.jpg', content: 'Great video!',
        ctime: 1700001000, like: 10, isUp: true, level: 5, replyCount: 3
      },
      {
        id: 'c2', rpid: 'rp2', mid: 'm2', nickname: 'Commenter2',
        content: 'Nice!', ctime: 1700002000, like: 0, level: 2
      }
    ],
    total: 2,
    cursor: 'cursor1',
    hasMore: true
  },
  mockReplies: {
    items: [
      { id: 'r1', rpid: 'rp3', mid: 'm3', nickname: 'Replier1', content: 'Thanks!', ctime: 1700003000, like: 1 }
    ],
    total: 15,
    page: 1,
    hasMore: true
  }
}))

describe('BiliVideoSidePanel', () => {
  const defaultProps = { bvid: 'BV1xx', aid: '123' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue(mockDetail)
    vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(mockComments)
    vi.mocked(window.electronApi.getBiliCommentReplies).mockResolvedValue(mockReplies)
  })

  describe('Video Detail', () => {
    it('should show loading state for detail', () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockImplementation(() => new Promise(() => {}))
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(screen.getByText('\u52a0\u8f7d\u4e2d...')).toBeInTheDocument()
    })

    it('should show error when detail returns null', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue(null)
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u89c6\u9891\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25')).toBeInTheDocument()
    })

    it('should show error when detail fetch throws', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockRejectedValue(new Error('fail'))
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u89c6\u9891\u8be6\u60c5\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
    })

    it('should render video title', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('Test Video Title')).toBeInTheDocument()
    })

    it('should render owner name', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('TestOwner')).toBeInTheDocument()
    })

    it('should render owner avatar', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      const img = await screen.findByAltText('')
      expect(img).toHaveAttribute('src', 'https://example.com/face.jpg')
    })

    it('should render owner without avatar', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({
        ...mockDetail, owner: { ...mockDetail.owner, face: undefined }
      })
      const { container } = render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('TestOwner')
      const ownerImg = container.querySelector<HTMLImageElement>('img[class*="w-8"]')
      expect(ownerImg).not.toBeInTheDocument()
    })

    it('should render stats with formatted numbers', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u64ad\u653e 1.0\u4e07')).toBeInTheDocument()
      expect(screen.getByText('\u8d5e 500')).toBeInTheDocument()
      expect(screen.getByText('\u6295\u5e01 100')).toBeInTheDocument()
      expect(screen.getByText('\u6536\u85cf 200')).toBeInTheDocument()
      expect(screen.getByText('\u8bc4\u8bba 50')).toBeInTheDocument()
    })

    it('should render publish date', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText(/\u53d1\u5e03\u4e8e/)).toBeInTheDocument()
    })

    it('should render tags', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('tag1')).toBeInTheDocument()
      expect(screen.getByText('tag2')).toBeInTheDocument()
      expect(screen.getByText('tag3')).toBeInTheDocument()
    })

    it('should not render tags when empty', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({ ...mockDetail, tags: [] })
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Test Video Title')
      expect(screen.queryByText('tag1')).not.toBeInTheDocument()
    })

    it('should render description expand button for long description', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u5c55\u5f00')).toBeInTheDocument()
    })

    it('should expand description when clicked', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText('\u5c55\u5f00'))
      expect(await screen.findByText('\u6536\u8d77')).toBeInTheDocument()
    })

    it('should collapse description when expanded', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText('\u5c55\u5f00'))
      fireEvent.click(await screen.findByText('\u6536\u8d77'))
      expect(await screen.findByText('\u5c55\u5f00')).toBeInTheDocument()
    })

    it('should not show expand button for short description', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({
        ...mockDetail, desc: 'Short desc'
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Test Video Title')
      expect(screen.queryByText('\u5c55\u5f00')).not.toBeInTheDocument()
    })

    it('should handle missing description gracefully', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({
        ...mockDetail, desc: ''
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Test Video Title')
    })

    it('should handle null stats gracefully', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({
        ...mockDetail, stats: { view: 10000, like: undefined, coin: undefined, favorite: undefined, reply: undefined }
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u64ad\u653e 1.0\u4e07')).toBeInTheDocument()
      expect(screen.queryByText('\u8d5e')).not.toBeInTheDocument()
    })
  })

  describe('Comment System', () => {
    it('should show loading state for comments', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockImplementation(() => new Promise(() => {}))
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u52a0\u8f7d\u8bc4\u8bba\u4e2d...')).toBeInTheDocument()
    })

    it('should show error state for comments', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue({
        items: [], total: 0, cursor: '', hasMore: false,
        error: '\u8bc4\u8bba\u52a0\u8f7d\u5931\u8d25'
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u8bc4\u8bba\u52a0\u8f7d\u5931\u8d25')).toBeInTheDocument()
    })

    it('should show error when comments fetch throws', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockRejectedValue(new Error('fail'))
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u8bc4\u8bba\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
    })

    it('should show empty comments message', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue({
        items: [], total: 0, cursor: '', hasMore: false
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u6682\u65e0\u8bc4\u8bba')).toBeInTheDocument()
    })

    it('should render comment list', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('Commenter1')).toBeInTheDocument()
      expect(screen.getByText('Great video!')).toBeInTheDocument()
      expect(screen.getByText('Commenter2')).toBeInTheDocument()
      expect(screen.getByText('Nice!')).toBeInTheDocument()
    })

    it('should show UP badge for UP comments', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('UP')).toBeInTheDocument()
    })

    it('should show comment level', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('Lv5')).toBeInTheDocument()
    })

    it('should show comment likes when > 0', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u8d5e 10')).toBeInTheDocument()
    })

    it('should not show zero likes', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter2')
      expect(screen.queryByText('\u8d5e 0')).not.toBeInTheDocument()
    })

    it('should show reply count button', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/)).toBeInTheDocument()
    })

    it('should show comment time', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter1')
    })

    it('should display hot sort as active by default', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      const hotBtn = await screen.findByText('\u6700\u70ed')
      expect(hotBtn.className).toContain('bg-[#00A1D6]')
    })

    it('should toggle sort to newest', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText('\u6700\u65b0'))
      const newestBtn = screen.getByText('\u6700\u65b0')
      expect(newestBtn.className).toContain('bg-[#00A1D6]')
      const hotBtn = screen.getByText('\u6700\u70ed')
      expect(hotBtn.className).not.toContain('bg-[#00A1D6]')
    })

    it('should show load more button when hasMore is true', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u52a0\u8f7d\u66f4\u591a')).toBeInTheDocument()
    })

    it('should not show load more when hasMore is false', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue({
        ...mockComments, hasMore: false
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter1')
      expect(screen.queryByText('\u52a0\u8f7d\u66f4\u591a')).not.toBeInTheDocument()
    })

    it('should show no more comments text', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue({
        ...mockComments, hasMore: false
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u6ca1\u6709\u66f4\u591a\u4e86')).toBeInTheDocument()
    })

    it('should show comment total count', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u8bc4\u8bba 2')).toBeInTheDocument()
    })
  })

  describe('Reply System', () => {
    it('should expand replies when clicking reply button', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('Replier1')).toBeInTheDocument()
      expect(screen.getByText('Thanks!')).toBeInTheDocument()
    })

    it('should show reply loading state', async () => {
      vi.mocked(window.electronApi.getBiliCommentReplies).mockImplementation(() => new Promise(() => {}))
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u52a0\u8f7d\u4e2d...')).toBeInTheDocument()
    })

    it('should show reply error', async () => {
      vi.mocked(window.electronApi.getBiliCommentReplies).mockResolvedValue({
        items: [], total: 0, page: 1, hasMore: false, error: '\u56de\u590d\u52a0\u8f7d\u5931\u8d25'
      })
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u56de\u590d\u52a0\u8f7d\u5931\u8d25')).toBeInTheDocument()
    })

    it('should show reply error on exception', async () => {
      vi.mocked(window.electronApi.getBiliCommentReplies).mockRejectedValue(new Error('fail'))
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u56de\u590d\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
    })

    it('should collapse replies', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('Replier1')).toBeInTheDocument()
      fireEvent.click(screen.getByText('\u6536\u8d77'))
      await waitFor(() => {
        expect(screen.queryByText('Replier1')).not.toBeInTheDocument()
      })
    })

    it('should show reply pagination with total pages', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u51712\u9875')).toBeInTheDocument()
    })

    it('should show next page button in reply pagination', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u4e0b\u4e00\u9875')).toBeInTheDocument()
    })

    it('should navigate to next reply page', async () => {
      const page2Response = {
        items: [
          { id: 'r2', rpid: 'rp4', mid: 'm4', nickname: 'Replier2', content: 'Page 2 reply', ctime: 1700004000, like: 2 }
        ],
        total: 15,
        page: 2,
        hasMore: false
      }
      vi.mocked(window.electronApi.getBiliCommentReplies)
        .mockResolvedValueOnce(mockReplies)
        .mockResolvedValueOnce(page2Response)
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      await screen.findByText('Replier1')
      fireEvent.click(screen.getByText('\u4e0b\u4e00\u9875'))
      expect(await screen.findByText('Replier2')).toBeInTheDocument()
    })

    it('should not show previous page on first page', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      await screen.findByText('Replier1')
      expect(screen.queryByText('\u4e0a\u4e00\u9875')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should render without aid prop', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue(mockDetail)
      render(<BiliVideoSidePanel bvid="BV1xx" />)
      expect(await screen.findByText('Test Video Title')).toBeInTheDocument()
    })

    it('should handle broken avatar for comments', async () => {
      const { container } = render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter1')
      const commentAvatar = container.querySelector<HTMLImageElement>('img[src="https://example.com/av1.jpg"]')
      expect(commentAvatar).toBeInTheDocument()
      fireEvent.error(commentAvatar!)
      const fallbacks = screen.getAllByText('C')
      expect(fallbacks.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle broken avatar for replies', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      await screen.findByText('Replier1')
      expect(screen.getByText('R')).toBeInTheDocument()
    })

    it('should handle missing avatar in comment', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter2')
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    it('should display formatTimeAgo as just now for recent comment', async () => {
      const now = Math.floor(Date.now() / 1000)
      const recentComments = {
        ...mockComments,
        items: [{ ...mockComments.items[0], ctime: now - 5 }]
      }
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(recentComments)
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('\u521a\u521a')).toBeInTheDocument()
    })

    it('should display formatTimeAgo as minutes ago', async () => {
      const now = Math.floor(Date.now() / 1000)
      const recentComments = {
        ...mockComments,
        items: [{ ...mockComments.items[0], ctime: now - 120 }]
      }
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(recentComments)
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('2\u5206\u949f\u524d')).toBeInTheDocument()
    })

    it('should display formatTimeAgo as hours ago', async () => {
      const now = Math.floor(Date.now() / 1000)
      const recentComments = {
        ...mockComments,
        items: [{ ...mockComments.items[0], ctime: now - 7200 }]
      }
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(recentComments)
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('2\u5c0f\u65f6\u524d')).toBeInTheDocument()
    })

    it('should display formatTimeAgo as days ago', async () => {
      const now = Math.floor(Date.now() / 1000)
      const recentComments = {
        ...mockComments,
        items: [{ ...mockComments.items[0], ctime: now - 172800 }]
      }
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(recentComments)
      render(<BiliVideoSidePanel {...defaultProps} />)
      expect(await screen.findByText('2\u5929\u524d')).toBeInTheDocument()
    })

    it('should call getBiliVideoComments with cursor when loading more', async () => {
      vi.mocked(window.electronApi.getBiliVideoComments).mockResolvedValue(mockComments)
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter1')

      fireEvent.click(screen.getByText('\u52a0\u8f7d\u66f4\u591a'))
      await waitFor(() => {
        expect(window.electronApi.getBiliVideoComments).toHaveBeenCalledWith('123', 'hot', 'cursor1', 20)
      })
    })

    it('should navigate to previous reply page', async () => {
      const page2Response = {
        items: [
          { id: 'r2', rpid: 'rp4', mid: 'm4', nickname: 'Replier2', content: 'Page 2 reply', ctime: 1700004000, like: 2 }
        ],
        total: 15,
        page: 2,
        hasMore: true
      }
      vi.mocked(window.electronApi.getBiliCommentReplies)
        .mockResolvedValueOnce(mockReplies)
        .mockResolvedValueOnce(page2Response)
        .mockResolvedValueOnce(mockReplies)
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      await screen.findByText('Replier1')

      fireEvent.click(screen.getByText('\u4e0b\u4e00\u9875'))
      await screen.findByText('Replier2')

      fireEvent.click(screen.getByText('\u4e0a\u4e00\u9875'))
      expect(await screen.findByText('Replier1')).toBeInTheDocument()
    })

    it('should show correct ellipsis for reply pagination near middle', async () => {
      const manyReplies = {
        items: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, rpid: `rp${i}`, mid: `m${i}`, nickname: `R${i}`, content: 'test', ctime: 1700000000, like: 0 })),
        total: 100,
        page: 5,
        hasMore: true
      }
      vi.mocked(window.electronApi.getBiliCommentReplies).mockResolvedValue(manyReplies)
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      expect(await screen.findByText('\u517110\u9875')).toBeInTheDocument()
      expect(screen.getByText('...')).toBeInTheDocument()
    })

    it('should not load replies when aria already expanded', async () => {
      const existingReplies = {
        ...mockReplies, page: 1
      }
      vi.mocked(window.electronApi.getBiliCommentReplies)
        .mockResolvedValueOnce(existingReplies)
      render(<BiliVideoSidePanel {...defaultProps} />)
      fireEvent.click(await screen.findByText(/\u5171 3 \u6761\u56de\u590d/))
      await screen.findByText('Replier1')
      vi.mocked(window.electronApi.getBiliCommentReplies).mockClear()
      fireEvent.click(screen.getByText('1'))
      expect(window.electronApi.getBiliCommentReplies).not.toHaveBeenCalled()
    })
  })

  describe('Sort Edge Cases', () => {
    it('should not re-fetch comments when clicking hot sort while already on hot', async () => {
      render(<BiliVideoSidePanel {...defaultProps} />)
      await screen.findByText('Commenter1')
      window.electronApi.getBiliVideoComments.mockClear()
      fireEvent.click(screen.getByText('\u6700\u70ed'))
      expect(window.electronApi.getBiliVideoComments).not.toHaveBeenCalled()
    })
  })

  describe('loadComments early return', () => {
    it('should not call getBiliVideoComments when aid is missing', async () => {
      vi.mocked(window.electronApi.getBiliVideoDetail).mockResolvedValue({
        ...mockDetail, aid: undefined
      })
      render(<BiliVideoSidePanel bvid="BV1xx" />)
      await screen.findByText('Test Video Title')
      expect(window.electronApi.getBiliVideoComments).not.toHaveBeenCalled()
    })
  })
})
