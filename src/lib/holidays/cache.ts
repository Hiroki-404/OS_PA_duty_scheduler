import type { SupabaseClient } from '@supabase/supabase-js'
import type { HolidayItem } from '@/lib/algorithm/types'
import { fetchHolidaysFromAPI } from './fetcher'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function getHolidaysForMonth(
  year: number,
  month: number,
  supabase: AnyClient
): Promise<HolidayItem[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const { data: cached } = await supabase
    .from('holiday_cache')
    .select('date, name')
    .gte('date', `${year}-${pad(month)}-01`)
    .lte('date', `${year}-${pad(month)}-31`)

  if (cached && cached.length > 0) {
    return cached.map(c => ({ date: c.date, name: c.name }))
  }

  const holidays = await fetchHolidaysFromAPI(year, month)
  if (holidays.length > 0) {
    await supabase.from('holiday_cache').upsert(
      holidays.map(h => ({ date: h.date, name: h.name, year }))
    )
  }
  return holidays
}

export function isHolidayDate(dateISO: string, holidays: HolidayItem[]): boolean {
  return holidays.some(h => h.date === dateISO)
}
