'use client'
import { motion } from 'framer-motion'
import { signInWithKakao } from '@/lib/kakao/auth'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try { await signInWithKakao() } catch { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm flex flex-col items-center gap-12"
      >
        <div className="text-center space-y-3">
          <div className="text-5xl">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">고대안산병원OS</h1>
          <p className="text-gray-400 text-sm">PA 당직 관리 시스템</p>
        </div>

        <motion.button
          onClick={handleLogin}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="w-full bg-[#FEE500] text-[#191919] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-sm disabled:opacity-60"
        >
          {loading
            ? <span className="inline-block w-5 h-5 rounded-full border-2 border-[#191919] border-t-transparent animate-spin" />
            : <>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2C5.58 2 2 4.92 2 8.5c0 2.3 1.48 4.32 3.72 5.48L4.8 17.16c-.08.3.24.54.5.36L9.14 14.9c.28.03.57.04.86.04 4.42 0 8-2.92 8-6.5S14.42 2 10 2z" fill="#191919"/>
                </svg>
                카카오로 시작하기
              </>
          }
        </motion.button>
      </motion.div>
    </div>
  )
}
