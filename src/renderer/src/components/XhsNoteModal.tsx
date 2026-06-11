import { useState, useEffect } from 'react'
import type { FeedItem, XhsNoteDetail } from '../../../shared/types'

interface XhsNoteModalProps {
  item: FeedItem
  onClose: () => void
}

function formatCount(n?: number): string {
  if (n === undefined || n === null) return ''
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function XhsNoteModal({ item, onClose }: XhsNoteModalProps) {
  const [detail, setDetail] = useState<XhsNoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const noteId = item.id.replace('xhs-', '')

  useEffect(() => {
    setLoading(true)
    setError('')
    window.electronApi.getXhsNoteDetail(noteId, item.url).then((result) => {
      if (result) {
        setDetail(result)
      } else {
        setError('无法加载笔记详情')
      }
    }).catch(() => {
      setError('加载失败')
    }).finally(() => {
      setLoading(false)
    })
  }, [noteId])

  const images = detail?.images?.length ? detail.images : (item.cover ? [item.cover] : [])
  const type = detail?.type || item.mediaType || 'unknown'
  const authorName = detail?.author?.nickname || item.author
  const avatar = detail?.author?.avatar || item.avatar || ''
  const stats = detail?.stats || item.stats
  const title = detail?.title || item.title || ''
  const desc = detail?.desc || ''
  const video = detail?.video
  const collect = detail?.stats?.collect

  useEffect(() => {
    setCurrentImageIndex(0)
  }, [images.length])

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-w-[1120px] w-[95vw] max-h-[90vh] h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Media */}
        <div className="md:w-[56%] w-full bg-gray-50 relative flex items-center justify-center min-h-[280px] md:min-h-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
            </div>
          ) : type === 'video' ? (
            video?.url ? (
              <video
                src={video.url}
                poster={video.poster || item.cover}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-black/5">
                {item.cover ? (
                  <img src={item.cover} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-gray-300 text-4xl">🎬</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
                  </div>
                </div>
                <div className="absolute top-3 right-3 bg-black/50 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                  视频
                </div>
              </div>
            )
          ) : images.length > 0 ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                key={currentImageIndex}
                src={images[currentImageIndex]}
                alt=""
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow text-lg text-gray-600"
                  >
                    ‹
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow text-lg text-gray-600"
                  >
                    ›
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.slice(0, 10).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${i === currentImageIndex ? 'bg-white' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-300 text-4xl">📕</div>
          )}
        </div>

        {/* Right: Content */}
        <div className="md:w-[44%] w-full flex flex-col bg-white">
          {/* Author bar */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            {avatar ? (
              <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-500 shrink-0">
                {(authorName || '?').charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{authorName || '未知用户'}</div>
            </div>
            <button className="px-4 py-1.5 text-xs font-medium rounded-full bg-[#ff2442] text-white hover:bg-[#e01e38] transition-colors shrink-0">
              关注
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <div className="h-5 bg-gray-100 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
                <div className="space-y-2 mt-4">
                  <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-500">{error}</p>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => {
                          setLoading(true); setError('')
                          window.electronApi.getXhsNoteDetail(noteId, item.url).then((r) => {
                            if (r) setDetail(r); else setError('无法加载笔记详情')
                          }).catch(() => setError('加载失败')).finally(() => setLoading(false))
                        }}
                        className="px-4 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        重试
                      </button>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          查看原文
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Title */}
                {title && (
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
                )}

                {/* Description */}
                {desc && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{desc}</p>
                )}

                {/* Stats */}
                {stats && (stats.like !== undefined || stats.comment !== undefined || collect !== undefined) && (
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
                    {stats.like !== undefined && <span>👍 {formatCount(stats.like)}</span>}
                    {stats.comment !== undefined && <span>💬 {formatCount(stats.comment)}</span>}
                    {collect !== undefined && <span>📌 {formatCount(collect)}</span>}
                  </div>
                )}

                {/* Comments */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    评论 {stats?.comment ? `(${stats.comment >= 10000 ? `${(stats.comment / 10000).toFixed(1)}w` : stats.comment})` : ''}
                  </h3>
                  {detail?.comments && detail.comments.length > 0 ? (
                    <div className="space-y-3">
                      {detail.comments.slice(0, 10).map((c) => (
                        <div key={c.id} className="flex gap-2.5">
                          {c.avatar ? (
                            <img src={c.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 shrink-0 mt-0.5">
                              {c.nickname.charAt(0) || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-700">{c.nickname}</div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-6">暂无评论</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-around shrink-0">
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-[#ff2442] transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span className="text-[10px]">{stats?.like !== undefined ? formatCount(stats.like) : '赞'}</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-[#ff2442] transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span className="text-[10px]">{stats?.comment !== undefined ? formatCount(stats.comment) : '评'}</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-[#ff2442] transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <span className="text-[10px]">{stats?.share !== undefined ? formatCount(stats.share) : '转发'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 left-5 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition-colors z-10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  )
}
