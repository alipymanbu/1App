import { useEffect, useState } from 'react'
import type { StorageSettings } from '../../../shared/types'

interface SettingsModalProps {
  onClose: () => void
}

type SettingsTab = 'storage' | 'about' | 'diagnostics'

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('storage')
  const [settings, setSettings] = useState<StorageSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [logAction, setLogAction] = useState('')
  const [logDirPath, setLogDirPath] = useState('')

  useEffect(() => {
    window.electronApi.getStorageSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (tab === 'diagnostics') {
      window.electronApi.getLogDir().then(setLogDirPath).catch(() => {})
    }
  }, [tab])

  const handleChooseDir = async () => {
    setMigrating(true)
    setStatus(null)
    try {
      const s = await window.electronApi.chooseDataRoot()
      setSettings(s)
      if (s.restartRequired) {
        setStatus({ type: 'success', msg: '数据已迁移到新目录，重启后生效。' })
      } else if (s.error) {
        setStatus({ type: 'error', msg: s.error })
      }
    } catch {
      setStatus({ type: 'error', msg: '操作失败，请重试' })
    } finally {
      setMigrating(false)
    }
  }

  const handleResetDir = async () => {
    setMigrating(true)
    setStatus(null)
    try {
      const s = await window.electronApi.resetDataRoot()
      setSettings(s)
      if (s.restartRequired) {
        setStatus({ type: 'success', msg: '数据已恢复到默认目录，重启后生效。' })
      } else if (s.error) {
        setStatus({ type: 'error', msg: s.error })
      }
    } catch {
      setStatus({ type: 'error', msg: '重置失败，请重试' })
    } finally {
      setMigrating(false)
    }
  }

  const handleClearCache = async () => {
    setClearing(true)
    setStatus(null)
    try {
      await window.electronApi.clearVideoCache()
      setStatus({ type: 'success', msg: '视频缓存已清理完成' })
    } catch {
      setStatus({ type: 'error', msg: '清理缓存失败' })
    } finally {
      setClearing(false)
    }
  }

  const handleRestart = async () => {
    await window.electronApi.restartApp()
  }

  const needsRestart = settings?.restartRequired ?? false

  const handleOpenLogDir = async () => {
    try {
      await window.electronApi.openLogDir()
    } catch {}
  }

  const handleExportLogs = async () => {
    setLogAction('export')
    try {
      const dir = await window.electronApi.exportLogs()
      if (dir) {
        setStatus({ type: 'success', msg: `诊断包已导出至: ${dir}` })
      } else {
        setStatus({ type: 'error', msg: '导出失败' })
      }
    } catch {
      setStatus({ type: 'error', msg: '导出失败' })
    } finally {
      setLogAction('')
    }
  }

  const handleClearLogs = async () => {
    setLogAction('clear')
    try {
      await window.electronApi.clearLogs()
      setStatus({ type: 'success', msg: '日志已清除' })
    } catch {
      setStatus({ type: 'error', msg: '清除失败' })
    } finally {
      setLogAction('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-[520px] max-w-[90vw] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">设置</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('storage')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'storage'
                ? 'text-[#00A1D6] border-b-2 border-[#00A1D6]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            数据与缓存
          </button>
          <button
            onClick={() => setTab('diagnostics')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'diagnostics'
                ? 'text-[#00A1D6] border-b-2 border-[#00A1D6]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            日志与诊断
          </button>
          <button
            onClick={() => setTab('about')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
              tab === 'about'
                ? 'text-[#00A1D6] border-b-2 border-[#00A1D6]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            关于
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {tab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">数据根目录</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-all font-mono text-xs">
                  {loading ? '加载中...' : settings?.dataRoot || '-'}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">应用数据实际位置</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-all font-mono text-xs">
                  {loading ? '加载中...' : settings?.actualDataDir || '-'}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">视频缓存位置</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-all font-mono text-xs">
                  {loading ? '加载中...' : settings?.videoCacheDir || '-'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleChooseDir}
                  disabled={loading || migrating || clearing}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#00A1D6] text-white hover:bg-[#00B5E5] disabled:opacity-50 transition-colors"
                >
                  {migrating ? '迁移中...' : '选择数据与缓存目录'}
                </button>
                <button
                  onClick={handleResetDir}
                  disabled={loading || migrating || clearing || settings?.isDefault}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  恢复默认目录
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={loading || clearing || migrating}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {clearing ? '清理中...' : '清理视频缓存'}
                </button>
              </div>

              {needsRestart && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-3 space-y-2">
                  <p className="text-xs text-blue-700">
                    数据目录已切换，需要重启应用才能生效。
                  </p>
                  <button
                    onClick={handleRestart}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    立即重启
                  </button>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700">
                  切换目录会迁移登录状态、用户资料、设置和视频缓存到新位置。迁移完成后需要重启应用，重启后所有读写都会使用新目录。
                </p>
              </div>

              {status && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs ${
                    status.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {status.msg}
                </div>
              )}
            </div>
          )}

          {tab === 'diagnostics' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">日志目录</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-all font-mono text-xs">
                  {logDirPath || '加载中...'}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleOpenLogDir}
                  disabled={!!logAction}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[#00A1D6] text-white hover:bg-[#00B5E5] disabled:opacity-50 transition-colors"
                >
                  打开日志目录
                </button>
                <button
                  onClick={handleExportLogs}
                  disabled={!!logAction}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {logAction === 'export' ? '导出中...' : '导出诊断包'}
                </button>
                <button
                  onClick={handleClearLogs}
                  disabled={!!logAction}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {logAction === 'clear' ? '清除中...' : '清除日志'}
                </button>
              </div>

              {status && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs ${
                    status.type === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {status.msg}
                </div>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white text-lg font-bold shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">1App</h3>
                  <p className="text-xs text-gray-400">版本 1.0.0</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  1App 是一款多平台内容聚合与浏览工具，支持在桌面端集中查看和播放各平台内容。
                </p>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">当前支持平台</h4>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 text-xs rounded-full bg-red-50 text-red-600">小红书</span>
                    <span className="px-2.5 py-1 text-xs rounded-full bg-sky-50 text-sky-600">B站</span>
                    <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600">抖音</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">播放能力</h4>
                  <p className="text-xs text-gray-500">
                    B站视频支持内置 DASH 播放，提供清晰度切换和本地缓存功能。视频缓存可自定义目录，避免占用系统盘空间。
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    平台登录信息仅保存在本地。各平台会话隔离，Cookie 独立存储。所有缓存数据仅用于加速播放，不会被上传或分享。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
