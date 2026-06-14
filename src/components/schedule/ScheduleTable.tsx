'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ScheduleEntry {
  id: string; user_id: string; date: string
  is_weekend: boolean; is_holiday: boolean; is_locked: boolean
}
interface AvailEntry { user_id: string; date: string; type: 'exclude' | 'half_day' | 'annual_leave' }
interface Holiday { date: string; name: string }
interface WorkerInfo { name: string; color: string }
interface ExchangeInfo {
  id: string
  requester_id: string
  target_id: string
  requester_date: string
  target_date: string | null
  type: 'swap' | 'transfer'
}

interface Props {
  schedules: ScheduleEntry[]
  workerMap: Record<string, WorkerInfo>
  year: number
  month: number
  holidays: Holiday[]
  availabilities: AvailEntry[]
  exchanges?: ExchangeInfo[]
  isAdmin?: boolean
  onCellClick?: (date: string, currentUserId: string | null) => void
}

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const DOW_FULL   = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const AVAIL_STYLE: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  exclude:      { label: '제외', bg: 'bg-red-50',    text: 'text-red-500',    dot: 'bg-red-400' },
  half_day:     { label: '반차', bg: 'bg-orange-50', text: 'text-orange-500', dot: 'bg-orange-400' },
  annual_leave: { label: '연차', bg: 'bg-purple-50', text: 'text-purple-500', dot: 'bg-purple-400' },
}

