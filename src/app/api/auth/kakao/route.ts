import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    console.error('[kakao/callback] no code in query params')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const pendingCookies: { name: string; value: string; options?: object }[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            pendingCookies.push({ name, value, options })
          })
        },
      },
    }
  )

  // 1단계: code → session 교환
  const { data: { user }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
  if (sessionError || !user) {
    console.error('[kakao/callback] session exchange failed:', sessionError?.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // 2단계: 프로필 조회 (신규 유저는 null — maybeSingle으로 에러 없이 처리)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('employee_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[kakao/callback] profile query error:', profileError.message)
  }

  // 3단계: redirect + 세션 쿠키 명시적 주입
  const dest = profile?.employee_id ? '/' : '/onboarding'
  const response = NextResponse.redirect(`${origin}${dest}`)
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}
