// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginView } from '../../../../src/renderer/src/pages/LoginView'

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B' + '\u7ad9', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '\ud83d\udcfa' },
    { id: 'xhs', name: '\u5c0f\u7ea2\u4e66', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '\ud83d\udcd5' },
    { id: 'douyin', name: '\u6296\u97f3', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '\ud83c\udfb5' }
  ]
}))

describe('LoginView', () => {
  it('should render login button for bilibili', () => {
    const onLogin = vi.fn()
    render(<LoginView platform="bilibili" onLogin={onLogin} />)

    expect(screen.getByText('\u767b\u5f55 B' + '\u7ad9')).toBeInTheDocument()
    expect(screen.getByText('\u6253\u5f00\u626b\u7801\u767b\u5f55')).toBeInTheDocument()
  })

  it('should render login button for xhs', () => {
    const onLogin = vi.fn()
    render(<LoginView platform="xhs" onLogin={onLogin} />)

    expect(screen.getByText('\u767b\u5f55 \u5c0f\u7ea2\u4e66')).toBeInTheDocument()
  })

  it('should render login button for douyin', () => {
    const onLogin = vi.fn()
    render(<LoginView platform="douyin" onLogin={onLogin} />)

    expect(screen.getByText('\u767b\u5f55 \u6296\u97f3')).toBeInTheDocument()
  })

  it('should render unknown platform gracefully', () => {
    const onLogin = vi.fn()
    render(<LoginView platform={'unknown' as any} onLogin={onLogin} />)

    expect(screen.getByText('\u767b\u5f55 \u5e73\u53f0')).toBeInTheDocument()
  })

  it('should call onLogin when button clicked', async () => {
    const onLogin = vi.fn()
    render(<LoginView platform="bilibili" onLogin={onLogin} />)

    await fireEvent.click(screen.getByText('\u6253\u5f00\u626b\u7801\u767b\u5f55'))
    expect(onLogin).toHaveBeenCalled()
  })

  it('should show loading state during login', async () => {
    const onLogin = vi.fn(() => new Promise<void>(resolve => setTimeout(resolve, 100)))
    render(<LoginView platform="bilibili" onLogin={onLogin} />)

    await fireEvent.click(screen.getByText('\u6253\u5f00\u626b\u7801\u767b\u5f55'))
    expect(screen.getByText('\u6b63\u5728\u6253\u5f00...')).toBeInTheDocument()
  })

  it('should revert from loading after login completes', async () => {
    const onLogin = vi.fn(() => Promise.resolve())
    render(<LoginView platform="bilibili" onLogin={onLogin} />)

    await fireEvent.click(screen.getByText('\u6253\u5f00\u626b\u7801\u767b\u5f55'))
    await vi.waitFor(() => {
      expect(screen.queryByText('\u6b63\u5728\u6253\u5f00...')).not.toBeInTheDocument()
    })
  })
})
