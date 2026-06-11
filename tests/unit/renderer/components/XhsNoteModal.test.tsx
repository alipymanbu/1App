// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { XhsNoteModal } from '../../../../src/renderer/src/components/XhsNoteModal'
import type { FeedItem } from '../../../../src/shared/types'

const { mockDetail, mockItem } = vi.hoisted(() => ({
  mockDetail: {
    noteId: 'note123',
    type: 'image' as const,
    title: 'Test Note Title',
    desc: 'Test note description content',
    images: [
      'https://example.com/img1.jpg',
      'https://example.com/img2.jpg',
      'https://example.com/img3.jpg'
    ],
    author: { nickname: 'TestAuthor', avatar: 'https://example.com/avatar.jpg' },
    stats: { like: 100, comment: 20, collect: 50, share: 5 },
    comments: [
      { id: 'c1', nickname: 'Commenter1', avatar: 'https://example.com/c1.jpg', content: 'Nice note!', likes: 10, time: '2024-01-01' },
      { id: 'c2', nickname: 'Commenter2', avatar: '', content: 'Great!', likes: 5, time: '2024-01-02' }
    ],
    url: 'https://xiaohongshu.com/note/note123'
  },
  mockItem: {
    id: 'xhs-note123',
    platform: 'xhs' as const,
    title: 'Test Note Title',
    cover: 'https://example.com/cover.jpg',
    author: 'TestAuthor',
    avatar: 'https://example.com/avatar.jpg',
    url: 'https://xiaohongshu.com/note/note123',
    mediaType: 'image'
  } satisfies FeedItem
}))

