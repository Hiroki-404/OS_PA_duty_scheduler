import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// 제출 플래그를 admin client로 기록 — 클라이언트 RLS 우회
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year, month, submitted_at } = await request.json()
  if (!year || !month) return NextResponse.json({ error: 'year, month required' }, { status: 400 })

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

  const { error } = await db.from('monthly_submission_flags').upsert(
    { user_id: user.id, year, month, submitted_at: submitted_at ?? new Date().toISOString() },
    { onConflict: 'user_id,year,month' }
  )

  if (error) {
    console.error('[FLAG] upsert 오류:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
