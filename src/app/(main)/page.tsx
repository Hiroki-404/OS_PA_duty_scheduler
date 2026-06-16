export const dynamic = 'force-dynamic'
export const revalidate = 0
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import { AdminScheduleSection } from '@/components/schedule/AdminScheduleSection'
import { GenerateButton } from '@/components/schedule/GenerateButton'
import { ResetButton } from '@/components/schedule/ResetButton'
import { YearMonthSelector } from '@/components/schedule/YearMonthSelector'

// 파스텔 무지개 팔레트 — 설정 탭 피커와 동일한 12색 폴백
const PALETTE = [
  '#EF9A9A', '#FFCC80', '#FFF176', '#C5E1A5', '#A5D6A7', '#80CBC4',
  '#80DEEA', '#90CAF9', '#9FA8DA', '#CE93D8', '#F48FB1', '#FFAB76',
]

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const supabase = await createClient()
  // RLS 완전 우회: 모든 데이터 조회에 admin client 사용
  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

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
    { data: rawProfilesData },
    { data: profile },
    { data: availabilities },
    holidays,
    { data: rawExchanges },
  ] = await Promise.all([
    // FK 조인 제거: profiles 는 별도 쿼리로 충분
    db.from('schedules')
      .select('id, user_id, date, is_weekend, is_holiday, is_locked')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date'),
    // profiles.color 우선 사용, 미설정 시 PALETTE 인덱스 폴백
    db.from('profiles').select('id, name, color').eq('is_active', true).order('created_at'),
    supabase.from('profiles').select('is_admin').eq('id', user!.id).single(),
    db.from('availability_requests')
      .select('user_id, date, type')
      .eq('year', year)
      .eq('month', month),
    getHolidaysForMonth(year, month, db).catch(() => [] as { date: string; name: string }[]),
    db.from('exchange_requests')
      .select('id, requester_id, target_id, requester_date, target_date, type')
      .eq('status', 'accepted'),
  ])

  // workerMap: adminClient로 가져온 전체 활성 근무자 기반 구성
  const workerMap: Record<string, { name: string; color: string }> = {}
  ;(rawProfilesData ?? []).forEach((p, i) => {
    const profile = p as { id: string; name: string | null; color: string | null }
    workerMap[p.id] = {
      name: profile.name ?? '미등록',
      color: profile.color ?? PALETTE[i % PALETTE.length],
    }
  })

  const scheduleList = (rawSchedules ?? []) as Array<{
    id: string; user_id: string; date: string
    is_weekend: boolean; is_holiday: boolean; is_locked: boolean
  }>

  // 이번 달에 걸치는 확정 교환만 필터링
  const exchanges = (rawExchanges ?? []).filter(ex => {
    const rd = ex.requester_date as string
    const td = ex.target_date as string | null
    return (rd >= monthStart && rd <= monthEnd) ||
           (td != null && td >= monthStart && td <= monthEnd)
  })

  const hasSchedules = scheduleList.length > 0
  const isAdmin = profile?.is_admin ?? false

  // 드롭다운 필터링용 전체 근무자 배열
  const allWorkers = Object.entries(workerMap).map(([id, info]) => ({ id, ...info }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <YearMonthSelector year={year} month={month} />
            {isAdmin && (
              <>
                <ResetButton year={year} month={month} />
                <GenerateButton year={year} month={month} hasSchedules={hasSchedules} />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <AdminScheduleSection
          schedules={scheduleList}
          workerMap={workerMap}
          allWorkers={allWorkers}
          year={year}
          month={month}
          holidays={holidays}
          availabilities={availabilities ?? []}
          exchanges={exchanges}
          isAdmin={isAdmin}
          hasSchedules={hasSchedules}
        />
      </div>
    </div>
  )
}
