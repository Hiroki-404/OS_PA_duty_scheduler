import { createClient } from '@/lib/supabase/server'
import { getHolidaysForMonth } from '@/lib/holidays/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const holidays = await getHolidaysForMonth(year, month, supabase)
    return NextResponse.json({ holidays, year, month })
  } catch {
    return NextResponse.json({ holidays: [], year, month })
  }
}
