'use client'
import { useRouter } from 'next/navigation'

interface Props {
  year: number
  month: number
}

export function YearMonthSelector({ year, month }: Props) {
  const router = useRouter()

  // 선택 범위: 최근 12개월 ~ 현재월 + 1개월
  const now = new Date()
  const options: { year: number; month: number }[] = []
  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }

  const value = `${year}-${month}`

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [y, m] = e.target.value.split('-').map(Number)
    router.push(`?year=${y}&month=${m}`)
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      className="text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl px-3 py-1.5 border-none outline-none appearance-none cursor-pointer"
    >
      {options.map(o => (
        <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
          {o.year}년 {o.month}월
        </option>
      ))}
    </select>
  )
}
