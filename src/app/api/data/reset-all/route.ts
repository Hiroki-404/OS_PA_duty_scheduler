import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // monthly_submission_flags: PK가 복합키라 별도 삭제
  await supabase.from('monthly_submission_flags').delete().gte('year', 1)

  const tables = ['exchange_requests', 'schedules', 'monthly_balance', 'availability_requests'] as const
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
