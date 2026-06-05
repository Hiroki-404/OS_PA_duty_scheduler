'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

const PALETTE = [
  '#FF6B6B','#FF8E53','#FFC048','#51CF66','#20C997',
  '#4DABF7','#748FFC','#DA77F2','#F783AC','#FF922B',
  '#E64980','#BE4BDB','#7950F2','#1C7ED6','#0CA678',
  '#2F9E44','#E67700','#D9480F','#862E9C','#5C7CFA',
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const steps = [
    { title: '사번을 입력해주세요', value: employeeId, setter: setEmployeeId, placeholder: '예: 2024001' },
    { title: '이름을 입력해주세요', value: name, setter: setName, placeholder: '예: 홍길동' },
  ]
  const cur = steps[step]

  const handleSubmit = async () => {
    setLoading(true)
    setErrorMsg('')

    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('[onboarding] getUser:', user?.id, userError?.message)

    if (userError || !user) {
      setErrorMsg('세션이 만료되었습니다. 다시 로그인해주세요.')
      setLoading(false)
      return
    }

    // 기존 프로필 조회 (color 미배정 여부 확인)
    const { data: existing } = await supabase
      .from('profiles').select('color').eq('id', user.id).maybeSingle()

    // 트리거가 color를 배정하지 못한 경우 보완
    let assignedColor: string | undefined
    if (!existing?.color || existing.color === '#3182F6') {
      const { data: usedRows } = await supabase
        .from('profiles').select('color').neq('id', user.id)
      const used = new Set((usedRows ?? []).map((r) => r.color))
      assignedColor = PALETTE.find(c => !used.has(c)) ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]
    }

    const payload: Record<string, string> = {
      employee_id: employeeId.trim(),
      name: name.trim(),
      ...(assignedColor ? { color: assignedColor } : {}),
    }
    console.log('[onboarding] saving:', user.id, payload)

    const { data: updated, error: updateError } = await supabase
      .from('profiles').update(payload).eq('id', user.id).select('id')

    console.log('[onboarding] update result:', updated, updateError?.message)

    if (updateError) {
      setErrorMsg(`저장 실패 (update): ${updateError.message}`)
      setLoading(false)
      return
    }

    if (!updated || updated.length === 0) {
      console.log('[onboarding] no row → insert')
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        kakao_id: user.user_metadata?.sub ?? user.id,
        employee_id: payload.employee_id,
        name: payload.name,
        color: assignedColor ?? PALETTE[0],
      })
      if (insertError) {
        setErrorMsg(`저장 실패 (insert): ${insertError.message}`)
        setLoading(false)
        return
      }
    }

    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-16">
      <div className="mb-2 text-sm text-gray-400">{step + 1} / {steps.length}</div>
      <div className="h-1 bg-gray-100 rounded-full mb-8">
        <motion.div
          className="h-full bg-toss-blue rounded-full"
          animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          transition={{ type: 'spring' }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{cur.title}</h2>
          <input
            value={cur.value}
            onChange={e => cur.setter(e.target.value)}
            placeholder={cur.placeholder}
            className="w-full text-lg border-b-2 border-gray-200 focus:border-toss-blue pb-3 outline-none transition-colors"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && cur.value.trim()) {
                step < steps.length - 1 ? setStep(s => s + 1) : handleSubmit()
              }
            }}
          />
          {errorMsg && <p className="mt-4 text-sm text-red-500">{errorMsg}</p>}
        </motion.div>
      </AnimatePresence>

      <div className="pb-12">
        {step < steps.length - 1
          ? <Button fullWidth disabled={!cur.value.trim()} onClick={() => setStep(s => s + 1)}>다음</Button>
          : <Button fullWidth loading={loading} disabled={!cur.value.trim()} onClick={handleSubmit}>시작하기</Button>
        }
      </div>
    </div>
  )
}
