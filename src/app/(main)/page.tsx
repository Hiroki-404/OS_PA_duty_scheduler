export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import { ScheduleTable } from '@/components/schedule/ScheduleTable'
import { GenerateButton } from '@/components/schedule/GenerateButton'
import { DowStatsTable } from '@/components/schedule/DowStatsTable'

const PALETTE = ['#4DABF7', '#FF6B6B', '#51CF66', '#FFD43B', '#CC5DE8', '#FF922B', '#20C997']

type ScheduleWithProfile = {
  id: string
  user_id: string
  date: string
  is_weekend: boolean
  is_holiday: boolean
  is_locked: boolean
  profiles: { name: string | null; color: string | null } | null
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd   = `${year}-${pad(month)}-31`

  const [
    { data: rawSchedules },
    { data: rawProfiles },
    { data: profile },
    { data: availabilities },
    holidays,
  ] = await Promise.all([
    // FK JOIN: profiles 테이블과 조인하여 name/color 직접 획득
    supabase.from('schedules')
      .select('id, user_id, date, is_weekend, is_holiday, is_locked, profiles(name, color)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date'),
    // 전체 활성 근무자 목록 (DowStatsTable용 + workerMap 보완)
    supabase.from('profiles').select('id, name, color').eq('is_active', true),
    supabase.from('profiles').select('is_admin').eq('id', user!.id).single(),
    supabase.from('availability_requests')
      .select('user_id, date, type')
      .eq('year', year)
      .eq('month', month),
    getHolidaysForMonth(year, month, supabase),
  ])

  const schedules = (rawSchedules as unknown as ScheduleWithProfile[]) ?? []

  // workerMap 구축 (이중 보완 전략)
  // 1순위: profiles 쿼리 결과 (모든 활성 근무자 포함)
  // 2순위: schedules FK join 결과 (profiles 쿼리 실패 시 보완)
  const workerMap: Record<string, { name: string; color: string }> = {}

  ;(rawProfiles ?? []).forEach((p, i) => {
    const color = (p as { id: string; name: string | null; color?: string | null }).color
    workerMap[p.id] = {
      name: p.name ?? '미등록',
      color: color ?? PALETTE[i % PALETTE.length],
    }
  })

  // profiles 쿼리 실패하거나 누락된 경우 FK join 데이터로 보완
  schedules.forEach((s, i) => {
    if (s.user_id && !workerMap[s.user_id]) {
      workerMap[s.user_id] = {
        name: s.profiles?.name ?? '미등록',
        color: s.profiles?.color ?? PALETTE[i % PALETTE.length],
      }
    }
  })

  // ScheduleTable용: profiles 중첩 필드 제거한 순수 schedule 배열
  const scheduleList = schedules.map(({ profiles: _p, ...rest }) => rest)

  const hasSchedules = scheduleList.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{year}년 {month}월 당직표</h1>
            <p className="text-sm text-gray-400 mt-0.5">이번 달 당직 일정</p>
          </div>
          {profile?.is_admin && <GenerateButton year={year} month={month} />}
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ScheduleTable
            schedules={scheduleList}
            workerMap={workerMap}
            year={year}
            month={month}
            holidays={holidays}
            availabilities={availabilities ?? []}
          />
        </div>

        {hasSchedules && Object.keys(workerMap).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-3">요일별 당직 통계</h2>
            <DowStatsTable
              schedules={scheduleList}
              workerMap={workerMap}
            />
          </div>
        )}
      </div>
    </div>
  )
}
