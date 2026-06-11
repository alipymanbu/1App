// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FavoriteModal } from '../../../../src/renderer/src/components/FavoriteModal'

describe('FavoriteModal', () => {
  const mockFolders = [
    { id: 'f1', title: '\u9ed8\u8ba4\u6536\u85cf\u5939', count: 5, checked: false },
    { id: 'f2', title: '\u6211\u7684\u6536\u85cf', count: 12, checked: true }
  ]

  const defaultProps = {
    aid: '123',
    bvid: 'BV1xx',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onFoldersChanged: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronApi.getVideoFavoriteFolders).mockResolvedValue(mockFolders)
    vi.mocked(window.electronApi.updateVideoFavoriteFolders).mockResolvedValue({ success: true })
    vi.mocked(window.electronApi.createFavoriteFolder).mockResolvedValue({
      success: true,
      folder: { id: 'new', title: '\u65b0\u5efa\u6536\u85cf\u5939', count: 0, checked: true }
    })
  })

  it('should show loading state initially', () => {
    vi.mocked(window.electronApi.getVideoFavoriteFolders).mockImplementation(() => new Promise(() => {}))
    render(<FavoriteModal {...defaultProps} />)
    expect(screen.getByText('\u52a0\u8f7d\u4e2d...')).toBeInTheDocument()
  })

  it('should show error when fetch fails', async () => {
    vi.mocked(window.electronApi.getVideoFavoriteFolders).mockRejectedValue(new Error('Network error'))
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('\u83b7\u53d6\u6536\u85cf\u5939\u5931\u8d25')).toBeInTheDocument()
  })

  it('should show empty state when no folders', async () => {
    vi.mocked(window.electronApi.getVideoFavoriteFolders).mockResolvedValue([])
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('\u6ca1\u6709\u521b\u5efa\u4efb\u4f55\u6536\u85cf\u5939')).toBeInTheDocument()
  })

  it('should render modal title', async () => {
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('\u6536\u85cf\u5230')).toBeInTheDocument()
  })

  it('should render folder list with checkboxes', async () => {
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('\u9ed8\u8ba4\u6536\u85cf\u5939')).toBeInTheDocument()
    expect(screen.getByText('\u6211\u7684\u6536\u85cf')).toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(2)
  })

  it('should show checked state for initially checked folders', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    expect(checkboxes[0]).not.toBeChecked()
    expect(checkboxes[1]).toBeChecked()
  })

  it('should toggle folder checkbox on click', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
    fireEvent.click(checkboxes[1])
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('should show folder count when available', async () => {
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('5')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('should disable confirm button when no changes', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const btn = await screen.findByText('\u786e\u5b9a')
    expect(btn.closest('button')).toBeDisabled()
  })

  it('should enable confirm button after changes', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    const btn = screen.getByText('\u786e\u5b9a')
    expect(btn.closest('button')).not.toBeDisabled()
  })

  it('should call updateVideoFavoriteFolders with correct params on save', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(window.electronApi.updateVideoFavoriteFolders).toHaveBeenCalledWith('123', ['f1'], [])
    })
  })

  it('should call onSuccess and onClose on successful save', async () => {
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledWith('BV1xx', '123')
      expect(defaultProps.onClose).toHaveBeenCalledOnce()
    })
  })

  it('should show saving state when saving', async () => {
    vi.mocked(window.electronApi.updateVideoFavoriteFolders).mockImplementation(() => new Promise(() => {}))
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u4fdd\u5b58\u4e2d...')).toBeInTheDocument()
  })

  it('should show error when save fails', async () => {
    vi.mocked(window.electronApi.updateVideoFavoriteFolders).mockResolvedValue({ success: false, error: '\u4fdd\u5b58\u5931\u8d25' })
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u4fdd\u5b58\u5931\u8d25')).toBeInTheDocument()
  })

  it('should close when backdrop clicked', async () => {
    render(<FavoriteModal {...defaultProps} />)
    await screen.findByText('\u6536\u85cf\u5230')
    const backdrop = screen.getByText('\u6536\u85cf\u5230').closest('.fixed')
    fireEvent.click(backdrop!)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('should show create folder button', async () => {
    render(<FavoriteModal {...defaultProps} />)
    expect(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939')).toBeInTheDocument()
  })

  it('should show create folder input when button clicked', async () => {
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    expect(screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')).toBeInTheDocument()
  })

  it('should create new folder and add to list', async () => {
    vi.mocked(window.electronApi.createFavoriteFolder).mockResolvedValue({
      success: true,
      folder: { id: 'new-folder', title: '\u6211\u7684\u521b\u5efa', count: 0, checked: true }
    })
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    const input = screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')
    fireEvent.change(input, { target: { value: '\u6211\u7684\u521b\u5efa' } })
    fireEvent.click(screen.getByText('\u65b0\u5efa'))
    expect(await screen.findByText('\u6211\u7684\u521b\u5efa')).toBeInTheDocument()
  })

  it('should disable create button when input is empty', async () => {
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    expect(screen.getByText('\u65b0\u5efa').closest('button')).toBeDisabled()
  })

  it('should cancel folder creation', async () => {
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    fireEvent.click(screen.getByText('\u53d6\u6d88'))
    expect(screen.queryByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')).not.toBeInTheDocument()
  })

  it('should create folder via Enter key', async () => {
    vi.mocked(window.electronApi.createFavoriteFolder).mockResolvedValue({
      success: true,
      folder: { id: 'key-folder', title: 'EnterFolder', count: 0, checked: true }
    })
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    const input = screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')
    fireEvent.change(input, { target: { value: 'EnterFolder' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('EnterFolder')).toBeInTheDocument()
  })

  it('should disable confirm button when no changes made', async () => {
    render(<FavoriteModal {...defaultProps} />)
    await screen.findByText('\u6536\u85cf\u5230')
    expect(screen.getByText('\u786e\u5b9a').closest('button')).toBeDisabled()
  })

  it('should show error when create folder API fails', async () => {
    vi.mocked(window.electronApi.createFavoriteFolder).mockResolvedValue({ success: false, error: '\u521b\u5efa\u5931\u8d25' })
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    const input = screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')
    fireEvent.change(input, { target: { value: '\u65b0\u6587\u4ef6\u5939' } })
    fireEvent.click(screen.getByText('\u65b0\u5efa'))
    expect(await screen.findByText('\u521b\u5efa\u5931\u8d25')).toBeInTheDocument()
  })

  it('should show error when create folder throws', async () => {
    vi.mocked(window.electronApi.createFavoriteFolder).mockRejectedValue(new Error('Network error'))
    render(<FavoriteModal {...defaultProps} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    const input = screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')
    fireEvent.change(input, { target: { value: '\u65b0\u6587\u4ef6\u5939' } })
    fireEvent.click(screen.getByText('\u65b0\u5efa'))
    expect(await screen.findByText('\u521b\u5efa\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
  })

  it('should handle create success without folder object', async () => {
    vi.mocked(window.electronApi.createFavoriteFolder).mockResolvedValue({ success: true })
    const onFoldersChanged = vi.fn()
    render(<FavoriteModal {...defaultProps} onFoldersChanged={onFoldersChanged} />)
    fireEvent.click(await screen.findByText('+ \u65b0\u5efa\u6536\u85cf\u5939'))
    const input = screen.getByPlaceholderText('\u6700\u591a\u53ef\u8f93\u516520\u4e2a\u5b57')
    fireEvent.change(input, { target: { value: '\u65b0\u6587\u4ef6\u5939' } })
    fireEvent.click(screen.getByText('\u65b0\u5efa'))
    await waitFor(() => {
      expect(onFoldersChanged).toHaveBeenCalled()
    })
  })

  it('should show error when confirm throws', async () => {
    vi.mocked(window.electronApi.updateVideoFavoriteFolders).mockRejectedValue(new Error('Network error'))
    render(<FavoriteModal {...defaultProps} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u6536\u85cf\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
  })

  it('should call onFoldersChanged after successful confirm', async () => {
    const onFoldersChanged = vi.fn()
    render(<FavoriteModal {...defaultProps} onFoldersChanged={onFoldersChanged} />)
    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(onFoldersChanged).toHaveBeenCalled()
    })
  })
})
