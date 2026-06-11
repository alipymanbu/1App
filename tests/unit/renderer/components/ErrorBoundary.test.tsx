// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../../../../src/renderer/src/components/ErrorBoundary'

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render children when no error', () => {
    render(<ErrorBoundary><div>Test Content</div></ErrorBoundary>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should catch render errors and show fallback', () => {
    const ThrowError = () => { throw new Error('Test error') }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    expect(screen.getByText('应用出现异常')).toBeInTheDocument()
  })

  it('should show error message when available', () => {
    const ThrowError = () => { throw new Error('Something went wrong!') }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument()
  })

  it('should show unknown error when error has no message', () => {
    const ThrowError = () => { throw new Error() }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    expect(screen.getByText('未知错误')).toBeInTheDocument()
  })

  it('should reset state when retry button is clicked', () => {
    let shouldThrow = true
    const ConditionalThrow = () => {
      if (shouldThrow) throw new Error('Retry test')
      return <div>Recovered</div>
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ConditionalThrow /></ErrorBoundary>)
    expect(screen.getByText('应用出现异常')).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByText('重试渲染'))
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('should reload page when refresh button is clicked', () => {
    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      writable: true
    })

    const ThrowError = () => { throw new Error('Refresh test') }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    fireEvent.click(screen.getByText('刷新页面'))
    expect(reload).toHaveBeenCalled()

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    })
  })

  it('should log error via logRenderer in componentDidCatch', () => {
    const ThrowError = () => { throw new Error('Log test') }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    expect(window.electronApi.logRenderer).toHaveBeenCalledWith({
      level: 'error',
      message: 'Log test',
      stack: expect.any(String),
      context: 'error-boundary'
    })
  })

  it('should render error UI with correct styling elements', () => {
    const ThrowError = () => { throw new Error('UI test') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<ErrorBoundary><ThrowError /></ErrorBoundary>)
    expect(screen.getByText('应用出现异常')).toBeInTheDocument()
    expect(screen.getByText('刷新页面')).toBeInTheDocument()
    expect(screen.getByText('重试渲染')).toBeInTheDocument()
  })
})

