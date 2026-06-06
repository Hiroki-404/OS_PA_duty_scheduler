import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/schedule/reset?year=2026&month=6
// 관리자 전용: 해당 월 schedules 데이터만 삭제 (availability_requests 보존)
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

  const { error } = await supabase
    .from('schedules')
    .delete()
    .gte('date', rangeStart)
    .lte('date', rangeEnd)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: balanceError } = await supabase
    .from('monthly_balance')
    .delete()
    .eq('year', year)
    .eq('month', month)

  if (balanceError) {
    return NextResponse.json({ error: balanceError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, year, month })
}
