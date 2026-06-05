'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { AvailabilityType } from '@/lib/algorithm/types'

const OPTIONS: Array<{ type: AvailabilityType; label: string; desc: string; colorClass: string }> = [
  { type: 'exclude', label: '당직 제외', desc: '이 날 당직에서 완전 제외됩니다', colorClass: 'bg-red-50 text-red-600' },
  { type: 'half_day', label: '반차', desc: '반차 — 당직 배정에 포함될 수 있습니다', colorClass: 'bg-orange-50 text-orange-600' },
  { type: 'annual_leave', label: '연차', desc: '연차 (당직 배정에서 제외)', colorClass: 'bg-green-50 text-green-600' },
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
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-3xl z-50"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />
            <div className="px-6 pt-4 pb-2">
              <h3 className="font-bold text-gray-800">{dateLabel} 유형 선택</h3>
            </div>
            <div className="px-4 pb-6 flex flex-col gap-2">
              {OPTIONS.map(opt => (
                <motion.button
                  key={opt.type}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onSelect(opt.type); onClose() }}
                  className={`flex items-center gap-4 p-4 rounded-2xl text-left ${opt.colorClass}
                    ${current === opt.type ? 'ring-2 ring-toss-blue' : ''}`}
                >
                  <div>
                    <div className="font-bold text-sm">{opt.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                  </div>
                  {current === opt.type && <span className="ml-auto text-toss-blue font-bold">✓</span>}
                </motion.button>
              ))}
              {current && (
                <button
                  onClick={() => { onSelect(null); onClose() }}
                  className="text-sm text-gray-400 py-2 text-center"
                >
                  선택 해제
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
