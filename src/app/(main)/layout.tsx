'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, ArrowLeftRight, BarChart3, Settings2 } from 'lucide-react'

const tabs = [
  {
    href: '/',
    label: '당직표',
    Icon: CalendarDays,
    activeColor: 'text-blue-500',
    activeBg: 'bg-blue-50',
  },
  {
    href: '/availability',
    label: '제외일',
    Icon: CheckCircle2,
    activeColor: 'text-emerald-500',
    activeBg: 'bg-emerald-50',
  },
  {
    href: '/exchange',
    label: '교환',
    Icon: ArrowLeftRight,
    activeColor: 'text-blue-500',
    activeBg: 'bg-blue-50',
  },
  {
    href: '/stats',
    label: '통계',
    Icon: BarChart3,
    activeColor: 'text-violet-500',
    activeBg: 'bg-violet-50',
  },
  {
    href: '/settings',
    label: '설정',
    Icon: Settings2,
    activeColor: 'text-gray-500',
    activeBg: 'bg-gray-100',
  },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white relative">
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
          return (
            <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center py-2 gap-0.5">
              <span className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all
                ${active ? `${tab.activeBg}` : ''}`}>
                <tab.Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={`transition-colors ${active ? tab.activeColor : 'text-gray-400'}`}
                />
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
