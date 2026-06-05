import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userIds, type, payload } = await request.json()
  if (!userIds?.length || !type) {
    return NextResponse.json({ error: 'userIds and type required' }, { status: 400 })
  }

  const { error } = await supabase.from('notifications').insert(
    userIds.map((uid: string) => ({ user_id: uid, type, payload: payload ?? {} }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: userIds.length })
}
