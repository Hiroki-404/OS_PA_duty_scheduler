'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'

interface Worker { id: string; name: string }

interface Props {
  open: boolean
  onClose: () => void
  workers: Worker[]
  currentUserId: string
  myCurrentMonthDates: string[]
  myNextMonthDates: string[]
  /** date(YYYY-MM-DD) → user_id: 이번 달 + 다음 달 전체 스케줄 맵 */
  scheduleMap: Record<string, string>
  currentYear: number
  currentMonth: number
  onSubmit: (params: {
    type: 'swap' | 'transfer'
    requesterDate: string
    targetId: string
    targetDate?: string
  }) => Promise<void>
}

// step 흐름
// 맞교환:   0(유형+월) → 1(내 날짜) → 2(상대 날짜 + 자동 대상자) → 4(최종확인)
// 일방교체: 0(유형+월) → 1(내 날짜) → 3(대상자 선택)

export function ExchangeRequestModal({
  open, onClose, workers, currentUserId,
  myCurrentMonthDates, myNextMonthDates, scheduleMap,
  currentYear, currentMonth, onSubmit,
}: Props) {
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0)
  const [step, setStep] = useState(0)
  const [exchangeType, setExchangeType] = useState<'swap' | 'transfer'>('swap')
  const [requesterDate, setRequesterDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  const nextYear  = currentMonth === 12 ? currentYear + 1 : currentYear

  const activeYear  = monthOffset === 0 ? currentYear  : nextYear
  const activeMonth = monthOffset === 0 ? currentMonth : nextMonth
  const myScheduleDates = monthOffset === 0 ? myCurrentMonthDates : myNextMonthDates

  const pad = (n: number) => String(n).padStart(2, '0')
  const minDate = `${activeYear}-${pad(activeMonth)}-01`
  const maxDate = `${activeYear}-${pad(activeMonth)}-${pad(new Date(activeYear, activeMonth, 0).getDate())}`

  // 맞교환: 상대 날짜에 배정된 근무자 자동 조회 (N→1 핵심 수정)
  const targetAssigneeId = targetDate ? scheduleMap[targetDate] ?? null : null
  const targetAssignee   = targetAssigneeId
    ? workers.find(w => w.id === targetAssigneeId) ?? null
    : null

  const otherWorkers = workers.filter(w => w.id !== currentUserId)

  const reset = () => {
    setStep(0); setExchangeType('swap')
    setRequesterDate(''); setTargetDate(''); setTargetId('')
    setMonthOffset(0)
  }
  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    const resolvedTargetId = exchangeType === 'swap' ? (targetAssigneeId ?? '') : targetId
    if (!resolvedTargetId) return
    setLoading(true)
    try {
      await onSubmit({
        type: exchangeType,
        requesterDate,
        targetId: resolvedTargetId,
        targetDate: exchangeType === 'swap' ? targetDate : undefined,
      })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[88vh] overflow-y-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />

            <div className="px-6 pt-4 pb-8">
              {/* 상단 월 탭: step 0에서만 변경 가능, 이후 단계에서는 표시만 */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 mb-5">
                {([0, 1] as const).map(offset => {
                  const yr = offset === 0 ? currentYear : nextYear
                  const mo = offset === 0 ? currentMonth : nextMonth
                  const active = monthOffset === offset
                  return (
                    <button
                      key={offset}
                      onClick={() => { if (step === 0) { setMonthOffset(offset) } }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors
                        ${active ? 'bg-white text-toss-blue shadow-sm' : 'text-gray-400'}
                        ${step > 0 ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {yr}년 {mo}월
                    </button>
                  )
                })}
              </div>

              <h3 className="font-bold text-gray-900 mb-4">당직 교환 신청</h3>

              {/* Step 0: 교환 유형 선택 */}
              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">교환 유형을 선택하세요</p>
                  {[
                    { type: 'swap' as const,     label: '맞교환 (A ↔ B)',   desc: '서로 날짜를 바꿉니다' },
                    { type: 'transfer' as const, label: '일방 교체 (A → B)', desc: '내 당직을 상대방이 대신 합니다' },
                  ].map(opt => (
                    <motion.button
                      key={opt.type}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setExchangeType(opt.type); setStep(1) }}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl text-left border-2 transition-colors
                        ${exchangeType === opt.type ? 'border-toss-blue bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Step 1: 내 날짜 선택 */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">
                    교환할 내 당직 날짜를 선택하세요
                  </p>
                  {myScheduleDates.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      {activeYear}년 {activeMonth}월 배정된 당직이 없습니다
                    </p>
                  ) : (
                    myScheduleDates.map(d => (
                      <motion.button
                        key={d}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setRequesterDate(d)
                          setStep(exchangeType === 'swap' ? 2 : 3)
                        }}
                        className={`w-full p-3 rounded-xl border-2 text-left font-medium text-sm
                          ${requesterDate === d
                            ? 'border-toss-blue bg-blue-50 text-toss-blue'
                            : 'border-gray-100 text-gray-700'}`}
                      >
                        {d}
                      </motion.button>
                    ))
                  )}
                  <Button variant="ghost" onClick={() => setStep(0)}>← 이전</Button>
                </div>
              )}

              {/* Step 2: 상대방 날짜 선택 (맞교환만) — 배정자 자동 결정 */}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-1">
                    바꿀 상대방의 당직 날짜를 선택하세요
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    해당 날짜에 배정된 근무자가 자동으로 교환 대상이 됩니다
                  </p>
                  <input
                    type="date"
                    value={targetDate}
                    min={minDate}
                    max={maxDate}
                    onChange={e => { setTargetDate(e.target.value); setTargetId('') }}
                    className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-toss-blue outline-none"
                  />

                  {/* 배정자 미리보기 */}
                  {targetDate && (
                    <div className={`p-3 rounded-xl text-sm font-medium border
                      ${targetAssignee
                        ? 'bg-blue-50 border-blue-100 text-blue-700'
                        : 'bg-gray-50 border-gray-100 text-gray-400'}`}
                    >
                      {targetAssignee
                        ? `교환 상대: ${targetAssignee.name}`
                        : '해당 날짜에 배정된 근무자가 없습니다'}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => { setTargetDate(''); setStep(1) }}>
                      ← 이전
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!targetDate || !targetAssignee}
                      onClick={() => setStep(4)}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: 대상자 선택 (일방 교체만) */}
              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">교체를 맡을 대상을 선택하세요</p>
                  {otherWorkers.map(w => (
                    <motion.button
                      key={w.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTargetId(w.id)}
                      className={`w-full p-3 rounded-xl border-2 text-left font-semibold text-sm
                        ${targetId === w.id
                          ? 'border-toss-blue bg-blue-50 text-toss-blue'
                          : 'border-gray-100 text-gray-700'}`}
                    >
                      {w.name}
                    </motion.button>
                  ))}
                  <div className="flex gap-2 mt-4">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>← 이전</Button>
                    <Button className="flex-1" loading={loading} disabled={!targetId} onClick={handleSubmit}>
                      신청하기
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: 맞교환 최종 확인 */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">교환 내용을 확인하세요</p>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">내 날짜</span>
                      <span className="font-semibold text-gray-800">{requesterDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">상대 날짜</span>
                      <span className="font-semibold text-gray-800">{targetDate}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">교환 상대</span>
                      <span className="font-bold text-toss-blue">
                        {targetAssignee?.name ?? '?'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    신청 후 상대방이 수락해야 교환이 확정됩니다
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep(2)}>← 이전</Button>
                    <Button className="flex-1" loading={loading} onClick={handleSubmit}>
                      신청하기
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
