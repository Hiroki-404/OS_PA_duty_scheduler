export type DayType = 'weekday' | 'weekend' | 'holiday'
export type AvailabilityType = 'exclude' | 'half_day' | 'annual_leave'

export interface WorkerInfo {
  id: string
  name: string
  activePeriod?: { startDate: string; endDate?: string }
}

export interface AvailabilityMap {
  [userId: string]: { [dateISO: string]: AvailabilityType }
}

export interface RunningBalance {
  [userId: string]: {
    total: number
    weekday: number
    weekend: number
    holiday: number
    dow: [number, number, number, number, number, number, number]
  }
}

export interface CarryoverBalance {
  [userId: string]: {
    weekendExcess: number
    holidayExcess: number
    dowExcess: [number, number, number, number, number, number, number]
  }
}

export interface ScheduleWarning {
  date: string
  reason: string
  forcedUserId: string
  originalType: AvailabilityType
}

export interface ScheduleResult {
  assignments: Map<string, string>
  warnings: ScheduleWarning[]
}

export interface PenaltyConfig {
  W_DISTRIBUTION: number
  W_DOW_BALANCE: number
  W_CARRYOVER: number
  W_WEEKLY_DENSITY: number
  W_CONSECUTIVE: number
}

export const DEFAULT_PENALTY_CONFIG: PenaltyConfig = {
  W_DISTRIBUTION: 100,
  W_DOW_BALANCE: 80,
  W_CARRYOVER: 60,
  W_WEEKLY_DENSITY: 50,
  W_CONSECUTIVE: 40,
}

export interface HolidayItem {
  date: string
  name: string
}
