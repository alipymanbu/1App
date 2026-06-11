import type { FeedItem } from '../../../shared/types'
import { FeedCard } from './FeedCard'

interface FeedGridProps {
  items: FeedItem[]
  loading: boolean
  error?: string
  onPlay?: (item: FeedItem) => void
}

export function FeedGrid({ items, loading, error, onPlay }: FeedGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse"
          >
            <div className="aspect-[16/10] bg-gray-100" />
            <div className="p-3.5 space-y-2.5">
              <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
              <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!loading && items.length === 0 && error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-4xl mb-3">⚠️</span>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-4xl mb-3">📭</span>
        <p className="text-sm">暂无内容</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 p-4">
      {items.map((item) => (
        <FeedCard key={item.id} item={item} onPlay={onPlay} />
      ))}
    </div>
  )
}
