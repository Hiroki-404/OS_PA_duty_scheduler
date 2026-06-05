import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date().toISOString()

  const { data: expired, error } = await supabase
    .from('exchange_requests')
    .update({ status: 'cancelled' })
    .lt('expires_at', now)
    .eq('status', 'pending')
    .select('id, requester_id, target_id, requester_date')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (expired && expired.length > 0) {
    await supabase.from('notifications').insert(
      expired.flatMap((ex: any) => [
        { user_id: ex.requester_id, type: 'exchange_cancelled', payload: { exchange_id: ex.id, date: ex.requester_date, reason: 'expired' } },
        { user_id: ex.target_id, type: 'exchange_cancelled', payload: { exchange_id: ex.id, date: ex.requester_date, reason: 'expired' } },
      ])
    )
  }

  return new Response(JSON.stringify({ expired: expired?.length ?? 0, timestamp: now }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
