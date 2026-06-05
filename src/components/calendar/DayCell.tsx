'use client'
import { motion } from 'framer-motion'
import type { AvailabilityType } from '@/lib/algorithm/types'

const TYPE_COLORS: Record<AvailabilityType, string> = {
  exclude: 'bg-red-500 text-white border-red-500',
  half_day: 'bg-orange-400 text-white border-orange-400',
  annual_leave: 'bg-green-500 text-white border-green-500',
}
const TYPE_LABELS: Record<AvailabilityType, string> = {
  exclude: '제외',
  half_day: '반차',
  annual_leave: '연차',
}

interface Props {
  day: number
  date: Date
  selectedType?: AvailabilityType
  isHoliday?: boolean
  isWeekend?: boolean
  onTap: (date: Date) => void
}

export function DayCell({ day, date, selectedType, isHoliday, onTap }: Props) {
  const dow = date.getDay()
  const isSun = dow === 0
  const isSat = dow === 6

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      onClick={() => onTap(date)}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 border
        ${selectedType
          ? TYPE_COLORS[selectedType]
          : 'bg-white border-gray-100'
        }
        ${!selectedType && (isSun || isHoliday) ? 'text-red-500' : ''}
        ${!selectedType && isSat && !isHoliday ? 'text-blue-500' : ''}
        ${!selectedType && !isSun && !isSat && !isHoliday ? 'text-gray-700' : ''}`}
    >
      <span className="text-sm font-bold">{day}</span>
      {selectedType && <span className="text-[9px] font-semibold mt-0.5">{TYPE_LABELS[selectedType]}</span>}
    </motion.button>
  )
}
