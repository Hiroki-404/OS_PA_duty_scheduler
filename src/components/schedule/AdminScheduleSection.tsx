'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ScheduleTable } from './ScheduleTable'
import { DowStatsTable } from './DowStatsTable'

interface ScheduleEntry {
  id: string; user_id: string; date: string
  is_weekend: boolean; is_holiday: boolean; is_locked: boolean
}
interface WorkerInfo { name: string; color: string }
interface WorkerItem { id: string; name: string; color: string }
interface AvailEntry { user_id: string; date: string; type: 'exclude' | 'half_day' | 'annual_leave' }
interface Holiday { date: string; name: string }
interface ExchangeInfo {
  id: string
  requester_id: string; target_id: string
  requester_date: string; target_date: string | null
  type: 'swap' | 'transfer'
}

interface Props {
  schedules: ScheduleEntry[]
  workerMap: Record<string, WorkerInfo>
  allWorkers: WorkerItem[]
  year: number
  month: number
  holidays: Holiday[]
  availabilities: AvailEntry[]
  exchanges: ExchangeInfo[]
  isAdmin: boolean
  hasSchedules: boolean
}

export function AdminScheduleSection({
  schedules, workerMap, allWorkers,
  year, month, holidays, availabilities, exchanges,
  isAdmin, hasSchedules,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  // 낙관적 업데이트: 교체 즉시 date→newUserId 로컬 반영
  const [overrideMap, setOverrideMap] = useState<Record<string, string>>({})

  const effectiveSchedules = schedules.map(s =>
    overrideMap[s.date] ? { ...s, user_id: overrideMap[s.date] } : s
  )

  const handleOverride = async (scheduleId: string, newUserId: string, date: string) => {
    setOverrideMap(prev => ({ ...prev, [date]: newUserId }))
    const res = await fetch('/api/schedule/override', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, newUserId }),
    })
    if (res.ok) {
      // 서버 데이터 갱신 (DowStatsTable 포함)
      startTransition(() => { router.refresh() })
    } else {
      // 실패 시 낙관적 업데이트 롤백
      setOverrideMap(prev => { const n = { ...prev }; delete n[date]; return n })
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <ScheduleTable
          schedules={effectiveSchedules}
          workerMap={workerMap}
          allWorkers={allWorkers}
          year={year}
          month={month}
          holidays={holidays}
          availabilities={availabilities}
          exchanges={exchanges}
          isAdmin={isAdmin}
          onOverride={isAdmin ? handleOverride : undefined}
        />
      </div>
      {hasSchedules && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">요일별 당직 통계</h2>
          <DowStatsTable
            schedules={effectiveSchedules}
            workerMap={workerMap}
          />
        </div>
      )}
    </>
  )
}