export function ScheduleTable({
  schedules, workerMap, year, month,
  holidays, availabilities, exchanges, isAdmin, onCellClick,
}: Props) {
  const [sheetDate, setSheetDate] = useState<string | null>(null)

  const today       = new Date().toISOString().slice(0, 10)
  const scheduleMap = Object.fromEntries(schedules.map(s => [s.date, s]))
  const holidayMap  = Object.fromEntries(holidays.map(h => [h.date, h.name]))

  const availMap: Record<string, AvailEntry[]> = {}
  for (const a of availabilities) {
    if (!availMap[a.date]) availMap[a.date] = []
    availMap[a.date].push(a)
  }

  // 교환 확정 맵: date → { partnerId, partnerDate, type }
  // 스왑 후 셀에 표시되는 사람은 상대방이므로, partnerId는 원래 배정자(= 반대편)를 가리켜야 함
  const exchangeMap: Record<string, { partnerId: string; partnerDate: string | null; type: string }> = {}
  for (const ex of (exchanges ?? [])) {
    // requester_date 셀: accept 후 target이 배정됨 → partner는 원래 requester
    exchangeMap[ex.requester_date] = { partnerId: ex.requester_id, partnerDate: ex.target_date,    type: ex.type }
    if (ex.type === 'swap' && ex.target_date) {
      // target_date 셀: accept 후 requester가 배정됨 → partner는 원래 target
      exchangeMap[ex.target_date] = { partnerId: ex.target_id,   partnerDate: ex.requester_date, type: ex.type }
    }
  }

  const firstDow    = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const sheetSchedule = sheetDate ? scheduleMap[sheetDate] : null
  const sheetWorker   = sheetSchedule ? workerMap[sheetSchedule.user_id] : null
  const sheetAvails   = sheetDate ? (availMap[sheetDate] ?? []) : []
  const sheetDayObj   = sheetDate ? new Date(sheetDate + 'T00:00:00') : null
  const sheetHolName  = sheetDate ? holidayMap[sheetDate] : null
  const sheetExchange = sheetDate ? exchangeMap[sheetDate] : null

  return (
    <>
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
          if (!day) return <div key={`e-${idx}`} className="min-h-[72px] border-r border-b border-gray-50 bg-gray-50/30" />

          const iso     = `${year}-${pad(month)}-${pad(day)}`
          const s       = scheduleMap[iso]
          const isToday = iso === today
          const isSun   = idx % 7 === 0
          const isSat   = idx % 7 === 6
          const isHol   = !!holidayMap[iso]
          const holName = holidayMap[iso]
          const worker  = s ? workerMap[s.user_id] : undefined
          const avails  = availMap[iso] ?? []
          const exInfo  = exchangeMap[iso]

          const dateBg = isHol ? 'bg-amber-50'
            : (isSat || isSun) ? 'bg-blue-50/30'
            : 'bg-white'

          const dateColor = (isSun || isHol) ? 'text-red-500'
            : isSat ? 'text-blue-500'
            : 'text-gray-700'

          // 교환 완료 → 빨간 테두리, 오늘 → 파란 테두리 (우선순위: 교환 > 오늘)
          const ringClass = exInfo
            ? 'ring-2 ring-inset ring-red-500'
            : isToday
            ? 'ring-2 ring-inset ring-toss-blue'
            : ''

          return (
            <motion.div
              key={iso}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSheetDate(iso)
                if (isAdmin && onCellClick) onCellClick(iso, s?.user_id ?? null)
              }}
              className={`min-h-[72px] border-r border-b border-gray-100 p-1 flex flex-col gap-0.5 cursor-pointer ${dateBg} ${ringClass}`}
            >
              {/* 날짜 번호 */}
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold leading-none ${dateColor}
                  ${isToday && !exInfo ? 'bg-toss-blue text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]' : ''}`}>
                  {day}
                </span>
              </div>

              {/* 공휴일 이름 */}
              {holName && (
                <span className="text-[8px] text-amber-600 font-medium leading-none truncate">{holName}</span>
              )}

              {/* 당직자 배지 */}
              {worker ? (
                <div
                  className="rounded-md px-1 py-0.5 text-center text-[9px] font-bold text-white leading-tight truncate"
                  style={{ backgroundColor: worker.color }}
                >
                  {worker.name}
                </div>
              ) : (
                <div className="rounded-md px-1 py-0.5 text-center text-[9px] text-gray-300 leading-tight">
                  —
                </div>
              )}

              {/* 교환 확정 서브라인 */}
              {exInfo && (
                <div className="text-[7px] text-red-500 font-semibold leading-none truncate">
                  {exInfo.type === 'swap'
                    ? `↔${workerMap[exInfo.partnerId]?.name ?? '?'}(${exInfo.partnerDate?.slice(-2)}일)`
                    : `→${workerMap[exInfo.partnerId]?.name ?? '?'}(일방)`}
                </div>
              )}

              {/* 가용성 표시 (최대 2명) */}
              <div className="flex flex-col gap-px mt-auto">
                {avails.slice(0, 2).map(a => {
                  const st  = AVAIL_STYLE[a.type]
                  const wkr = workerMap[a.user_id]
                  const wn  = wkr?.name ?? '?'
                  const wc  = wkr?.color ?? '#aaa'
                  return (
                    <div
                      key={a.user_id}
                      className="flex items-center gap-0.5 rounded px-0.5"
                      style={{ backgroundColor: wc + '22' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: wc }} />
                      <span className="text-[7px] font-medium truncate" style={{ color: wc }}>
                        {wn.charAt(0)} {st.label}
                      </span>
                    </div>
                  )
                })}
                {avails.length > 2 && (
                  <span className="text-[7px] text-gray-400 px-0.5">+{avails.length - 2}</span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 날짜 상세 바텀시트 */}
      <AnimatePresence>
        {sheetDate && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheetDate(null)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[60vh] overflow-y-auto"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />

              {/* 헤더 */}
              <div className="px-6 pt-4 pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-400 font-medium">
                  {sheetDayObj && DOW_FULL[sheetDayObj.getDay()]}
                  {sheetHolName && ` · ${sheetHolName}`}
                </p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  {month}월 {sheetDate?.slice(8)}일
                  {sheetExchange && (
                    <span className="ml-2 text-sm font-normal text-red-500">교환됨</span>
                  )}
                </h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* 당직자 */}
                <section>
                  <p className="text-xs font-bold text-gray-400 mb-2">당직자</p>
                  {sheetWorker ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 rounded-2xl"
                        style={{ backgroundColor: sheetWorker.color + '18' }}>
                        <div className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: sheetWorker.color }} />
                        <span className="font-bold text-gray-900">{sheetWorker.name}</span>
                        <span className="ml-auto text-xs text-gray-400">당직</span>
                      </div>
                      {/* 교환 기록 서브라인 */}
                      {sheetExchange && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                          <span className="text-red-400 text-xs shrink-0">
                            {sheetExchange.type === 'swap' ? '↔' : '→'}
                          </span>
                          <span className="text-xs text-red-600 font-medium">
                            {sheetExchange.type === 'swap'
                              ? `교환자: ${workerMap[sheetExchange.partnerId]?.name ?? '?'}(${sheetExchange.partnerDate?.slice(-2)}일)`
                              : `교체자: ${workerMap[sheetExchange.partnerId]?.name ?? '?'}`}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">배정 없음</p>
                  )}
                </section>

                {/* 신청 내역 */}
                {sheetAvails.length > 0 && (
                  <section>
                    <p className="text-xs font-bold text-gray-400 mb-2">신청 내역</p>
                    <div className="space-y-2">
                      {sheetAvails.map(a => {
                        const st = AVAIL_STYLE[a.type]
                        const wn = workerMap[a.user_id]?.name ?? '?'
                        const wc = workerMap[a.user_id]?.color ?? '#aaa'
                        return (
                          <div key={a.user_id} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: wc }} />
                            <span className="text-sm font-medium text-gray-800 flex-1">{wn}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                              {st.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {!sheetWorker && sheetAvails.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">이 날은 정보가 없습니다</p>
                )}
              </div>
              <div className="pb-8" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
