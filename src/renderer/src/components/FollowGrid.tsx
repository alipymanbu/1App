import { useState } from 'react'
import type { FollowUser } from '../../../shared/types'
import { PLATFORMS } from '../../../shared/constants'

function formatCount(n?: number): string {
  if (n === undefined || n === null) return '-'
  if (typeof n !== 'number') return String(n)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function FollowCard({ user, onSelect }: { user: FollowUser; onSelect?: (user: FollowUser) => void }) {
  const [imgError, setImgError] = useState(false)
  const platformInfo = PLATFORMS.find((p) => p.id === user.platform)
  const s = user.stats

  return (
    <div
      onClick={() => onSelect?.(user)}
      className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {user.avatar && !imgError ? (
        <img
          src={user.avatar}
          alt={user.nickname}
          className="w-12 h-12 rounded-full object-cover bg-gray-200 shrink-0"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg text-gray-500 shrink-0">
          {user.nickname.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-gray-900 truncate">{user.nickname}</h4>
        {user.bio && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{user.bio}</p>
        )}
        {s && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[
              { key: 'following', label: '关注', value: s.following },
              { key: 'follower', label: '粉丝', value: s.follower },
              { key: 'likes', label: '获赞', value: s.likes },
              { key: 'views', label: '播放', value: s.views }
            ].filter(p => p.value !== undefined).map(p => (
              <span key={p.key} className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-100 px-2.5 py-0.5 text-[11px]">
                <span className="font-medium text-gray-700">{formatCount(p.value)}</span>
                <span className="text-gray-400">{p.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={user.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-400 hover:underline shrink-0"
        >
          空间
        </a>
        {platformInfo && (
          <span className="text-xs text-gray-400">{platformInfo.name}</span>
        )}
      </div>
    </div>
  )
}

interface FollowGridProps {
  items: FollowUser[]
  loading: boolean
  error?: string
  onSelectUser?: (user: FollowUser) => void
}

export function FollowGrid({ items, loading, error, onSelectUser }: FollowGridProps) {
  if (loading) {
    return (
      <div className="grid gap-3 px-4 pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!loading && items.length === 0 && error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <span className="text-3xl mb-3">👥</span>
        <p className="text-sm">暂无关注</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 px-4 pb-4">
      {items.map((user) => (
        <FollowCard key={user.uid} user={user} onSelect={onSelectUser} />
      ))}
    </div>
  )
}
