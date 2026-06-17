export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, saveNotification } from '@/lib/push'

// Vercel Cron: 매월 23일 23:00 UTC = 24일 08:00 KST
// 제외일 미제출자에게만 타겟 알림 발송
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: workers } = await db.from('profiles').select('id').eq('is_active', true)
  if (!workers?.length) return NextResponse.json({ success: true, sent: 0 })

  // KST 기준 다음 달 계산
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const kstMonth = kstNow.getUTCMonth() + 1
  const kstYear  = kstNow.getUTCFullYear()
  const targetMonth = kstMonth === 12 ? 1 : kstMonth + 1
  const targetYear  = kstMonth === 12 ? kstYear + 1 : kstYear

  // 제출 완료자 ID 세트
  const { data: submitted } = await db
    .from('monthly_submission_flags')
    .select('user_id')
    .eq('year', targetYear)
    .eq('month', targetMonth)

  const submittedIds = new Set((submitted ?? []).map(s => s.user_id))
  const overdue = workers.filter(w => !submittedIds.has(w.id))
  if (!overdue.length) return NextResponse.json({ success: true, sent: 0 })

  const title = '제외일 미제출 알림'
  const content = `${targetYear}년 ${targetMonth}월 당직 제외일을 아직 제출하지 않으셨습니다.`

  await Promise.all(
    overdue.map(w =>
      Promise.all([
        sendPushToUser(w.id, { title, body: content, url: '/availability' }),
        saveNotification(db, w.id, title, content, 'except_days'),
      ])
    )
  )

  return NextResponse.json({ success: true, sent: overdue.length })
}
