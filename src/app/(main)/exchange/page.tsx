'use client'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ExchangeRequestModal } from '@/components/exchange/ExchangeRequestModal'
import { Badge } from '@/components/ui/Badge'

const STATUS_LABEL: Record<string, string> = {
  pending: '대기', accepted: '수락됨', rejected: '거절됨', cancelled: '취소됨'
}
const STATUS_VARIANT: Record<string, 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'blue', accepted: 'green', rejected: 'red', cancelled: 'gray'
}

// 당해 연도 6월 7일 15:30 기준으로 내년 전체 월 자동 활성화
function getYearOptions(now: Date): number[] {
  const activation = new Date(now.getFullYear(), 5, 7, 15, 30)
  return now >= activation
    ? [now.getFullYear(), now.getFullYear() + 1]
    : [now.getFullYear()]
}

function MonthPickerPopup({ year, month, onSelect }: {
  year: number; month: number
  onSelect: (y: number, m: number) => void
}) {
  const [open, setOpen] = useState(false)
  const now = new Date()
  const yearOptions = getYearOptions(now)
  const safeYear = yearOptions.includes(year) ? year : yearOptions[0]
  const [pickerYear, setPickerYear] = useState(safeYear)

  return (
    <>
      <button
        onClick={() => { setPickerYear(safeYear); setOpen(true) }}
        className="flex items-center gap-1 bg-gray-100 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-700"
      >
        {year}년 {month}월 <span className="text-gray-400 text-xs">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)} />
            <motion.div
              className="fixed inset-x-4 top-[15%] bg-white rounded-3xl z-50 shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div className="flex border-b border-gray-100">
                {yearOptions.map(y => (
                  <button key={y} onClick={() => setPickerYear(y)}
                    className={`flex-1 py-3.5 text-sm font-bold transition-colors
                      ${pickerYear === y ? 'text-toss-blue border-b-2 border-toss-blue' : 'text-gray-400'}`}>
                    {y}년
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 p-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const isSelected = pickerYear === year && m === month
                  const isCurrent  = pickerYear === now.getFullYear() && m === now.getMonth() + 1
                  return (
                    <button key={m}
                      onClick={() => { onSelect(pickerYear, m); setOpen(false) }}
                      className={`h-12 rounded-2xl text-sm font-bold transition-all
                        ${isSelected ? 'bg-toss-blue text-white shadow-sm'
                          : isCurrent ? 'border-2 border-toss-blue text-toss-blue'
                          : 'text-gray-700 active:bg-gray-100'}`}>
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

export default function ExchangePage() {
  const now = new Date()
  const [modalOpen, setModalOpen]     = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [workers, setWorkers]         = useState<Array<{ id: string; name: string }>>([])
  const [myCurrentDates, setMyCurrentDates] = useState<string[]>([])
  const [myNextDates, setMyNextDates] = useState<string[]>([])
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({})
  const [requests, setRequests]       = useState<any[]>([])
  const [profiles, setProfiles]       = useState<Record<string, string>>({})

  // 교환 내역 조회 필터 — 기본값: 현재 월
  const [filterYear, setFilterYear]   = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)

  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const nextMonth    = currentMonth === 12 ? 1  : currentMonth + 1
  const nextYear     = currentMonth === 12 ? currentYear + 1 : currentYear

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)

      const pad = (n: number) => String(n).padStart(2, '0')
      const curStart = `${currentYear}-${pad(currentMonth)}-01`
      const curEnd   = `${currentYear}-${pad(currentMonth)}-${pad(new Date(currentYear, currentMonth, 0).getDate())}`
      const nxtStart = `${nextYear}-${pad(nextMonth)}-01`
      const nxtEnd   = `${nextYear}-${pad(nextMonth)}-${pad(new Date(nextYear, nextMonth, 0).getDate())}`

      const [
        { data: profs },
        { data: curSchedules },
        { data: nxtSchedules },
        { data: allSchedules },
        { data: reqs },
      ] = await Promise.all([
        sb.from('profiles').select('id,name').eq('is_active', true),
        sb.from('schedules').select('date').eq('user_id', user.id)
          .gte('date', curStart).lte('date', curEnd),
        sb.from('schedules').select('date').eq('user_id', user.id)
          .gte('date', nxtStart).lte('date', nxtEnd),
        sb.from('schedules').select('date,user_id')
          .gte('date', curStart).lte('date', nxtEnd),
        sb.from('exchange_requests').select('*')
          .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
          .order('requested_at', { ascending: false }),
      ])

      setWorkers(profs ?? [])
      setProfiles(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.name])))
      setMyCurrentDates((curSchedules ?? []).map((s: any) => s.date))
      setMyNextDates((nxtSchedules ?? []).map((s: any) => s.date))
      setScheduleMap(Object.fromEntries((allSchedules ?? []).map((s: any) => [s.date, s.user_id])))
      setRequests(reqs ?? [])
    })
  }, [currentYear, currentMonth, nextYear, nextMonth])

  // 선택 연월에 requester_date 또는 target_date가 걸치는 요청만 표시
  const filteredRequests = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const prefix = `${filterYear}-${pad(filterMonth)}`
    return requests.filter(r => {
      const rd = r.requester_date as string
      const td = r.target_date as string | null
      return rd.startsWith(prefix) || (td !== null && td.startsWith(prefix))
    })
  }, [requests, filterYear, filterMonth])

  const handleSubmit = async (params: {
    type: 'swap' | 'transfer'
    requesterDate: string
    targetId: string
    targetDate?: string
  }) => {
    const res = await fetch('/api/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (res.ok) {
      const { request } = await res.json()
      setRequests(prev => [request, ...prev])
    }
  }

  const handleCancel = async (exchangeId: string) => {
    const res = await fetch(`/api/exchange?id=${exchangeId}`, { method: 'DELETE' })
    if (res.ok) {
      setRequests(prev =>
        prev.map(r => r.id === exchangeId ? { ...r, status: 'cancelled' } : r)
      )
    }
  }

  const handleAccept = async (exchangeId: string) => {
    const res = await fetch('/api/exchange', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeId, action: 'accept' }),
    })
    if (res.ok) {
      setRequests(prev =>
        prev.map(r => r.id === exchangeId ? { ...r, status: 'accepted' } : r)
      )
    }
  }

  // 교환 상태 실시간 동기화 — 수락/거절 시 양쪽 화면 즉시 갱신
  useEffect(() => {
    if (!currentUserId) return
    const sb = createClient()
    const channel = sb.channel(`exchange-sync-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'exchange_requests' },
        (payload) => {
          const updated = payload.new as any
          if (updated.requester_id === currentUserId || updated.target_id === currentUserId) {
            setRequests(prev =>
              prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
            )
          }
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [currentUserId])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">당직 교환</h1>
          <div className="flex items-center gap-2">
            {/* 연월 조회 필터 */}
            <MonthPickerPopup
              year={filterYear}
              month={filterMonth}
              onSelect={(y, m) => { setFilterYear(y); setFilterMonth(m) }}
            />
            <button
              onClick={() => setModalOpen(true)}
              className="bg-toss-blue text-white text-sm font-semibold px-4 py-2 rounded-xl whitespace-nowrap"
            >
              교환 신청
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {filterYear}년 {filterMonth}월 교환 요청이 없습니다
          </div>
        ) : (
          filteredRequests.map((r: any, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">
                  {r.type === 'swap' ? '맞교환' : '일방 교체'}
                </span>
                <Badge
                  label={STATUS_LABEL[r.status] ?? r.status}
                  variant={STATUS_VARIANT[r.status] ?? 'gray'}
                />
              </div>

              {/* 맞교환: ↔, 일방 교체: → */}
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {profiles[r.requester_id] ?? '?'}
                <span className={`mx-2 ${r.type === 'swap' ? 'text-toss-blue' : 'text-gray-400'}`}>
                  {r.type === 'swap' ? '↔' : '→'}
                </span>
                {profiles[r.target_id] ?? '?'}
              </p>

              {/* 날짜 정보 */}
              <p className="text-xs text-gray-400 mt-0.5">
                {r.type === 'swap' && r.target_date
                  ? `${r.requester_date} ↔ ${r.target_date}`
                  : r.requester_date}
              </p>

              {/* 신청자: 취소 / 피신청자: 수락 */}
              {r.status === 'pending' && r.requester_id === currentUserId && (
                <button
                  onClick={() => handleCancel(r.id)}
                  className="mt-2 text-xs text-red-500 font-semibold hover:text-red-600 transition-colors"
                >
                  신청 취소
                </button>
              )}
              {r.status === 'pending' && r.target_id === currentUserId && (
                <button
                  onClick={() => handleAccept(r.id)}
                  className="mt-2 text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
                >
                  요청 수락
                </button>
              )}
            </motion.div>
          ))
        )}
      </div>

      <ExchangeRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workers={workers}
        currentUserId={currentUserId}
        myCurrentMonthDates={myCurrentDates}
        myNextMonthDates={myNextDates}
        scheduleMap={scheduleMap}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
