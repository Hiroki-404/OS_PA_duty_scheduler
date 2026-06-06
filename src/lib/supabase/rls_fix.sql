-- ============================================================
-- [필수] Supabase SQL Editor에서 전체 실행
-- 달력/통계표 공백 + 제출 현황 조회 오류의 근본 원인 수정
--
-- 원인: profiles_select 정책이 profiles 테이블을 재귀 참조
--       → 쿼리 에러 → rawProfiles = null → workerMap 공백
-- ============================================================

-- 1. 재귀 없는 is_admin() SECURITY DEFINER 함수 (핵심)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- 2. profiles SELECT: 재귀 정책 교체 → 인증된 모든 사용자 읽기 허용
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 3. profiles UPDATE: 재귀 제거 (is_admin() 함수 사용)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update_fixed" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 4. availability_requests SELECT: 재귀 정책 교체
DROP POLICY IF EXISTS "avail_select" ON public.availability_requests;
DROP POLICY IF EXISTS "availability_requests_select_authenticated" ON public.availability_requests;
CREATE POLICY "avail_select_all" ON public.availability_requests
  FOR SELECT TO authenticated USING (true);

-- 5. 나머지 관리자 정책들도 is_admin() 함수로 교체
DROP POLICY IF EXISTS "wp_manage" ON public.worker_periods;
CREATE POLICY "wp_manage_fixed" ON public.worker_periods
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "holiday_manage" ON public.holiday_cache;
CREATE POLICY "holiday_manage_fixed" ON public.holiday_cache
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "schedules_manage" ON public.schedules;
CREATE POLICY "schedules_manage_fixed" ON public.schedules
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "balance_manage" ON public.monthly_balance;
CREATE POLICY "balance_manage_fixed" ON public.monthly_balance
  FOR ALL TO authenticated USING (public.is_admin());

-- 6. profiles에 color 컬럼이 없으면 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- 7. 기존 유저 중 color 미설정자 팔레트 자동 배정
DO $$
DECLARE
  palette TEXT[] := ARRAY[
    '#FF6B6B','#FF8E53','#FFC048','#51CF66','#20C997',
    '#4DABF7','#748FFC','#DA77F2','#F783AC','#FF922B'
  ];
  rec RECORD;
  idx INT := 1;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE color IS NULL ORDER BY created_at LOOP
    UPDATE public.profiles SET color = palette[idx] WHERE id = rec.id;
    idx := (idx % array_length(palette, 1)) + 1;
  END LOOP;
END $$;

-- 확인 쿼리 (실행 후 아래로 검증)
SELECT name, is_admin, is_active, color FROM public.profiles ORDER BY created_at;
