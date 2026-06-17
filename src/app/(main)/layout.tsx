'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, ArrowLeftRight, BarChart3, Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PushPermissionModal } from '@/components/push/PushPermissionModal'
import { subscribeToPush } from '@/lib/push-client'

const tabs = [
  { href: '/',            label: '당직표', Icon: CalendarDays,  activeColor: 'text-blue-500',   activeBg: 'bg-blue-50'   },
  { href: '/availability', label: '제외일', Icon: CheckCircle2,  activeColor: 'text-emerald-500', activeBg: 'bg-emerald-50' },
  { href: '/exchange',     label: '교환',   Icon: ArrowLeftRight, activeColor: 'text-blue-500',   activeBg: 'bg-blue-50'   },
  { href: '/stats',        label: '통계',   Icon: BarChart3,      activeColor: 'text-violet-500', activeBg: 'bg-violet-50' },
  { href: '/settings',     label: '설정',   Icon: Settings2,      activeColor: 'text-gray-500',   activeBg: 'bg-gray-100'  },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [userId, setUserId]           = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showPushModal, setShowPushModal] = useState(false)

  // 초기 인증 + 알림 미읽음 수 + 푸시 권한 체크
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      // 미읽음 교환 알림 수 조회
      const { count } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .eq('landing_tab', 'exchange')
      setUnreadCount(count ?? 0)

      // 푸시 권한 상태 처리
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'default') {
        setShowPushModal(true)
      } else if (Notification.permission === 'granted') {
        // 이미 허용 상태 → 토큰 만료 대비 조용히 재등록
        subscribeToPush().catch(() => {})
      }
    })
  }, [])

  // 교환 탭 진입 시 알림 일괄 읽음 처리
  useEffect(() => {
    if (pathname !== '/exchange' || !userId || unreadCount === 0) return
    const sb = createClient()
    sb.from('notifications')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .eq('landing_tab', 'exchange')
      .then(() => setUnreadCount(0))
  }, [pathname, userId]) // unreadCount 의존 제거 — 탭 진입 시점에만 실행

  // Supabase Realtime: 알림 INSERT/UPDATE 실시간 반영
  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const channel = sb
      .channel(`notif-badge-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (!payload.new.is_read && payload.new.landing_tab === 'exchange') {
            setUnreadCount(prev => prev + 1)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          if (payload.new.is_read && !payload.old.is_read && payload.new.landing_tab === 'exchange') {
            setUnreadCount(prev => Math.max(0, prev - 1))
          }
        },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [userId])

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white relative">
      {showPushModal && <PushPermissionModal onClose={() => setShowPushModal(false)} />}

      <main className="flex-1 overflow-y-auto pb-20">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
        >
          {children}
        </motion.div>
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-20">
        {tabs.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          const isExchange = tab.href === '/exchange'
          return (
            <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center py-2 gap-0.5">
              <span className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all relative
                ${active ? tab.activeBg : ''}`}>
                <tab.Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={`transition-colors ${active ? tab.activeColor : 'text-gray-400'}`}
                />
                {isExchange && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-medium transition-colors ${active ? tab.activeColor : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
