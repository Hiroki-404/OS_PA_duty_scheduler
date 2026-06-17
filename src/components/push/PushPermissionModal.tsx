'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeToPush } from '@/lib/push-client'

interface Props { onClose: () => void }

export function PushPermissionModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false)

  const handleAllow = async () => {
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') await subscribeToPush()
    } catch {}
    setLoading(false)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 z-[9998] flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 space-y-4"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center space-y-2">
            <div className="text-4xl mb-1">🔔</div>
            <h2 className="text-lg font-bold text-gray-900">알림을 허용해주세요</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              당직 교환 요청, 제출 기간 리마인더 등<br />중요한 알림을 즉시 받아보세요.
            </p>
          </div>
          <button
            onClick={handleAllow}
            disabled={loading}
            className="w-full py-3.5 bg-toss-blue text-white rounded-2xl font-bold text-sm disabled:opacity-60 transition-opacity"
          >
            {loading ? '처리 중...' : '알림 허용'}
          </button>
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-400">
            나중에 하기
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
