import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/schedule/reset?year=2026&month=6
// 관리자 전용: 해당 월 schedules + exchange_requests + monthly_balance 삭제 (availability_requests 보존)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const year  = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year, month 파라미터가 필요합니다' }, { status: 400 })
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const rangeStart = `${year}-${pad(month)}-01`
  const lastDay    = new Date(year, month, 0).getDate()
  const rangeEnd   = `${year}-${pad(month)}-${pad(lastDay)}`

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

  const { error } = await db
    .from('schedules')
    .delete()
    .gte('date', rangeStart)
    .lte('date', rangeEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: balanceError } = await db
    .from('monthly_balance')
    .delete()
    .eq('year', year)
    .eq('month', month)

  if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 500 })

  // 해당 월에 걸치는 교환 내역 삭제 (requester_date 또는 target_date 기준)
  const { error: exError } = await db
    .from('exchange_requests')
    .delete()
    .or(
      `and(requester_date.gte.${rangeStart},requester_date.lte.${rangeEnd}),and(target_date.gte.${rangeStart},target_date.lte.${rangeEnd})`
    )

  if (exError) return NextResponse.json({ error: exError.message }, { status: 500 })

  return NextResponse.json({ success: true, year, month })
}
