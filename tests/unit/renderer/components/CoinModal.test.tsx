// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CoinModal } from '../../../../src/renderer/src/components/CoinModal'

describe('CoinModal', () => {
  const defaultProps = {
    bvid: 'BV1xx',
    aid: '123',
    onClose: vi.fn(),
    onSuccess: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronApi.addVideoCoin).mockResolvedValue({ success: true })
  })

  it('should render modal title', () => {
    render(<CoinModal {...defaultProps} />)
    expect(screen.getByText('\u7ed9UP\u4e3b\u6295\u5e01')).toBeInTheDocument()
  })

  it('should render 1 coin and 2 coin buttons', () => {
    render(<CoinModal {...defaultProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getAllByText('\u786c\u5e01').length).toBe(2)
  })

  it('should highlight 1 coin by default', () => {
    const { container } = render(<CoinModal {...defaultProps} />)
    const buttons = container.querySelectorAll('.rounded-full')
    const firstBtn = buttons[0]
    expect(firstBtn.className).toContain('border-[#00A1D6]')
  })

  it('should switch to 2 coins when clicked', () => {
    const { container } = render(<CoinModal {...defaultProps} />)
    const buttons = container.querySelectorAll('.rounded-full')
    fireEvent.click(buttons[1])
    expect(buttons[1].className).toContain('border-[#00A1D6]')
    expect(buttons[0].className).not.toContain('border-[#00A1D6]')
  })

  it('should toggle like checkbox', () => {
    render(<CoinModal {...defaultProps} />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('should render like label', () => {
    render(<CoinModal {...defaultProps} />)
    expect(screen.getByText('\u540c\u65f6\u70b9\u8d5e\u5185\u5bb9')).toBeInTheDocument()
  })

  it('should call addVideoCoin with 1 coin and like=false by default when confirmed', async () => {
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(window.electronApi.addVideoCoin).toHaveBeenCalledWith('BV1xx', '123', 1, false)
    })
  })

  it('should call addVideoCoin with 2 coins and like=true when both toggled', async () => {
    render(<CoinModal {...defaultProps} />)
    const buttons = screen.getByText('2').closest('button')!
    fireEvent.click(buttons)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(window.electronApi.addVideoCoin).toHaveBeenCalledWith('BV1xx', '123', 2, true)
    })
  })

  it('should call onSuccess and onClose on successful coin', async () => {
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalledOnce()
      expect(defaultProps.onClose).toHaveBeenCalledOnce()
    })
  })

  it('should show error when addVideoCoin fails', async () => {
    vi.mocked(window.electronApi.addVideoCoin).mockResolvedValue({ success: false, error: '\u5e01\u4e0d\u8db3' })
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u5e01\u4e0d\u8db3')).toBeInTheDocument()
  })

  it('should show saving state when confirming', async () => {
    vi.mocked(window.electronApi.addVideoCoin).mockImplementation(() => new Promise(() => {}))
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u6295\u5e01\u4e2d...')).toBeInTheDocument()
  })

  it('should close when backdrop clicked', () => {
    render(<CoinModal {...defaultProps} />)
    const backdrop = screen.getByText('\u7ed9UP\u4e3b\u6295\u5e01').closest('.fixed')
    fireEvent.click(backdrop!)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('should render without aid', async () => {
    render(<CoinModal {...defaultProps} aid={undefined} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(window.electronApi.addVideoCoin).toHaveBeenCalledWith('BV1xx', undefined, 1, false)
    })
  })

  it('should show error from catch block when addVideoCoin throws', async () => {
    vi.mocked(window.electronApi.addVideoCoin).mockRejectedValue(new Error('Network error'))
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u6295\u5e01\u8bf7\u6c42\u5f02\u5e38')).toBeInTheDocument()
  })

  it('should disable confirm button when saving', async () => {
    vi.mocked(window.electronApi.addVideoCoin).mockImplementation(() => new Promise(() => {}))
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    await waitFor(() => {
      expect(screen.getByText('\u6295\u5e01\u4e2d...').closest('button')).toBeDisabled()
    })
  })

  it('should call onClose when close button clicked', () => {
    render(<CoinModal {...defaultProps} />)
    const closeBtn = screen.getByText('\u2715')
    fireEvent.click(closeBtn)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('should show default error when result.error is empty', async () => {
    vi.mocked(window.electronApi.addVideoCoin).mockResolvedValue({ success: false, error: '' })
    render(<CoinModal {...defaultProps} />)
    fireEvent.click(screen.getByText('\u786e\u5b9a'))
    expect(await screen.findByText('\u6295\u5e01\u5931\u8d25')).toBeInTheDocument()
  })
})
