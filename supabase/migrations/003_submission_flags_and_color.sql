-- ① 0개 제출자 동기화용 제출 플래그 테이블
CREATE TABLE IF NOT EXISTS monthly_submission_flags (
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year         INTEGER     NOT NULL,
  month        INTEGER     NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, year, month)
);

ALTER TABLE monthly_submission_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_all"
  ON monthly_submission_flags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "users_manage_own"
  ON monthly_submission_flags FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ② 퍼스널 컬러 컬럼 (profiles 테이블)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color TEXT;
