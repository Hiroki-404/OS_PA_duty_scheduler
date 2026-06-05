import { createClient } from '@/lib/supabase/client'

export async function signInWithKakao() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/kakao`,
      scopes: 'profile_nickname',
    },
  })
  if (error) throw error
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
