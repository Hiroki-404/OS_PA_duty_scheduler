'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { AvailabilityType } from '@/lib/algorithm/types'

const OPTIONS: Array<{ type: AvailabilityType; label: string; desc: string; colorClass: string }> = [
  { type: 'exclude',      label: '당직 제외', desc: '이 날 당직에서 완전 제외됩니다',         colorClass: 'bg-red-50 text-red-600' },
  { type: 'half_day',     label: '반차',     desc: '반차 — 당직 배정에 포함될 수 있습니다',  colorClass: 'bg-orange-50 text-orange-600' },
  { type: 'annual_leave', label: '연차',     desc: '연차 (당직 배정에서 제외)',              colorClass: 'bg-purple-50 text-purple-600' },
]

interface Props {
  open: boolean
  date?: Date
  current?: AvailabilityType
  onSelect: (type: AvailabilityType | null) => void
  onClose: () => void
}

export function AvailabilityTypeSheet({ open, date, current, onSelect, onClose }: Props) {
  const dateLabel = date ? `${date.getMonth() + 1}월 ${date.getDate()}일` : ''

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />
            <div className="px-6 pt-4 pb-2">
              <h3 className="font-bold text-gray-800">{dateLabel} 유형 선택</h3>
            </div>

            <div className="px-4 pb-8 flex flex-col gap-2">
              {OPTIONS.map(opt => (
                <motion.button
                  key={opt.type}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onSelect(opt.type); onClose() }}
                  className={`flex items-center gap-4 p-4 rounded-2xl text-left ${opt.colorClass}
                    ${current === opt.type ? 'ring-2 ring-toss-blue' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm">{opt.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                  </div>
                  {current === opt.type && <span className="text-toss-blue font-bold text-lg">✓</span>}
                </motion.button>
              ))}

              {/* 해제 버튼 — 항상 표시, 선택된 항목 없으면 비활성 */}
              <motion.button
                whileTap={current ? { scale: 0.97 } : {}}
                onClick={() => { if (current) { onSelect(null); onClose() } }}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-colors mt-1
                  ${current
                    ? 'border-gray-200 text-gray-600 bg-white active:bg-gray-50'
                    : 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed'}`}
              >
                <span className="text-sm font-bold">✕ 선택 해제</span>
                {current && (
                  <span className="text-xs text-gray-400">
                    ({OPTIONS.find(o => o.type === current)?.label} 해제)
                  </span>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
