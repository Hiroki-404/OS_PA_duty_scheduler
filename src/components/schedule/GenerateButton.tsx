'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface Props { year: number; month: number; hasSchedules: boolean }

export function GenerateButton({ year, month, hasSchedules }: Props) {
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const now = new Date()
    const nowTotal  = now.getFullYear() * 12 + (now.getMonth() + 1)
    const viewTotal = year * 12 + month

    // CASE A: 과거 달 — 재배치 완전 차단
    if (viewTotal < nowTotal) {
      alert('지난달 당직은 재배치가 불가능합니다.')
      return
    }

    // CASE B: 이번 달 — 운행 중 경고 confirm
    if (viewTotal === nowTotal) {
      if (!confirm('이미 배정되어 운행 중인 달입니다. 진짜로 재배치하시겠습니까?')) return
    }

    // CASE C: 미래 달 — 기존 데이터 있으면 재배치 confirm
    if (viewTotal > nowTotal && hasSchedules) {
      if (!confirm('이미 당직이 배치된 달입니다. 재배치 하시겠습니까?')) return
    }

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
