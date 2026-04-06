-- PostgreSQL schema for Life OS API
-- Idempotent: safe to run on every deploy

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════
-- FOUNDATION
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 TEXT UNIQUE NOT NULL,
  display_name          TEXT NOT NULL DEFAULT 'Friend',
  timezone              TEXT NOT NULL DEFAULT 'Europe/Sofia',
  theme                 TEXT NOT NULL DEFAULT 'solarpunk' CHECK (theme IN ('solarpunk','dark','light')),
  password_hash         TEXT,
  email_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token          TEXT,
  verify_token_expires  TIMESTAMPTZ,
  reset_token           TEXT,
  reset_token_expires   TIMESTAMPTZ,
  settings              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token          TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS entity_tags (
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  body        TEXT,
  format      TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown','plain','richtext')),
  entity_type TEXT,
  entity_id   UUID,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_notes_user_entity ON notes(user_id, entity_type, entity_id);

-- ═══════════════════════════════════════════════
-- MIND
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inbox_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  processed   BOOLEAN NOT NULL DEFAULT FALSE,
  routed_to   TEXT,
  routed_id   UUID,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date  DATE NOT NULL,
  body        TEXT,
  mood        SMALLINT CHECK (mood BETWEEN 1 AND 10),
  energy      SMALLINT CHECK (energy BETWEEN 1 AND 10),
  prompts     JSONB NOT NULL DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,
  hours_logged     NUMERIC(4,1) CHECK (hours_logged BETWEEN 0 AND 168),
  reflection       TEXT,
  wins             TEXT[],
  blockers         TEXT[],
  next_week_focus  TEXT[],
  mood_avg         NUMERIC(3,1) CHECK (mood_avg BETWEEN 1 AND 10),
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, week_start)
);

-- ═══════════════════════════════════════════════
-- GROWTH
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  value       SMALLINT NOT NULL DEFAULT 0 CHECK (value BETWEEN 0 AND 100),
  target      SMALLINT CHECK (target BETWEEN 0 AND 100),
  icon        TEXT,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS resources (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('book','course','article','video','podcast','paper','other')),
  title            TEXT NOT NULL,
  author           TEXT,
  url              TEXT,
  cover_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','active','completed','abandoned','reference')),
  started_at       DATE,
  completed_at     DATE,
  rating           SMALLINT CHECK (rating BETWEEN 1 AND 5),
  review           TEXT,
  progress_current INTEGER,
  progress_total   INTEGER,
  skill_id         UUID REFERENCES skills(id) ON DELETE SET NULL,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_resources_user_type_status ON resources(user_id, type, status);

