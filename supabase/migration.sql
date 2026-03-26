-- ╔══════════════════════════════════════════════════════╗
-- ║  imarPRO — SaaS Supabase Schema v3.0               ║
-- ║  Idempotent — güvenle tekrar çalıştırılabilir       ║
-- ╚══════════════════════════════════════════════════════╝
-- Supabase SQL Editor'da çalıştırın.

-- ══════════════════════════════════════
-- 1. KULLANICI PROFİLLERİ
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  company TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'pro', 'admin', 'superadmin')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  locale TEXT DEFAULT 'tr',
  
  -- Kullanım limitleri
  max_projects INT NOT NULL DEFAULT 3,           -- free=3, pro=50, enterprise=unlimited
  max_ai_calls_monthly INT NOT NULL DEFAULT 10,  -- free=10, pro=500, enterprise=unlimited
  ai_calls_used INT NOT NULL DEFAULT 0,
  ai_calls_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  
  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,
  
  -- Meta
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════
-- 2. ORGANİZASYONLAR (Multi-Tenancy)
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  max_members INT NOT NULL DEFAULT 3,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);

-- ══════════════════════════════════════
-- 3. ORGANİZASYON ÜYELERİ
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_orgmem_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_orgmem_user ON org_members(user_id);


-- ══════════════════════════════════════
-- 4. PROJELER (Genişletilmiş)
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'İsimsiz Proje',
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  
  -- Proje verileri (JSONB)
  data JSONB DEFAULT '{}'::jsonb,
  
  -- Lokasyon
  il TEXT DEFAULT '',
  ilce TEXT DEFAULT '',
  
  -- Özet metrikler (hızlı sıralama/filtreleme için)
  parsel_alan_m2 FLOAT DEFAULT 0,
  toplam_insaat_m2 FLOAT DEFAULT 0,
  kat_sayisi INT DEFAULT 0,
  daire_sayisi INT DEFAULT 0,
  toplam_maliyet FLOAT DEFAULT 0,
  toplam_gelir FLOAT DEFAULT 0,
  kar_marji FLOAT DEFAULT 0,
  
  -- Paylaşım
  is_public BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE,
  
  -- Meta
  thumbnail_url TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_il ON projects(il);
CREATE INDEX IF NOT EXISTS idx_projects_share ON projects(share_token);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON projects USING gin(tags);


-- ══════════════════════════════════════
-- 5. PROJE PAYLAŞIMLARI
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  shared_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_share_project ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_share_user ON project_shares(shared_with);


-- ══════════════════════════════════════
-- 6. KULLANIM TAKİBİ
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- plan_generate, ai_review, pdf_export, ifc_export, render, ...
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  tokens_used INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_log(action);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_log(created_at DESC);


-- ══════════════════════════════════════
-- 7. BİLDİRİMLER
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error', 'invite', 'share')),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  link TEXT DEFAULT '',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE NOT is_read;


-- ══════════════════════════════════════
-- 8. API KEY YÖNETİMİ
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Varsayılan',
  key_hash TEXT NOT NULL,  -- SHA256 hash (açık metin saklanmaz)
  key_prefix TEXT NOT NULL, -- İlk 8 karakter (tanımlama için)
  scopes TEXT[] DEFAULT '{read,write}'::text[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apikey_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apikey_hash ON api_keys(key_hash);


-- ══════════════════════════════════════
-- 9. ROW LEVEL SECURITY
-- ══════════════════════════════════════

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view" ON organizations;
DROP POLICY IF EXISTS "Org owner can modify" ON organizations;
CREATE POLICY "Org members can view" ON organizations FOR SELECT USING (
  owner_id = auth.uid() OR
  EXISTS (SELECT 1 FROM org_members WHERE org_id = id AND user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Org owner can modify" ON organizations FOR ALL USING (owner_id = auth.uid());

-- Org Members
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own org memberships" ON org_members;
CREATE POLICY "Members view own org memberships" ON org_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM organizations WHERE id = org_id AND owner_id = auth.uid())
);

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
DROP POLICY IF EXISTS "Shared users can view" ON projects;
DROP POLICY IF EXISTS "Public projects viewable" ON projects;
DROP POLICY IF EXISTS "Org members can view org projects" ON projects;

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Shared users can view" ON projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_shares WHERE project_id = id AND shared_with = auth.uid())
);
CREATE POLICY "Public projects viewable" ON projects FOR SELECT USING (is_public = TRUE);
CREATE POLICY "Org members can view org projects" ON projects FOR SELECT USING (
  org_id IS NOT NULL AND
  EXISTS (SELECT 1 FROM org_members WHERE org_id = projects.org_id AND user_id = auth.uid() AND status = 'active')
);

