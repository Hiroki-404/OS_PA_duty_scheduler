'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { signOut } from '@/lib/kakao/auth'
import { useRouter } from 'next/navigation'
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push-client'
import { getCached, setCached } from '@/lib/tab-cache'

interface ProfileRow { id: string; name: string; employee_id: string; is_admin: boolean; is_active: boolean; color: string | null }

const COLOR_PALETTE = [
  '#EF9A9A', '#FFCC80', '#FFF176', '#C5E1A5', '#A5D6A7', '#80CBC4',
  '#80DEEA', '#90CAF9', '#9FA8DA', '#CE93D8', '#F48FB1', '#FFAB76',
]

export default function SettingsPage() {
  const [profiles, setProfiles]         = useState<ProfileRow[]>([])
  const [currentUser, setCurrentUser]   = useState<ProfileRow | null>(null)
  const [loading, setLoading]           = useState<string | null>(null)
  const [pushEnabled, setPushEnabled]   = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushLoading, setPushLoading]   = useState(false)

  // 관리자 알림 전송 다이얼로그
  const [sendTarget, setSendTarget]     = useState<{ id: string; name: string } | null>(null)
  const [notifMsg, setNotifMsg]         = useState('')
  const [sendingNotif, setSendingNotif] = useState(false)

  const { show } = useToast()
  const router = useRouter()

  useEffect(() => {
    const sb = createClient()

    // 캐시 즉시 표시 (60초 TTL)
    const cached = getCached<{ profiles: ProfileRow[]; userId: string }>('settings-profiles', 60_000)
    if (cached) {
      setProfiles(cached.profiles)
      setCurrentUser(cached.profiles.find(p => p.id === cached.userId) ?? null)
    }

    sb.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user
      if (!user) return
      const { data } = await sb.from('profiles').select('*').order('name')
      if (data) {
        setProfiles(data)
        setCurrentUser(data.find(p => p.id === user.id) ?? null)
        setCached('settings-profiles', { profiles: data, userId: user.id })
      }
    })

    // 푸시 알림 지원 및 현재 권한 확인
    if (typeof Notification !== 'undefined' && 'serviceWorker' in navigator) {
      setPushSupported(true)
      setPushEnabled(Notification.permission === 'granted')
    }
  }, [])

  const togglePush = async () => {
    if (!pushSupported) return
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
        show('알림이 해제되었습니다', 'success')
      } else {
        const perm = await Notification.requestPermission()
        if (perm === 'granted') {
          await subscribeToPush()
          setPushEnabled(true)
          show('알림이 활성화되었습니다', 'success')
        } else {
          show('브라우저 설정에서 알림을 허용해주세요', 'error')
        }
      }
    } catch {
      show('알림 설정 중 오류가 발생했습니다', 'error')
    }
    setPushLoading(false)
  }

  const toggleAdmin = async (targetId: string, currentIsAdmin: boolean) => {
    if (!currentUser?.is_admin) return show('관리자 권한이 없습니다', 'error')
    setLoading(targetId)
    const sb = createClient()
    await sb.from('profiles').update({ is_admin: !currentIsAdmin }).eq('id', targetId)
    setProfiles(prev => prev.map(p => p.id === targetId ? { ...p, is_admin: !currentIsAdmin } : p))
    show(currentIsAdmin ? '관리자 권한을 해제했습니다' : '관리자 권한을 부여했습니다', 'success')
    setLoading(null)
  }

  const toggleActive = async (targetId: string, currentIsActive: boolean) => {
    if (!currentUser?.is_admin) return show('관리자 권한이 없습니다', 'error')
    setLoading(targetId + '-active')
    const sb = createClient()
    await sb.from('profiles').update({ is_active: !currentIsActive }).eq('id', targetId)
    setProfiles(prev => prev.map(p => p.id === targetId ? { ...p, is_active: !currentIsActive } : p))
    show(currentIsActive ? '비활성화했습니다' : '활성화했습니다', 'success')
    setLoading(null)
  }

  const updateColor = async (targetId: string, color: string) => {
    if (!currentUser?.is_admin) return show('관리자 권한이 없습니다', 'error')
    const sb = createClient()
    await sb.from('profiles').update({ color }).eq('id', targetId)
    setProfiles(prev => prev.map(p => p.id === targetId ? { ...p, color } : p))
    show('퍼스널 컬러가 변경되었습니다', 'success')
  }

  const handleSendNotif = async () => {
    if (!sendTarget || !notifMsg.trim()) return
    setSendingNotif(true)
    try {
      const res = await fetch('/api/push/send-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: sendTarget.id, message: notifMsg.trim() }),
      })
      if (res.ok) {
        show(`${sendTarget.name}에게 알림을 전송했습니다`, 'success')
        setSendTarget(null)
        setNotifMsg('')
      } else {
        const body = await res.json()
        show(body.error ?? '전송 실패', 'error')
      }
    } catch {
      show('전송 중 오류가 발생했습니다', 'error')
    }
    setSendingNotif(false)
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

        {/* 근무자 관리 (관리자 전용) */}
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
                className="px-4 py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: p.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length] }}
                    className="w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0"
                  >
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                      {p.is_admin && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">관리자</span>}
                      {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">비활성</span>}
                    </div>
                    <span className="text-xs text-gray-400">{p.employee_id}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {/* 알림 보내기 버튼 */}
                    <button
                      onClick={() => { setSendTarget({ id: p.id, name: p.name }); setNotifMsg('') }}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      알림
                    </button>
                    {p.id !== currentUser?.id && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                {/* 퍼스널 컬러 피커 */}
                <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => updateColor(p.id, c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full transition-all ${
                        p.color === c
                          ? 'ring-2 ring-offset-1 ring-gray-500 scale-125'
                          : 'opacity-50 hover:opacity-100 hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 내 정보 + 푸시 알림 토글 */}
        {currentUser && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-700">내 정보</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between"><span>이름</span><span className="font-medium">{currentUser.name}</span></div>
              <div className="flex justify-between"><span>사번</span><span className="font-medium">{currentUser.employee_id}</span></div>
              <div className="flex justify-between"><span>권한</span><span className="font-medium">{currentUser.is_admin ? '관리자' : '근무자'}</span></div>
            </div>
            {pushSupported && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">푸시 알림</p>
                  <p className="text-xs text-gray-400">교환 요청, 제출 기간 알림</p>
                </div>
                <button
                  onClick={togglePush}
                  disabled={pushLoading}
                  className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${pushEnabled ? 'bg-toss-blue' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
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

        <Button fullWidth variant="secondary" onClick={handleSignOut}>로그아웃</Button>
      </div>

      {/* 관리자 알림 전송 모달 */}
      <AnimatePresence>
        {sendTarget && (
          <motion.div
            className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !sendingNotif && setSendTarget(null)}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 space-y-4"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base font-bold text-gray-900">알림 보내기</h3>
                <p className="text-sm text-gray-400 mt-0.5">수신자: {sendTarget.name}</p>
              </div>
              <textarea
                value={notifMsg}
                onChange={e => setNotifMsg(e.target.value)}
                placeholder="메시지를 입력하세요..."
                rows={4}
                maxLength={300}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-toss-blue/30 focus:border-toss-blue"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSendTarget(null)}
                  disabled={sendingNotif}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-500 bg-gray-100 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSendNotif}
                  disabled={sendingNotif || !notifMsg.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-toss-blue disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingNotif
                    ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : '전송'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
