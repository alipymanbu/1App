import { useState } from 'react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
}

function getPageItems(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (page <= 5) {
    return [1, 2, 3, 4, 5, 6, 7, '...', totalPages]
  }
  if (page >= totalPages - 4) {
    return [
      1,
      '...',
      totalPages - 6,
      totalPages - 5,
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    ]
  }
  return [
    1,
    '...',
    page - 2,
    page - 1,
    page,
    page + 1,
    page + 2,
    '...',
    totalPages
  ]
}

export function Pagination({ page, pageSize, total, loading, onPageChange }: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('')
  const safePageSize = pageSize > 0 ? pageSize : 10
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : 0
  const totalPages = Math.ceil(safeTotal / safePageSize)

  const handleJump = (): void => {
    const num = parseInt(jumpValue, 10)
    if (isNaN(num) || num < 1 || num > totalPages || num === page) return
    onPageChange(num)
    setJumpValue('')
  }

  if (totalPages <= 1) return null

  const pageItems = getPageItems(page, totalPages)

  return (
    <div className="flex items-center justify-between px-4 pb-6 gap-4 flex-wrap">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className="px-3 py-1.5 text-sm rounded-lg font-medium bg-white border border-gray-200 text-gray-600 
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          上一页
        </button>

        {pageItems.map((item, i) => {
          if (item === '...') {
            return (
              <span key={`e${i}`} className="px-2 py-1.5 text-sm text-gray-400 select-none">
                ...
              </span>
            )
          }
          return (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              disabled={loading || item === page}
              className={`min-w-[36px] h-9 text-sm rounded-lg font-medium transition-colors ${
                item === page
                  ? 'bg-[#00A1D6] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item}
            </button>
          )
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className="px-3 py-1.5 text-sm rounded-lg font-medium bg-white border border-gray-200 text-gray-600 
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          下一页
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          共 {totalPages} 页 / {total} 个
        </span>
        <div className="flex items-center gap-1.5">
          <span>跳至</span>
          <input
            type="text"
            value={jumpValue}
            onChange={(e) => {
              const val = e.target.value
              if (/^\d*$/.test(val)) setJumpValue(val)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJump() }}
            disabled={loading}
            placeholder="页"
            className="w-16 h-8 text-sm text-center border border-gray-200 rounded-lg bg-white 
                       focus:outline-none focus:border-[#00A1D6] focus:ring-1 focus:ring-[#00A1D6]/20 
                       disabled:opacity-40 placeholder:text-gray-300"
          />
          <button
            onClick={handleJump}
            disabled={loading || !jumpValue}
            className="px-3 py-1.5 text-sm rounded-lg font-medium bg-gray-100 text-gray-600 
                       hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            跳转
          </button>
        </div>
      </div>
    </div>
  )
}
