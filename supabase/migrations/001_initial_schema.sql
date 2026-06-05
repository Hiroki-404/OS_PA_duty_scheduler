CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. profiles
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  kakao_id      TEXT UNIQUE NOT NULL,
  employee_id   TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
);

-- 2. worker_periods
CREATE TABLE worker_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE worker_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_select" ON worker_periods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "wp_manage" ON worker_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

-- 3. availability_requests
CREATE TABLE availability_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL,
  month         SMALLINT NOT NULL,
  date          DATE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('exclude','half_day','annual_leave')),
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);
CREATE INDEX idx_avail_year_month ON availability_requests(year, month);
ALTER TABLE availability_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_select" ON availability_requests FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);
CREATE POLICY "avail_insert" ON availability_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "avail_update" ON availability_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "avail_delete" ON availability_requests FOR DELETE USING (auth.uid() = user_id);

-- 4. holiday_cache
CREATE TABLE holiday_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  year        SMALLINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_holiday_year ON holiday_cache(year);
ALTER TABLE holiday_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holiday_select" ON holiday_cache FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "holiday_manage" ON holiday_cache FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

-- 5. schedules
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  date        DATE NOT NULL UNIQUE,
  is_weekend  BOOLEAN NOT NULL DEFAULT FALSE,
  is_holiday  BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_user ON schedules(user_id);
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "schedules_manage" ON schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

-- 6. monthly_balance
CREATE TABLE monthly_balance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year            SMALLINT NOT NULL,
  month           SMALLINT NOT NULL,
  total_duties    SMALLINT NOT NULL DEFAULT 0,
  weekday_duties  SMALLINT NOT NULL DEFAULT 0,
  weekend_duties  SMALLINT NOT NULL DEFAULT 0,
  holiday_duties  SMALLINT NOT NULL DEFAULT 0,
  dow_0           SMALLINT NOT NULL DEFAULT 0,
  dow_1           SMALLINT NOT NULL DEFAULT 0,
  dow_2           SMALLINT NOT NULL DEFAULT 0,
  dow_3           SMALLINT NOT NULL DEFAULT 0,
  dow_4           SMALLINT NOT NULL DEFAULT 0,
  dow_5           SMALLINT NOT NULL DEFAULT 0,
  dow_6           SMALLINT NOT NULL DEFAULT 0,
  is_initial_month BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);
ALTER TABLE monthly_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balance_select" ON monthly_balance FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "balance_manage" ON monthly_balance FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);

-- 7. exchange_requests
CREATE TABLE exchange_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id    UUID NOT NULL REFERENCES profiles(id),
  target_id       UUID NOT NULL REFERENCES profiles(id),
  requester_date  DATE NOT NULL,
  target_date     DATE,
  type            TEXT NOT NULL CHECK (type IN ('swap','transfer')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  expires_at      TIMESTAMPTZ NOT NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_exchange_req ON exchange_requests(requester_id, status);
CREATE INDEX idx_exchange_tgt ON exchange_requests(target_id, status);
ALTER TABLE exchange_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_select" ON exchange_requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = target_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
);
CREATE POLICY "exchange_insert" ON exchange_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "exchange_update" ON exchange_requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = target_id
);

-- 8. notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (TRUE);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE exchange_requests;
