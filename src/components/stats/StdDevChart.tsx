'use client'
import { useMemo } from 'react'
import type { MonthlyBalance } from '@/types/domain'

interface WorkerStats {
  id: string
  name: string
  total: number
  weekend: number
  weekday: number
  holiday: number
}

interface Props {
  balances: Array<MonthlyBalance & { workerName: string }>
}

function calcStats(values: number[]) {
  if (!values.length) return { mean: 0, stdDev: 0 }
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  return { mean, stdDev: Math.sqrt(variance) }
}

export function StdDevChart({ balances }: Props) {
  const workerStats = useMemo(() => {
    const map = new Map<string, WorkerStats>()
    for (const b of balances) {
      const cur = map.get(b.userId) ?? { id: b.userId, name: b.workerName, total: 0, weekend: 0, weekday: 0, holiday: 0 }
      cur.total += b.totalDuties
      cur.weekend += b.weekendDuties
      cur.weekday += b.weekdayDuties
      cur.holiday += b.holidayDuties
      map.set(b.userId, cur)
    }
    return [...map.values()]
  }, [balances])

  const totals = workerStats.map(w => w.total)
  const { mean, stdDev } = calcStats(totals)
  const threshold = mean + 1.5 * stdDev
  const maxTotal = Math.max(...totals, 1)

  if (!workerStats.length) {
    return <div className="text-center py-8 text-sm text-gray-400">데이터가 없습니다</div>
  }

  return (
    <div className="space-y-6">
      {/* 총 당직 횟수 막대 차트 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">총 당직 횟수</h3>
        <div className="space-y-3">
          {workerStats
            .sort((a, b) => b.total - a.total)
            .map(w => {
              const isAlert = w.total > threshold
              const pct = (w.total / maxTotal) * 100
              return (
                <div key={w.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{w.name}</span>
                    <div className="flex items-center gap-2">
                      {isAlert && (
                        <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">주의</span>
                      )}
                      <span className={`text-sm font-bold ${isAlert ? 'text-red-600' : 'text-gray-700'}`}>
                        {w.total}회
                      </span>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isAlert ? 'bg-red-400' : 'bg-toss-blue'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>평균 {mean.toFixed(1)}회</span>
          <span>표준편차 {stdDev.toFixed(1)}</span>
          <span>임계값 +1.5σ = {threshold.toFixed(1)}</span>
        </div>
      </div>

      {/* 주말/공휴일 vs 평일 분포 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">주말·공휴일 vs 평일</h3>
        <div className="space-y-2">
          {workerStats.map(w => {
            const special = w.weekend + w.holiday
            const total = w.total || 1
            const specialPct = (special / total) * 100
            return (
              <div key={w.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16 shrink-0">{w.name}</span>
                <div className="flex-1 h-4 rounded-full overflow-hidden flex">
                  <div className="h-full bg-orange-300" style={{ width: `${specialPct}%` }} />
                  <div className="h-full bg-blue-200" style={{ width: `${100 - specialPct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-12 text-right">{special}/{w.weekday}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-300 inline-block" />주말·공휴일</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />평일</span>
        </div>
      </div>
    </div>
  )
}