-- Project Shares
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view shares" ON project_shares;
CREATE POLICY "Users can view shares" ON project_shares FOR SELECT USING (
  shared_with = auth.uid() OR shared_by = auth.uid()
);

-- Usage Log
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own usage" ON usage_log;
CREATE POLICY "Users view own usage" ON usage_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own usage" ON usage_log FOR INSERT WITH CHECK (user_id = auth.uid());

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own keys" ON api_keys;
CREATE POLICY "Users manage own keys" ON api_keys FOR ALL USING (user_id = auth.uid());


-- ══════════════════════════════════════
-- 10. TRIGGERS
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated ON projects;
CREATE TRIGGER trigger_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_profiles_updated ON profiles;
CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_org_updated ON organizations;
CREATE TRIGGER trigger_org_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════
-- 11. HELPER FUNCTIONS
-- ══════════════════════════════════════

-- Kullanıcının proje sayısını kontrol et (limit)
CREATE OR REPLACE FUNCTION check_project_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_limit INT;
BEGIN
  SELECT count(*) INTO current_count FROM projects WHERE user_id = NEW.user_id AND status != 'archived';
  SELECT max_projects INTO max_limit FROM profiles WHERE id = NEW.user_id;
  
  IF max_limit > 0 AND current_count >= max_limit THEN
    RAISE EXCEPTION 'Proje limiti aşıldı (%, max %)', current_count, max_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_project_limit ON projects;
CREATE TRIGGER trigger_check_project_limit
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION check_project_limit();

-- AI kullanım sayacı
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID, p_action TEXT, p_tokens INT DEFAULT 0)
RETURNS BOOLEAN AS $$
DECLARE
  profile_rec RECORD;
BEGIN
  SELECT ai_calls_used, max_ai_calls_monthly, ai_calls_reset_at INTO profile_rec
  FROM profiles WHERE id = p_user_id;
  
  -- Reset döngüsü kontrolü
  IF profile_rec.ai_calls_reset_at < NOW() THEN
    UPDATE profiles SET ai_calls_used = 0, ai_calls_reset_at = NOW() + INTERVAL '30 days'
    WHERE id = p_user_id;
    profile_rec.ai_calls_used := 0;
  END IF;
  
  -- Limit kontrolü (0 = sınırsız)
  IF profile_rec.max_ai_calls_monthly > 0 AND profile_rec.ai_calls_used >= profile_rec.max_ai_calls_monthly THEN
    RETURN FALSE;
  END IF;
  
  -- Sayacı artır
  UPDATE profiles SET ai_calls_used = ai_calls_used + 1 WHERE id = p_user_id;
  
  -- Kullanım logu
  INSERT INTO usage_log (user_id, action, tokens_used) VALUES (p_user_id, p_action, p_tokens);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════
-- 12. ADMIN İSTATİSTİK FONKSİYONLARI
-- ══════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'active_users_7d', (SELECT count(*) FROM profiles WHERE last_active_at > NOW() - INTERVAL '7 days'),
    'total_projects', (SELECT count(*) FROM projects),
    'projects_this_week', (SELECT count(*) FROM projects WHERE created_at > NOW() - INTERVAL '7 days'),
    'total_organizations', (SELECT count(*) FROM organizations),
    'total_ai_calls', (SELECT COALESCE(sum(ai_calls_used), 0) FROM profiles),
    'plan_distribution', (
      SELECT jsonb_object_agg(plan, cnt)
      FROM (SELECT plan, count(*) as cnt FROM profiles GROUP BY plan) sub
    ),
    'top_actions', (
      SELECT jsonb_agg(jsonb_build_object('action', action, 'count', cnt))
      FROM (
        SELECT action, count(*) as cnt FROM usage_log
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY action ORDER BY cnt DESC LIMIT 10
      ) sub
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════
-- 13. DOĞRULAMA
-- ══════════════════════════════════════
-- Çalıştırdıktan sonra doğrulama:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
-- SELECT proname FROM pg_proc WHERE proname LIKE '%imarpro%' OR proname LIKE '%admin%' OR proname LIKE '%increment%';
