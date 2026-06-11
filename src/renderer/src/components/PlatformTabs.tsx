import type { PlatformId } from '../../../shared/types'
import { PLATFORMS } from '../../../shared/constants'

interface PlatformTabsProps {
  selected: PlatformId
  onSelect: (id: PlatformId) => void
  loginStates: Record<PlatformId, boolean>
}

export function PlatformTabs({ selected, onSelect, loginStates }: PlatformTabsProps) {
  return (
    <div className="flex gap-2 p-4">
      {PLATFORMS.map((platform) => {
        const isActive = selected === platform.id
        const isLoggedIn = loginStates[platform.id]
        return (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            className={`
              flex items-center gap-2.5 px-5 py-3 rounded-[14px] text-sm font-medium
              transition-all duration-200 ease-out
              ${isActive
                ? 'shadow-sm'
                : 'hover:bg-gray-100/80 text-gray-500'
              }
            `}
            style={{
              backgroundColor: isActive ? `${platform.color}12` : 'transparent',
              color: isActive ? platform.color : undefined
            }}
          >
            <span className="text-base">{platform.icon}</span>
            <span>{platform.name}</span>
            {isLoggedIn ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1" />
            )}
          </button>
        )
      })}
    </div>
  )
}
