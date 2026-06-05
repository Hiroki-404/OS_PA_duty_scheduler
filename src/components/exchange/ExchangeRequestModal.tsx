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
  myScheduleDates: string[]
  onSubmit: (params: { type: 'swap' | 'transfer'; requesterDate: string; targetId: string; targetDate?: string }) => Promise<void>
}

export function ExchangeRequestModal({ open, onClose, workers, currentUserId, myScheduleDates, onSubmit }: Props) {
  const [step, setStep] = useState(0)
  const [exchangeType, setExchangeType] = useState<'swap' | 'transfer'>('swap')
  const [requesterDate, setRequesterDate] = useState('')
  const [targetId, setTargetId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => { setStep(0); setExchangeType('swap'); setRequesterDate(''); setTargetId(''); setTargetDate('') }
  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onSubmit({ type: exchangeType, requesterDate, targetId, targetDate: exchangeType === 'swap' ? targetDate : undefined })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  const otherWorkers = workers.filter(w => w.id !== currentUserId)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} />
          <motion.div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-3xl z-50"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3" />
            <div className="px-6 pt-4 pb-8">
              <h3 className="font-bold text-gray-900 mb-4">당직 교환 신청</h3>

              {/* Step 0: 교환 유형 */}
              {step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">교환 유형을 선택하세요</p>
                  {[
                    { type: 'swap' as const, label: '맞교환 (A ↔ B)', desc: '서로 날짜를 바꿉니다' },
                    { type: 'transfer' as const, label: '일방 교체 (A → B)', desc: '내 당직을 상대방이 대신 합니다' },
                  ].map(opt => (
                    <motion.button key={opt.type} whileTap={{ scale: 0.97 }} onClick={() => { setExchangeType(opt.type); setStep(1) }}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl text-left border-2 transition-colors
                        ${exchangeType === opt.type ? 'border-toss-blue bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
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
                  <p className="text-sm text-gray-500 mb-3">교환할 내 당직 날짜를 선택하세요</p>
                  {myScheduleDates.length === 0
                    ? <p className="text-sm text-gray-400 text-center py-4">이번 달 배정된 당직이 없습니다</p>
                    : myScheduleDates.map(d => (
                        <motion.button key={d} whileTap={{ scale: 0.97 }} onClick={() => { setRequesterDate(d); setStep(exchangeType === 'swap' ? 2 : 3) }}
                          className={`w-full p-3 rounded-xl border-2 text-left font-medium text-sm
                            ${requesterDate === d ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-100 text-gray-700'}`}>
                          {d}
                        </motion.button>
                      ))
                  }
                  <Button variant="ghost" onClick={() => setStep(0)}>← 이전</Button>
                </div>
              )}

              {/* Step 2: 상대방 날짜 선택 (맞교환만) */}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">상대방의 당직 날짜를 입력하세요</p>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm focus:border-toss-blue outline-none" />
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setStep(1)}>← 이전</Button>
                    <Button fullWidth disabled={!targetDate} onClick={() => setStep(3)}>다음</Button>
                  </div>
                </div>
              )}

              {/* Step 3: 대상자 선택 */}
              {step === 3 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-3">교환 상대를 선택하세요</p>
                  {otherWorkers.map(w => (
                    <motion.button key={w.id} whileTap={{ scale: 0.97 }} onClick={() => setTargetId(w.id)}
                      className={`w-full p-3 rounded-xl border-2 text-left font-semibold text-sm
                        ${targetId === w.id ? 'border-toss-blue bg-blue-50 text-toss-blue' : 'border-gray-100 text-gray-700'}`}>
                      {w.name}
                    </motion.button>
                  ))}
                  <div className="flex gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setStep(exchangeType === 'swap' ? 2 : 1)}>← 이전</Button>
                    <Button fullWidth loading={loading} disabled={!targetId} onClick={handleSubmit}>신청하기</Button>
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
