import webpush from 'web-push'
import { createAdminClient } from './supabase/admin'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}월 ${d.getDate()}일/${DOW[d.getDay()]}요일`
}

function initWebPush() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'duty@hospital.local'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  return webpush
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string; tag?: string },
) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

  const db = createAdminClient()
  const { data: tokens } = await db
    .from('user_push_tokens')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!tokens?.length) return

  const wp = initWebPush()
  // url을 data 안에 넣어야 SW의 notificationclick이 올바르게 읽을 수 있음
  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: { url: payload.url, tag: payload.tag },
  })

  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        await wp.sendNotification(
          { endpoint: token.endpoint, keys: { p256dh: token.p256dh, auth: token.auth } },
          message,
          { urgency: 'high' },
        )
      } catch (err: any) {
        // 만료/무효 토큰 자가 치유: 410 Gone / 404 Not Found → DB에서 즉시 제거
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.from('user_push_tokens').delete().eq('endpoint', token.endpoint)
        }
      }
    }),
  )
}

export async function saveNotification(
  db: ReturnType<typeof createAdminClient>,
  receiverId: string,
  title: string,
  content: string,
  landingTab: 'except_days' | 'exchange',
) {
  await db.from('notifications').insert({ receiver_id: receiverId, title, content, landing_tab: landingTab })
}
