import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverIds, title, content, landingTab } = await request.json()
  if (!receiverIds?.length || !title || !content) {
    return NextResponse.json({ error: 'receiverIds, title, content required' }, { status: 400 })
  }

  const db = createAdminClient()
  const tab = landingTab ?? 'exchange'

  const { error } = await db.from('notifications').insert(
    (receiverIds as string[]).map(rid => ({
      receiver_id: rid,
      title,
      content,
      landing_tab: tab,
    }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 각 수신자에게 웹 푸시도 병렬 발송
  await Promise.allSettled(
    (receiverIds as string[]).map(rid =>
      sendPushToUser(rid, { title, body: content, url: tab === 'except_days' ? '/availability' : '/exchange' })
    )
  )

  return NextResponse.json({ success: true, count: receiverIds.length })
}
