'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface ExchangeNotification {
  id: string
  payload: {
    exchange_id: string
    requester_name: string
    requester_date: string
    target_date?: string
    type: 'swap' | 'transfer'
  }
}

interface Props { userId: string }

export function ExchangeNotificationBanner({ userId }: Props) {
  const [pending, setPending] = useState<ExchangeNotification[]>([])

  useEffect(() => {
    if (!userId) return
    const sb = createClient()

    sb.from('notifications')
      .select('id, payload')
      .eq('user_id', userId)
      .eq('type', 'exchange_request')
      .eq('is_read', false)
      .then(({ data }) => {
        if (data) setPending(data as ExchangeNotification[])
      })

    const channel = sb.channel(`notif-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        payload => {
          if (payload.new.type === 'exchange_request') {
            setPending(prev => [...prev, payload.new as ExchangeNotification])
          }
        })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [userId])

  const handleRespond = async (notifId: string, exchangeId: string, approve: boolean) => {
    const sb = createClient()
    await fetch('/api/exchange', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchangeId, action: approve ? 'accept' : 'reject' }),
    })
    await sb.from('notifications').update({ is_read: true }).eq('id', notifId)
    setPending(prev => prev.filter(n => n.id !== notifId))
  }

  const first = pending[0]

  return (
    <AnimatePresence>
      {first && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-b border-gray-100 shadow-lg z-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-gray-900">
            {first.payload.requester_name}님의 교환 요청
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {first.payload.requester_date}
            {first.payload.type === 'swap' && first.payload.target_date && ` ↔ ${first.payload.target_date}`}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleRespond(first.id, first.payload.exchange_id, true)}
              className="flex-1 bg-toss-blue text-white text-sm font-semibold py-2 rounded-xl"
            >수락</button>
            <button
              onClick={() => handleRespond(first.id, first.payload.exchange_id, false)}
              className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2 rounded-xl"
            >거절</button>
          </div>
          {pending.length > 1 && (
            <p className="text-xs text-gray-400 mt-1 text-center">+{pending.length - 1}건 더</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
