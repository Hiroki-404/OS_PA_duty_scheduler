'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { signOut } from '@/lib/kakao/auth'
import { useRouter } from 'next/navigation'

interface ProfileRow { id: string; name: string; employee_id: string; is_admin: boolean; is_active: boolean }

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [currentUser, setCurrentUser] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const { show } = useToast()
  const router = useRouter()

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await sb.from('profiles').select('*').order('name')
      if (data) {
        setProfiles(data)
        setCurrentUser(data.find(p => p.id === user.id) ?? null)
      }
    })
  }, [])

  const toggleAdmin = async (targetId: string, currentIsAdmin: boolean) => {
    if (!currentUser?.is_admin) return show('관리자 권한이 없습니다', 'error')
    setLoading(targetId)
    const sb = createClient()
    await sb.from('profiles').update({ is_admin: !currentIsAdmin }).eq('id', targetId)
    setProfiles(prev => prev.map(p => p.id === targetId ? { ...p, is_admin: !currentIsAdmin } : p))
    show(`${currentIsAdmin ? '관리자 권한을 해제했습니다' : '관리자 권한을 부여했습니다'}`, 'success')
    setLoading(null)
  }

  const toggleActive = async (targetId: string, currentIsActive: boolean) => {
    if (!currentUser?.is_admin) return show('관리자 권한이 없습니다', 'error')
    setLoading(targetId + '-active')
    const sb = createClient()
    await sb.from('profiles').update({ is_active: !currentIsActive }).eq('id', targetId)
    setProfiles(prev => prev.map(p => p.id === targetId ? { ...p, is_active: !currentIsActive } : p))
    show(`${currentIsActive ? '비활성화했습니다' : '활성화했습니다'}`, 'success')
    setLoading(null)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  const handleFullReset = async () => {
    const confirmed = window.confirm(
      '⚠️ 전체 초기화\n\n모든 당직표, 누적 통계, 제출 데이터가 삭제됩니다.\n프로필(이름/사번)은 유지됩니다.\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?'
    )
    if (!confirmed) return
    setLoading('reset-all')
    try {
      const res = await fetch('/api/data/reset-all', { method: 'DELETE' })
      if (res.ok) {
        show('전체 데이터가 초기화되었습니다', 'success')
        window.location.reload()
      } else {
        const body = await res.json()
        show(body.error ?? '초기화 실패', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* 근무자 관리 */}
        {currentUser?.is_admin && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-bold text-gray-700">근무자 관리</h2>
            </div>
            {profiles.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <div className="w-9 h-9 rounded-full bg-toss-blue text-white flex items-center justify-center font-bold text-sm">
                  {p.name[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                    {p.is_admin && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">관리자</span>}
                    {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">비활성</span>}
                  </div>
                  <span className="text-xs text-gray-400">{p.employee_id}</span>
                </div>
                {p.id !== currentUser?.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAdmin(p.id, p.is_admin)}
                      disabled={loading === p.id}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {loading === p.id ? '⏳' : p.is_admin ? '관리자 해제' : '관리자 위임'}
                    </button>
                    <button
                      onClick={() => toggleActive(p.id, p.is_active)}
                      disabled={loading === p.id + '-active'}
                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {loading === p.id + '-active' ? '⏳' : p.is_active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* 내 정보 */}
        {currentUser && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-gray-700 mb-3">내 정보</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span>이름</span><span className="font-medium">{currentUser.name}</span></div>
              <div className="flex justify-between"><span>사번</span><span className="font-medium">{currentUser.employee_id}</span></div>
              <div className="flex justify-between"><span>권한</span><span className="font-medium">{currentUser.is_admin ? '관리자' : '근무자'}</span></div>
            </div>
          </div>
        )}

        {/* 위험 구역 */}
        {currentUser?.is_admin && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-red-100">
            <div className="px-4 py-3 border-b border-red-50">
              <h2 className="text-sm font-bold text-red-500">위험 구역</h2>
              <p className="text-xs text-gray-400 mt-0.5">되돌릴 수 없는 작업입니다</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-gray-500 mb-3">
                모든 당직표·통계·제출 데이터를 초기화합니다. 프로필 정보는 유지됩니다.
              </p>
              <button
                disabled={loading === 'reset-all'}
                onClick={handleFullReset}
                className="w-full py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 border border-red-200 active:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {loading === 'reset-all' ? '초기화 중...' : '전체 데이터 초기화'}
              </button>
            </div>
          </div>
        )}

        {/* 로그아웃 */}
        <Button fullWidth variant="secondary" onClick={handleSignOut}>로그아웃</Button>
      </div>
    </div>
  )
}
