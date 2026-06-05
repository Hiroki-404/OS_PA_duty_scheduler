'use client'

interface ScheduleEntry { date: string; user_id: string }
interface WorkerInfo { name: string; color: string }

interface Props {
  schedules: ScheduleEntry[]
  workerMap: Record<string, WorkerInfo>
}

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function DowStatsTable({ schedules, workerMap }: Props) {
  const workerIds = Object.keys(workerMap)

  // worker × dow 집계
  const stats: Record<string, number[]> = {}
  for (const id of workerIds) stats[id] = [0, 0, 0, 0, 0, 0, 0]

  for (const s of schedules) {
    const dow = new Date(s.date).getDay()
    if (stats[s.user_id]) stats[s.user_id][dow]++
  }

  const totals = Object.fromEntries(
    workerIds.map(id => [id, stats[id].reduce((a, b) => a + b, 0)])
  )

  const sorted = [...workerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1.5 pr-3 text-gray-500 font-medium w-16">이름</th>
            {DOW_LABELS.map((d, i) => (
              <th key={d}
                className={`text-center py-1.5 px-1 font-semibold
                  ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                {d}
              </th>
            ))}
            <th className="text-center py-1.5 px-2 text-gray-600 font-bold">합계</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(id => {
            const worker = workerMap[id]
            if (!worker) return null
            const row = stats[id]
            const total = totals[id]
            return (
              <tr key={id} className="border-t border-gray-50">
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: worker.color }}
                    />
                    <span className="text-gray-700 font-medium truncate max-w-[52px]">
                      {worker.name}
                    </span>
                  </div>
                </td>
                {row.map((count, i) => (
                  <td key={i} className="text-center py-1.5 px-1">
                    {count > 0 ? (
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                        style={{ backgroundColor: worker.color }}
                      >
                        {count}
                      </span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                ))}
                <td className="text-center py-1.5 px-2 font-bold text-gray-800">{total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
