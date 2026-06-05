import { generateSchedule } from '@/lib/algorithm/scheduler'
import type { WorkerInfo, AvailabilityMap } from '@/lib/algorithm/types'

const WORKERS: WorkerInfo[] = [
  { id: 'w1', name: '김철수' },
  { id: 'w2', name: '이영희' },
  { id: 'w3', name: '박민수' },
  { id: 'w4', name: '최지연' },
]

describe('generateSchedule', () => {
  test('4명 28일(2월) — 모든 날짜 배정됨', () => {
    const result = generateSchedule(2027, 2, WORKERS, {}, [], [])
    expect(result.assignments.size).toBe(28)
  })

  test('각 근무자 총 배정 수 균등 분배 (오차 1 이내)', () => {
    const result = generateSchedule(2027, 2, WORKERS, {}, [], [])
    const counts = WORKERS.map(w =>
      [...result.assignments.values()].filter(uid => uid === w.id).length
    )
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  test('전원 제외일 신청 날 — warnings 반환 + 강제 배정', () => {
    const avail: AvailabilityMap = {}
    WORKERS.forEach(w => { avail[w.id] = { '2027-02-15': 'annual_leave' } })
    const result = generateSchedule(2027, 2, WORKERS, avail, [], [])
    const warned = result.warnings.find(w => w.date === '2027-02-15')
    expect(warned).toBeDefined()
    expect(result.assignments.has('2027-02-15')).toBe(true)
  })

  test('이전 달 이월 — 많이 배정된 사람 이번 달 페널티 높음 (배정 수 적거나 같음)', () => {
    const heavyId = WORKERS[0].id
    const prevBalances = WORKERS.map(w => ({
      userId: w.id,
      weekendDuties: w.id === heavyId ? 10 : 2,
      holidayDuties: 0,
      weekdayDuties: w.id === heavyId ? 15 : 5,
      dow: [2, 2, 2, 2, 2, 2, 2] as [number, number, number, number, number, number, number],
      isInitialMonth: false,
    }))
    const result = generateSchedule(2027, 3, WORKERS, {}, prevBalances, [])
    const heavyCount = [...result.assignments.values()].filter(uid => uid === heavyId).length
    const avgCount = result.assignments.size / WORKERS.length
    expect(heavyCount).toBeLessThanOrEqual(Math.ceil(avgCount))
  })

  test('제외일 신청 날은 해당 근무자 배정 안 됨', () => {
    const avail: AvailabilityMap = { w1: { '2027-02-10': 'exclude' } }
    const result = generateSchedule(2027, 2, WORKERS, avail, [], [])
    expect(result.assignments.get('2027-02-10')).not.toBe('w1')
  })
})
