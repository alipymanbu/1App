import { useEffect, useState, useCallback, useRef } from 'react'
import type { BiliVideoDetail, BiliVideoComment, BiliCommentRepliesResult } from '../../../shared/types'

interface BiliVideoSidePanelProps {
  bvid: string
  aid?: string
}

function formatPubdate(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatCount(n?: number): string {
  if (n == null) return ''
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function formatTimeAgo(ts?: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`
  return formatPubdate(ts)
}

export function BiliVideoSidePanel({ bvid, aid }: BiliVideoSidePanelProps) {
  const [detail, setDetail] = useState<BiliVideoDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [descExpanded, setDescExpanded] = useState(false)

  const [comments, setComments] = useState<BiliVideoComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState('')
  const [commentSort, setCommentSort] = useState<'hot' | 'time'>('hot')
  const [commentCursor, setCommentCursor] = useState<string | undefined>()
  const [hasMoreComments, setHasMoreComments] = useState(false)
  const [commentsTotal, setCommentsTotal] = useState<number | undefined>()
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set())
  const handleAvatarError = useCallback((id: string) => { setBrokenAvatars(prev => new Set(prev).add(id)) }, [])

  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [replySections, setReplySections] = useState<Record<string, { items: BiliVideoComment[]; page: number; hasMore: boolean; total?: number }>>({})
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({})
  const [replyError, setReplyError] = useState<Record<string, string>>({})
  const replyDataRef = useRef(replySections)
  useEffect(() => { replyDataRef.current = replySections }, [replySections])

  const loadDetail = useCallback(async () => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const result = await window.electronApi.getBiliVideoDetail(bvid, aid)
      if (result) {
        setDetail(result)
      } else {
        setDetailError('视频详情加载失败')
      }
    } catch {
      setDetailError('视频详情请求异常')
    } finally {
      setDetailLoading(false)
    }
  }, [bvid, aid])

  const loadComments = useCallback(async (reset = true) => {
    const targetAid = detail?.aid || aid || ''
    if (!targetAid) return
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const result = await window.electronApi.getBiliVideoComments(
        targetAid,
        commentSort,
        reset ? undefined : commentCursor,
        20
      )
      if (result.error) {
        setCommentsError(result.error)
      } else {
        setComments(prev => reset ? result.items : [...prev, ...result.items])
        setCommentCursor(result.cursor)
        setHasMoreComments(result.hasMore)
        setCommentsTotal(result.total)
      }
    } catch {
      setCommentsError('评论请求异常')
    } finally {
      setCommentsLoading(false)
    }
  }, [detail?.aid, aid, commentSort, commentCursor])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (detail?.aid || aid) {
      setCommentCursor(undefined)
      setComments([])
      setHasMoreComments(false)
      setCommentsTotal(undefined)
      setExpandedReplies(new Set())
      setReplySections({})
      setReplyLoading({})
      setReplyError({})
      loadComments(true)
    }
  }, [detail?.aid, aid, commentSort]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSortChange = useCallback((sort: 'hot' | 'time') => {
    if (sort !== commentSort) {
      setCommentSort(sort)
    }
  }, [commentSort])

  const handleLoadMore = useCallback(() => {
    if (!commentsLoading && hasMoreComments) {
      loadComments(false)
    }
  }, [commentsLoading, hasMoreComments, loadComments])

  const loadReplies = useCallback(async (rootRpid: string, page: number) => {
    const targetAid = detail?.aid || aid || ''
    if (!targetAid) return
    setReplyLoading(prev => ({ ...prev, [rootRpid]: true }))
    setReplyError(prev => { const n = { ...prev }; delete n[rootRpid]; return n })
    try {
      const result = await window.electronApi.getBiliCommentReplies(targetAid, rootRpid, page, 10)
      if (result.error) {
        setReplyError(prev => ({ ...prev, [rootRpid]: result.error || '回复加载失败' }))
      } else {
        setReplySections(prev => ({
          ...prev,
          [rootRpid]: { items: result.items, page, hasMore: result.hasMore, total: result.total }
        }))
      }
    } catch {
      setReplyError(prev => ({ ...prev, [rootRpid]: '回复请求异常' }))
    } finally {
      setReplyLoading(prev => ({ ...prev, [rootRpid]: false }))
    }
  }, [detail?.aid, aid])

  const handleExpandReplies = useCallback((rootRpid: string) => {
    const existing = replyDataRef.current[rootRpid]
    if (!existing || existing.items.length === 0) {
      loadReplies(rootRpid, 1)
    }
    setExpandedReplies(prev => new Set(prev).add(rootRpid))
  }, [loadReplies])

  const handleCollapseReplies = useCallback((rootRpid: string) => {
    setExpandedReplies(prev => {
      const n = new Set(prev)
      n.delete(rootRpid)
      return n
    })
  }, [])

  const getPageNumbers = (totalPages: number, currentPage: number): (number | string)[] => {
    const pages: (number | string)[] = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      if (totalPages > 1) pages.push(totalPages)
    }
    return pages
  }

  const renderReplyPagination = useCallback((rootRpid: string) => {
    const section = replySections[rootRpid]
    if (!section) return null
    const currentPage = section.page
    const pageSize = 10
    const totalPages = section.total != null ? Math.ceil(section.total / pageSize) : section.hasMore ? currentPage + 1 : currentPage
    return (
      <div className="flex items-center gap-2 text-[11px] text-gray-400 pt-1 flex-wrap">
        {totalPages > 1 && <span>共{totalPages}页</span>}
        {currentPage > 1 && (
          <button onClick={() => loadReplies(rootRpid, currentPage - 1)} className="hover:text-gray-600 transition-colors">
            上一页
          </button>
        )}
        {getPageNumbers(totalPages, currentPage).map((p, i) =>
          typeof p === 'string' ? (
            <span key={`e${i}`} className="text-gray-300">{p}</span>
          ) : (
            <button
              key={p}
              onClick={() => { if (p !== currentPage) loadReplies(rootRpid, p) }}
              className={p === currentPage ? 'text-[#00A1D6] font-medium' : 'text-gray-500 hover:text-gray-700 transition-colors'}
            >
              {p}
            </button>
          )
        )}
        {currentPage < totalPages && (
          <button onClick={() => loadReplies(rootRpid, currentPage + 1)} className="text-[#00A1D6] hover:text-[#00B5E5] transition-colors">
            下一页
          </button>
        )}
        <button onClick={() => handleCollapseReplies(rootRpid)} className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
          收起
        </button>
      </div>
    )
  }, [replySections, loadReplies, handleCollapseReplies])

  return (
    <aside className="w-full lg:w-[390px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 bg-white flex flex-col min-h-0">
      {/* Video meta - fixed top section */}
      <div className="shrink-0">
        {detailLoading && (
          <div className="p-4 flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            加载中...
          </div>
        )}
        {detailError && !detailLoading && (
          <div className="p-4 text-red-400 text-sm">{detailError}</div>
        )}

        {detail && !detailLoading && (
          <div className="p-5 space-y-5">
            <h2 className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">{detail.title}</h2>

            <div className="flex items-center gap-3">
              {detail.owner.face && (
                <img src={detail.owner.face} alt="" className="w-8 h-8 rounded-full bg-gray-100" referrerPolicy="no-referrer" />
              )}
              <span className="text-sm font-medium text-gray-800">{detail.owner.name}</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
              {detail.stats.view != null && <span>播放 {formatCount(detail.stats.view)}</span>}
              {detail.stats.like != null && <span>赞 {formatCount(detail.stats.like)}</span>}
              {detail.stats.coin != null && <span>投币 {formatCount(detail.stats.coin)}</span>}
              {detail.stats.favorite != null && <span>收藏 {formatCount(detail.stats.favorite)}</span>}
              {detail.stats.reply != null && <span>评论 {formatCount(detail.stats.reply)}</span>}
              {detail.pubdate != null && <span>发布于 {formatPubdate(detail.pubdate)}</span>}
            </div>

            {detail.desc && (
              <div className="text-xs text-gray-500 leading-relaxed">
                <p className={descExpanded ? '' : 'line-clamp-4'}>{detail.desc}</p>
                {detail.desc.length > 120 && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    className="text-[#00A1D6] hover:text-[#00B5E5] mt-1"
                  >
                    {descExpanded ? '收起' : '展开'}
                  </button>
                )}
              </div>
            )}

            {detail.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detail.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 shrink-0" />

      {/* Comments - scrollable section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">
            评论 {commentsTotal != null ? formatCount(commentsTotal) : ''}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSortChange('hot')}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${commentSort === 'hot' ? 'bg-[#00A1D6] text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              最热
            </button>
            <button
              onClick={() => handleSortChange('time')}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${commentSort === 'time' ? 'bg-[#00A1D6] text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              最新
            </button>
          </div>
        </div>

        {commentsLoading && comments.length === 0 && (
          <div className="flex items-center gap-2 text-gray-400 text-xs py-4">
            <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
            加载评论中...
          </div>
        )}

        {commentsError && !commentsLoading && (
          <div className="text-red-400 text-xs py-4">{commentsError}</div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="text-gray-400 text-xs py-4 text-center">暂无评论</div>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id}>
              <div className="flex gap-2.5">
                {c.avatar && !brokenAvatars.has(c.id) ? (
                  <img src={c.avatar} alt="" className="w-7 h-7 rounded-full bg-gray-100 shrink-0 mt-0.5" referrerPolicy="no-referrer" onError={() => handleAvatarError(c.id)} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-gray-400">{c.nickname.charAt(0)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-gray-700">{c.nickname}</span>
                    {c.isUp && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00A1D6]/20 text-[#00A1D6]">UP</span>
                    )}
                    {c.level != null && (
                      <span className="text-[10px] text-gray-400">Lv{c.level}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed mt-0.5 break-words">{c.content}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{formatTimeAgo(c.ctime)}</span>
                    {c.like != null && c.like > 0 && <span>赞 {formatCount(c.like)}</span>}
                  </div>
                  {c.replyCount != null && c.replyCount > 0 && !expandedReplies.has(c.rpid) && (
                    <button
                      onClick={() => handleExpandReplies(c.rpid)}
                      className="mt-1.5 text-[11px] text-[#00A1D6] hover:text-[#00B5E5]"
                    >
                      共 {c.replyCount} 条回复，点击查看
                    </button>
                  )}
                </div>
              </div>
              {expandedReplies.has(c.rpid) && (
                <div className="ml-9 mt-2 space-y-3">
                  {replySections[c.rpid]?.items.map(reply => (
                    <div key={reply.id} className="flex gap-2">
                      {reply.avatar && !brokenAvatars.has(reply.id) ? (
                        <img src={reply.avatar} alt="" className="w-5 h-5 rounded-full bg-gray-100 shrink-0 mt-0.5" referrerPolicy="no-referrer" onError={() => handleAvatarError(reply.id)} />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-100 shrink-0 mt-0.5 flex items-center justify-center text-[8px] text-gray-400">{reply.nickname.charAt(0)}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-700">{reply.nickname}</span>
                          {reply.isUp && <span className="text-[9px] px-1 py-0.5 rounded bg-[#00A1D6]/20 text-[#00A1D6]">UP</span>}
                          {reply.level != null && <span className="text-[9px] text-gray-400">Lv{reply.level}</span>}
                        </div>
                        <p className="text-[11px] text-gray-700 leading-relaxed mt-0.5 break-words">{reply.content}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-400">
                          <span>{formatTimeAgo(reply.ctime)}</span>
                          {reply.like != null && reply.like > 0 && <span>赞 {formatCount(reply.like)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {replyLoading[c.rpid] && (
                    <div className="flex items-center gap-1.5 text-gray-400 text-[10px] py-1">
                      <div className="w-2.5 h-2.5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                      加载中...
                    </div>
                  )}
                  {replyError[c.rpid] && (
                    <div className="text-red-400 text-[10px] py-1">{replyError[c.rpid]}</div>
                  )}
                  {!replyLoading[c.rpid] && !replyError[c.rpid] && replySections[c.rpid] && renderReplyPagination(c.rpid)}
                </div>
              )}
            </div>
          ))}
        </div>

        {hasMoreComments && (
          <div className="text-center pt-2 pb-4">
            <button
              onClick={handleLoadMore}
              disabled={commentsLoading}
              className="px-4 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {commentsLoading ? (
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  加载中...
                </span>
              ) : (
                '加载更多'
              )}
            </button>
          </div>
        )}

        {!hasMoreComments && comments.length > 0 && !commentsLoading && (
          <div className="text-center text-[10px] text-gray-400 py-2">没有更多了</div>
        )}
      </div>
    </aside>
  )
}
