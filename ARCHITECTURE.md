# 병원 스마트 당직 배정 플랫폼 — 아키텍처 문서

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v3, Framer Motion v11 |
| Backend/DB | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| 외부 API | Kakao OAuth 2.0, Kakao 메시지 API, 공공데이터포털 특일정보 API |
| 테스트 | Jest + ts-jest |

## 폴더 구조

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # 카카오 간편 로그인
│   │   └── onboarding/page.tsx     # 최초 1회 사번/이름 입력
│   ├── (main)/
│   │   ├── layout.tsx              # 하단 탭바 + 페이지 전환 애니메이션
│   │   ├── page.tsx                # 홈 (이번 달 당직표)
│   │   ├── availability/page.tsx   # 당직 제외일 입력
│   │   ├── exchange/page.tsx       # 당직 교환 신청/목록
│   │   ├── stats/page.tsx          # 통계 탭
│   │   ├── settings/page.tsx       # 환경 설정 (관리자 위임, 근무자 관리)
│   │   └── schedule/[year]/[month]/page.tsx  # 과거 월 조회
│   └── api/
│       ├── auth/kakao/route.ts     # OAuth 콜백
│       ├── schedule/generate/route.ts  # 당직 배정 실행 (POST) + 확정 (PATCH)
│       ├── exchange/route.ts       # 교환 신청/수락/거절
│       ├── holidays/route.ts       # 공휴일 조회
│       └── notifications/send/route.ts
├── components/
│   ├── ui/                         # 토스 스타일 원자 컴포넌트
│   │   ├── Button.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── Toast.tsx               # ToastProvider + useToast
│   │   └── Badge.tsx
│   ├── calendar/
│   │   ├── MonthCalendar.tsx       # 멀티셀렉트 달력
│   │   ├── DayCell.tsx             # 날짜 셀 (제외/반차/연차 색상)
│   │   └── AvailabilityTypeSheet.tsx  # 바텀시트 유형 선택
│   ├── schedule/
│   │   ├── ScheduleTable.tsx       # 월간 달력 그리드
│   │   ├── GenerateButton.tsx      # 관리자 배정 실행 버튼
│   │   └── SubmissionStatus.tsx    # 제출 현황 (완료/미제출 시각화)
│   ├── exchange/
│   │   ├── ExchangeRequestModal.tsx  # 4단계 교환 신청 모달
│   │   └── ExchangeNotificationBanner.tsx  # Realtime 교환 요청 배너
│   └── stats/
│       └── StdDevChart.tsx         # 표준편차 차트
├── lib/
│   ├── supabase/                   # 클라이언트(브라우저/서버/미들웨어)
│   ├── algorithm/                  # 핵심 배정 알고리즘 (types/balance/penalty/scheduler)
│   ├── kakao/                      # OAuth + 메시지 서비스
│   └── holidays/                   # 공공데이터 API + 캐시
├── modules/
│   ├── surgery-info/               # 향후 수술 정보 공유 모듈 (예약)
│   └── ai-librarian/               # 향후 AI 사서 챗봇 모듈 (예약)
└── types/
    ├── database.ts                 # Supabase 테이블 타입
    └── domain.ts                   # 도메인 타입
```

## 데이터베이스 스키마

### profiles
사용자 프로필. Supabase Auth와 1:1 연결.
- `id` UUID PK (→ auth.users)
- `kakao_id` TEXT UNIQUE
- `employee_id` TEXT UNIQUE (사번)
- `name` TEXT
- `is_admin` BOOLEAN (관리자 여부)
- `is_active` BOOLEAN (활성/장기휴가)

### worker_periods
임시/기간제 근무자 활성 기간.
- `user_id` → profiles
- `start_date`, `end_date` DATE

### availability_requests
당직 제외일 신청. `submitted_at`이 있으면 제출 완료.
- `user_id`, `year`, `month`, `date`, `type` ('exclude'|'half_day'|'annual_leave')
- UNIQUE(user_id, date)

### schedules
확정된 당직 배정. 1일 1명 보장 (date UNIQUE).
- `user_id`, `date`, `is_weekend`, `is_holiday`, `is_locked`

### monthly_balance
월별 누적 당직 횟수. 이월 보정에 사용.
- `user_id`, `year`, `month`
- `total_duties`, `weekday_duties`, `weekend_duties`, `holiday_duties`
- `dow_0`~`dow_6` (요일별 카운트)
- `is_initial_month` (서비스 도입 첫 달 예외 처리)

### exchange_requests
당직 교환 요청. `expires_at` 24시간 후 자동 만료.
- `requester_id`, `target_id`, `requester_date`, `target_date`
- `type` ('swap'|'transfer'), `status` ('pending'|'accepted'|'rejected'|'cancelled')

### holiday_cache
공공데이터포털 공휴일 캐시.
- `date` DATE UNIQUE, `name`, `year`

### notifications
Supabase Realtime 구독용. type 종류: exchange_request, exchange_response, exchange_cancelled, schedule_published.
- `user_id`, `type`, `payload` JSONB, `is_read`

## 옵션 B 확정 기본값

1. **반차(half_day)**: 당직 배정에서 연차와 동일하게 완전 제외
2. **배정불가 날짜**: 연차→반차→제외 순 강제 후보 승격 + warnings 반환
3. **패널티 우선순위**: 균등분배(특수일) ≈ 요일별 균등 > 이월 보정 > 주간밀도 > 연속
4. **교환 수락 유효 시간**: 24시간 (expires_at = NOW()+24h)
5. **확정 후 교환**: is_locked 여부와 무관하게 교환 가능
6. **카카오 메시지**: 23/24/25일 최대 3회 재발송
7. **관리자 수동 수정**: 패널티 위반 경고 표시 후 강행 가능
8. **통계 기준**: 전체 누적 기간, +1.5σ 임계값 고정
9. **최초 달 기준**: 서비스 도입 첫 달 공통 1회 (is_initial_month=true)
10. **임시 근무자**: worker_periods 테이블로 기간 관리

## 알고리즘 개요

패널티 최소화 + 제약 만족 그리디 (Most Constrained First)

| 패널티 항목 | 가중치 | 설명 |
|---|---|---|
| W_DISTRIBUTION | 100 | 특수일/평일 균등분배 편차 |
| W_DOW_BALANCE | 80 | 요일별 균등분배 편차 |
| W_CARRYOVER | 60 | 이전 달 누적 과다 보정 |
| W_WEEKLY_DENSITY | 50 | 주당 3개+50점, 4개+500점 |
| W_CONSECUTIVE | 40 | 연속 3일+40점, 4일+400점 |

연속 규칙: 2일 허용 → 3일 지양(+10W) → 4일 최악(+100W)
주당 밀도: 2개 권장 → 3개 부분수용(+5W) → 4개 강력제한(+100W)

## 확장 모듈 계획

- `src/modules/surgery-info/` — 수술 정보 공유 게시판 (2차 스프린트)
- `src/modules/ai-librarian/` — AI 사서 챗봇 (3차 스프린트)

각 모듈은 독립적인 라우트·컴포넌트·API를 가지며, 당직 모듈과 `user_id`만으로 연결됩니다.

## 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
KAKAO_CLIENT_ID=                   # 카카오 REST API 키
KAKAO_CLIENT_SECRET=               # 카카오 Client Secret
KAKAO_ADMIN_KEY=                   # 카카오 Admin 키 (메시지 발송)
PUBLIC_DATA_API_KEY=               # 공공데이터포털 API 키
NEXT_PUBLIC_APP_URL=               # 앱 배포 URL
```
