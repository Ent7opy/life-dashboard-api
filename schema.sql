-- PostgreSQL schema for Life Dashboard API
-- Idempotent: safe to run on every deploy

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (single user for now; can be extended for multi-user)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  email TEXT UNIQUE,
  api_key_hash TEXT,
  theme_preference TEXT CHECK (theme_preference IN ('light', 'dark', 'auto')) DEFAULT 'auto',
  settings JSONB DEFAULT '{}'::jsonb
);

-- University path selection
CREATE TABLE IF NOT EXISTS university_path (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_path TEXT CHECK (selected_path IN ('german', 'bulgarian', 'hybrid')) DEFAULT 'german',
  selected_university_name TEXT,
  start_year INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tasks (customizable per user)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  due_date DATE,
  phase_id TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress per category (editable rings)
CREATE TABLE IF NOT EXISTS progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  value INTEGER CHECK (value >= 0 AND value <= 100) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, category_id)
);

-- Reading list entries
CREATE TABLE IF NOT EXISTS reading_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('unread', 'reading', 'completed')) DEFAULT 'unread',
  started_at DATE,
  completed_at DATE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly review entries (streak tracking, hours logged)
CREATE TABLE IF NOT EXISTS weekly_review (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(4,1) CHECK (hours >= 0 AND hours <= 24) DEFAULT 0,
  reflection TEXT,
  goals JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, entry_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_user_id ON reading_list(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_review_user_id ON weekly_review(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_review_entry_date ON weekly_review(entry_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop before recreating to stay idempotent)
DROP TRIGGER IF EXISTS update_university_path_updated_at ON university_path;
CREATE TRIGGER update_university_path_updated_at
  BEFORE UPDATE ON university_path
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reading_list_updated_at ON reading_list;
CREATE TRIGGER update_reading_list_updated_at
  BEFORE UPDATE ON reading_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default user (safe to re-run)
INSERT INTO users (id, email, theme_preference)
VALUES ('00000000-0000-0000-0000-000000000000', 'user@example.com', 'auto')
ON CONFLICT DO NOTHING;
