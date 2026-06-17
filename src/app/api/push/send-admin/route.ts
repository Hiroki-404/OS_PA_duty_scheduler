import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, saveNotification } from '@/lib/push'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { targetUserId, message } = body

  if (!targetUserId || !message?.trim()) {
    return NextResponse.json({ error: '수신자와 메시지를 입력해주세요' }, { status: 400 })
  }

  const db = createAdminClient()
  const title = '관리자 메시지'
  const content = (message as string).trim()

  await Promise.all([
    sendPushToUser(targetUserId, { title, body: content, url: '/settings' }),
    saveNotification(db, targetUserId, title, content, 'exchange'),
  ])

  return NextResponse.json({ success: true })
}
