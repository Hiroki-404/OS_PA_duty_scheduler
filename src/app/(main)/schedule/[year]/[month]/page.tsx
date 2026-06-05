import { createClient } from '@/lib/supabase/server'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import { ScheduleTable } from '@/components/schedule/ScheduleTable'

interface Props {
  params: Promise<{ year: string; month: string }>
}

export default async function SchedulePage({ params }: Props) {
  const { year: yearStr, month: monthStr } = await params
  const supabase = await createClient()
  const year  = parseInt(yearStr)
  const month = parseInt(monthStr)
  const pad = (n: number) => String(n).padStart(2, '0')

  const [{ data: schedules }, { data: profiles }, holidays] = await Promise.all([
    supabase.from('schedules')
      .select('*')
      .gte('date', `${year}-${pad(month)}-01`)
      .lte('date', `${year}-${pad(month)}-31`)
      .order('date'),
    supabase.from('profiles').select('id, name, color').eq('is_active', true),
    getHolidaysForMonth(year, month, supabase),
  ])

  const workerMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, { name: p.name, color: p.color ?? '#4DABF7' }])
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">{year}년 {month}월 당직표</h1>
      </header>
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <ScheduleTable
            schedules={schedules ?? []}
            workerMap={workerMap}
            year={year}
            month={month}
            holidays={holidays}
            availabilities={[]}
          />
        </div>
      </div>
    </div>
  )
}
