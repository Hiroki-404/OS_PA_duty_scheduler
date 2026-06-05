'use client'
import { motion } from 'framer-motion'

interface WorkerStatus {
  id: string
  name: string
  submittedAt?: string
  hasNoDays?: boolean
}

interface Props {
  workers: WorkerStatus[]
  currentUserId: string
}

export function SubmissionStatus({ workers, currentUserId }: Props) {
  return (
    <div className="space-y-2">
      {workers.map((w, i) => (
        <motion.div
          key={w.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`flex items-center gap-3 p-4 rounded-2xl transition-all
            ${w.submittedAt
              ? 'bg-blue-50 border border-blue-100'
              : 'bg-gray-50 opacity-50 blur-[1px]'}`}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm
            ${w.submittedAt ? 'bg-toss-blue text-white' : 'bg-gray-200 text-gray-500'}`}>
            {w.name[0]}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-gray-800">
              {w.name}{w.id === currentUserId && ' (나)'}
            </div>
            {w.submittedAt
              ? <div className={`text-xs mt-0.5 ${w.hasNoDays ? 'text-gray-500' : 'text-green-600'}`}>
                  {w.hasNoDays ? '당직 빼는 날 없음' : '제출 완료'}
                </div>
              : <div className="text-xs text-gray-400 mt-0.5">미제출</div>
            }
          </div>
          {w.submittedAt && <span className="text-toss-blue text-xl">✓</span>}
        </motion.div>
      ))}
    </div>
  )
}
