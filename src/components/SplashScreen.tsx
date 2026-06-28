'use client'
import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const dismiss = () => {
      setPhase('fading')
      timer = setTimeout(() => setPhase('gone'), 320)
    }

    if (document.readyState === 'complete') {
      timer = setTimeout(dismiss, 100)
    } else {
      const onLoad = () => { timer = setTimeout(dismiss, 100) }
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white
        transition-opacity duration-300 ease-out pointer-events-none
        ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden="true"
    >
      {/* icon2 — 스플래시 로고, 화면 너비 28% (최대 140px) */}
      <img
        src="/icon2.png"
        alt=""
        style={{ width: 'min(28vw, 140px)', height: 'auto' }}
        draggable={false}
      />
      {/* 원형 CSS 스피너 — 로고 하단 28px */}
      <div className="mt-7 w-7 h-7 rounded-full border-2 border-gray-200 border-t-transparent animate-spin" />
    </div>
  )
}
