import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

  const { data: requesterProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
  await supabase.from('notifications').insert({
    user_id: targetId,
    type: 'exchange_request',
    payload: {
      exchange_id: req.id,
      requester_name: requesterProfile?.name ?? '알 수 없음',
      requester_date: requesterDate,
      target_date: targetDate,
      type,
    },
  })

  return NextResponse.json({ request: req }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { exchangeId, action } = await request.json()
  if (!exchangeId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const { data: ex, error: fetchErr } = await supabase
    .from('exchange_requests').select('*').eq('id', exchangeId).single()

  if (fetchErr || !ex) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ex.target_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (ex.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  const newStatus = action === 'accept' ? 'accepted' : 'rejected'

  if (action === 'accept') {
    if (ex.type === 'swap' && ex.target_date) {
      const { data: reqSchedule } = await supabase.from('schedules').select('id,user_id').eq('date', ex.requester_date).single()
      const { data: tgtSchedule } = await supabase.from('schedules').select('id,user_id').eq('date', ex.target_date).single()
      if (reqSchedule && tgtSchedule) {
        await Promise.all([
          supabase.from('schedules').update({ user_id: tgtSchedule.user_id }).eq('id', reqSchedule.id),
          supabase.from('schedules').update({ user_id: reqSchedule.user_id }).eq('id', tgtSchedule.id),
        ])
      }
    }
    if (ex.type === 'transfer') {
      await supabase.from('schedules').update({ user_id: ex.target_id }).eq('date', ex.requester_date)
    }
  }

  await supabase.from('exchange_requests').update({ status: newStatus, responded_at: new Date().toISOString() }).eq('id', exchangeId)

  await supabase.from('notifications').insert({
    user_id: ex.requester_id,
    type: 'exchange_response',
    payload: { exchange_id: exchangeId, status: newStatus, date: ex.requester_date },
  })

  return NextResponse.json({ status: newStatus })
}

// 신청자 본인이 pending 상태 요청을 취소
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
