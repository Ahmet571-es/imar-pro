-- imarPRO Supabase Schema
-- Run this in Supabase SQL Editor
-- Idempotent — safe to run multiple times

-- ══════════════════════════════════════
-- 1. PROJECTS TABLE
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'İsimsiz Proje',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- ══════════════════════════════════════
-- 2. ROW LEVEL SECURITY
-- ══════════════════════════════════════

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- Recreate policies
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════
-- 3. AUTO-UPDATE TRIGGER
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_updated_at ON projects;
CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════
-- 4. DATA SIZE INDEX (for large JSONB)
-- ══════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- ══════════════════════════════════════
-- 5. VERIFY
-- ══════════════════════════════════════
-- After running, verify with:
-- SELECT count(*) FROM projects;
-- SELECT * FROM pg_policies WHERE tablename = 'projects';
