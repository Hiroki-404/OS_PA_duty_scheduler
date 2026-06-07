import type {
  WorkerInfo, AvailabilityMap, HolidayItem,
  ScheduleResult, ScheduleWarning, PenaltyConfig, AvailabilityType
} from './types'
import { DEFAULT_PENALTY_CONFIG } from './types'
import { getDaysInMonth, getDayType, initRunningBalance, computeCarryover } from './balance'
import { computePenalty } from './penalty'

export interface PrevMonthBalance {
  userId: string
  weekendDuties: number
  holidayDuties: number
  weekdayDuties: number
  dow: [number, number, number, number, number, number, number]
  isInitialMonth: boolean
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// Fisher-Yates shuffle — 매 배정 실행마다 무작위 시드 생성
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateSchedule(
  year: number,
  month: number,
  workers: WorkerInfo[],
  availabilities: AvailabilityMap,
  prevBalances: PrevMonthBalance[],
  holidays: HolidayItem[],
  config: PenaltyConfig = DEFAULT_PENALTY_CONFIG
): ScheduleResult {
  const days = getDaysInMonth(year, month)
  const assignments = new Map<string, string>()
  const warnings: ScheduleWarning[] = []

  // 해당 월 활성 근무자 필터 후 셔플 — 실행마다 초기 순서 무작위화
  const filtered = workers.filter(w => {
    if (!w.activePeriod) return true
    const s = new Date(w.activePeriod.startDate)
    const e = w.activePeriod.endDate ? new Date(w.activePeriod.endDate) : null
    const monthEnd   = new Date(year, month, 0)
    const monthStart = new Date(year, month - 1, 1)
    return s <= monthEnd && (!e || e >= monthStart)
  })
  const active = shuffleArray(filtered)

  if (!active.length) throw new Error('활성 근무자가 없습니다')

  console.log(`[ALGO] 대상 근무자(셔플 후): ${active.map(w => w.name).join(', ')} (${active.length}명)`)
  console.log(`[ALGO] 배정 대상 일수: ${days.length}일`)

  const nonInit = prevBalances.filter(b => !b.isInitialMonth)
  const carryover = nonInit.length ? computeCarryover(nonInit, active.length) : {}
  const runningBalance = initRunningBalance(active.map(w => w.id))

  // Most Constrained First: 가용 근무자 수 오름차순, 동수 구간은 셔플로 무작위화
  const shuffledDays = shuffleArray([...days])
  const sortedDays = shuffledDays.sort((a, b) =>
    getAvailableWorkers(a, active, availabilities).length -
    getAvailableWorkers(b, active, availabilities).length
  )

  const constrainedTop = sortedDays.slice(0, 5).map(d => {
    const iso = d.toISOString().slice(0, 10)
    const avail = getAvailableWorkers(d, active, availabilities).length
    return `${iso}(가용 ${avail}명)`
  })
  console.log(`[ALGO] 최우선 배정일(제약 심한 순): ${constrainedTop.join(', ')}`)

  for (const day of sortedDays) {
    const iso = day.toISOString().slice(0, 10)
    const dowLabel = DOW[day.getDay()]

    let candidates = getAvailableWorkers(day, active, availabilities)
    let forced: AvailabilityType | null = null

    if (!candidates.length) {
      const halfDayCandidates = getForcedCandidates(day, active, availabilities, 'half_day')
      if (halfDayCandidates.length) {
        candidates = halfDayCandidates
        forced = 'half_day'
      } else {
        const annualCandidates = getForcedCandidates(day, active, availabilities, 'annual_leave')
        const excludeCandidates = getForcedCandidates(day, active, availabilities, 'exclude')
        if (annualCandidates.length)       { candidates = annualCandidates; forced = 'annual_leave' }
        else if (excludeCandidates.length) { candidates = excludeCandidates; forced = 'exclude' }
        else throw new Error(`${iso}: 배정 가능한 근무자가 없습니다`)
      }
    }

    const ctx = {
      year, month,
      numWorkers: active.length,
      holidays,
      assignments,
      runningBalance,
      carryover,
      config,
      availabilities,
    }

    // 패널티 스코어 계산 (1회만)
    const scored = candidates.map(w => ({
      worker: w,
      score: computePenalty(w.id, day, ctx),
    }))
    scored.sort((a, b) => a.score - b.score)

    // 최저 스코어 동점자 추출 후 무작위 선택 — 핵심 랜덤 시드 주입
    const minScore = scored[0].score
    const tied = scored.filter(s => s.score === minScore)
    const best = tied[Math.floor(Math.random() * tied.length)].worker

    assignments.set(iso, best.id)

    const scoreStr = scored.map(s => `${s.worker.name}:${s.score.toFixed(0)}`).join(' / ')
    const forcedTag = forced ? ` [강제:${forced}]` : ''
    const tiedTag  = tied.length > 1 ? ` (동점${tied.length}명→랜덤)` : ''
    console.log(`[ALGO] ${iso}(${dowLabel})${forcedTag}${tiedTag} → ${best.name}  [${scoreStr}]`)

    if (forced) {
      warnings.push({
        date: iso,
        reason: `전체 ${forced} 신청일 — 강제 배정`,
        forcedUserId: best.id,
        originalType: forced,
      })
    }

    const b = runningBalance[best.id]
    b.total++
    b.dow[day.getDay()]++
    const dayType = getDayType(day, holidays)
    if (dayType === 'holiday')      b.holiday++
    else if (dayType === 'weekend') b.weekend++
    else                            b.weekday++
  }

  console.log('[ALGO] ── 최종 누적 밸런스 스냅샷 ──')
  for (const w of active) {
    const b = runningBalance[w.id]
    const dowStr = b.dow.map((c, i) => `${DOW[i]}:${c}`).join(' ')
    console.log(`  ${w.name}: 합계 ${b.total} | 평일 ${b.weekday} / 주말 ${b.weekend} / 공휴일 ${b.holiday} | ${dowStr}`)
  }

  return { assignments, warnings }
}

function getAvailableWorkers(day: Date, workers: WorkerInfo[], avail: AvailabilityMap): WorkerInfo[] {
  const iso = day.toISOString().slice(0, 10)
  return workers.filter(w => {
    const type = avail[w.id]?.[iso]
    return !type || type === 'half_day'
  })
}

function getForcedCandidates(
  day: Date, workers: WorkerInfo[], avail: AvailabilityMap, type: AvailabilityType
): WorkerInfo[] {
  const iso = day.toISOString().slice(0, 10)
  return workers.filter(w => avail[w.id]?.[iso] === type)
}

export function computeMonthlyBalance(
  year: number,
  month: number,
  assignments: Map<string, string>,
  workers: WorkerInfo[],
  holidays: HolidayItem[]
): PrevMonthBalance[] {
  return workers.map(w => {
    const dates = [...assignments.entries()]
      .filter(([, uid]) => uid === w.id)
      .map(([d]) => new Date(d))
    const dow: [number,number,number,number,number,number,number] = [0,0,0,0,0,0,0]
    let weekday = 0, weekend = 0, holiday = 0
    for (const d of dates) {
      dow[d.getDay()]++
      const dt = getDayType(d, holidays)
      if (dt === 'holiday')      holiday++
      else if (dt === 'weekend') weekend++
      else                       weekday++
    }
    return {
      userId: w.id,
      weekdayDuties: weekday,
      weekendDuties: weekend,
      holidayDuties: holiday,
      dow,
      isInitialMonth: false,
    }
  })
}
