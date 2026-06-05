import { createClient } from '@/lib/supabase/server'
import { StdDevChart } from '@/components/stats/StdDevChart'
import type { MonthlyBalance } from '@/types/domain'

export default async function StatsPage() {
  const supabase = await createClient()

  const [{ data: balances }, { data: profiles }] = await Promise.all([
    supabase.from('monthly_balance').select('*').order('year').order('month'),
    supabase.from('profiles').select('id, name'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))

  const enriched = (balances ?? []).map(b => ({
    userId: b.user_id,
    year: b.year,
    month: b.month,
    totalDuties: b.total_duties,
    weekdayDuties: b.weekday_duties,
    weekendDuties: b.weekend_duties,
    holidayDuties: b.holiday_duties,
    dow: [b.dow_0, b.dow_1, b.dow_2, b.dow_3, b.dow_4, b.dow_5, b.dow_6] as MonthlyBalance['dow'],
    isInitialMonth: b.is_initial_month,
    workerName: profileMap[b.user_id] ?? '알 수 없음',
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">당직 통계</h1>
        <p className="text-sm text-gray-400 mt-0.5">전체 누적 기간 기준</p>
      </header>
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <StdDevChart balances={enriched} />
        </div>
      </div>
    </div>
  )
}
