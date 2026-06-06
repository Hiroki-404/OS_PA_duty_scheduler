'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { SubmissionStatus } from '@/components/schedule/SubmissionStatus'
import { Button } from '@/components/ui/Button'
import type { AvailabilityType } from '@/lib/algorithm/types'

type DoneState = 'idle' | 'submitted' | 'updated'

interface WorkerWithDates {
  id: string
  name: string
  submittedAt?: string
  dates?: string[]
}

function DateChip({ iso, holidays }: { iso: string; holidays: Set<string> }) {
  const d = new Date(iso)
  const day = d.getDate()
  const dow = d.getDay()
  const isHoliday = holidays.has(iso)

  let cls = 'w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center'
  if (isHoliday) {
    cls += ' bg-orange-400 text-white'
  } else if (dow === 6) {
    cls += ' bg-blue-500 text-white'
  } else if (dow === 0) {
    cls += ' bg-red-500 text-white'
  } else {
    cls += ' bg-white text-black border border-black'
  }

  return <span className={cls}>{day}</span>
}

export default function AvailabilityPage() {
  const now = new Date()
  const targetYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const targetMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2

  const [selections, setSelections]       = useState<Record<string, AvailabilityType>>({})
  const initialRef                         = useRef<Record<string, AvailabilityType>>({})
  const [hasSubmitted, setHasSubmitted]   = useState(false)
  const [holidays, setHolidays]           = useState<string[]>([])
  const [holidaySet, setHolidaySet]       = useState<Set<string>>(new Set())
  const [loading, setLoading]             = useState(false)
  const [done, setDone]                   = useState<DoneState>('idle')
  const [workers, setWorkers]             = useState<WorkerWithDates[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  const isDirty = JSON.stringify(selections) !== JSON.stringify(initialRef.current)

  useEffect(() => {
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
      ] = await Promise.all([
        // 명시적 user_id 필터 — RLS 우회 방지
        sb.from('availability_requests')
          .select('date,type,submitted_at')
          .eq('user_id', user.id)
          .eq('year', targetYear)
          .eq('month', targetMonth),
        // 공휴일
        sb.from('holiday_cache')
          .select('date')
          .gte('date', `${targetYear}-${pad(targetMonth)}-01`)
          .lte('date', `${targetYear}-${pad(targetMonth)}-31`)
          .then(({ data }) => {
            if (data && data.length > 0) return { holidays: data }
            return fetch(`/api/holidays?year=${targetYear}&month=${targetMonth}`)
              .then(r => r.json()).catch(() => ({ holidays: [] }))
          }),
        sb.from('profiles').select('id,name').eq('is_active', true),
        // 팀 전체 제출 현황
        sb.from('availability_requests')
          .select('user_id,date,type,submitted_at')
          .eq('year', targetYear)
          .eq('month', targetMonth)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: true }),
      ])

      const sel: Record<string, AvailabilityType> = {}
      let submitted = false
      avail?.forEach((a: any) => {
        sel[a.date] = a.type
        if (a.submitted_at) submitted = true
      })
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

    // 1단계: 기존 데이터 삭제 (실패 시 중단)
    const { error: delErr } = await sb.from('availability_requests')
      .delete()
      .eq('user_id', user.id)
      .eq('year', targetYear)
      .eq('month', targetMonth)

    if (delErr) {
      console.error('[제출] 삭제 실패:', delErr)
      setLoading(false)
      return
    }

    // 2단계: 새 데이터 삽입 (삭제 후라 충돌 없음)
    const entries = Object.entries(selections)
    if (entries.length > 0) {
      const { error: insErr } = await sb.from('availability_requests').insert(
        entries.map(([date, type]) => ({
          user_id: user.id, year: targetYear, month: targetMonth,
          date, type, submitted_at: nowIso,
        }))
      )
      if (insErr) {
        console.error('[제출] 삽입 실패:', insErr)
        setLoading(false)
        return
      }
    } else {
      // 선택 없이 제출 — 제출 완료 표시용 더미 행
      await sb.from('availability_requests').insert([{
        user_id: user.id, year: targetYear, month: targetMonth,
        date: `${targetYear}-${pad(targetMonth)}-01`,
        type: 'exclude' as const, submitted_at: nowIso,
      }])
    }

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

  const btnLabel = !hasSubmitted ? '제출하기' : isDirty ? '수정하기' : '이미 제출됨'
  const btnDisabled = loading || (!isDirty && hasSubmitted)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">{targetYear}년 {targetMonth}월 제외일 입력</h1>
        <p className="text-sm text-gray-400 mt-0.5">당직을 쉬고 싶은 날을 선택하세요</p>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* 달력 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <MonthCalendar
            year={targetYear}
            month={targetMonth}
            selections={selections}
            holidays={holidays}
            onChange={handleChange}
          />
        </div>

        {/* 완료 피드백 */}
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

        {/* 선택 수 + 제출/수정 버튼 */}
        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <span className="text-sm text-gray-600">
            선택한 날짜: <strong>{Object.keys(selections).length}일</strong>
          </span>
          <Button
            size="sm"
            loading={loading}
            disabled={btnDisabled}
            variant="primary"
            onClick={handleSubmit}
          >
            {btnLabel}
          </Button>
        </div>

        {/* 제출 현황 */}
        {hasSubmitted && workers.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-3">팀 제출 현황</h2>
            <div className="space-y-3">
              {workers.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-4 rounded-2xl transition-all
                    ${w.submittedAt
                      ? 'bg-blue-50 border border-blue-100'
                      : 'bg-gray-50 opacity-50 blur-[1px]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                      ${w.submittedAt ? 'bg-toss-blue text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {w.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800">
                        {w.name}{w.id === currentUserId && ' (나)'}
                      </div>
                      {w.submittedAt
                        ? <div className="text-xs text-green-600 mt-0.5">제출 완료</div>
                        : <div className="text-xs text-gray-400 mt-0.5">미제출</div>
                      }
                    </div>
                    {w.submittedAt && <span className="text-toss-blue text-xl shrink-0">✓</span>}
                  </div>
                  {/* 날짜 컬러 칩 */}
                  {w.submittedAt && w.dates && w.dates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {w.dates.map(iso => (
                        <DateChip key={iso} iso={iso} holidays={holidaySet} />
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
