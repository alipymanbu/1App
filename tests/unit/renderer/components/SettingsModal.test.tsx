// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '../../../../src/renderer/src/components/SettingsModal'

describe('SettingsModal', () => {
  const mockSettings = {
    dataRoot: 'C:\\Users\\Test\\1App',
    defaultDataRoot: 'C:\\Users\\Test\\AppData\\Roaming\\1App',
    actualDataDir: 'C:\\Users\\Test\\1App\\data',
    videoCacheDir: 'C:\\Users\\Test\\1App\\cache',
    isDefault: false,
    restartRequired: false
  }

  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.electronApi.getStorageSettings).mockResolvedValue(mockSettings)
    vi.mocked(window.electronApi.chooseDataRoot).mockResolvedValue(mockSettings)
    vi.mocked(window.electronApi.resetDataRoot).mockResolvedValue(mockSettings)
    vi.mocked(window.electronApi.clearVideoCache).mockResolvedValue(undefined)
    vi.mocked(window.electronApi.getLogDir).mockResolvedValue('C:\\Users\\Test\\1App\\logs')
    vi.mocked(window.electronApi.openLogDir).mockResolvedValue(undefined)
    vi.mocked(window.electronApi.exportLogs).mockResolvedValue('C:\\Users\\Test\\1App\\logs\\diagnostics.zip')
    vi.mocked(window.electronApi.clearLogs).mockResolvedValue(undefined)
    vi.mocked(window.electronApi.restartApp).mockResolvedValue(undefined)
  })

  it('should render modal title', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('\u8bbe\u7f6e')).toBeInTheDocument()
  })

  it('should show storage tab by default', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')).toBeInTheDocument()
  })

  it('should render all three tab buttons', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')).toBeInTheDocument()
    expect(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad')).toBeInTheDocument()
    expect(screen.getByText('\u5173\u4e8e')).toBeInTheDocument()
  })

  it('should highlight storage tab by default', async () => {
    render(<SettingsModal onClose={onClose} />)
    const storageTab = await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    expect(storageTab.className).toContain('text-[#00A1D6]')
  })

  it('should show data root after settings loaded', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('C:\\Users\\Test\\1App')).toBeInTheDocument()
  })

  it('should show actual data directory', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('C:\\Users\\Test\\1App\\data')).toBeInTheDocument()
  })

  it('should show video cache directory', async () => {
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('C:\\Users\\Test\\1App\\cache')).toBeInTheDocument()
  })

  it('should call chooseDataRoot when button clicked', async () => {
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.chooseDataRoot).toHaveBeenCalledOnce()
    })
  })

  it('should call resetDataRoot when button clicked', async () => {
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.resetDataRoot).toHaveBeenCalledOnce()
    })
  })

  it('should call clearVideoCache when button clicked', async () => {
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6e05\u7406\u89c6\u9891\u7f13\u5b58')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.clearVideoCache).toHaveBeenCalledOnce()
    })
  })

  it('should show migrating state when choosing directory', async () => {
    vi.mocked(window.electronApi.chooseDataRoot).mockImplementation(() => new Promise(() => {}))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText('\u8fc1\u79fb\u4e2d...')).toBeInTheDocument()
  })

  it('should show clearing state when clearing cache', async () => {
    vi.mocked(window.electronApi.clearVideoCache).mockImplementation(() => new Promise(() => {}))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6e05\u7406\u89c6\u9891\u7f13\u5b58')
    fireEvent.click(btn)
    expect(await screen.findByText('\u6e05\u7406\u4e2d...')).toBeInTheDocument()
  })

  it('should show success status after clear cache', async () => {
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6e05\u7406\u89c6\u9891\u7f13\u5b58')
    fireEvent.click(btn)
    expect(await screen.findByText('\u89c6\u9891\u7f13\u5b58\u5df2\u6e05\u7406\u5b8c\u6210')).toBeInTheDocument()
  })

  it('should switch to diagnostics tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(await screen.findByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    expect(await screen.findByText('C:\\Users\\Test\\1App\\logs')).toBeInTheDocument()
  })

  it('should highlight diagnostics tab when active', async () => {
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(await screen.findByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const diagTab = screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad')
    expect(diagTab.className).toContain('text-[#00A1D6]')
  })

  it('should call openLogDir in diagnostics tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u6253\u5f00\u65e5\u5fd7\u76ee\u5f55')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.openLogDir).toHaveBeenCalledOnce()
    })
  })

  it('should call exportLogs in diagnostics tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u5bfc\u51fa\u8bca\u65ad\u5305')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.exportLogs).toHaveBeenCalledOnce()
    })
  })

  it('should show export success status', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u5bfc\u51fa\u8bca\u65ad\u5305')
    fireEvent.click(btn)
    expect(await screen.findByText(/diagnostics/)).toBeInTheDocument()
  })

  it('should call clearLogs in diagnostics tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u6e05\u9664\u65e5\u5fd7')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.clearLogs).toHaveBeenCalledOnce()
    })
  })

  it('should show clear logs success status', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u6e05\u9664\u65e5\u5fd7')
    fireEvent.click(btn)
    expect(await screen.findByText('\u65e5\u5fd7\u5df2\u6e05\u9664')).toBeInTheDocument()
  })

  it('should switch to about tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(await screen.findByText('\u5173\u4e8e'))
    expect(screen.getByText('1App')).toBeInTheDocument()
  })

  it('should show version in about tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(await screen.findByText('\u5173\u4e8e'))
    expect(screen.getByText('\u7248\u672c 1.0.0')).toBeInTheDocument()
  })

  it('should show app description in about tab', async () => {
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(await screen.findByText('\u5173\u4e8e'))
    const matches = screen.getAllByText(/1App/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('should show restart prompt when restartRequired is true', async () => {
    vi.mocked(window.electronApi.getStorageSettings).mockResolvedValue({
      ...mockSettings,
      restartRequired: true
    })
    render(<SettingsModal onClose={onClose} />)
    expect(await screen.findByText('\u7acb\u5373\u91cd\u542f')).toBeInTheDocument()
  })

  it('should call restartApp when restart button clicked', async () => {
    vi.mocked(window.electronApi.getStorageSettings).mockResolvedValue({
      ...mockSettings,
      restartRequired: true
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u7acb\u5373\u91cd\u542f')
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.electronApi.restartApp).toHaveBeenCalledOnce()
    })
  })

  it('should show migration success status when chooseDataRoot returns restartRequired', async () => {
    vi.mocked(window.electronApi.chooseDataRoot).mockResolvedValue({
      ...mockSettings,
      restartRequired: true
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText(/\u6570\u636e\u5df2\u8fc1\u79fb/)).toBeInTheDocument()
  })

  it('should show reset success status when resetDataRoot returns restartRequired', async () => {
    vi.mocked(window.electronApi.resetDataRoot).mockResolvedValue({
      ...mockSettings,
      restartRequired: true
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText(/\u6570\u636e\u5df2\u6062\u590d/)).toBeInTheDocument()
  })

  it('should close modal when close button clicked', async () => {
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u8bbe\u7f6e')
    const svg = document.querySelector('svg')
    const closeBtn = svg?.closest('button')
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should disable action buttons when already clearing', async () => {
    vi.mocked(window.electronApi.clearVideoCache).mockImplementation(() => new Promise(() => {}))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6e05\u7406\u89c6\u9891\u7f13\u5b58')
    fireEvent.click(btn)
    expect(screen.getByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55').closest('button')).toBeDisabled()
    expect(screen.getByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55').closest('button')).toBeDisabled()
  })

  it('should show error when chooseDataRoot returns error', async () => {
    vi.mocked(window.electronApi.chooseDataRoot).mockResolvedValue({
      ...mockSettings, restartRequired: false, error: '\u76ee\u6807\u76ee\u5f55\u4e0d\u53ef\u5199'
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText('\u76ee\u6807\u76ee\u5f55\u4e0d\u53ef\u5199')).toBeInTheDocument()
  })

  it('should show error when chooseDataRoot throws', async () => {
    vi.mocked(window.electronApi.chooseDataRoot).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u9009\u62e9\u6570\u636e\u4e0e\u7f13\u5b58\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText('\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5')).toBeInTheDocument()
  })

  it('should show error when resetDataRoot throws', async () => {
    vi.mocked(window.electronApi.resetDataRoot).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText('\u91cd\u7f6e\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5')).toBeInTheDocument()
  })

  it('should show error when clearVideoCache throws', async () => {
    vi.mocked(window.electronApi.clearVideoCache).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6e05\u7406\u89c6\u9891\u7f13\u5b58')
    fireEvent.click(btn)
    expect(await screen.findByText('\u6e05\u7406\u7f13\u5b58\u5931\u8d25')).toBeInTheDocument()
  })

  it('should disable reset button when isDefault', async () => {
    vi.mocked(window.electronApi.getStorageSettings).mockResolvedValue({
      ...mockSettings, isDefault: true
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55')
    expect(btn.closest('button')).toBeDisabled()
  })

  it('should show error when exportLogs returns null', async () => {
    vi.mocked(window.electronApi.exportLogs).mockResolvedValue(null)
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u5bfc\u51fa\u8bca\u65ad\u5305')
    fireEvent.click(btn)
    expect(await screen.findByText('\u5bfc\u51fa\u5931\u8d25')).toBeInTheDocument()
  })

  it('should show error when exportLogs throws', async () => {
    vi.mocked(window.electronApi.exportLogs).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u5bfc\u51fa\u8bca\u65ad\u5305')
    fireEvent.click(btn)
    expect(await screen.findByText('\u5bfc\u51fa\u5931\u8d25')).toBeInTheDocument()
  })

  it('should show error when clearLogs throws', async () => {
    vi.mocked(window.electronApi.clearLogs).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    const btn = await screen.findByText('\u6e05\u9664\u65e5\u5fd7')
    fireEvent.click(btn)
    expect(await screen.findByText('\u6e05\u9664\u5931\u8d25')).toBeInTheDocument()
  })

  it('should show error when resetDataRoot returns error', async () => {
    vi.mocked(window.electronApi.resetDataRoot).mockResolvedValue({
      ...mockSettings, restartRequired: false, error: '\u6062\u590d\u5931\u8d25'
    })
    render(<SettingsModal onClose={onClose} />)
    const btn = await screen.findByText('\u6062\u590d\u9ed8\u8ba4\u76ee\u5f55')
    fireEvent.click(btn)
    expect(await screen.findByText('\u6062\u590d\u5931\u8d25')).toBeInTheDocument()
  })

  it('should handle getLogDir rejection silently', async () => {
    vi.mocked(window.electronApi.getLogDir).mockRejectedValue(new Error('fail'))
    render(<SettingsModal onClose={onClose} />)
    await screen.findByText('\u6570\u636e\u4e0e\u7f13\u5b58')
    fireEvent.click(screen.getByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad'))
    expect(await screen.findByText('\u65e5\u5fd7\u4e0e\u8bca\u65ad')).toBeInTheDocument()
  })
})
