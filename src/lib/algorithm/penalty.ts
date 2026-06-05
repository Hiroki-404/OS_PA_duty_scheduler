import type { PenaltyConfig, RunningBalance, CarryoverBalance, HolidayItem, AvailabilityMap } from './types'
import { getDayType, getTargetCount } from './balance'

interface PenaltyContext {
  year: number
  month: number
  numWorkers: number
  holidays: HolidayItem[]
  assignments: Map<string, string>
  runningBalance: RunningBalance
  carryover: CarryoverBalance
  config: PenaltyConfig
  availabilities?: AvailabilityMap
}

export function computePenalty(userId: string, date: Date, ctx: PenaltyContext): number {
  const { year, month, numWorkers, holidays, assignments, runningBalance, carryover, config, availabilities } = ctx
  const b = runningBalance[userId]
  if (!b) return Infinity

  const dow = date.getDay()
  const dt  = getDayType(date, holidays)
  const iso = date.toISOString().slice(0, 10)
  let score = 0

  // P1: 특수일(주말+공휴일) 균등분배 편차
  const isSpecial = dt === 'weekend' || dt === 'holiday'
  if (isSpecial) {
    const tSpec = getTargetCount('weekend', year, month, numWorkers, holidays)
               + getTargetCount('holiday', year, month, numWorkers, holidays)
    score += config.W_DISTRIBUTION * Math.pow(Math.max(0, b.weekend + b.holiday - tSpec + 1), 2)
  }

  // P2: 평일 균등분배 편차
  if (dt === 'weekday') {
    const tWd = getTargetCount('weekday', year, month, numWorkers, holidays)
    score += config.W_DISTRIBUTION * Math.pow(Math.max(0, b.weekday - tWd + 1), 2)
  }

  // P3: 요일별 균등분배 편차
  const tDow = getTargetCount('dow', year, month, numWorkers, holidays, dow)
  score += config.W_DOW_BALANCE * Math.pow(Math.max(0, b.dow[dow] - tDow + 1), 2)

  // P4: 이월 보정
  const co = carryover[userId]
  if (co) {
    if (isSpecial) score += config.W_CARRYOVER * Math.max(0, co.weekendExcess + co.holidayExcess)
    score += config.W_CARRYOVER * Math.max(0, co.dowExcess[dow]) * 0.5
  }

  // P5: 주간 밀도 (일~토)
  const wc = countWeekAssignments(userId, date, assignments)
  if (wc === 3)      score += config.W_WEEKLY_DENSITY * 5
  else if (wc >= 4)  score += config.W_WEEKLY_DENSITY * 100

  // P6: 연속 근무
  const cc = countConsecutive(userId, date, assignments)
  if (cc === 2)      score += config.W_CONSECUTIVE * 10
  else if (cc >= 3)  score += config.W_CONSECUTIVE * 100

  // P7: 반차 날짜 — 배정 가능하지만 가중치 부여 (가급적 다른 사람 먼저)
  if (availabilities?.[userId]?.[iso] === 'half_day') {
    score += config.W_CONSECUTIVE * 30
  }

  return score
}

export function countWeekAssignments(userId: string, date: Date, assignments: Map<string, string>): number {
  const dow = date.getDay()
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - dow)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  let count = 0
  for (const [ds, uid] of assignments) {
    if (uid !== userId) continue
    const d = new Date(ds)
    if (d >= weekStart && d <= weekEnd) count++
  }
  return count
}

export function countConsecutive(userId: string, date: Date, assignments: Map<string, string>): number {
  let count = 0
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  while (assignments.get(d.toISOString().slice(0, 10)) === userId) {
    count++
    d.setDate(d.getDate() - 1)
  }
  return count
}
