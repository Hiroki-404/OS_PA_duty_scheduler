import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await request.json().catch(() => ({}))
  const db = createAdminClient()

  if (endpoint) {
    await db.from('user_push_tokens').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  } else {
    await db.from('user_push_tokens').delete().eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
