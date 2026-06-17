export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, saveNotification } from '@/lib/push'

// Vercel Cron: 매월 22일 23:00 UTC = 23일 08:00 KST
// 모든 활성 근무자에게 제외일 제출 기간 알림 발송
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: workers } = await db.from('profiles').select('id').eq('is_active', true)
  if (!workers?.length) return NextResponse.json({ success: true, sent: 0 })

  // KST 기준 현재 월의 다음 달 = 제외일 제출 대상 월
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const kstMonth = kstNow.getUTCMonth() + 1
  const kstYear  = kstNow.getUTCFullYear()
  const targetMonth = kstMonth === 12 ? 1 : kstMonth + 1
  const targetYear  = kstMonth === 12 ? kstYear + 1 : kstYear

  const title = '당직 제외일 제출 기간'
  const content = `${targetYear}년 ${targetMonth}월 당직 제외일 제출 기간입니다!`

  await Promise.all(
    workers.map(w =>
      Promise.all([
        sendPushToUser(w.id, { title, body: content, url: '/availability' }),
        saveNotification(db, w.id, title, content, 'except_days'),
      ])
    )
  )

  return NextResponse.json({ success: true, sent: workers.length })
}
