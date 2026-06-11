import { useEffect, useRef, useState, useCallback } from 'react'
import type { FavoriteFolderSelection } from '../../../shared/types'

interface FavoriteModalProps {
  aid: string
  bvid?: string
  onClose: () => void
  onSuccess: (bvid?: string, aid?: string) => void
  onFoldersChanged?: () => void
}

export function FavoriteModal({ aid, bvid, onClose, onSuccess, onFoldersChanged }: FavoriteModalProps) {
  const [folders, setFolders] = useState<FavoriteFolderSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const initialChecked = useRef<string[]>([])

  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderTitle, setNewFolderTitle] = useState('')
  const [createError, setCreateError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const result = await window.electronApi.getVideoFavoriteFolders(aid)
        initialChecked.current = result.filter(f => f.checked).map(f => f.id)
        setFolders(result)
      } catch {
        setError('获取收藏夹失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [aid])

  useEffect(() => {
    if (creatingFolder && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingFolder])

  const toggleFolder = useCallback((id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f))
  }, [])

  const hasChanges = (() => {
    const currentIds = folders.filter(f => f.checked).map(f => f.id)
    const initialIds = initialChecked.current
    if (currentIds.length !== initialIds.length) return true
    return currentIds.some(id => !initialIds.includes(id))
  })()

  const handleConfirm = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      const currentIds = folders.filter(f => f.checked).map(f => f.id)
      const initialIds = initialChecked.current
      const addIds = currentIds.filter(id => !initialIds.includes(id))
      const delIds = initialIds.filter(id => !currentIds.includes(id))

      if (addIds.length === 0 && delIds.length === 0) {
        onClose()
        return
      }

      const result = await window.electronApi.updateVideoFavoriteFolders(aid, addIds, delIds)
      if (!result.success) {
        setError(result.error || '收藏更新失败')
        setSaving(false)
        return
      }
      onFoldersChanged?.()
      onSuccess(bvid, aid)
      onClose()
    } catch {
      setError('收藏请求异常')
      setSaving(false)
    }
  }, [folders, aid, bvid, onClose, onSuccess, onFoldersChanged])

  const handleCreate = useCallback(async () => {
    const trimmed = newFolderTitle.trim()
    if (!trimmed) {
      setCreateError('请输入收藏夹名称')
      return
    }
    if (trimmed.length > 20) {
      setCreateError('收藏夹名称最多20个字')
      return
    }

    setIsCreating(true)
    setCreateError('')
    try {
      const result = await window.electronApi.createFavoriteFolder(trimmed)
      if (!result.success) {
        setCreateError(result.error || '创建失败')
        setIsCreating(false)
        return
      }
      const created = result.folder
      if (created) {
        setFolders(prev => [...prev, created])
      }
      setNewFolderTitle('')
      setCreatingFolder(false)
      setIsCreating(false)
      onFoldersChanged?.()
    } catch {
      setCreateError('创建请求异常')
      setIsCreating(false)
    }
  }, [newFolderTitle, onFoldersChanged])

  const handleCancelCreate = useCallback(() => {
    setCreatingFolder(false)
    setNewFolderTitle('')
    setCreateError('')
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-800">收藏到</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
        </div>
        <div className="p-4 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="text-gray-400 text-sm text-center py-4">加载中...</div>
          ) : error ? (
            <div className="text-red-400 text-sm text-center py-4">{error}</div>
          ) : (
            <>
              {folders.length === 0 && !creatingFolder ? (
                <div className="text-gray-400 text-sm text-center py-4">没有创建任何收藏夹</div>
              ) : (
                <div className="space-y-1 mb-3">
                  {folders.map(f => (
                    <label key={f.id} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={f.checked}
                        onChange={() => toggleFolder(f.id)}
                        className="accent-[#00A1D6]"
                      />
                      <span className="text-sm text-gray-700 flex-1 truncate">{f.title}</span>
                      {f.count !== undefined && (
                        <span className="text-xs text-gray-400 shrink-0">{f.count}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {creatingFolder ? (
                <div className="border-t border-gray-100 pt-3 mt-1">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newFolderTitle}
                      onChange={e => setNewFolderTitle(e.target.value.slice(0, 20))}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                      placeholder="最多可输入20个字"
                      className="flex-1 bg-gray-50 border border-[#00A1D6] rounded text-sm text-gray-800 px-2 py-1.5 outline-none placeholder-gray-300"
                      disabled={isCreating}
                    />
                    <button
                      onClick={handleCreate}
                      disabled={isCreating || !newFolderTitle.trim()}
                      className="px-3 py-1.5 text-xs rounded bg-[#00A1D6] text-white disabled:opacity-40 hover:bg-[#00B5E5] transition-colors shrink-0"
                    >
                      {isCreating ? '创建中...' : '新建'}
                    </button>
                  </div>
                  {createError && (
                    <div className="text-red-400 text-xs mt-1.5">{createError}</div>
                  )}
                  {!isCreating && (
                    <button onClick={handleCancelCreate} className="text-xs text-gray-400 hover:text-gray-600 mt-1.5">
                      取消
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setCreatingFolder(true)}
                  className="w-full text-left text-sm text-[#00A1D6] hover:text-[#00B5E5] py-1.5 px-2 rounded hover:bg-gray-50 transition-colors"
                >
                  + 新建收藏夹
                </button>
              )}
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          {saving && <span className="text-xs text-gray-400">保存中...</span>}
          <div className="flex-1" />
          <button
            onClick={handleConfirm}
            disabled={!hasChanges || saving || loading}
            className="px-4 py-1.5 text-xs rounded bg-[#00A1D6] text-white disabled:opacity-40 hover:bg-[#00B5E5] transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
