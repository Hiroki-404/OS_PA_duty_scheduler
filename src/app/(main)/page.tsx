export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import { ScheduleTable } from '@/components/schedule/ScheduleTable'
import { GenerateButton } from '@/components/schedule/GenerateButton'
import { ResetButton } from '@/components/schedule/ResetButton'
import { YearMonthSelector } from '@/components/schedule/YearMonthSelector'
import { DowStatsTable } from '@/components/schedule/DowStatsTable'

const PALETTE = ['#4DABF7', '#FF6B6B', '#51CF66', '#FFD43B', '#CC5DE8', '#FF922B', '#20C997']

type ScheduleWithProfile = {
  id: string
  user_id: string
  date: string
  is_weekend: boolean
  is_holiday: boolean
  is_locked: boolean
  profiles: { name: string | null; color?: string | null } | null
}

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const supabase = await createClient()
  const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const params = await searchParams
  const year  = params.year  ? Number(params.year)  : now.getFullYear()
  const month = params.month ? Number(params.month) : now.getMonth() + 1

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDay    = new Date(year, month, 0).getDate()
  const monthEnd   = `${year}-${pad(month)}-${pad(lastDay)}`

  const [
    { data: rawSchedules },
    { data: rawProfilesData, error: profilesError },
    { data: profile },
    { data: availabilities },
    holidays,
    { data: rawExchanges },
  ] = await Promise.all([
    // FK JOIN: profiles 테이블과 조인하여 name만 획득 (color는 DB에 없을 수 있으므로 제외)
    supabase.from('schedules')
      .select('id, user_id, date, is_weekend, is_holiday, is_locked, profiles(name)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date'),
    // 전체 활성 근무자 목록 (admin client로 RLS 우회, 없으면 일반 client 폴백)
    (adminSupabase ?? supabase).from('profiles').select('id, name, color').eq('is_active', true).order('created_at'),
    supabase.from('profiles').select('is_admin').eq('id', user!.id).single(),
    supabase.from('availability_requests')
      .select('user_id, date, type')
      .eq('year', year)
      .eq('month', month),
    getHolidaysForMonth(year, month, supabase).catch(() => []),
    // 확정된 교환 요청 (캘린더 바인딩용)
    (adminSupabase ?? supabase)
      .from('exchange_requests')
      .select('id, requester_id, target_id, requester_date, target_date, type')
      .eq('status', 'accepted'),
  ])

  // color 컬럼 없을 때 폴백: name만 조회
  let rawProfiles: { id: string; name: string | null; color?: string | null }[] | null = rawProfilesData
  if (!rawProfilesData && profilesError) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at')
    rawProfiles = data
  }

  const schedules = (rawSchedules as unknown as ScheduleWithProfile[]) ?? []

  // 이번 달 확정 교환만 필터링
  const exchanges = (rawExchanges ?? []).filter(ex => {
    const rd = ex.requester_date as string
    const td = ex.target_date as string | null
    return (rd >= monthStart && rd <= monthEnd) || (td != null && td >= monthStart && td <= monthEnd)
  })

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

  // profiles 쿼리 실패하거나 누락된 경우 FK join 데이터로 보완 (color는 PALETTE 사용)
  schedules.forEach((s, i) => {
    if (s.user_id && !workerMap[s.user_id]) {
      workerMap[s.user_id] = {
        name: s.profiles?.name ?? '미등록',
        color: PALETTE[i % PALETTE.length],
      }
    }
  })

  // ScheduleTable용: profiles 중첩 필드 제거한 순수 schedule 배열
  const scheduleList = schedules.map(({ profiles: _p, ...rest }) => rest)

  const hasSchedules = scheduleList.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{year}년 {month}월 당직표</h1>
            <p className="text-sm text-gray-400 mt-0.5">이번 달 당직 일정</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <YearMonthSelector year={year} month={month} />
            {profile?.is_admin && (
              <>
                <ResetButton year={year} month={month} />
                <GenerateButton year={year} month={month} hasSchedules={hasSchedules} />
              </>
            )}
          </div>
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
            exchanges={exchanges}
          />
        </div>

        {hasSchedules && (
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