CREATE TABLE IF NOT EXISTS learning_nodes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'future' CHECK (status IN ('done','active','future','skipped')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  skill_id    UUID REFERENCES skills(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

-- ═══════════════════════════════════════════════
-- WORK
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS goals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  type           TEXT NOT NULL DEFAULT 'outcome' CHECK (type IN ('outcome','process','project','milestone')),
  timeframe      TEXT NOT NULL DEFAULT 'quarterly' CHECK (timeframe IN ('daily','weekly','monthly','quarterly','yearly','lifetime')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned','paused')),
  target_date    DATE,
  metric_name    TEXT,
  metric_target  NUMERIC,
  metric_current NUMERIC NOT NULL DEFAULT 0,
  parent_id      UUID REFERENCES goals(id) ON DELETE SET NULL,
  archived_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('idea','active','paused','completed','abandoned')),
  type         TEXT,
  url          TEXT,
  repo_url     TEXT,
  start_date   DATE,
  target_date  DATE,
  completed_at DATE,
  goal_id      UUID REFERENCES goals(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'todo',
  priority     SMALLINT NOT NULL DEFAULT 2,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  goal_id      UUID REFERENCES goals(id) ON DELETE SET NULL,
  parent_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  recurrence   TEXT,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id     ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project     ON tasks(project_id) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS habits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  frequency    TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','weekends','weekly','custom')),
  target_count SMALLINT NOT NULL DEFAULT 1,
  color        TEXT,
  icon         TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  goal_id      UUID REFERENCES goals(id) ON DELETE SET NULL,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL,
  count      SMALLINT NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, log_date);

-- ═══════════════════════════════════════════════
-- BODY
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS health_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  mood          SMALLINT CHECK (mood BETWEEN 1 AND 10),
  energy        SMALLINT CHECK (energy BETWEEN 1 AND 10),
  sleep_hours   NUMERIC(3,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  sleep_quality SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  weight_kg     NUMERIC(5,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS workouts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type         TEXT NOT NULL DEFAULT 'strength' CHECK (type IN ('strength','cardio','flexibility','sport','walk','other')),
  name         TEXT,
  duration_min INTEGER,
  calories     INTEGER,
  notes        TEXT,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id   UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise     TEXT NOT NULL,
  sets         SMALLINT,
  reps         SMALLINT,
  weight_kg    NUMERIC(5,2),
  duration_sec INTEGER,
  distance_m   INTEGER,
  notes        TEXT,
  sort_order   SMALLINT NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════
-- MONEY
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'checking' CHECK (type IN ('checking','savings','investment','crypto','loan','cash','other')),
  currency    TEXT NOT NULL DEFAULT 'EUR',
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  institution TEXT,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  category      TEXT,
  subcategory   TEXT,
  description   TEXT,
  txn_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense','transfer')),
  to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  recurring     BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, txn_date, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category  ON transactions(user_id, category);

CREATE TABLE IF NOT EXISTS budgets (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'EUR',
  period     TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, period)
);

-- ═══════════════════════════════════════════════
-- PEOPLE
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  relationship        TEXT,
  email               TEXT,
  phone               TEXT,
  location            TEXT,
  birthday            DATE,
  avatar_url          TEXT,
  notes               TEXT,
  keep_in_touch_freq  TEXT,
  last_contact        DATE,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS interactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  type       TEXT NOT NULL DEFAULT 'message' CHECK (type IN ('message','call','meeting','email','social','other')),
  summary    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata   JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id, date DESC);

-- ═══════════════════════════════════════════════
-- MEDIA
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS media_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('movie','show','album','song','podcast','game','documentary','other')),
  title        TEXT NOT NULL,
  creator      TEXT,
  year         SMALLINT,
  cover_url    TEXT,
  url          TEXT,
  status       TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','watching','completed','abandoned','reference')),
  rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
  review       TEXT,
  started_at   DATE,
  completed_at DATE,
  progress     JSONB DEFAULT '{}',
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_media_user_type_status ON media_items(user_id, type, status);

-- ═══════════════════════════════════════════════
-- WORLD
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS places (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  country     TEXT NOT NULL,
  city        TEXT,
  type        TEXT NOT NULL DEFAULT 'city' CHECK (type IN ('city','country','region','landmark','venue','other')),
  status      TEXT NOT NULL DEFAULT 'wishlist' CHECK (status IN ('wishlist','visited','lived')),
  visited_at  DATE,
  lat         NUMERIC(10,6),
  lng         NUMERIC(10,6),
  notes       TEXT,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS trips (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','booked','active','completed','cancelled')),
  budget      NUMERIC(10,2),
  currency    TEXT DEFAULT 'EUR',
  notes       TEXT,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS trip_places (
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id   UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (trip_id, place_id)
);

-- ═══════════════════════════════════════════════
-- HOBBIES
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hobbies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','want_to_try','retired')),
  started_at  DATE,
  description TEXT,
  skill_id    UUID REFERENCES skills(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS hobby_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hobby_id     UUID NOT NULL REFERENCES hobbies(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_min INTEGER,
  notes        TEXT,
  rating       SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'
);

-- ═══════════════════════════════════════════════
-- updated_at TRIGGER FUNCTION
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at          ON users;
CREATE TRIGGER trg_users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_notes_updated_at           ON notes;
CREATE TRIGGER trg_notes_updated_at           BEFORE UPDATE ON notes           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_inbox_updated_at           ON inbox_items;
CREATE TRIGGER trg_inbox_updated_at           BEFORE UPDATE ON inbox_items      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_journal_updated_at         ON journal_entries;
CREATE TRIGGER trg_journal_updated_at         BEFORE UPDATE ON journal_entries  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_weekly_reviews_updated_at  ON weekly_reviews;
CREATE TRIGGER trg_weekly_reviews_updated_at  BEFORE UPDATE ON weekly_reviews   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_skills_updated_at          ON skills;
CREATE TRIGGER trg_skills_updated_at          BEFORE UPDATE ON skills           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_resources_updated_at       ON resources;
CREATE TRIGGER trg_resources_updated_at       BEFORE UPDATE ON resources        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_learning_nodes_updated_at  ON learning_nodes;
CREATE TRIGGER trg_learning_nodes_updated_at  BEFORE UPDATE ON learning_nodes   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_goals_updated_at           ON goals;
CREATE TRIGGER trg_goals_updated_at           BEFORE UPDATE ON goals            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_projects_updated_at        ON projects;
CREATE TRIGGER trg_projects_updated_at        BEFORE UPDATE ON projects         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_tasks_updated_at           ON tasks;
CREATE TRIGGER trg_tasks_updated_at           BEFORE UPDATE ON tasks            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_habits_updated_at          ON habits;
CREATE TRIGGER trg_habits_updated_at          BEFORE UPDATE ON habits           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_health_logs_updated_at     ON health_logs;
CREATE TRIGGER trg_health_logs_updated_at     BEFORE UPDATE ON health_logs      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_workouts_updated_at        ON workouts;
CREATE TRIGGER trg_workouts_updated_at        BEFORE UPDATE ON workouts         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_accounts_updated_at        ON accounts;
CREATE TRIGGER trg_accounts_updated_at        BEFORE UPDATE ON accounts         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_transactions_updated_at    ON transactions;
CREATE TRIGGER trg_transactions_updated_at    BEFORE UPDATE ON transactions     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_budgets_updated_at         ON budgets;
CREATE TRIGGER trg_budgets_updated_at         BEFORE UPDATE ON budgets          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_contacts_updated_at        ON contacts;
CREATE TRIGGER trg_contacts_updated_at        BEFORE UPDATE ON contacts         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_media_items_updated_at     ON media_items;
CREATE TRIGGER trg_media_items_updated_at     BEFORE UPDATE ON media_items      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_places_updated_at          ON places;
CREATE TRIGGER trg_places_updated_at          BEFORE UPDATE ON places           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_trips_updated_at           ON trips;
CREATE TRIGGER trg_trips_updated_at           BEFORE UPDATE ON trips            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_hobbies_updated_at         ON hobbies;
CREATE TRIGGER trg_hobbies_updated_at         BEFORE UPDATE ON hobbies          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

