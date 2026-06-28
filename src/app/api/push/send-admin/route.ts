import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, saveNotification } from '@/lib/push'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // is_admin 체크와 name 조회를 단일 쿼리로
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { targetUserId, message } = body

  if (!targetUserId || !message?.trim()) {
    return NextResponse.json({ error: '수신자와 메시지를 입력해주세요' }, { status: 400 })
  }

  const db = createAdminClient()
  // 발신자 이름(관리자 실명)을 title로, 실제 메시지를 body로
  const adminName = (profile.name as string | null) ?? '관리자'
  const content = (message as string).trim()

  await Promise.all([
    sendPushToUser(targetUserId, {
      title: adminName,
      body: content,
      url: '/settings',
      tag: 'admin-message',
    }),
    saveNotification(db, targetUserId, adminName, content, 'exchange'),
  ])

  return NextResponse.json({ success: true })
}
