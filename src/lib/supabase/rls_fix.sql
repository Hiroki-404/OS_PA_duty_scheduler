-- ============================================================
-- [실행 방법] Supabase 대시보드 → SQL Editor에 이 파일 내용을
--             전체 복사하여 붙여넣고 "Run" 버튼을 클릭하세요.
--
-- [목적] 일반 근무자도 팀 제출 현황을 조회할 수 있도록
--        profiles 및 availability_requests 테이블의
--        SELECT RLS 정책을 추가합니다.
--
-- [주의] 기존 정책과 충돌하면 아래 DROP 라인의 주석을 해제하고
--        먼저 실행한 뒤 CREATE를 실행하세요.
-- DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
-- DROP POLICY IF EXISTS "availability_requests_select_authenticated" ON public.availability_requests;
-- ============================================================

-- profiles: 인증된 모든 사용자가 읽기 가능
CREATE POLICY IF NOT EXISTS "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- availability_requests: 인증된 모든 사용자가 읽기 가능 (제출 현황 공유)
CREATE POLICY IF NOT EXISTS "availability_requests_select_authenticated"
  ON public.availability_requests FOR SELECT
  TO authenticated
  USING (true);
