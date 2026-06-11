// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../../../src/renderer/src/App'

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B' + '\u7ad9', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '\ud83d\udcfa' },
    { id: 'xhs', name: '\u5c0f\u7ea2\u4e66', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '\ud83d\udcd5' },
    { id: 'douyin', name: '\u6296\u97f3', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '\ud83c\udfb5' }
  ]
}))

describe('App', () => {
  beforeEach(() => {
    vi.mocked(window.electronApi.checkLogin).mockResolvedValue({ loggedIn: false, profile: null })
    vi.mocked(window.electronApi.onLoginStatusChanged).mockReturnValue(vi.fn())
  })

  it('should render header with app title', () => {
    render(<App />)
    expect(screen.getByText('1App')).toBeInTheDocument()
  })

  it('should render settings button', () => {
    render(<App />)
    expect(screen.getByTitle('\u8bbe\u7f6e')).toBeInTheDocument()
  })

  it('should render platform tabs', () => {
    render(<App />)
    expect(screen.getByText('B' + '\u7ad9')).toBeInTheDocument()
    expect(screen.getByText('\u5c0f\u7ea2\u4e66')).toBeInTheDocument()
    expect(screen.getByText('\u6296\u97f3')).toBeInTheDocument()
  })

  it('should render login view when logged out', () => {
    render(<App />)
    expect(screen.getByText('\u767b\u5f55 B' + '\u7ad9')).toBeInTheDocument()
  })

  it('should call checkLogin on mount', () => {
    render(<App />)
    expect(window.electronApi.checkLogin).toHaveBeenCalled()
  })
})
