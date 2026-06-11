import { useState } from 'react'
import type { PlatformId } from '../../../shared/types'
import { PLATFORMS } from '../../../shared/constants'

interface LoginViewProps {
  platform: PlatformId
  onLogin: () => void
}

export function LoginView({ platform, onLogin }: LoginViewProps) {
  const [loading, setLoading] = useState(false)
  const info = PLATFORMS.find((p) => p.id === platform)

  const handleLogin = async () => {
    setLoading(true)
    try {
      await onLogin()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mb-6"
        style={{
          backgroundColor: info ? `${info.color}12` : '#f3f4f6'
        }}
      >
        {info?.icon || '🔗'}
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        登录 {info?.name || '平台'}
      </h2>

      <p className="text-sm text-gray-400 text-center max-w-xs mb-8 leading-relaxed">
        点击下方按钮，在弹出的窗口中扫描二维码登录。
        <br />
        登录状态将长期保存，下次启动无需重复登录。
      </p>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-8 py-3 rounded-xl text-sm font-medium text-white 
                   shadow-sm hover:shadow-md active:scale-[0.98] 
                   transition-all duration-200 disabled:opacity-60"
        style={{ backgroundColor: info?.color || '#111827' }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            正在打开...
          </span>
        ) : (
          '打开扫码登录'
        )}
      </button>
    </div>
  )
}
