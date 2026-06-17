import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, saveNotification, fmtDate } from '@/lib/push'

type AnySupabaseClient = ReturnType<typeof createAdminClient>

async function recalculateBalance(db: AnySupabaseClient, year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`

  const { data: schedules } = await db.from('schedules')
    .select('user_id, date, is_weekend, is_holiday')
    .gte('date', monthStart)
    .lte('date', monthEnd)

  if (!schedules || schedules.length === 0) return

  const map: Record<string, { total: number; weekday: number; weekend: number; holiday: number; dow: number[] }> = {}
  for (const s of schedules) {
    if (!map[s.user_id]) map[s.user_id] = { total: 0, weekday: 0, weekend: 0, holiday: 0, dow: [0,0,0,0,0,0,0] }
    const b = map[s.user_id]
    b.total++
    if (s.is_holiday) b.holiday++
    else if (s.is_weekend) b.weekend++
    else b.weekday++
    b.dow[new Date(s.date + 'T00:00:00').getDay()]++
  }

  const inserts = Object.entries(map).map(([uid, b]) => ({
    user_id: uid, year, month,
    total_duties: b.total, weekday_duties: b.weekday, weekend_duties: b.weekend, holiday_duties: b.holiday,
    dow_0: b.dow[0], dow_1: b.dow[1], dow_2: b.dow[2], dow_3: b.dow[3],
    dow_4: b.dow[4], dow_5: b.dow[5], dow_6: b.dow[6],
    is_initial_month: false,
  }))

  await db.from('monthly_balance').delete().eq('year', year).eq('month', month)
  if (inserts.length > 0) await db.from('monthly_balance').insert(inserts)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('exchange_requests')
    .select('*')
    .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, requesterDate, targetId, targetDate } = await request.json()

  if (!type || !requesterDate || !targetId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: req, error } = await supabase.from('exchange_requests').insert({
    requester_id: user.id,
    target_id: targetId,
    requester_date: requesterDate,
    target_date: targetDate ?? null,
    type,
    expires_at: expiresAt,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const db = createAdminClient()
  const { data: requesterProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
  const requesterName = requesterProfile?.name ?? '알 수 없음'

  let title: string
  let content: string
  if (type === 'swap' && targetDate) {
    title = '당직 교환 신청'
    content = `${fmtDate(targetDate)} 당직 교환 신청\n신청자: ${requesterName}(${fmtDate(requesterDate)})`
  } else {
    title = '당직 대신 요청'
    content = `${fmtDate(requesterDate)}에 당직 대신 서주세요!\n신청자: ${requesterName}`
  }

  await Promise.all([
    sendPushToUser(targetId, { title, body: content, url: '/exchange' }),
    saveNotification(db, targetId, title, content, 'exchange'),
  ])

  return NextResponse.json({ request: req }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exchangeId, action } = await request.json()
  if (!exchangeId || !['accept', 'reject', 'rollback'].includes(action)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

  const { data: ex, error: fetchErr } = await db
    .from('exchange_requests').select('*').eq('id', exchangeId).single()

  if (fetchErr || !ex) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 관리자 강제 롤백
  if (action === 'rollback') {
    const { data: adminProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!adminProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (ex.status === 'accepted') {
      if (ex.type === 'swap' && ex.target_date) {
        await Promise.all([
          db.from('schedules').update({ user_id: ex.requester_id }).eq('date', ex.requester_date),
          db.from('schedules').update({ user_id: ex.target_id }).eq('date', ex.target_date),
        ])
        const months = new Set([ex.requester_date.slice(0, 7), ex.target_date.slice(0, 7)])
        for (const ym of months) {
          const [y, m] = ym.split('-').map(Number)
          await recalculateBalance(db as AnySupabaseClient, y, m)
        }
      }
      if (ex.type === 'transfer') {
        await db.from('schedules').update({ user_id: ex.requester_id }).eq('date', ex.requester_date)
        const [y, m] = ex.requester_date.slice(0, 7).split('-').map(Number)
        await recalculateBalance(db as AnySupabaseClient, y, m)
      }
    }

    await db.from('exchange_requests').delete().eq('id', exchangeId)
    return NextResponse.json({ success: true })
  }

  // 중복 수락 방어: 이미 처리된 요청 차단
  if (ex.target_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (ex.status !== 'pending') {
    return NextResponse.json(
      { error: '이미 만료되거나 취소된 교환 요청입니다' },
      { status: 409 }
    )
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected'

  if (action === 'accept') {
    if (ex.type === 'swap' && ex.target_date) {
      const { data: reqSchedule } = await db.from('schedules').select('id,user_id').eq('date', ex.requester_date).single()
      const { data: tgtSchedule } = await db.from('schedules').select('id,user_id').eq('date', ex.target_date).single()
      if (reqSchedule && tgtSchedule) {
        await Promise.all([
          db.from('schedules').update({ user_id: tgtSchedule.user_id }).eq('id', reqSchedule.id),
          db.from('schedules').update({ user_id: reqSchedule.user_id }).eq('id', tgtSchedule.id),
        ])
      }
      const months = new Set([ex.requester_date.slice(0, 7), ex.target_date.slice(0, 7)])
      for (const ym of months) {
        const [y, m] = ym.split('-').map(Number)
        await recalculateBalance(db as AnySupabaseClient, y, m)
      }
    }
    if (ex.type === 'transfer') {
      await db.from('schedules').update({ user_id: ex.target_id }).eq('date', ex.requester_date)
      const [y, m] = ex.requester_date.slice(0, 7).split('-').map(Number)
      await recalculateBalance(db as ReturnType<typeof createAdminClient>, y, m)
    }
  }

  await db.from('exchange_requests')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', exchangeId)

  // 수락/거절 완료 시 신청자에게 알림 발송
  if (action === 'accept') {
    const { data: targetProfile } = await db.from('profiles').select('name').eq('id', user.id).single()
    const targetName = targetProfile?.name ?? '알 수 없음'

    let title: string
    let content: string
    if (ex.type === 'swap' && ex.target_date) {
      title = '교환 수락 완료'
      content = `${fmtDate(ex.target_date)}로 교환 완료\n수락자: ${targetName}(${fmtDate(ex.requester_date)})`
    } else {
      title = '교환 수락 완료'
      content = `${fmtDate(ex.requester_date)} 당직 ${targetName}에게 넘겨짐`
    }

    await Promise.all([
      sendPushToUser(ex.requester_id, { title, body: content, url: '/exchange' }),
      saveNotification(db as AnySupabaseClient, ex.requester_id, title, content, 'exchange'),
    ])
  }

  return NextResponse.json({ status: newStatus })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const exchangeId = searchParams.get('id')
  if (!exchangeId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: ex, error: fetchErr } = await supabase
    .from('exchange_requests').select('requester_id, status').eq('id', exchangeId).single()

  if (fetchErr || !ex) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ex.requester_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (ex.status !== 'pending') return NextResponse.json({ error: '대기 중인 요청만 취소할 수 있습니다' }, { status: 409 })

  const { error } = await supabase
    .from('exchange_requests')
    .update({ status: 'cancelled' })
    .eq('id', exchangeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
