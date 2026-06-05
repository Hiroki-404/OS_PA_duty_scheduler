export interface Worker {
  id: string
  name: string
  employeeId: string
  isAdmin: boolean
  isActive: boolean
  color: string
  activePeriod?: { startDate: string; endDate?: string }
}

export interface Schedule {
  id: string
  userId: string
  date: string
  isWeekend: boolean
  isHoliday: boolean
  isLocked: boolean
  workerName?: string
}

export interface AvailabilityRequest {
  id: string
  userId: string
  year: number
  month: number
  date: string
  type: 'exclude' | 'half_day' | 'annual_leave'
  submittedAt?: string
}

export interface ExchangeRequest {
  id: string
  requesterId: string
  targetId: string
  requesterDate: string
  targetDate?: string
  type: 'swap' | 'transfer'
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  expiresAt: string
  requestedAt: string
  respondedAt?: string
}

export interface MonthlyBalance {
  userId: string
  year: number
  month: number
  totalDuties: number
  weekdayDuties: number
  weekendDuties: number
  holidayDuties: number
  dow: [number, number, number, number, number, number, number]
  isInitialMonth: boolean
}
