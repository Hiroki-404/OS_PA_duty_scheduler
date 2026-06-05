import type { HolidayItem, RunningBalance, CarryoverBalance } from './types'

export function getDaysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month, 0).getDate()
  return Array.from({ length: count }, (_, i) => new Date(year, month - 1, i + 1))
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay()
  return w === 0 || w === 6
}

export function isHoliday(d: Date, holidays: HolidayItem[]): boolean {
  return holidays.some(h => h.date === d.toISOString().slice(0, 10))
}

export function getDayType(d: Date, holidays: HolidayItem[]): 'weekday' | 'weekend' | 'holiday' {
  if (isHoliday(d, holidays)) return 'holiday'
  if (isWeekend(d)) return 'weekend'
  return 'weekday'
}

export function getTargetCount(
  type: 'weekday' | 'weekend' | 'holiday' | 'dow',
  year: number,
  month: number,
  numWorkers: number,
  holidays: HolidayItem[],
  dow?: number
): number {
  const days = getDaysInMonth(year, month)
  let count: number
  if (type === 'dow' && dow !== undefined) {
    count = days.filter(d => d.getDay() === dow).length
  } else if (type === 'holiday') {
    count = days.filter(d => isHoliday(d, holidays)).length
  } else if (type === 'weekend') {
    count = days.filter(d => isWeekend(d) && !isHoliday(d, holidays)).length
  } else {
    count = days.filter(d => !isWeekend(d) && !isHoliday(d, holidays)).length
  }
  return count / numWorkers
}

export function initRunningBalance(workers: string[]): RunningBalance {
  return Object.fromEntries(workers.map(id => [
    id,
    { total: 0, weekday: 0, weekend: 0, holiday: 0, dow: [0, 0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number, number] }
  ]))
}

export function computeCarryover(
  prevBalances: Array<{
    userId: string
    weekendDuties: number
    holidayDuties: number
    weekdayDuties: number
    dow: [number, number, number, number, number, number, number]
  }>,
  numWorkers: number
): CarryoverBalance {
  if (!prevBalances.length) return {}
  const avgW = prevBalances.reduce((s, b) => s + b.weekendDuties, 0) / numWorkers
  const avgH = prevBalances.reduce((s, b) => s + b.holidayDuties, 0) / numWorkers
  const avgDow = [0, 1, 2, 3, 4, 5, 6].map(i => prevBalances.reduce((s, b) => s + b.dow[i], 0) / numWorkers)
  return Object.fromEntries(prevBalances.map(b => [
    b.userId,
    {
      weekendExcess: b.weekendDuties - avgW,
      holidayExcess: b.holidayDuties - avgH,
      dowExcess: [0, 1, 2, 3, 4, 5, 6].map(i => b.dow[i] - avgDow[i]) as [number, number, number, number, number, number, number],
    }
  ]))
}
