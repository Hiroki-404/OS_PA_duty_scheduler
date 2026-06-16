import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type AnyDB = ReturnType<typeof createAdminClient>

async function recalculateBalance(db: AnyDB, year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`

  const { data: schedules } = await db.from('schedules')
    .select('user_id, date, is_weekend, is_holiday')
    .gte('date', monthStart)
    .lte('date', monthEnd)

  if (!schedules || schedules.length === 0) {
    await db.from('monthly_balance').delete().eq('year', year).eq('month', month)
    return
  }

  const map: Record<string, { total: number; weekday: number; weekend: number; holiday: number; dow: number[] }> = {}
  for (const s of schedules) {
    if (!map[s.user_id]) map[s.user_id] = { total: 0, weekday: 0, weekend: 0, holiday: 0, dow: [0, 0, 0, 0, 0, 0, 0] }
    const b = map[s.user_id]
    b.total++
    if (s.is_holiday) b.holiday++
    else if (s.is_weekend) b.weekend++
    else b.weekday++
    b.dow[new Date(s.date + 'T00:00:00').getDay()]++
  }

  const inserts = Object.entries(map).map(([uid, b]) => ({
    user_id: uid, year, month,
    total_duties: b.total, weekday_duties: b.weekday, weekend_duties: b.weekend, holiday_duties: b.holiday,
    dow_0: b.dow[0], dow_1: b.dow[1], dow_2: b.dow[2], dow_3: b.dow[3],
    dow_4: b.dow[4], dow_5: b.dow[5], dow_6: b.dow[6],
    is_initial_month: false,
  }))

  await db.from('monthly_balance').delete().eq('year', year).eq('month', month)
  if (inserts.length > 0) await db.from('monthly_balance').insert(inserts)
}

// PATCH /api/schedule/override
// 관리자 전용: 특정 날짜의 당직자를 수동으로 교체하고 통계를 즉시 재계산
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { scheduleId, newUserId } = await request.json()
  if (!scheduleId || !newUserId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : (supabase as unknown as AnyDB)

  const { data: schedule } = await db.from('schedules').select('id, date').eq('id', scheduleId).single()
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const { error } = await db.from('schedules').update({ user_id: newUserId }).eq('id', scheduleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const [y, m] = (schedule.date as string).slice(0, 7).split('-').map(Number)
  await recalculateBalance(db, y, m)

  return NextResponse.json({ success: true })
}
