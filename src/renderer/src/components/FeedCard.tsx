import { useState } from 'react'
import type { FeedItem } from '../../../shared/types'
import { PLATFORMS } from '../../../shared/constants'

interface FeedCardProps {
  item: FeedItem
  onPlay?: (item: FeedItem) => void
}

function formatCount(n?: number): string {
  if (n === undefined || n === null) return ''
  if (typeof n !== 'number') return String(n)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function FeedCard({ item, onPlay }: FeedCardProps) {
  const [imgError, setImgError] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const platformInfo = PLATFORMS.find((p) => p.id === item.platform)

  const canPlayInline = item.platform === 'bilibili' && (item.bvid || item.aid) && item.mediaType === 'video'
  const isXhs = item.platform === 'xhs'

  const handleClick = (e: React.MouseEvent) => {
    if ((canPlayInline || isXhs) && onPlay) {
      e.preventDefault()
      onPlay(item)
    }
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <div className="aspect-[16/10] bg-gray-100 relative overflow-hidden">
        {item.cover && !imgError ? (
          <img
            src={item.cover}
            alt={item.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">
            {platformInfo?.icon || '📄'}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug h-10">
          {item.title}
        </h4>
        <div className="flex items-center gap-2 mt-2.5">
          {item.avatar && !avatarError ? (
            <img
              src={item.avatar}
              alt={item.author}
              className="w-5 h-5 rounded-full object-cover bg-gray-200"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 shrink-0">
              {item.author ? item.author.charAt(0) : '?'}
            </div>
          )}
          <span className="text-xs text-gray-500 truncate">{item.author}</span>
          {platformInfo && (
            <span className="text-[10px] text-gray-400 ml-auto">{platformInfo.name}</span>
          )}
        </div>
        {item.stats && (item.stats.play !== undefined || item.stats.like !== undefined || item.stats.comment !== undefined || item.stats.share !== undefined) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {item.stats.play !== undefined && (
              <span>▶️ {formatCount(item.stats.play)}</span>
            )}
            {item.stats.like !== undefined && (
              <span>👍 {formatCount(item.stats.like)}</span>
            )}
            {item.stats.comment !== undefined && (
              <span>💬 {formatCount(item.stats.comment)}</span>
            )}
            {item.stats.share !== undefined && (
              <span>🔁 {formatCount(item.stats.share)}</span>
            )}
          </div>
        )}
      </div>
    </a>
  )
}
