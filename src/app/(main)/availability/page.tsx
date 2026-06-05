'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { SubmissionStatus } from '@/components/schedule/SubmissionStatus'
import { Button } from '@/components/ui/Button'
import type { AvailabilityType } from '@/lib/algorithm/types'

type DoneState = 'idle' | 'submitted' | 'updated'

export default function AvailabilityPage() {
  const now = new Date()
  const targetYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const targetMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2

  const [selections, setSelections]           = useState<Record<string, AvailabilityType>>({})
  const initialRef                             = useRef<Record<string, AvailabilityType>>({})
  const [hasSubmitted, setHasSubmitted]        = useState(false)
  const [holidays, setHolidays]               = useState<string[]>([])
  const [loading, setLoading]                 = useState(false)
  const [done, setDone]                       = useState<DoneState>('idle')
  const [workers, setWorkers]                 = useState<Array<{ id: string; name: string; submittedAt?: string }>>([])
  const [currentUserId, setCurrentUserId]     = useState('')

  const isDirty = JSON.stringify(selections) !== JSON.stringify(initialRef.current)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.auth.getUser(),
      sb.from('availability_requests')
        .select('date,type,submitted_at')
        .eq('year', targetYear)
        .eq('month', targetMonth),
      fetch(`/api/holidays?year=${targetYear}&month=${targetMonth}`)
        .then(r => r.json()).catch(() => ({ holidays: [] })),
      sb.from('profiles').select('id,name').eq('is_active', true),
    ]).then(([{ data: { user } }, { data: avail }, holidaysData, { data: profiles }]) => {
      setCurrentUserId(user?.id ?? '')

      const sel: Record<string, AvailabilityType> = {}
      let submitted = false
      avail?.forEach((a: any) => {
        sel[a.date] = a.type
        if (a.submitted_at) submitted = true
      })
      setSelections(sel)
      initialRef.current = { ...sel }
      setHasSubmitted(submitted)
      setHolidays((holidaysData?.holidays ?? []).map((h: any) => h.date))

      sb.from('availability_requests')
        .select('user_id,submitted_at')
        .eq('year', targetYear)
        .eq('month', targetMonth)
        .then(({ data: subs }) => {
          const subMap: Record<string, string> = {}
          subs?.forEach((s: any) => { if (s.submitted_at) subMap[s.user_id] = s.submitted_at })
          setWorkers((profiles ?? []).map((p: any) => ({ id: p.id, name: p.name, submittedAt: subMap[p.id] })))
        })
    })
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
    if (!user) return

    const pad = (n: number) => String(n).padStart(2, '0')
    const nowIso = new Date().toISOString()

    await sb.from('availability_requests')
      .delete().eq('user_id', user.id).eq('year', targetYear).eq('month', targetMonth)

    const entries = Object.entries(selections)
    if (entries.length > 0) {
      await sb.from('availability_requests').upsert(
        entries.map(([date, type]) => ({
          user_id: user.id, year: targetYear, month: targetMonth,
          date, type, submitted_at: nowIso,
        }))
      )
    } else {
      await sb.from('availability_requests').upsert([{
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
      w.id === user.id ? { ...w, submittedAt: nowIso } : w
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
            variant={isDirty && hasSubmitted ? 'primary' : 'primary'}
            onClick={handleSubmit}
          >
            {btnLabel}
          </Button>
        </div>

        {/* 제출 현황 */}
        {hasSubmitted && workers.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-700 mb-3">팀 제출 현황</h2>
            <SubmissionStatus workers={workers} currentUserId={currentUserId} />
          </div>
        )}
      </div>
    </div>
  )
}
