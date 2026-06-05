'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Props { year: number; month: number }

export function GenerateButton({ year, month }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleGenerate = async () => {
    if (!confirm(`${year}년 ${month}월 당직을 자동 배정하시겠습니까?`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '배정 중 오류가 발생했습니다.')
        return
      }
      if (data.warnings?.length) {
        alert(`배정 완료 (경고 ${data.warnings.length}건)\n${data.warnings.map((w: any) => `${w.date}: ${w.reason}`).join('\n')}`)
      } else {
        alert('당직 배정이 완료되었습니다.')
      }
      window.location.reload()
    } catch (e: any) {
      alert(e.message ?? '배정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleGenerate}
      disabled={loading}
      className="bg-toss-blue text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-60"
    >
      {loading ? '⏳' : '배정 실행'}
    </motion.button>
  )
}
