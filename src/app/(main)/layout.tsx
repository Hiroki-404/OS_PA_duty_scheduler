'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

const tabs = [
  { href: '/', label: '홈', icon: '🏠' },
  { href: '/availability', label: '제출', icon: '📅' },
  { href: '/exchange', label: '교환', icon: '🔄' },
  { href: '/stats', label: '통계', icon: '📊' },
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-white relative">
      <main className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex z-20">
        {tabs.map(tab => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
          return (
            <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center py-2 gap-0.5">
              <span className="text-lg">{tab.icon}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-toss-blue' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
