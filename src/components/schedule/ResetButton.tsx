'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props {
  year: number
  month: number
}

export function ResetButton({ year, month }: Props) {
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!confirm(`${year}년 ${month}월 배정을 초기화하시겠습니까?\n(가용성 데이터는 보존됩니다)`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/schedule/reset?year=${year}&month=${month}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '초기화 중 오류가 발생했습니다.')
        return
      }
      alert(`${year}년 ${month}월 배정이 초기화되었습니다.`)
      window.location.reload()
    } catch (e: any) {
      alert(e.message ?? '초기화 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleReset}
      disabled={loading}
      className="bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-60 hover:bg-gray-200 transition-colors"
    >
      {loading ? '⏳' : '초기화'}
    </motion.button>
  )
}
