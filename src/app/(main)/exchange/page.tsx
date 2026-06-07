'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { ExchangeRequestModal } from '@/components/exchange/ExchangeRequestModal'
import { ExchangeNotificationBanner } from '@/components/exchange/ExchangeNotificationBanner'
import { Badge } from '@/components/ui/Badge'

const STATUS_LABEL: Record<string, string> = {
  pending: '대기', accepted: '수락됨', rejected: '거절됨', cancelled: '취소됨'
}
const STATUS_VARIANT: Record<string, 'blue' | 'green' | 'red' | 'gray'> = {
  pending: 'blue', accepted: 'green', rejected: 'red', cancelled: 'gray'
}

export default function ExchangePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [workers, setWorkers] = useState<Array<{ id: string; name: string }>>([])
  const [myCurrentDates, setMyCurrentDates] = useState<string[]>([])
  const [myNextDates, setMyNextDates] = useState<string[]>([])
  // date → user_id: 이번 달 + 다음 달 전체 스케줄 (맞교환 대상자 자동 추적용)
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({})
  const [requests, setRequests] = useState<any[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})

  const now = new Date()
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
        // 맞교환 대상자 조회: 두 달 전체 스케줄의 date→user_id 맵
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

  return (
    <div className="min-h-screen bg-gray-50">
      <ExchangeNotificationBanner userId={currentUserId} />
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">당직 교환</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-toss-blue text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            교환 신청
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {requests.length === 0
          ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              진행 중인 교환 요청이 없습니다
            </div>
          )
          : requests.map((r: any, i) => (
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
              <p className="text-xs text-gray-500">
                {profiles[r.requester_id] ?? '?'} → {profiles[r.target_id] ?? '?'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {r.requester_date}{r.target_date ? ` ↔ ${r.target_date}` : ''}
              </p>
              {/* 대기 상태인 내 요청만 취소 버튼 노출 */}
              {r.status === 'pending' && r.requester_id === currentUserId && (
                <button
                  onClick={() => handleCancel(r.id)}
                  className="mt-2 text-xs text-red-500 font-semibold hover:text-red-600 transition-colors"
                >
                  신청 취소
                </button>
              )}
            </motion.div>
          ))
        }
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
