'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

const PALETTE = ['#4DABF7', '#FF6B6B', '#51CF66', '#FFD43B', '#CC5DE8', '#FF922B', '#20C997']
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface RawBalance {
  user_id: string
  year: number
  month: number
  total_duties: number
  weekday_duties: number
  weekend_duties: number
  holiday_duties: number
  dow_0: number; dow_1: number; dow_2: number; dow_3: number
  dow_4: number; dow_5: number; dow_6: number
}
interface Profile { id: string; name: string; color: string | null }

function MonthPickerPopup({ year, month, onSelect }: {
  year: number; month: number
  onSelect: (y: number, m: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const now = new Date()
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]
  const isFuture = (y: number, m: number) =>
    y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)

  return (
    <>
      <button
        onClick={() => { setPickerYear(year); setOpen(true) }}
        className="flex items-center gap-1 bg-gray-100 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-700"
      >
        {year}년 {month}월 <span className="text-gray-400 text-xs">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-4 top-[15%] bg-white rounded-3xl z-50 shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div className="flex border-b border-gray-100">
                {yearOptions.map(y => (
                  <button key={y} onClick={() => setPickerYear(y)}
                    className={`flex-1 py-3.5 text-sm font-bold transition-colors
                      ${pickerYear === y ? 'text-toss-blue border-b-2 border-toss-blue' : 'text-gray-400'}`}>
                    {y}년
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 p-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const isSelected = pickerYear === year && m === month
                  const isCurrent = pickerYear === now.getFullYear() && m === now.getMonth() + 1
                  const disabled = isFuture(pickerYear, m)
                  return (
                    <button key={m} disabled={disabled}
                      onClick={() => { onSelect(pickerYear, m); setOpen(false) }}
                      className={`h-12 rounded-2xl text-sm font-bold transition-all
                        ${isSelected ? 'bg-toss-blue text-white shadow-sm'
                          : isCurrent ? 'border-2 border-toss-blue text-toss-blue'
                          : 'text-gray-700 active:bg-gray-100'}
                        ${disabled ? 'opacity-25 cursor-not-allowed' : ''}`}>
                      {m}월
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function MonthlyView({ balances, profiles }: { balances: RawBalance[]; profiles: Profile[] }) {
  const profileMap = useMemo(() =>
    Object.fromEntries(profiles.map((p, i) => [p.id, { ...p, color: p.color ?? PALETTE[i % PALETTE.length] }])),
    [profiles]
  )

  if (balances.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-sm">이 달에는 당직 배정 데이터가 없습니다</p>
        <p className="text-gray-300 text-xs mt-1">배정 실행 후 다시 확인해 주세요</p>
      </div>
    )
  }

  const sorted = [...balances].sort((a, b) => b.total_duties - a.total_duties)

  return (
    <div className="space-y-3">
      {sorted.map(b => {
        const worker = profileMap[b.user_id]
        if (!worker) return null
        const dow = [b.dow_0, b.dow_1, b.dow_2, b.dow_3, b.dow_4, b.dow_5, b.dow_6]
        const maxDow = Math.max(...dow, 1)
        return (
          <div key={b.user_id} className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: worker.color }} />
              <span className="font-bold text-gray-800 flex-1">{worker.name}</span>
              <span className="text-xl font-bold" style={{ color: worker.color }}>{b.total_duties}회</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: '평일', value: b.weekday_duties, color: '#4DABF7' },
                { label: '주말', value: b.weekend_duties, color: '#FF8E53' },
                { label: '공휴일', value: b.holiday_duties, color: '#FF6B6B' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 font-medium">{label}</div>
                  <div className="text-lg font-bold mt-0.5" style={{ color: value > 0 ? color : '#d1d5db' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DOW_LABELS.map((d, i) => (
                <div key={d} className="flex flex-col items-center gap-0.5">
                  <div className="w-full h-8 bg-gray-200 rounded-sm flex items-end overflow-hidden">
                    {dow[i] > 0 && (
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${(dow[i] / maxDow) * 100}%`,
                          backgroundColor: worker.color,
                          minHeight: '4px',
                        }}
                      />
                    )}
                  </div>
                  <span className={`text-[9px] font-bold
                    ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {d}
                  </span>
                  <span className="text-[9px] font-bold text-gray-500 min-h-[12px]">
                    {dow[i] > 0 ? dow[i] : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CumulativeView({ allBalances, profiles }: { allBalances: RawBalance[]; profiles: Profile[] }) {
  const profileMap = useMemo(() =>
    Object.fromEntries(profiles.map((p, i) => [p.id, { ...p, color: p.color ?? PALETTE[i % PALETTE.length] }])),
    [profiles]
  )

  const workerStats = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string; color: string
      total: number; weekday: number; weekend: number; holiday: number
      dow: number[]
    }>()
    for (const b of allBalances) {
      const prof = profileMap[b.user_id]
      if (!prof) continue
      const cur = map.get(b.user_id) ?? {
        id: b.user_id, name: prof.name, color: prof.color,
        total: 0, weekday: 0, weekend: 0, holiday: 0,
        dow: [0, 0, 0, 0, 0, 0, 0],
      }
      cur.total += b.total_duties
      cur.weekday += b.weekday_duties
      cur.weekend += b.weekend_duties
      cur.holiday += b.holiday_duties
      const raw = [b.dow_0, b.dow_1, b.dow_2, b.dow_3, b.dow_4, b.dow_5, b.dow_6]
      cur.dow = cur.dow.map((v, i) => v + raw[i])
      map.set(b.user_id, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [allBalances, profileMap])

  if (workerStats.length === 0) {
    return <div className="text-center py-12 text-sm text-gray-400">누적 데이터가 없습니다</div>
  }

  const totals = workerStats.map(w => w.total)
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length
  const stdDev = Math.sqrt(totals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / totals.length)
  const threshold = mean + 1.5 * stdDev
  const maxTotal = Math.max(...totals, 1)

  return (
    <div className="space-y-6">
      {/* 총 당직 횟수 막대 차트 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">총 당직 횟수</h3>
        <div className="space-y-3">
          {workerStats.map(w => {
            const isAlert = w.total > threshold
            const pct = (w.total / maxTotal) * 100
            return (
              <div key={w.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                    <span className="text-sm font-medium text-gray-800">{w.name}</span>
                  </div>
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
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: isAlert ? '#f87171' : w.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>평균 {mean.toFixed(1)}회</span>
          <span>σ {stdDev.toFixed(1)}</span>
          <span>임계 +1.5σ = {threshold.toFixed(1)}</span>
        </div>
      </section>

      {/* 주말·공휴일 vs 평일 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">주말·공휴일 vs 평일</h3>
        <div className="space-y-2">
          {workerStats.map(w => {
            const special = w.weekend + w.holiday
            const specialPct = (special / (w.total || 1)) * 100
            return (
              <div key={w.id} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-16 shrink-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                  <span className="text-xs text-gray-600 truncate">{w.name}</span>
                </div>
                <div className="flex-1 h-4 rounded-full overflow-hidden flex bg-gray-100">
                  <div className="h-full bg-orange-400 transition-all" style={{ width: `${specialPct}%` }} />
                  <div className="h-full bg-blue-300 transition-all" style={{ width: `${100 - specialPct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-12 text-right shrink-0">
                  {special}<span className="text-gray-300 mx-0.5">/</span>{w.weekday}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />주말·공휴일
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-300 inline-block" />평일
          </span>
        </div>
      </section>

      {/* 요일별 누적 분포 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">요일별 누적 분포</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-1.5 pr-3 text-gray-400 font-medium w-16">이름</th>
                {DOW_LABELS.map((d, i) => (
                  <th key={d} className={`text-center py-1.5 px-1 font-semibold
                    ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {d}
                  </th>
                ))}
                <th className="text-center py-1.5 px-2 text-gray-600 font-bold">합계</th>
              </tr>
            </thead>
            <tbody>
              {workerStats.map(w => (
                <tr key={w.id} className="border-t border-gray-50">
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                      <span className="text-gray-700 font-medium truncate max-w-[52px]">{w.name}</span>
                    </div>
                  </td>
                  {w.dow.map((count, i) => (
                    <td key={i} className="text-center py-1.5 px-1">
                      {count > 0 ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                          style={{ backgroundColor: w.color }}
                        >
                          {count}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  ))}
                  <td className="text-center py-1.5 px-2 font-bold text-gray-800">{w.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function StatsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [mode, setMode] = useState<'monthly' | 'cumulative'>('monthly')
  const [allBalances, setAllBalances] = useState<RawBalance[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('monthly_balance').select('*').order('year').order('month'),
      sb.from('profiles').select('id, name, color').eq('is_active', true),
    ]).then(([{ data: balances }, { data: profs }]) => {
      setAllBalances(balances ?? [])
      setProfiles(profs ?? [])
      if (balances && balances.length > 0) {
        const latest = balances.reduce((prev, cur) => {
          if (cur.year > prev.year) return cur
          if (cur.year === prev.year && cur.month > prev.month) return cur
          return prev
        })
        setYear(latest.year)
        setMonth(latest.month)
      }
      setLoading(false)
    })
  }, [])

  const monthlyBalances = useMemo(
    () => allBalances.filter(b => b.year === year && b.month === month),
    [allBalances, year, month]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 flex-1">당직 통계</h1>
          {mode === 'monthly' && (
            <MonthPickerPopup
              year={year} month={month}
              onSelect={(y, m) => { setYear(y); setMonth(m) }}
            />
          )}
          <button
            onClick={() => setMode(m => m === 'monthly' ? 'cumulative' : 'monthly')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap
              ${mode === 'cumulative'
                ? 'bg-toss-blue text-white'
                : 'bg-gray-100 text-gray-600'}`}
          >
            {mode === 'monthly' ? '누적 통계' : '← 월별'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-0.5">
          {mode === 'monthly' ? `${year}년 ${month}월 당직 현황` : '전체 누적 기간 기준'}
        </p>
      </header>

      <div className="px-4 py-4">
        {loading ? (
          <div className="text-center py-12 text-sm text-gray-400">로딩 중...</div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={mode === 'monthly' ? `${year}-${month}` : 'cumulative'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              {mode === 'monthly' ? (
                <MonthlyView balances={monthlyBalances} profiles={profiles} />
              ) : (
                <CumulativeView allBalances={allBalances} profiles={profiles} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
