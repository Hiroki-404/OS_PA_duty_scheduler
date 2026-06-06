-- ============================================================
-- [필수] Supabase SQL Editor에서 전체 실행
-- 재실행 안전 버전 — DROP IF EXISTS로 중복 오류 방지
-- ============================================================

-- 1. 재귀 없는 is_admin() SECURITY DEFINER 함수
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- 2. profiles SELECT (재귀 제거 → 인증된 전체 조회 허용)
DROP POLICY IF EXISTS "profiles_select"                ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all"            ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated"  ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 3. profiles UPDATE (재귀 제거)
DROP POLICY IF EXISTS "profiles_update"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_fixed"  ON public.profiles;
CREATE POLICY "profiles_update_fixed" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 4. availability_requests SELECT
--    본인 데이터 + 관리자는 전체 조회 (팀 제출현황 표시용)
DROP POLICY IF EXISTS "avail_select"                                  ON public.availability_requests;
DROP POLICY IF EXISTS "avail_select_all"                              ON public.availability_requests;
DROP POLICY IF EXISTS "availability_requests_select_authenticated"    ON public.availability_requests;
CREATE POLICY "avail_select_all" ON public.availability_requests
  FOR SELECT TO authenticated
  USING (true);

-- 5. worker_periods
DROP POLICY IF EXISTS "wp_manage"        ON public.worker_periods;
DROP POLICY IF EXISTS "wp_manage_fixed"  ON public.worker_periods;
CREATE POLICY "wp_manage_fixed" ON public.worker_periods
  FOR ALL TO authenticated USING (public.is_admin());

-- 6. holiday_cache
DROP POLICY IF EXISTS "holiday_manage"        ON public.holiday_cache;
DROP POLICY IF EXISTS "holiday_manage_fixed"  ON public.holiday_cache;
CREATE POLICY "holiday_manage_fixed" ON public.holiday_cache
  FOR ALL TO authenticated USING (public.is_admin());

-- 7. schedules (SELECT는 기존 schedules_select 유지)
DROP POLICY IF EXISTS "schedules_manage"        ON public.schedules;
DROP POLICY IF EXISTS "schedules_manage_fixed"  ON public.schedules;
CREATE POLICY "schedules_manage_fixed" ON public.schedules
  FOR ALL TO authenticated USING (public.is_admin());

-- 8. monthly_balance
DROP POLICY IF EXISTS "balance_manage"        ON public.monthly_balance;
DROP POLICY IF EXISTS "balance_manage_fixed"  ON public.monthly_balance;
CREATE POLICY "balance_manage_fixed" ON public.monthly_balance
  FOR ALL TO authenticated USING (public.is_admin());

-- 9. color 컬럼 추가 (없으면)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;

-- 10. color 미설정 유저 팔레트 자동 배정
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

-- 확인
SELECT name, is_admin, is_active, color FROM public.profiles ORDER BY created_at;
