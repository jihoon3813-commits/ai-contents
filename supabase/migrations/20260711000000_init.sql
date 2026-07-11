-- 1. Profiles (프로필 테이블)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Asia/Seoul' NOT NULL,
  language TEXT DEFAULT 'ko' NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Workspaces (워크스페이스 테이블)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_code TEXT DEFAULT 'FREE' NOT NULL,
  status TEXT DEFAULT 'ACTIVE' NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Workspace Members (멤버 관계 테이블)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')) NOT NULL,
  status TEXT CHECK (status IN ('ACTIVE', 'INVITED', 'DISABLED')) DEFAULT 'ACTIVE' NOT NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(workspace_id, user_id)
);

-- 4. Subscriptions (구독 및 제한 테이블)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  limits JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON public.subscriptions(workspace_id);

-- 6. Trigger Function for Sign-up (신규 회원가입 트리거 함수)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_name TEXT;
  v_slug TEXT;
BEGIN
  v_workspace_id := gen_random_uuid();
  v_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  
  -- 한글/영문/숫자 유지하며 slugify
  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9가-힣]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  IF v_slug = '' THEN
    v_slug := 'workspace';
  END IF;
  -- 고유성 확보를 위해 워크스페이스 ID의 앞 8자리 결합
  v_slug := v_slug || '-' || substring(v_workspace_id::text from 1 for 8);

  -- 1) Profile 생성
  INSERT INTO public.profiles (id, name, avatar_url, timezone, language, onboarding_completed, is_admin)
  VALUES (
    new.id,
    v_name,
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'Asia/Seoul',
    'ko',
    FALSE,
    FALSE
  );

  -- 2) Workspace 생성
  INSERT INTO public.workspaces (id, name, slug, owner_id, plan_code, status, settings)
  VALUES (
    v_workspace_id,
    v_name || '의 워크스페이스',
    v_slug,
    new.id,
    'FREE',
    'ACTIVE',
    '{}'::jsonb
  );

  -- 3) Workspace Member (OWNER) 추가
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, joined_at)
  VALUES (
    v_workspace_id,
    new.id,
    'OWNER',
    'ACTIVE',
    NOW()
  );

  -- 4) Subscription 생성 (무료 한도)
  INSERT INTO public.subscriptions (workspace_id, plan_code, status, current_period_start, current_period_end, limits)
  VALUES (
    v_workspace_id,
    'FREE',
    'ACTIVE',
    NOW(),
    NOW() + INTERVAL '1 month',
    '{"words_limit": 10000, "images_limit": 20}'::jsonb
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 바인딩
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 8. Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- 9. Workspaces Policies
DROP POLICY IF EXISTS "Members can view workspace" ON public.workspaces;
CREATE POLICY "Members can view workspace" 
  ON public.workspaces FOR SELECT 
  USING (
    id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;
CREATE POLICY "Owners can update workspace" 
  ON public.workspaces FOR UPDATE 
  USING (
    id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role = 'OWNER'
    )
  );

-- 10. Workspace Members Policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" 
  ON public.workspace_members FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners/Admins can manage members" ON public.workspace_members;
CREATE POLICY "Owners/Admins can manage members" 
  ON public.workspace_members FOR ALL 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN')
    )
  );

-- 11. Subscriptions Policies
DROP POLICY IF EXISTS "Members can view subscriptions" ON public.subscriptions;
CREATE POLICY "Members can view subscriptions" 
  ON public.subscriptions FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );
