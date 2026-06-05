'use client'
import { useState } from 'react'
import type { AvailabilityType } from '@/lib/algorithm/types'
import { DayCell } from './DayCell'
import { AvailabilityTypeSheet } from './AvailabilityTypeSheet'

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  year: number
  month: number
  selections: Record<string, AvailabilityType>
  holidays: string[]
  onChange: (dateISO: string, type: AvailabilityType | null) => void
}

export function MonthCalendar({ year, month, selections, holidays, onChange }: Props) {
  const [sheetDate, setSheetDate] = useState<Date | null>(null)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const pad = (n: number) => String(n).padStart(2, '0')

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div>
        <div className="grid grid-cols-7 mb-2">
          {DOW_LABELS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1
              ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />
            const iso = `${year}-${pad(month)}-${pad(day)}`
            const date = new Date(year, month - 1, day)
            return (
              <DayCell
                key={iso}
                day={day}
                date={date}
                selectedType={selections[iso]}
                isHoliday={holidays.includes(iso)}
                isWeekend={[0, 6].includes(date.getDay())}
                onTap={() => setSheetDate(date)}
              />
            )
          })}
        </div>
      </div>

      <AvailabilityTypeSheet
        open={!!sheetDate}
        date={sheetDate ?? undefined}
        current={sheetDate ? selections[`${year}-${pad(month)}-${pad(sheetDate.getDate())}`] : undefined}
        onSelect={type => {
          if (!sheetDate) return
          onChange(`${year}-${pad(month)}-${pad(sheetDate.getDate())}`, type)
        }}
        onClose={() => setSheetDate(null)}
      />
    </>
  )
}
