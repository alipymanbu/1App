import { useState, useCallback } from 'react'

interface CoinModalProps {
  bvid: string
  aid?: string
  onClose: () => void
  onSuccess: () => void
}

export function CoinModal({ bvid, aid, onClose, onSuccess }: CoinModalProps) {
  const [multiply, setMultiply] = useState(1)
  const [selectLike, setSelectLike] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const result = await window.electronApi.addVideoCoin(bvid, aid, multiply, selectLike)
      if (!result.success) {
        setError(result.error || '投币失败')
        setSaving(false)
        return
      }
      onSuccess()
      onClose()
    } catch {
      setError('投币请求异常')
      setSaving(false)
    }
  }, [bvid, aid, multiply, selectLike, onClose, onSuccess])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800">给UP主投币</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-center gap-4 mb-5">
            <button
              onClick={() => setMultiply(1)}
              className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center transition-colors ${
                multiply === 1
                  ? 'border-[#00A1D6] bg-[#00A1D6]/10 text-[#00A1D6]'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-lg font-bold">1</span>
              <span className="text-[10px]">硬币</span>
            </button>
            <button
              onClick={() => setMultiply(2)}
              className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center transition-colors ${
                multiply === 2
                  ? 'border-[#00A1D6] bg-[#00A1D6]/10 text-[#00A1D6]'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-lg font-bold">2</span>
              <span className="text-[10px]">硬币</span>
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={selectLike}
              onChange={e => setSelectLike(e.target.checked)}
              className="accent-[#00A1D6]"
            />
            <span className="text-sm text-gray-600">同时点赞内容</span>
          </label>

          {error && (
            <div className="text-red-400 text-xs text-center mb-3">{error}</div>
          )}

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full py-2 text-sm rounded bg-[#00A1D6] text-white disabled:opacity-40 hover:bg-[#00B5E5] transition-colors"
          >
            {saving ? '投币中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
