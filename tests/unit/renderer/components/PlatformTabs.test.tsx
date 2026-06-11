// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let PlatformTabs: any

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'B' + '\u7ad9', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: '\ud83d\udcfa' },
    { id: 'xhs', name: '\u5c0f\u7ea2\u4e66', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: '\ud83d\udcd5' },
    { id: 'douyin', name: '\u6296\u97f3', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: '\ud83c\udfb5' }
  ]
}))

beforeAll(async () => {
  PlatformTabs = (await import('../../../../src/renderer/src/components/PlatformTabs')).PlatformTabs
})

describe('PlatformTabs', () => {
  const defaultProps = {
    selected: 'bilibili' as const,
    onSelect: vi.fn(),
    loginStates: { xhs: false, bilibili: true, douyin: false }
  }

  it('should render all three platform tabs', () => {
    render(<PlatformTabs {...defaultProps} />)
    expect(screen.getByText('B' + '\u7ad9')).toBeInTheDocument()
    expect(screen.getByText('\u5c0f\u7ea2\u4e66')).toBeInTheDocument()
    expect(screen.getByText('\u6296\u97f3')).toBeInTheDocument()
  })

  it('should call onSelect when tab clicked', () => {
    const onSelect = vi.fn()
    render(<PlatformTabs {...defaultProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('\u6296\u97f3'))
    expect(onSelect).toHaveBeenCalledWith('douyin')
  })

  it('should handle all platforms logged out', () => {
    render(<PlatformTabs {...defaultProps} loginStates={{ xhs: false, bilibili: false, douyin: false }} />)
    expect(screen.getByText('B' + '\u7ad9')).toBeInTheDocument()
  })
})
