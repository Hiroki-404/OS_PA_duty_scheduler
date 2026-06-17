'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface NotifRow {
  id: string
  title: string
  content: string
  landing_tab: string
}

interface Props { userId: string }

export function ExchangeNotificationBanner({ userId }: Props) {
  const [pending, setPending] = useState<NotifRow[]>([])

  useEffect(() => {
    if (!userId) return
    const sb = createClient()

    sb.from('notifications')
      .select('id, title, content, landing_tab')
      .eq('receiver_id', userId)
      .eq('landing_tab', 'exchange')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setPending(data as NotifRow[]) })

    const channel = sb.channel(`notif-banner-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (!payload.new.is_read && payload.new.landing_tab === 'exchange') {
            setPending(prev => [payload.new as NotifRow, ...prev])
          }
        },
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [userId])

  const dismiss = async (id: string) => {
    const sb = createClient()
    await sb.from('notifications').update({ is_read: true }).eq('id', id)
    setPending(prev => prev.filter(n => n.id !== id))
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{first.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{first.content}</p>
            </div>
            <button onClick={() => dismiss(first.id)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">✕</button>
          </div>
          {pending.length > 1 && (
            <p className="text-xs text-gray-400 mt-1 text-center">+{pending.length - 1}건 더</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
