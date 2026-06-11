import { useState, useEffect } from 'react'
import type { UserProfile, PlatformId } from '../../../shared/types'
import { PLATFORMS } from '../../../shared/constants'

interface UserCardProps {
  profile: UserProfile
  platform: PlatformId
  onLogout: () => void
}

function formatCount(n?: number): string {
  if (n === undefined || n === null) return ''
  if (typeof n !== 'number') return String(n)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function AvatarFallback({ nickname }: { nickname: string }) {
  return (
    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-500">
      {nickname.charAt(0)}
    </div>
  )
}

export function UserCard({ profile, platform, onLogout }: UserCardProps) {
  const [imgError, setImgError] = useState(false)
  const info = PLATFORMS.find((p) => p.id === platform)

  useEffect(() => {
    setImgError(false)
  }, [profile.avatar])

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-4">
        <div className="relative">
          {profile.avatar && !imgError ? (
            <img
              src={profile.avatar}
              alt={profile.nickname}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <AvatarFallback nickname={profile.nickname} />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {profile.nickname}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {info && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${info.color}14`,
                  color: info.color
                }}
              >
                {info.icon} {info.name}
              </span>
            )}
            {profile.uid && (
              <span className="text-xs text-gray-400">ID: {profile.uid}</span>
            )}
          </div>
          {profile.bio && (
            <p className="text-xs text-gray-500 mt-1 truncate">{profile.bio}</p>
          )}
          {(() => {
            const statItems = [
              { key: 'following', label: '关注', value: profile.stats?.following },
              { key: 'follower', label: '粉丝', value: profile.stats?.follower },
              { key: 'likes', label: '获赞', value: profile.stats?.likes },
              { key: 'views', label: '播放', value: profile.stats?.views }
            ].filter(item => item.value !== undefined)
            if (statItems.length === 0) return null
            return (
              <div className="flex items-center rounded-2xl border border-gray-200/70 bg-slate-50/70 mt-3 overflow-hidden">
                {statItems.map((item, i) => (
                  <div
                    key={item.key}
                    className={`flex-1 text-center py-2.5 px-1 ${i > 0 ? 'border-l border-gray-200/60' : ''}`}
                  >
                    <span className="text-sm font-semibold text-gray-900">{formatCount(item.value)}</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">{item.label}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
      <button
        onClick={onLogout}
        className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-red-500 
                   rounded-xl hover:bg-red-50 transition-colors duration-200"
      >
        退出登录
      </button>
    </div>
  )
}