describe('XhsNoteModal', () => {
  const onClose = vi.fn()
  const defaultProps = { item: mockItem, onClose }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue(mockDetail)
  })

  describe('Loading and Error', () => {
    it('should show loading spinner initially', () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockImplementation(() => new Promise(() => {}))
      render(<XhsNoteModal {...defaultProps} />)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('should show skeleton placeholders during loading', () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockImplementation(() => new Promise(() => {}))
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should show error message when detail is null', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue(null)
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u65e0\u6cd5\u52a0\u8f7d\u7b14\u8bb0\u8be6\u60c5')).toBeInTheDocument()
    })

    it('should show error message on exception', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockRejectedValue(new Error('fail'))
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u52a0\u8f7d\u5931\u8d25')).toBeInTheDocument()
    })

    it('should show retry button on error', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue(null)
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u91cd\u8bd5')).toBeInTheDocument()
    })

    it('should show view original link on error', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue(null)
      render(<XhsNoteModal {...defaultProps} />)
      const link = await screen.findByText('\u67e5\u770b\u539f\u6587')
      expect(link.closest('a')).toHaveAttribute('href', 'https://xiaohongshu.com/note/note123')
    })

    it('should retry fetching on retry button click', async () => {
      const getDetail = vi.mocked(window.electronApi.getXhsNoteDetail)
      getDetail.mockResolvedValueOnce(null)
      getDetail.mockResolvedValueOnce(mockDetail)
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u91cd\u8bd5')).toBeInTheDocument()
      fireEvent.click(screen.getByText('\u91cd\u8bd5'))
      expect(await screen.findByText('TestAuthor')).toBeInTheDocument()
    })
  })

  describe('Author Info', () => {
    it('should render author name', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('TestAuthor')).toBeInTheDocument()
    })

    it('should render follow button', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u5173\u6ce8')).toBeInTheDocument()
    })

    it('should render author avatar', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const avatarImg = container.querySelector<HTMLImageElement>('img[src="https://example.com/avatar.jpg"]')
      expect(avatarImg).toBeInTheDocument()
    })

    it('should show initial fallback when no avatar', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, author: { ...mockDetail.author, avatar: '' }
      })
      const itemNoAvatar = { ...mockItem, avatar: undefined }
      render(<XhsNoteModal {...defaultProps} item={itemNoAvatar} />)
      await screen.findByText('TestAuthor')
      const avatarDiv = document.querySelector('.bg-gray-200')
      expect(avatarDiv?.textContent).toBe('T')
    })

    it('should show unknown user when author name is empty', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, author: { nickname: '', avatar: '' }
      })
      const itemNoAuthor = { ...mockItem, author: '', avatar: undefined }
      render(<XhsNoteModal {...defaultProps} item={itemNoAuthor} />)
      expect(await screen.findByText('\u672a\u77e5\u7528\u6237')).toBeInTheDocument()
    })
  })

  describe('Content', () => {
    it('should render title', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('Test Note Title')).toBeInTheDocument()
    })

    it('should render description', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('Test note description content')).toBeInTheDocument()
    })

    it('should render stats with formatted numbers', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('Test Note Title')
      const statsDiv = container.querySelector('.text-gray-400.pt-1')
      expect(statsDiv?.textContent).toMatch(/100/)
      expect(statsDiv?.textContent).toMatch(/20/)
      expect(statsDiv?.textContent).toMatch(/50/)
    })

    it('should not render stats section when no stats', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, stats: {}
      })
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('Test Note Title')
      const statsDiv = document.querySelector('.text-gray-400.pt-1')
      expect(statsDiv).not.toBeInTheDocument()
    })

    it('should render title from fallback when detail has no title', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, title: ''
      })
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('Test Note Title')).toBeInTheDocument()
    })

    it('should not show description section when desc is empty', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, desc: ''
      })
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('Test Note Title')
      expect(screen.queryByText('Test note description content')).not.toBeInTheDocument()
    })

    it('should not show title section when title is empty and no fallback', async () => {
      const itemWithNoTitle = { ...mockItem, title: '' }
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, title: ''
      })
      render(<XhsNoteModal {...defaultProps} item={itemWithNoTitle} />)
      await screen.findByText('TestAuthor')
    })
  })

  describe('Comments', () => {
    it('should render comment list', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('Commenter1')).toBeInTheDocument()
      expect(screen.getByText('Nice note!')).toBeInTheDocument()
      expect(screen.getByText('Commenter2')).toBeInTheDocument()
      expect(screen.getByText('Great!')).toBeInTheDocument()
    })

    it('should show empty comments message', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, comments: []
      })
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u6682\u65e0\u8bc4\u8bba')).toBeInTheDocument()
    })

    it('should show comment header with count', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u8bc4\u8bba (20)')).toBeInTheDocument()
    })

    it('should show comment header without count when missing', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, stats: { like: 100, comment: undefined, collect: 50 }
      })
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('\u8bc4\u8bba')).toBeInTheDocument()
    })

    it('should render comment avatar', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('Nice note!')
      const commentAvatar = container.querySelector<HTMLImageElement>('img[src="https://example.com/c1.jpg"]')
      expect(commentAvatar).toBeInTheDocument()
    })

    it('should render fallback initial for comment without avatar', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('Great!')
      expect(screen.getByText('C')).toBeInTheDocument()
    })
  })

  describe('Image Gallery', () => {
    function getNoteImg(container: HTMLElement): HTMLImageElement | null {
      const imgs = container.querySelectorAll<HTMLImageElement>('img.max-w-full')
      return imgs[0] || null
    }

    it('should render current image', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const noteImg = getNoteImg(container)
      expect(noteImg).toHaveAttribute('src', 'https://example.com/img1.jpg')
    })

    it('should show prev and next navigation for multiple images', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      expect(screen.getByText('\u2039')).toBeInTheDocument()
      expect(screen.getByText('\u203a')).toBeInTheDocument()
    })

    it('should navigate to next image', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      fireEvent.click(screen.getByText('\u203a'))
      await waitFor(() => {
        expect(getNoteImg(container)).toHaveAttribute('src', 'https://example.com/img2.jpg')
      })
    })

    it('should navigate to previous image', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      fireEvent.click(screen.getByText('\u2039'))
      await waitFor(() => {
        expect(getNoteImg(container)).toHaveAttribute('src', 'https://example.com/img3.jpg')
      })
    })

    it('should wrap around from last to first on next', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const nextBtn = screen.getByText('\u203a')
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      fireEvent.click(nextBtn)
      await waitFor(() => {
        expect(getNoteImg(container)).toHaveAttribute('src', 'https://example.com/img1.jpg')
      })
    })

    it('should show dot indicators', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const dots = container.querySelectorAll('.rounded-full')
      const dotArray = Array.from(dots).filter(d =>
        d.className.includes('bg-white') || d.className.includes('bg-white/40')
      )
      expect(dotArray.length).toBeGreaterThanOrEqual(3)
    })

    it('should not show navigation for single image', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, images: ['https://example.com/img1.jpg']
      })
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      expect(screen.queryByText('\u2039')).not.toBeInTheDocument()
      expect(screen.queryByText('\u203a')).not.toBeInTheDocument()
    })

    it('should reset image index when images change', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      fireEvent.click(screen.getByText('\u203a'))
      fireEvent.click(screen.getByText('\u203a'))
      await waitFor(() => {
        expect(getNoteImg(container)).toHaveAttribute('src', 'https://example.com/img3.jpg')
      })
    })
  })

  describe('Video Type', () => {
    it('should render video element for video type notes', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail,
        type: 'video',
        images: [],
        video: { url: 'https://example.com/video.mp4', poster: 'https://example.com/poster.jpg' }
      })
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const video = document.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4')
      expect(video).toHaveAttribute('poster', 'https://example.com/poster.jpg')
    })

    it('should show video badge when no video url', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail,
        type: 'video',
        images: [],
        video: undefined
      })
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      expect(screen.getByText('\u89c6\u9891')).toBeInTheDocument()
    })
  })

  describe('Close Behavior', () => {
    it('should call onClose when close button clicked', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const closeBtn = document.querySelector('button.top-5.left-5')
      expect(closeBtn).toBeInTheDocument()
      fireEvent.click(closeBtn!)
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when backdrop clicked', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const backdrop = document.querySelector('.fixed.inset-0')
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('should not close when inner modal content clicked', async () => {
      render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const modalContent = document.querySelector('[class*="rounded-"]')
      expect(modalContent).toBeInTheDocument()
      fireEvent.click(modalContent!)
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Fallback Behavior', () => {
    it('should show fallback icon when no images and no cover', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, images: []
      })
      const itemNoCover = { ...mockItem, cover: undefined }
      render(<XhsNoteModal {...defaultProps} item={itemNoCover} />)
      await screen.findByText('TestAuthor')
      expect(document.querySelector('.text-4xl')).toBeInTheDocument()
    })

    it('should use cover as fallback image when detail has no images', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, images: []
      })
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const coverImg = container.querySelector<HTMLImageElement>('img[src="https://example.com/cover.jpg"]')
      expect(coverImg).toBeInTheDocument()
    })

    it('should use item author as fallback when detail has no author', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, author: { nickname: '', avatar: '' }
      })
      render(<XhsNoteModal {...defaultProps} />)
      expect(await screen.findByText('TestAuthor')).toBeInTheDocument()
    })

    it('should format large numbers with w suffix', async () => {
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const statsDiv = container.querySelector('.text-gray-400.pt-1')
      expect(statsDiv?.textContent).toMatch(/100/)
      expect(statsDiv?.textContent).toMatch(/20/)
      expect(statsDiv?.textContent).toMatch(/50/)
    })

    it('should format numbers with k suffix', async () => {
      vi.mocked(window.electronApi.getXhsNoteDetail).mockResolvedValue({
        ...mockDetail, stats: { like: 1500, comment: 2500, collect: 3500 }
      })
      const { container } = render(<XhsNoteModal {...defaultProps} />)
      await screen.findByText('TestAuthor')
      const statsDiv = container.querySelector('.text-gray-400.pt-1')
      expect(statsDiv?.textContent).toMatch(/1\.5k/)
      expect(statsDiv?.textContent).toMatch(/2\.5k/)
      expect(statsDiv?.textContent).toMatch(/3\.5k/)
    })
  })
})
