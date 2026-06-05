import type { HolidayItem } from '@/lib/algorithm/types'

const BASE_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo'

export async function fetchHolidaysFromAPI(year: number, month: number): Promise<HolidayItem[]> {
  const serviceKey = process.env.PUBLIC_DATA_API_KEY
  if (!serviceKey) {
    console.warn('PUBLIC_DATA_API_KEY not configured')
    return []
  }

  const params = new URLSearchParams({
    ServiceKey: serviceKey,
    solYear: String(year),
    solMonth: String(month).padStart(2, '0'),
    _type: 'json',
    numOfRows: '50',
    pageNo: '1',
  })

  try {
    const res = await fetch(`${BASE_URL}?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.response?.body?.items?.item
    if (!items) return []
    const list = Array.isArray(items) ? items : [items]
    return list.map((item: any) => {
      const d = String(item.locdate)
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, name: item.dateName }
    })
  } catch {
    return []
  }
}
