import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateSchedule, computeMonthlyBalance } from '@/lib/algorithm/scheduler'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import type { WorkerInfo, AvailabilityMap } from '@/lib/algorithm/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { year, month } = await request.json()
  if (!year || !month) return NextResponse.json({ error: 'year, month required' }, { status: 400 })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[SCHEDULE] 배정 시작: ${year}년 ${month}월`)
  console.log(`${'='.repeat(60)}`)

  try {
    const pad = (n: number) => String(n).padStart(2, '0')
    const rangeStart = `${year}-${pad(month)}-01`
    const rangeEnd   = `${year}-${pad(month)}-31`

    // 1. 제출 완료된 availability_requests 조회
    const { data: availData, error: availError } = await supabase
      .from('availability_requests')
      .select('user_id, date, type')
      .eq('year', year)
      .eq('month', month)
      .not('submitted_at', 'is', null)

    if (availError) console.error('[SCHEDULE] availability 조회 오류:', availError.message)

    const submittedUserIds = new Set((availData ?? []).map(a => a.user_id))
    console.log(`[SCHEDULE] 제출 완료 건수: ${(availData ?? []).length}건 / 제출자 수: ${submittedUserIds.size}명`)

    // 2. 활성 근무자 조회
    const [{ data: profilesData, error: profilesError }, { data: periods }] = await Promise.all([
      supabase.from('profiles').select('id, name').eq('is_active', true),
      supabase.from('worker_periods').select('user_id, start_date, end_date'),
    ])

    if (profilesError) console.error('[SCHEDULE] profiles 조회 오류:', profilesError.message)

    const allActive = profilesData ?? []
    console.log(`[SCHEDULE] 전체 활성 근무자: ${allActive.map(p => p.name).join(', ')} (${allActive.length}명)`)

    const targetProfiles = submittedUserIds.size > 0
      ? allActive.filter(p => submittedUserIds.has(p.id))
      : allActive

    console.log(`[SCHEDULE] 배정 대상자 (${targetProfiles.length}명): ${targetProfiles.map(p => p.name).join(', ')}`)

    if (!targetProfiles.length) {
      console.warn('[SCHEDULE] 배정 대상자 없음 → 중단')
      return NextResponse.json({ error: '제출 완료한 근무자가 없습니다' }, { status: 400 })
    }

    const workers: WorkerInfo[] = targetProfiles.map(p => {
      const period = periods?.find(wp => wp.user_id === p.id)
      return {
        id: p.id,
        name: p.name,
        activePeriod: period
          ? { startDate: period.start_date, endDate: period.end_date ?? undefined }
          : undefined,
      }
    })

    // 3. AvailabilityMap 구성
    const availabilities: AvailabilityMap = {}
    for (const a of availData ?? []) {
      if (!availabilities[a.user_id]) availabilities[a.user_id] = {}
      availabilities[a.user_id][a.date] = a.type
    }

    // 가용성 맵 요약 로그
    const workerNameMap = Object.fromEntries(workers.map(w => [w.id, w.name]))
    console.log('[SCHEDULE] 가용성 신청 내역:')
    for (const [uid, dates] of Object.entries(availabilities)) {
      const entries = Object.entries(dates).map(([d, t]) => `  ${d}:${t}`).join('\n')
      console.log(`  ${workerNameMap[uid] ?? uid}:\n${entries}`)
    }

    // 4. 이전 달 이월 데이터
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year
    const { data: prevBalances } = await supabase
      .from('monthly_balance')
      .select('*')
      .eq('year', prevYear)
      .eq('month', prevMonth)

    const prevData = (prevBalances ?? []).map(b => ({
      userId:        b.user_id,
      weekendDuties: b.weekend_duties,
      holidayDuties: b.holiday_duties,
      weekdayDuties: b.weekday_duties,
      dow: [b.dow_0, b.dow_1, b.dow_2, b.dow_3, b.dow_4, b.dow_5, b.dow_6] as
        [number,number,number,number,number,number,number],
      isInitialMonth: b.is_initial_month,
    }))
    console.log(`[SCHEDULE] 이월 데이터: ${prevData.length ? `${prevYear}년 ${prevMonth}월 기록 ${prevData.length}건` : '없음 (초기 배정)'}`)

    // 5. 공휴일
    const holidays = await getHolidaysForMonth(year, month, supabase)
    console.log(`[SCHEDULE] 공휴일: ${holidays.length ? holidays.map(h => `${h.date}(${h.name})`).join(', ') : '없음'}`)

    // 6. 알고리즘 실행
    console.log('\n[SCHEDULE] ── 알고리즘 시작 ──')
    const result = generateSchedule(year, month, workers, availabilities, prevData, holidays)
    console.log('[SCHEDULE] ── 알고리즘 완료 ──\n')

    // 결과 요약
    const assignmentSummary: Record<string, number> = {}
    for (const [, uid] of result.assignments) {
      assignmentSummary[uid] = (assignmentSummary[uid] ?? 0) + 1
    }
    console.log('[SCHEDULE] 배정 결과 요약:')
    for (const w of workers) {
      console.log(`  ${w.name}: ${assignmentSummary[w.id] ?? 0}회`)
    }

    if (result.warnings.length) {
      console.warn(`[SCHEDULE] 경고 ${result.warnings.length}건:`)
      result.warnings.forEach(w => console.warn(`  ${w.date}: ${w.reason}`))
    } else {
      console.log('[SCHEDULE] 경고 없음 ✓')
    }

    // 7. 기존 스케줄 삭제 후 INSERT
    const { error: deleteError } = await supabase.from('schedules').delete().gte('date', rangeStart).lte('date', rangeEnd)
    if (deleteError) console.error('[SCHEDULE] 기존 스케줄 삭제 오류:', deleteError.message)

    const rows = [...result.assignments.entries()].map(([date, userId]) => {
      const d = new Date(date)
      return {
        user_id:    userId,
        date,
        is_weekend: [0, 6].includes(d.getDay()),
        is_holiday: holidays.some(h => h.date === date),
        is_locked:  false,
        created_by: user.id,
      }
    })

    const { error: insertError } = await supabase.from('schedules').insert(rows)
    if (insertError) console.error('[SCHEDULE] INSERT 오류:', insertError.message)
    else console.log(`[SCHEDULE] schedules INSERT 완료: ${rows.length}건`)

    // 8. monthly_balance 저장
    const balances = computeMonthlyBalance(year, month, result.assignments, workers, holidays)
    const { error: balanceError } = await supabase.from('monthly_balance').upsert(
      balances.map(b => ({
        user_id: b.userId, year, month,
        total_duties:   b.weekdayDuties + b.weekendDuties + b.holidayDuties,
        weekday_duties: b.weekdayDuties,
        weekend_duties: b.weekendDuties,
        holiday_duties: b.holidayDuties,
        dow_0: b.dow[0], dow_1: b.dow[1], dow_2: b.dow[2], dow_3: b.dow[3],
        dow_4: b.dow[4], dow_5: b.dow[5], dow_6: b.dow[6],
        is_initial_month: prevData.length === 0,
      }))
    )
    if (balanceError) console.error('[SCHEDULE] monthly_balance upsert 오류:', balanceError.message)

    console.log(`${'='.repeat(60)}`)
    console.log(`[SCHEDULE] 완료: ${rows.length}일 배정, 근무자 ${workers.length}명`)
    console.log(`${'='.repeat(60)}\n`)

    return NextResponse.json({
      success: true,
      count: rows.length,
      workers: workers.length,
      warnings: result.warnings,
    })
  } catch (e: any) {
    console.error('[SCHEDULE] 치명적 오류:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { year, month, lock } = await request.json()
  const pad = (n: number) => String(n).padStart(2, '0')

  await supabase.from('schedules')
    .update({ is_locked: lock ?? true })
    .gte('date', `${year}-${pad(month)}-01`)
    .lte('date', `${year}-${pad(month)}-31`)

  if (lock) {
    const { data: workers } = await supabase.from('profiles').select('id').eq('is_active', true)
    await supabase.from('notifications').insert(
      (workers ?? []).map(w => ({
        user_id: w.id,
        type: 'schedule_published',
        payload: { year, month },
      }))
    )
  }

  return NextResponse.json({ success: true })
}
