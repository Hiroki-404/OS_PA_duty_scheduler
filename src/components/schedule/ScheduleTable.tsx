'use client'
import { motion } from 'framer-motion'

interface ScheduleEntry {
  id: string; user_id: string; date: string
  is_weekend: boolean; is_holiday: boolean; is_locked: boolean
}
interface AvailEntry { user_id: string; date: string; type: 'exclude' | 'half_day' | 'annual_leave' }
interface Holiday { date: string; name: string }
interface WorkerInfo { name: string; color: string }

interface Props {
  schedules: ScheduleEntry[]
  workerMap: Record<string, WorkerInfo>
  year: number
  month: number
  holidays: Holiday[]
  availabilities: AvailEntry[]
  isAdmin?: boolean
  onCellClick?: (date: string, currentUserId: string | null) => void
}

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const AVAIL_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  exclude:      { label: '제외', bg: 'bg-red-50',    text: 'text-red-400' },
  half_day:     { label: '반차', bg: 'bg-orange-50', text: 'text-orange-400' },
  annual_leave: { label: '연차', bg: 'bg-purple-50', text: 'text-purple-400' },
}

export function ScheduleTable({
  schedules, workerMap, year, month,
  holidays, availabilities, isAdmin, onCellClick,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const scheduleMap = Object.fromEntries(schedules.map(s => [s.date, s]))
  const holidayMap  = Object.fromEntries(holidays.map(h => [h.date, h.name]))

  // 날짜별 제외일 목록 (여러 근무자)
  const availMap: Record<string, AvailEntry[]> = {}
  for (const a of availabilities) {
    if (!availMap[a.date]) availMap[a.date] = []
    availMap[a.date].push(a)
  }

  const firstDow   = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-xs font-semibold
            ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="min-h-[72px] border-r border-b border-gray-50" />

          const iso        = `${year}-${pad(month)}-${pad(day)}`
          const s          = scheduleMap[iso]
          const isToday    = iso === today
          const isSun      = idx % 7 === 0
          const isSat      = idx % 7 === 6
          const isHol      = !!holidayMap[iso]
          const holName    = holidayMap[iso]
          const worker     = s ? workerMap[s.user_id] : undefined
          const dayAvails  = availMap[iso] ?? []

          const dateBg = isHol
            ? 'bg-yellow-50'
            : (isSat || isSun) ? 'bg-blue-50/20'
            : 'bg-white'

          const dateColor = (isSun || isHol)
            ? 'text-red-500'
            : isSat ? 'text-blue-500'
            : 'text-gray-600'

          return (
            <motion.div
              key={iso}
              whileTap={isAdmin ? { scale: 0.94 } : {}}
              onClick={() => isAdmin && onCellClick?.(iso, s?.user_id ?? null)}
              className={`min-h-[72px] border-r border-b border-gray-50 p-1 flex flex-col gap-0.5
                ${dateBg}
                ${isToday ? 'ring-2 ring-inset ring-toss-blue' : ''}
                ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              {/* 날짜 번호 */}
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-bold ${dateColor}`}>{day}</span>
              </div>

              {/* 공휴일 이름 */}
              {holName && (
                <span className="text-[9px] text-yellow-600 font-medium leading-none truncate">
                  {holName}
                </span>
              )}

              {/* 당직자 배지 */}
              {worker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-auto rounded-lg px-1 py-1 text-center text-[10px] font-bold text-white leading-tight truncate"
                  style={{ backgroundColor: worker.color }}
                >
                  {worker.name}
                </motion.div>
              )}

              {/* 제외일/반차/연차 표시 (최대 2명) */}
              {dayAvails.slice(0, 2).map((a) => {
                const style = AVAIL_STYLE[a.type]
                const wName = workerMap[a.user_id]?.name ?? '?'
                return (
                  <div key={a.user_id}
                    className={`rounded text-[8px] px-1 ${style.bg} ${style.text} font-medium truncate`}>
                    {wName} {style.label}
                  </div>
                )
              })}
              {dayAvails.length > 2 && (
                <div className="text-[8px] text-gray-400">+{dayAvails.length - 2}명</div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
