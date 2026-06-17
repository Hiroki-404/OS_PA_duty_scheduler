'use client'
import { useEffect, useState } from 'react'

// 로고 엣지 픽셀 추출값 — manifest.ts / globals.css와 동기화
const SPLASH_BG = '#F5F5F5'

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const dismiss = () => {
      setPhase('fading')
      timer = setTimeout(() => setPhase('gone'), 320)
    }

    if (document.readyState === 'complete') {
      timer = setTimeout(dismiss, 700)
    } else {
      const onLoad = () => { timer = setTimeout(dismiss, 700) }
      window.addEventListener('load', onLoad, { once: true })
      return () => {
        window.removeEventListener('load', onLoad)
        clearTimeout(timer)
      }
    }
    return () => clearTimeout(timer)
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      style={{ backgroundColor: SPLASH_BG }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center
        transition-opacity duration-300 ease-out pointer-events-none
        ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden="true"
    >
      {/* 로고 — 화면 너비의 28% (최대 160px) */}
      <img
        src="/icon-512x512.png"
        alt=""
        style={{ width: 'min(28vw, 160px)', height: 'auto' }}
        draggable={false}
      />
      {/* 원형 CSS 스피너 — 로고 하단 28px */}
      <div className="mt-7 w-8 h-8 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
    </div>
  )
}
