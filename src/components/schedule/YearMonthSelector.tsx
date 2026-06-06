'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface Props { year: number; month: number }

export function YearMonthSelector({ year, month }: Props) {
  const router = useRouter()
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)

  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  const handleSelect = (y: number, m: number) => {
    router.push(`?year=${y}&month=${m}`)
    setOpen(false)
  }

  const isFuture = (y: number, m: number) =>
    y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 2)

  return (
    <>
      <button
        onClick={() => { setPickerYear(year); setOpen(true) }}
        className="flex items-center gap-1 bg-gray-100 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-700"
      >
        {year}년 {month}월 <span className="text-gray-400 text-xs">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-4 top-[15%] bg-white rounded-3xl z-50 shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              {/* 연도 탭 */}
              <div className="flex border-b border-gray-100">
                {yearOptions.map(y => (
                  <button
                    key={y}
                    onClick={() => setPickerYear(y)}
                    className={`flex-1 py-3.5 text-sm font-bold transition-colors
                      ${pickerYear === y
                        ? 'text-toss-blue border-b-2 border-toss-blue'
                        : 'text-gray-400'}`}
                  >
                    {y}년
                  </button>
                ))}
              </div>

              {/* 1~12월 4×3 그리드 */}
              <div className="grid grid-cols-4 gap-2 p-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const isSelected = pickerYear === year && m === month
                  const isCurrent = pickerYear === now.getFullYear() && m === now.getMonth() + 1
                  const disabled = isFuture(pickerYear, m)
                  return (
                    <button
                      key={m}
                      disabled={disabled}
                      onClick={() => handleSelect(pickerYear, m)}
                      className={`h-12 rounded-2xl text-sm font-bold transition-all
                        ${isSelected
                          ? 'bg-toss-blue text-white shadow-sm'
                          : isCurrent
                          ? 'border-2 border-toss-blue text-toss-blue'
                          : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'}
                        ${disabled ? 'opacity-25 cursor-not-allowed' : ''}`}
                    >
                      {m}월
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
