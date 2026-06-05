import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const day = now.getDate()

  if (day < 23 || day > 25) {
    return new Response(JSON.stringify({ skip: true, day }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const targetYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const targetMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2

  const { data: workers } = await supabase
    .from('profiles')
    .select('id, name, kakao_id')
    .eq('is_active', true)

  const { data: submitted } = await supabase
    .from('availability_requests')
    .select('user_id')
    .eq('year', targetYear)
    .eq('month', targetMonth)
    .not('submitted_at', 'is', null)

  const submittedIds = new Set((submitted ?? []).map((s: any) => s.user_id))
  const pending = (workers ?? []).filter((w: any) => !submittedIds.has(w.id))

  const adminKey = Deno.env.get('KAKAO_ADMIN_KEY')
  const base = Deno.env.get('APP_BASE_URL') ?? 'https://localhost:3000'
  const link = `${base}/availability`
  const daysLeft = 25 - day + 1

  const results = await Promise.allSettled(
    pending.map(async (w: any) => {
      if (!adminKey || !w.kakao_id) return { name: w.name, skipped: true }
      const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/send', {
        method: 'POST',
        headers: { Authorization: `KakaoAK ${adminKey}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({
          receiver_uuids: JSON.stringify([w.kakao_id]),
          template_object: JSON.stringify({
            object_type: 'text',
            text: `[당직 관리] ${w.name}님, ${targetYear}년 ${targetMonth}월 당직 제외일 입력 마감까지 ${daysLeft}일 남았습니다.\n\n지금 바로 입력해주세요!`,
            link: { web_url: link, mobile_web_url: link },
            button_title: '제외일 입력하기',
          }),
        }),
      })
      return { name: w.name, ok: res.ok, status: res.status }
    })
  )

  return new Response(JSON.stringify({
    day, targetYear, targetMonth,
    total: workers?.length ?? 0,
    sent: pending.length,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { error: String((r as any).reason) }),
  }), { headers: { 'Content-Type': 'application/json' } })
})
