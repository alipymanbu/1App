// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '../../../../src/renderer/src/components/Pagination'

describe('Pagination', () => {
  const defaultProps = { page: 1, pageSize: 10, total: 50, loading: false, onPageChange: vi.fn() }

  it('should render pagination info', () => {
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText('\u4e0a\u4e00\u9875')).toBeInTheDocument()
    expect(screen.getByText('\u4e0b\u4e00\u9875')).toBeInTheDocument()
  })

  it('should disable prev button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />)
    expect(screen.getByText('\u4e0a\u4e00\u9875').closest('button')).toBeDisabled()
  })

  it('should disable next button on last page', () => {
    render(<Pagination {...defaultProps} page={5} total={50} />)
    expect(screen.getByText('\u4e0b\u4e00\u9875').closest('button')).toBeDisabled()
  })

  it('should enable both buttons on middle page', () => {
    render(<Pagination {...defaultProps} page={3} total={50} />)
    expect(screen.getByText('\u4e0a\u4e00\u9875').closest('button')).not.toBeDisabled()
    expect(screen.getByText('\u4e0b\u4e00\u9875').closest('button')).not.toBeDisabled()
  })

  it('should show page number buttons', () => {
    render(<Pagination {...defaultProps} total={100} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should call onPageChange with prev page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={50} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('\u4e0a\u4e00\u9875'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('should call onPageChange with next page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={50} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('\u4e0b\u4e00\u9875'))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('should call onPageChange with specific page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} total={100} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByText('5'))
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it('should disable buttons when loading', () => {
    render(<Pagination {...defaultProps} page={3} total={50} loading={true} />)
    expect(screen.getByText('\u4e0a\u4e00\u9875').closest('button')).toBeDisabled()
    expect(screen.getByText('\u4e0b\u4e00\u9875').closest('button')).toBeDisabled()
  })

  it('should not render when total is 0', () => {
    const { container } = render(<Pagination {...defaultProps} total={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('should handle single page (total <= pageSize)', () => {
    const { container } = render(<Pagination {...defaultProps} total={5} />)
    expect(container.innerHTML).toBe('')
  })

  it('should filter non-digit input in jump field', () => {
    render(<Pagination {...defaultProps} total={100} />)
    const input = screen.getByPlaceholderText('页') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input.value).toBe('')
  })

  it('should update jump value with digit input', () => {
    render(<Pagination {...defaultProps} total={100} />)
    const input = screen.getByPlaceholderText('页') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    expect(input.value).toBe('5')
  })

  it('should call onPageChange when jumping to valid page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.click(screen.getByText('跳转'))
    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it('should not jump when page exceeds totalPages', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.click(screen.getByText('跳转'))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('should not jump when page equals current page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByText('跳转'))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('should jump on Enter key press', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.change(input, { target: { value: '7' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPageChange).toHaveBeenCalledWith(7)
  })

  it('should disable jump input and button when loading', () => {
    render(<Pagination {...defaultProps} page={3} total={100} loading={true} />)
    expect(screen.getByPlaceholderText('页')).toBeDisabled()
    expect(screen.getByText('跳转').closest('button')).toBeDisabled()
  })

  it('should disable jump button when no input', () => {
    render(<Pagination {...defaultProps} page={3} total={100} />)
    expect(screen.getByText('跳转').closest('button')).toBeDisabled()
  })

  it('should render ellipsis for large page counts', () => {
    render(<Pagination {...defaultProps} page={1} total={200} />)
    expect(screen.getByText('...')).toBeInTheDocument()
  })

  it('should show correct pages when near end', () => {
    render(<Pagination {...defaultProps} page={18} total={200} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('should handle negative total safely', () => {
    const { container } = render(<Pagination {...defaultProps} total={-1} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render ellipsis for middle page range', () => {
    render(<Pagination {...defaultProps} page={6} total={120} />)
    expect(screen.getAllByText('...').length).toBe(2)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('should not jump on Enter when input is empty', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('should not jump when input is 0', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} total={100} onPageChange={onPageChange} />)
    const input = screen.getByPlaceholderText('页')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByText('跳转'))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('should not update input with non-digit characters', () => {
    render(<Pagination {...defaultProps} page={3} total={100} />)
    const input = screen.getByPlaceholderText('页') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12a' } })
    expect(input.value).toBe('')
  })

  it('should handle pageSize of 0 safely by defaulting to 10', () => {
    render(<Pagination {...defaultProps} pageSize={0} total={100} />)
    expect(screen.getByText('共 10 页 / 100 个')).toBeInTheDocument()
  })

  it('should handle Infinity total safely', () => {
    const { container } = render(<Pagination {...defaultProps} total={Infinity} />)
    expect(container.innerHTML).toBe('')
  })

  it('should handle NaN total safely', () => {
    const { container } = render(<Pagination {...defaultProps} total={NaN} />)
    expect(container.innerHTML).toBe('')
  })
})
