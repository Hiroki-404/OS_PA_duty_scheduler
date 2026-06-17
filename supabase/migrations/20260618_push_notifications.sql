-- ============================================================
-- 1. user_push_tokens 테이블 신설
-- ============================================================
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tokens_user_policy" ON user_push_tokens;
CREATE POLICY "tokens_user_policy" ON user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. notifications 테이블 스키마 마이그레이션
--    기존: user_id / type / payload
--    신규: receiver_id / title / content / landing_tab
-- ============================================================
TRUNCATE TABLE notifications;

-- 컬럼 이름 변경
ALTER TABLE notifications RENAME COLUMN user_id TO receiver_id;

-- 신규 컬럼 추가
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title       TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content     TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS landing_tab TEXT NOT NULL DEFAULT 'exchange';

-- 구 컬럼 제거
ALTER TABLE notifications DROP COLUMN IF EXISTS type;
ALTER TABLE notifications DROP COLUMN IF EXISTS payload;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_id ON notifications(receiver_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = receiver_id);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- service_role 은 RLS 우회하므로 INSERT 정책 불필요
