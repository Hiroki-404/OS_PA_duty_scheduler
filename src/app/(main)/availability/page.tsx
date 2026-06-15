'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { Button } from '@/components/ui/Button'
import type { AvailabilityType } from '@/lib/algorithm/types'

type DoneState = 'idle' | 'submitted' | 'updated'

interface WorkerWithDates {
  id: string
  name: string
  submittedAt?: string
  dates?: string[]
}

// 당해 연도 6월 7일 15:30 기준으로 내년 전체 월 자동 활성화
function getYearOptions(now: Date): number[] {
  const activation = new Date(now.getFullYear(), 5, 7, 15, 30)
  return now >= activation
    ? [now.getFullYear(), now.getFullYear() + 1]
    : [now.getFullYear()]
}

function DateChip({ iso, holidays }: { iso: string; holidays: Set<string> }) {
  const d = new Date(iso)
  const day = d.getDate()
  const dow = d.getDay()
  const isHoliday = holidays.has(iso)
  let cls = 'w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center'
  if (isHoliday)     cls += ' bg-orange-400 text-white'
  else if (dow === 6) cls += ' bg-blue-500 text-white'
  else if (dow === 0) cls += ' bg-red-500 text-white'
  else               cls += ' bg-white text-black border border-black'
  return <span className={cls}>{day}</span>
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

  // 과거 월 비활성화: 현재 월 미만은 선택 불가
  const isPast = (y: number, m: number) =>
    y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)

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
                  const disabled   = isPast(pickerYear, m)
                  return (
                    <button key={m}
                      disabled={disabled}
                      onClick={() => { onSelect(pickerYear, m); setOpen(false) }}
                      className={`h-12 rounded-2xl text-sm font-bold transition-all
                        ${isSelected ? 'bg-toss-blue text-white shadow-sm'
                          : isCurrent ? 'border-2 border-toss-blue text-toss-blue'
                          : 'text-gray-700 active:bg-gray-100'}
                        ${disabled ? 'opacity-25 cursor-not-allowed' : ''}`}>
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

export default function AvailabilityPage() {
  const now = new Date()

  // 기본값: 다음 달 (12월이면 내년 1월)
  const defaultYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const defaultMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2

  const [targetYear, setTargetYear]   = useState(defaultYear)
  const [targetMonth, setTargetMonth] = useState(defaultMonth)

  const [selections, setSelections]       = useState<Record<string, AvailabilityType>>({})
  const initialRef                         = useRef<Record<string, AvailabilityType>>({})
  const [hasSubmitted, setHasSubmitted]   = useState(false)
  const [holidays, setHolidays]           = useState<string[]>([])
  const [holidaySet, setHolidaySet]       = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(false)
  const [done, setDone]                   = useState<DoneState>('idle')
  const [workers, setWorkers]             = useState<WorkerWithDates[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [dataLoading, setDataLoading]     = useState(true)

  const isDirty = JSON.stringify(selections) !== JSON.stringify(initialRef.current)

  useEffect(() => {
    // 연월 변경 시 상태 리셋
    setSelections({})
    initialRef.current = {}
    setHasSubmitted(false)
    setDone('idle')
    setHolidays([])
    setHolidaySet(new Set())
    setWorkers([])
    setDataLoading(true)

    const sb = createClient()
    const pad = (n: number) => String(n).padStart(2, '0')

    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const [
        { data: avail },
        holidaysData,
        { data: profiles },
        { data: allSubs },
        flagsResponse,
      ] = await Promise.all([
        sb.from('availability_requests')
          .select('date,type,submitted_at')
          .eq('user_id', user.id)
          .eq('year', targetYear)
          .eq('month', targetMonth),
        sb.from('holiday_cache')
          .select('date')
          .gte('date', `${targetYear}-${pad(targetMonth)}-01`)
          .lte('date', `${targetYear}-${pad(targetMonth)}-${String(new Date(targetYear, targetMonth, 0).getDate()).padStart(2, '0')}`)
          .then(({ data }) => {
            if (data && data.length > 0) return { holidays: data }
            return fetch(`/api/holidays?year=${targetYear}&month=${targetMonth}`)
              .then(r => r.json()).catch(() => ({ holidays: [] }))
          }),
        sb.from('profiles').select('id,name').eq('is_active', true),
        sb.from('availability_requests')
          .select('user_id,date,type,submitted_at')
          .eq('year', targetYear)
          .eq('month', targetMonth)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: true }),
        // 0개 제출자 감지: server API를 통해 admin client로 RLS 완전 우회
        fetch(`/api/availability/flag?year=${targetYear}&month=${targetMonth}`)
          .then(r => r.json())
          .catch(() => ({ flags: [] })),
      ])

      const sel: Record<string, AvailabilityType> = {}
      // DB 행 기반 제출 여부
      let submittedFromDb = false
      avail?.forEach((a: any) => {
        sel[a.date] = a.type
        if (a.submitted_at) submittedFromDb = true
      })

      // 0개 제출 버그 수정: localStorage 플래그로 보완
      const storageKey = `avail_submitted_${user.id}_${targetYear}_${targetMonth}`
      const submittedFromStorage = typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true'
      const submitted = submittedFromDb || submittedFromStorage

      setSelections(sel)
      initialRef.current = { ...sel }
      setHasSubmitted(submitted)

      const hDates: string[] = []
      const rawHolidays = (holidaysData as any)?.holidays ?? []
      rawHolidays.forEach((h: any) => {
        if (typeof h === 'string') hDates.push(h)
        else if (h?.date) hDates.push(h.date)
      })
      setHolidays(hDates)
      setHolidaySet(new Set(hDates))

      const datesByUser: Record<string, string[]> = {}
      const submittedAtByUser: Record<string, string> = {}
      ;(allSubs ?? []).forEach((s: any) => {
        if (!datesByUser[s.user_id]) datesByUser[s.user_id] = []
        datesByUser[s.user_id].push(s.date)
        submittedAtByUser[s.user_id] = s.submitted_at
      })
      // 0개 제출자: server API가 반환한 flags로 제출 완료 감지 (RLS 우회됨)
      ;((flagsResponse as any)?.flags ?? []).forEach((f: any) => {
        if (!submittedAtByUser[f.user_id]) {
          submittedAtByUser[f.user_id] = f.submitted_at
        }
      })

      const workerList = (profiles ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        submittedAt: submittedAtByUser[p.id],
        dates: datesByUser[p.id]?.sort() ?? [],
      }))
      workerList.sort((a, b) => {
        if (a.submittedAt && b.submittedAt) return a.submittedAt.localeCompare(b.submittedAt)
        if (a.submittedAt) return -1
        if (b.submittedAt) return 1
        return 0
      })
      setWorkers(workerList)
      setDataLoading(false)
    })()
  }, [targetYear, targetMonth])

  const handleChange = useCallback((iso: string, type: AvailabilityType | null) => {
    setSelections(prev => {
      const next = { ...prev }
      if (type === null) delete next[iso]
      else next[iso] = type
      return next
    })
    setDone('idle')
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    const pad = (n: number) => String(n).padStart(2, '0')
    const nowIso = new Date().toISOString()

    const { error: delErr } = await sb.from('availability_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('year', targetYear)
      .eq('month', targetMonth)

    if (delErr) { console.error('[제출] 삭제 실패:', delErr); setLoading(false); return }

    const entries = Object.entries(selections)
    if (entries.length > 0) {
      const { error: insErr } = await sb.from('availability_requests').insert(
        entries.map(([date, type]) => ({
          user_id: user.id, year: targetYear, month: targetMonth,
          date, type, submitted_at: nowIso,
        }))
      )
      if (insErr) { console.error('[제출] 삽입 실패:', insErr); setLoading(false); return }
    }

    // 0개 선택 제출: localStorage 플래그 + 서버 API(admin client)로 DB 플래그 기록
    // 클라이언트 사이드 upsert는 RLS silent fail 위험 → API route 경유
    const storageKey = `avail_submitted_${user.id}_${targetYear}_${targetMonth}`
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, 'true')
    await fetch('/api/availability/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: targetYear, month: targetMonth, submitted_at: nowIso }),
    })

    const isUpdate = hasSubmitted
    initialRef.current = { ...selections }
    setHasSubmitted(true)
    setDone(isUpdate ? 'updated' : 'submitted')
    setWorkers(prev => prev.map(w =>
      w.id === user.id
        ? { ...w, submittedAt: nowIso, dates: Object.keys(selections).sort() }
        : w
    ))
    setLoading(false)
  }

  const handleMonthSelect = (y: number, m: number) => {
    setTargetYear(y)
    setTargetMonth(m)
  }

  const btnLabel    = !hasSubmitted ? '제출하기' : isDirty ? '수정하기' : '이미 제출됨'
  const btnDisabled = loading || (!isDirty && hasSubmitted)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">제외일 선택</h1>
            <p className="text-sm text-gray-400 mt-0.5">당직 제외일을 선택 후 제출하세요</p>
          </div>
          <MonthPickerPopup
            year={targetYear}
            month={targetMonth}
            onSelect={handleMonthSelect}
          />
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <MonthCalendar
            year={targetYear}
            month={targetMonth}
            selections={selections}
            holidays={holidays}
            onChange={handleChange}
          />
        </div>

        <AnimatePresence>
          {done !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold text-center
                ${done === 'submitted' ? 'bg-toss-blue text-white' : 'bg-green-500 text-white'}`}
            >
              {done === 'submitted' ? '✓ 제출 완료!' : '✓ 수정 완료!'}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <span className="text-sm text-gray-600">
            선택한 날짜: <strong>{Object.keys(selections).length}일</strong>
          </span>
          <Button size="sm" loading={loading} disabled={btnDisabled} variant="primary" onClick={handleSubmit}>
            {btnLabel}
          </Button>
        </div>

        {dataLoading && (
          <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="h-4 w-28 bg-gray-100 rounded mb-3" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 mb-2">
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                  <div className="h-2 w-16 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!dataLoading && workers.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-3">팀 제출 현황</h2>
            <div className="space-y-3">
              {workers.map((w, i) => {
                // 본인이 0개 제출한 경우 DB 행이 없어도 hasSubmitted(localStorage) 로 판단
                const isMe = w.id === currentUserId
                const isSubmitted = isMe ? hasSubmitted : !!w.submittedAt
                return (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-2xl transition-all
                      ${isSubmitted ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 opacity-50 blur-[1px]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                        ${isSubmitted ? 'bg-toss-blue text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {w.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800">
                          {w.name}{isMe && ' (나)'}
                        </div>
                        {isSubmitted
                          ? <div className="text-xs text-green-600 mt-0.5">제출 완료</div>
                          : <div className="text-xs text-gray-400 mt-0.5">미제출</div>}
                      </div>
                      {isSubmitted && <span className="text-toss-blue text-xl shrink-0">✓</span>}
                    </div>
                    {isSubmitted && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.dates && w.dates.length > 0
                          ? w.dates.map(iso => (
                              <DateChip key={iso} iso={iso} holidays={holidaySet} />
                            ))
                          : <span className="text-xs text-gray-400">제외일 없음</span>
                        }
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
