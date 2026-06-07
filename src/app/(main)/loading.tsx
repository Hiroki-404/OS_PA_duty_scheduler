// SSR 대기 중 즉시 노출되는 스켈레톤 — 탭 전환·월 변경 시 화면 멈춤 현상 제거
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <header className="bg-white px-6 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-2">
            <div className="h-6 w-40 bg-gray-200 rounded-lg" />
            <div className="h-4 w-24 bg-gray-100 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-gray-100 rounded-xl" />
            <div className="h-8 w-8 bg-gray-100 rounded-xl" />
            <div className="h-8 w-16 bg-toss-blue/20 rounded-xl" />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100 px-1 py-2">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="flex justify-center">
                <div className="h-3 w-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
          {/* 캘린더 셀 */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[72px] border-r border-b border-gray-50 p-1 flex flex-col gap-1"
              >
                <div className="h-3 w-4 bg-gray-100 rounded" />
                <div className="h-5 bg-gray-100 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* 요일별 분포 스켈레톤 */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="h-4 w-28 bg-gray-100 rounded mb-4" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 mb-3 items-center">
              <div className="h-3 w-16 bg-gray-100 rounded" />
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-5 w-5 bg-gray-100 rounded-full" />
              ))}
              <div className="h-4 w-6 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
