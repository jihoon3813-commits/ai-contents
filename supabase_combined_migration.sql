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

-- 10. Workspace Members Policies (보안 함수를 정의하여 무한 루프 방지)
CREATE OR REPLACE FUNCTION public.get_auth_user_workspaces()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT workspace_id 
  FROM public.workspace_members 
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_managed_workspaces()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT workspace_id 
  FROM public.workspace_members 
  WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members" 
  ON public.workspace_members FOR SELECT 
  USING (
    workspace_id IN (SELECT public.get_auth_user_workspaces())
  );

DROP POLICY IF EXISTS "Owners/Admins can manage members" ON public.workspace_members;
CREATE POLICY "Owners/Admins can manage members" 
  ON public.workspace_members FOR ALL 
  USING (
    workspace_id IN (SELECT public.get_auth_user_managed_workspaces())
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


-- 1. Brands Table (브랜드 테이블)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  website_url TEXT,
  target_audience TEXT,
  customer_problems TEXT,
  products_services TEXT,
  core_values TEXT,
  default_cta TEXT,
  legal_notice TEXT,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ -- 소프트 삭제용
);

-- 2. Brand Voice Profiles Table (브랜드 보이스 슬라이더 및 세부 특성)
CREATE TABLE IF NOT EXISTS public.brand_voice_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE NOT NULL,
  formal_level INT CHECK (formal_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  sentence_length INT CHECK (sentence_length BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  expertise_level INT CHECK (expertise_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  emotional_level INT CHECK (emotional_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  sales_level INT CHECK (sales_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  humor_level INT CHECK (humor_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  emoji_level INT CHECK (emoji_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  question_level INT CHECK (question_level BETWEEN 1 AND 5) DEFAULT 3 NOT NULL,
  honorific_style TEXT DEFAULT 'HONORIFIC' NOT NULL, -- 존댓말 스타일 (HONORIFIC, CASUAL, NEUTRAL)
  preferred_phrases TEXT DEFAULT '' NOT NULL,       -- 선호 표현
  forbidden_phrases TEXT DEFAULT '' NOT NULL,       -- 금지 표현
  proprietary_terms TEXT DEFAULT '' NOT NULL,       -- 브랜드 고유 용어
  intro_style TEXT,
  closing_style TEXT,
  cta_style TEXT,
  analysis_summary TEXT,                            -- 여러 샘플의 종합 분석 요약
  approved_at TIMESTAMPTZ,                          -- 분석 결과 승인일시
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Brand Samples Table (문체 분석용 과거 작성 글 보관 및 상태 관리)
CREATE TABLE IF NOT EXISTS public.brand_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('PASTED', 'FILE')) NOT NULL,
  source_url TEXT,
  raw_text TEXT NOT NULL,
  file_path TEXT,
  character_count INT NOT NULL,
  analysis_status TEXT CHECK (analysis_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING' NOT NULL,
  analysis_result JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. 성능 향상용 인덱스 설정
CREATE INDEX IF NOT EXISTS idx_brands_workspace_id ON public.brands(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brand_samples_brand_id ON public.brand_samples(brand_id);

-- 5. 기본 브랜드 관련 트리거 함수
-- 새로운 브랜드가 is_default = true로 설정될 시, 동일 워크스페이스 내부의 다른 모든 브랜드의 is_default를 false로 해제
CREATE OR REPLACE FUNCTION public.handle_default_brand()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE public.brands
    SET is_default = FALSE
    WHERE workspace_id = NEW.workspace_id 
      AND id <> NEW.id 
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 바인딩
DROP TRIGGER IF EXISTS on_brand_default_set ON public.brands;
CREATE TRIGGER on_brand_default_set
  BEFORE INSERT OR UPDATE OF is_default ON public.brands
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.handle_default_brand();

-- 6. RLS 활성화
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_samples ENABLE ROW LEVEL SECURITY;

-- 7. Brands RLS Policies
DROP POLICY IF EXISTS "Members can view workspace brands" ON public.brands;
CREATE POLICY "Members can view workspace brands" 
  ON public.brands FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can insert brands" ON public.brands;
CREATE POLICY "Editors/Admins/Owners can insert brands" 
  ON public.brands FOR INSERT 
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can update brands" ON public.brands;
CREATE POLICY "Editors/Admins/Owners can update brands" 
  ON public.brands FOR UPDATE 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
    )
  );

-- 8. Brand Voice Profiles RLS Policies
DROP POLICY IF EXISTS "Members can view voice profiles" ON public.brand_voice_profiles;
CREATE POLICY "Members can view voice profiles" 
  ON public.brand_voice_profiles FOR SELECT 
  USING (
    brand_id IN (
      SELECT id 
      FROM public.brands 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can manage voice profiles" ON public.brand_voice_profiles;
CREATE POLICY "Editors/Admins/Owners can manage voice profiles" 
  ON public.brand_voice_profiles FOR ALL 
  USING (
    brand_id IN (
      SELECT id 
      FROM public.brands 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
      )
    )
  );

-- 9. Brand Samples RLS Policies
DROP POLICY IF EXISTS "Members can view brand samples" ON public.brand_samples;
CREATE POLICY "Members can view brand samples" 
  ON public.brand_samples FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can manage brand samples" ON public.brand_samples;
CREATE POLICY "Editors/Admins/Owners can manage brand samples" 
  ON public.brand_samples FOR ALL 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
    )
  );


-- 1. Platforms Master Table (플랫폼 마스터 테이블)
CREATE TABLE IF NOT EXISTS public.platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- BLOG, SOCIAL, CMS
  supports_api_publish BOOLEAN DEFAULT FALSE NOT NULL,
  supports_draft_publish BOOLEAN DEFAULT FALSE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  default_rules JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Content Projects Table (콘텐츠 프로젝트 테이블)
CREATE TABLE IF NOT EXISTS public.content_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  category TEXT,
  content_goal TEXT NOT NULL, -- SEARCH_TRAFFIC, ADSENSE_APPROVAL 등
  content_type TEXT NOT NULL, -- INFORMATIONAL, REVIEW 등
  target_audience TEXT,
  audience_stage TEXT,
  primary_keyword TEXT NOT NULL,
  secondary_keywords TEXT[] DEFAULT '{}'::text[] NOT NULL,
  excluded_keywords TEXT[] DEFAULT '{}'::text[] NOT NULL,
  region_name TEXT,
  product_name TEXT,
  required_points TEXT,
  forbidden_phrases TEXT[] DEFAULT '{}'::text[] NOT NULL,
  source_notes TEXT,
  target_character_count INT DEFAULT 1000 NOT NULL,
  requested_image_count INT DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'SETUP' NOT NULL, -- SETUP, OUTLINE_READY, GENERATING, NEEDS_REVIEW, APPROVED 등
  generation_status TEXT DEFAULT 'NOT_STARTED' NOT NULL, -- NOT_STARTED, QUEUED, PROCESSING, COMPLETED 등
  current_step INT DEFAULT 1 NOT NULL, -- 마법사 단계 저장
  wizard_data JSONB DEFAULT '{}'::jsonb NOT NULL, -- 진행 단계별 미완성 데이터 임시 저장
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMPTZ -- 소프트 삭제용
);

-- 3. Project Platforms Table (프로젝트 채널 매핑 테이블)
CREATE TABLE IF NOT EXISTS public.project_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE CASCADE NOT NULL,
  target_character_count INT NOT NULL,
  requested_image_count INT NOT NULL,
  platform_settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, platform_id)
);

-- 4. Content Experiences Table (경험 정보 기술 테이블)
CREATE TABLE IF NOT EXISTS public.content_experiences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.content_projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  has_direct_experience BOOLEAN DEFAULT FALSE NOT NULL,
  usage_period TEXT,
  motivation TEXT,
  problem_before TEXT,
  change_after TEXT,
  advantages TEXT,
  disadvantages TEXT,
  recommended_for TEXT,
  not_recommended_for TEXT,
  real_episode TEXT,
  price_info TEXT,
  experienced_at TIMESTAMPTZ,
  additional_notes TEXT,
  confirmed_by_user BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. 인덱스 설정
CREATE INDEX IF NOT EXISTS idx_content_projects_workspace ON public.content_projects(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_projects_brand ON public.content_projects(brand_id);
CREATE INDEX IF NOT EXISTS idx_project_platforms_project ON public.project_platforms(project_id);

-- 6. 초기 플랫폼 마스터 데이터 시드 삽입
INSERT INTO public.platforms (code, name, category, supports_api_publish, supports_draft_publish, default_rules)
VALUES
  ('WORDPRESS', 'WordPress', 'CMS', true, true, '{"default_char_limit": 2500, "default_image_limit": 5, "default_faq_limit": 3, "default_outline": true}'),
  ('BLOGGER', 'Blogger', 'CMS', true, true, '{"default_char_limit": 2200, "default_image_limit": 5, "default_faq_limit": 2, "default_outline": false}'),
  ('TISTORY', '티스토리', 'CMS', true, true, '{"default_char_limit": 2200, "default_image_limit": 6, "default_faq_limit": 0, "default_outline": false}'),
  ('NAVER_BLOG', '네이버 블로그', 'BLOG', false, false, '{"default_char_limit": 2000, "default_image_limit": 8, "default_faq_limit": 0, "default_outline": false}'),
  ('INSTAGRAM', '인스타그램', 'SOCIAL', false, false, '{"default_char_limit": 800, "default_image_limit": 8, "default_hashtag_limit": 10, "default_outline": false}')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, 
    category = EXCLUDED.category,
    default_rules = EXCLUDED.default_rules,
    updated_at = NOW();

-- 7. RLS 활성화
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_experiences ENABLE ROW LEVEL SECURITY;

-- 8. Platforms RLS Policies
DROP POLICY IF EXISTS "All users can view active platforms" ON public.platforms;
CREATE POLICY "All users can view active platforms" 
  ON public.platforms FOR SELECT 
  USING (is_active = true);

-- 9. Content Projects RLS Policies
DROP POLICY IF EXISTS "Members can view workspace projects" ON public.content_projects;
CREATE POLICY "Members can view workspace projects" 
  ON public.content_projects FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can insert projects" ON public.content_projects;
CREATE POLICY "Editors/Admins/Owners can insert projects" 
  ON public.content_projects FOR INSERT 
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can update projects" ON public.content_projects;
CREATE POLICY "Editors/Admins/Owners can update projects" 
  ON public.content_projects FOR UPDATE 
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
    )
  );

-- 10. Project Platforms RLS Policies
DROP POLICY IF EXISTS "Members can view project platforms" ON public.project_platforms;
CREATE POLICY "Members can view project platforms" 
  ON public.project_platforms FOR SELECT 
  USING (
    project_id IN (
      SELECT id 
      FROM public.content_projects 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can manage project platforms" ON public.project_platforms;
CREATE POLICY "Editors/Admins/Owners can manage project platforms" 
  ON public.project_platforms FOR ALL 
  USING (
    project_id IN (
      SELECT id 
      FROM public.content_projects 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
      )
    )
  );

-- 11. Content Experiences RLS Policies
DROP POLICY IF EXISTS "Members can view content experiences" ON public.content_experiences;
CREATE POLICY "Members can view content experiences" 
  ON public.content_experiences FOR SELECT 
  USING (
    project_id IN (
      SELECT id 
      FROM public.content_projects 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Editors/Admins/Owners can manage content experiences" ON public.content_experiences;
CREATE POLICY "Editors/Admins/Owners can manage content experiences" 
  ON public.content_experiences FOR ALL 
  USING (
    project_id IN (
      SELECT id 
      FROM public.content_projects 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() AND role IN ('OWNER', 'ADMIN', 'EDITOR')
      )
    )
  );


-- 1. 프롬프트 템플릿 테이블
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  function_type VARCHAR(50) NOT NULL, -- BRIEF_GENERATION, OUTLINE_GENERATION, SECTION_GENERATION 등
  name VARCHAR(150) NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  output_schema JSONB,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_key_version UNIQUE(key, version)
);

-- 2. 콘텐츠 브리프 테이블
CREATE TABLE content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE UNIQUE NOT NULL,
  search_intent TEXT,
  audience_problem TEXT,
  core_answer TEXT,
  core_message TEXT,
  supporting_points TEXT[],
  proposed_cta TEXT,
  restrictions TEXT[],
  facts_summary TEXT[],
  raw_ai_response JSONB,
  prompt_version_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 콘텐츠 개요 테이블
CREATE TABLE content_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES platforms(id) ON DELETE SET NULL, -- NULL이면 공통 개요
  title_candidates TEXT[],
  selected_title TEXT,
  intro_direction TEXT,
  conclusion_direction TEXT,
  cta_direction TEXT,
  version_number INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, APPROVED
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 개요 항목 테이블
CREATE TABLE outline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_id UUID REFERENCES content_outlines(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES outline_items(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL, -- INTRO, HEADING, FAQ, CONCLUSION, CTA
  heading_level INT DEFAULT 2, -- H2, H3 등
  title VARCHAR(300) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. 플랫폼별 원고 본문 테이블
CREATE TABLE platform_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE NOT NULL,
  platform_account_id UUID, -- 향후 연동용
  title VARCHAR(300),
  seo_title VARCHAR(300),
  meta_description TEXT,
  slug VARCHAR(300),
  excerpt TEXT,
  body_html TEXT,
  body_text TEXT,
  body_json JSONB,
  hashtags TEXT[],
  categories TEXT[],
  tags TEXT[],
  cta_text TEXT,
  character_count INT DEFAULT 0,
  word_count INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW', -- NEEDS_REVIEW, APPROVED, PUBLISHED
  generation_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, QUEUED, PROCESSING, COMPLETED, FAILED
  current_version_number INT NOT NULL DEFAULT 1,
  prompt_version_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_project_platform UNIQUE(project_id, platform_id)
);

-- 6. 본문 개별 섹션 테이블
CREATE TABLE content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_content_id UUID REFERENCES platform_contents(id) ON DELETE CASCADE NOT NULL,
  outline_item_id UUID REFERENCES outline_items(id) ON DELETE SET NULL,
  section_type VARCHAR(20) NOT NULL, -- INTRO, HEADING, FAQ, CONCLUSION, CTA
  heading_level INT DEFAULT 2,
  heading VARCHAR(300),
  body_html TEXT,
  body_text TEXT,
  sort_order INT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  generation_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED', -- NOT_STARTED, PROCESSING, COMPLETED, FAILED
  source_fact_ids TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. 이미지 기획 테이블
CREATE TABLE image_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_content_id UUID REFERENCES platform_contents(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES content_sections(id) ON DELETE SET NULL,
  sequence_number INT NOT NULL,
  role VARCHAR(100),
  description TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  aspect_ratio VARCHAR(20),
  recommended_width INT,
  recommended_height INT,
  overlay_text VARCHAR(200),
  filename_suggestion VARCHAR(250),
  alt_text VARCHAR(300),
  caption TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  linked_asset_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. AI 비동기 상태 추적 Jobs 테이블
CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_content_id UUID REFERENCES platform_contents(id) ON DELETE CASCADE,
  section_id UUID REFERENCES content_sections(id) ON DELETE SET NULL,
  job_type VARCHAR(50) NOT NULL, -- BRIEF_GENERATION, OUTLINE_GENERATION, SECTION_GENERATION, PLATFORM_TRANSFORMATION, IMAGE_PLAN_GENERATION 등
  provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
  input_snapshot JSONB,
  output_snapshot JSONB,
  prompt_version_id UUID REFERENCES prompt_templates(id) ON DELETE SET NULL,
  input_tokens INT,
  output_tokens INT,
  estimated_cost NUMERIC(10, 6) DEFAULT 0.000000,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 적용 설정
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE outline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (본인이 속한 워크스페이스 기준 격리)
CREATE POLICY select_prompt_templates ON prompt_templates FOR SELECT USING (true); -- 템플릿은 전체 공유 읽기

CREATE POLICY manage_content_briefs ON content_briefs
  USING (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL))
  WITH CHECK (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL));

CREATE POLICY manage_content_outlines ON content_outlines
  USING (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL))
  WITH CHECK (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL));

CREATE POLICY manage_outline_items ON outline_items
  USING (outline_id IN (SELECT id FROM content_outlines WHERE project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL)))
  WITH CHECK (outline_id IN (SELECT id FROM content_outlines WHERE project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL)));

CREATE POLICY manage_platform_contents ON platform_contents
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY manage_content_sections ON content_sections
  USING (platform_content_id IN (SELECT id FROM platform_contents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())))
  WITH CHECK (platform_content_id IN (SELECT id FROM platform_contents WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())));

CREATE POLICY manage_image_plans ON image_plans
  USING (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL))
  WITH CHECK (project_id IN (SELECT id FROM content_projects WHERE deleted_at IS NULL));

CREATE POLICY manage_ai_jobs ON ai_jobs
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));


-- 콘텐츠 버전 관리 테이블
CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_content_id UUID REFERENCES platform_contents(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,
  version_type VARCHAR(20) NOT NULL, -- GENERATED, MANUAL, PRE_PUBLISH, PUBLISHED, RESTORED
  title VARCHAR(300),
  body_html TEXT,
  body_text TEXT,
  body_json JSONB,
  metadata_snapshot JSONB, -- seo_title, meta_description, slug, tags, hashtags, categories 스냅샷
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_platform_version UNIQUE(platform_content_id, version_number)
);

-- RLS 활성화 및 권한 설정
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_versions' AND policyname = 'manage_content_versions'
  ) THEN
    CREATE POLICY manage_content_versions ON content_versions
      USING (platform_content_id IN (
        SELECT id FROM platform_contents WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ))
      WITH CHECK (platform_content_id IN (
        SELECT id FROM platform_contents WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ));
  END IF;
END
$$;


-- 1. 콘텐츠 평가 요약 테이블
CREATE TABLE IF NOT EXISTS content_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_content_id UUID REFERENCES platform_contents(id) ON DELETE CASCADE NOT NULL,
  evaluation_version INT NOT NULL,
  intent_score INT NOT NULL,
  quality_score INT NOT NULL,
  readability_score INT NOT NULL,
  technical_seo_score INT NOT NULL,
  trust_score INT NOT NULL,
  platform_fit_score INT NOT NULL,
  overall_score INT NOT NULL,
  keyword_density JSONB NOT NULL DEFAULT '{}'::jsonb,
  repetition_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  raw_result JSONB,
  model_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 평가 발견 이슈 테이블
CREATE TABLE IF NOT EXISTS evaluation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES content_evaluations(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES content_sections(id) ON DELETE SET NULL,
  severity VARCHAR(20) NOT NULL, -- INFO, WARNING, CRITICAL
  category VARCHAR(50) NOT NULL, -- SEO, INTENT, QUALITY, READABILITY, TRUST, PLATFORM_FIT
  issue_code VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  suggested_action TEXT,
  auto_fix_available BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, FIXED, IGNORED
  ignore_reason TEXT,
  fixed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 콘텐츠 사실 검증 테이블
CREATE TABLE IF NOT EXISTS content_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE NOT NULL,
  fact_text TEXT NOT NULL,
  fact_type VARCHAR(30) NOT NULL, -- USER_FACT, SOURCE_FACT, GENERAL_KNOWLEDGE, AI_SUGGESTION, NEEDS_VERIFICATION
  source_title VARCHAR(300),
  source_url VARCHAR(1024),
  source_excerpt TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED', -- UNVERIFIED, USER_CONFIRMED, SOURCE_CONFIRMED, OUTDATED, DISPUTED
  user_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 활성화
ALTER TABLE content_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_facts ENABLE ROW LEVEL SECURITY;

-- RLS 정책 설정 (사용자가 속한 워크스페이스 기준 격리)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_evaluations' AND policyname = 'manage_content_evaluations'
  ) THEN
    CREATE POLICY manage_content_evaluations ON content_evaluations
      USING (platform_content_id IN (
        SELECT id FROM platform_contents WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ))
      WITH CHECK (platform_content_id IN (
        SELECT id FROM platform_contents WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'evaluation_issues' AND policyname = 'manage_evaluation_issues'
  ) THEN
    CREATE POLICY manage_evaluation_issues ON evaluation_issues
      USING (evaluation_id IN (
        SELECT id FROM content_evaluations WHERE platform_content_id IN (
          SELECT id FROM platform_contents WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
          )
        )
      ))
      WITH CHECK (evaluation_id IN (
        SELECT id FROM content_evaluations WHERE platform_content_id IN (
          SELECT id FROM platform_contents WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
          )
        )
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_facts' AND policyname = 'manage_content_facts'
  ) THEN
    CREATE POLICY manage_content_facts ON content_facts
      USING (project_id IN (
        SELECT id FROM content_projects WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ))
      WITH CHECK (project_id IN (
        SELECT id FROM content_projects WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      ));
  END IF;
END
$$;

-- 성능 최적화용 인덱스
CREATE INDEX IF NOT EXISTS idx_content_evaluations_platform_content ON content_evaluations(platform_content_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_issues_evaluation ON evaluation_issues(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_content_facts_project ON content_facts(project_id);


-- 1. assets (자산 및 이미지 관리 테이블)
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.content_projects(id) ON DELETE CASCADE NOT NULL,
  platform_content_id UUID REFERENCES public.platform_contents(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES public.content_sections(id) ON DELETE SET NULL,
  asset_type TEXT CHECK (asset_type IN ('IMAGE', 'FILE')) NOT NULL,
  source_type TEXT CHECK (source_type IN ('UPLOAD', 'GENERATED', 'PLANNED')) NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT DEFAULT '' NOT NULL,
  caption TEXT DEFAULT '' NOT NULL,
  source_url TEXT DEFAULT '' NOT NULL,
  copyright_status TEXT CHECK (copyright_status IN ('OWNED', 'LICENSED', 'AI_GENERATED', 'UNKNOWN', 'RESTRICTED')) DEFAULT 'UNKNOWN' NOT NULL,
  status TEXT CHECK (status IN ('PLANNED', 'UPLOADED', 'GENERATING', 'GENERATED', 'FAILED', 'APPROVED')) DEFAULT 'PLANNED' NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. export_logs (내보내기/다운로드 감사 로그 테이블)
CREATE TABLE IF NOT EXISTS public.export_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform_content_id UUID REFERENCES public.platform_contents(id) ON DELETE CASCADE NOT NULL,
  export_format TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_assets_workspace_id ON public.assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assets_project_id ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_platform_content_id ON public.assets(platform_content_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_platform_content_id ON public.export_logs(platform_content_id);

-- 4. RLS 활성화
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (자산 및 내보내기 로그 정책)
DROP POLICY IF EXISTS "Members can view own workspace assets" ON public.assets;
CREATE POLICY "Members can view own workspace assets" ON public.assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = assets.workspace_id
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Editors can manage workspace assets" ON public.assets;
CREATE POLICY "Editors can manage workspace assets" ON public.assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = assets.workspace_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'EDITOR')
        AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Members can view export logs" ON public.export_logs;
CREATE POLICY "Members can view export logs" ON public.export_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      JOIN public.platform_contents ON platform_contents.id = export_logs.platform_content_id
      WHERE workspace_members.workspace_id = platform_contents.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Authorized users can insert export logs" ON public.export_logs;
CREATE POLICY "Authorized users can insert export logs" ON public.export_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- 6. storage.buckets 'assets' 생성 시도 및 storage.objects RLS 연동
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Workspace active members can read storage assets" ON storage.objects;
CREATE POLICY "Workspace active members can read storage assets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'assets' AND
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = (storage.foldername(name))[2]::uuid
        AND user_id = auth.uid()
        AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Workspace active editors can write storage assets" ON storage.objects;
CREATE POLICY "Workspace active editors can write storage assets" ON storage.objects
  FOR ALL USING (
    bucket_id = 'assets' AND
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = (storage.foldername(name))[2]::uuid
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN', 'EDITOR')
        AND status = 'ACTIVE'
    )
  );


-- 1) platform_accounts (플랫폼 연동 계정 테이블)
CREATE TABLE IF NOT EXISTS public.platform_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  platform_id UUID REFERENCES public.platforms(id) ON DELETE CASCADE NOT NULL,
  account_name TEXT NOT NULL,
  external_account_id TEXT,
  site_url TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  credentials_encrypted TEXT,
  connection_status TEXT CHECK (connection_status IN ('CONNECTED', 'DISCONNECTED', 'EXPIRED', 'ERROR')) DEFAULT 'CONNECTED' NOT NULL,
  last_verified_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2) publications (발행 이력 및 조치 기록 테이블)
CREATE TABLE IF NOT EXISTS public.publications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  platform_content_id UUID REFERENCES public.platform_contents(id) ON DELETE CASCADE NOT NULL,
  platform_account_id UUID REFERENCES public.platform_accounts(id) ON DELETE CASCADE NOT NULL,
  publication_type TEXT CHECK (publication_type IN ('DRAFT', 'PUBLISH', 'SCHEDULE')) NOT NULL,
  status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'DRAFT_CREATED', 'PUBLISHED', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING' NOT NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  external_url TEXT,
  request_payload JSONB,
  response_payload JSONB,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3) usage_records (워크스페이스별 리소스 사용량 테이블)
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL,  -- 'PROJECT_CREATION', 'CONTENT_CREATION', 'AI_INPUT_TOKENS', 'AI_OUTPUT_TOKENS', 'REGENERATION', 'EVALUATION', 'FILE_SAVE', 'EXPORT', 'EXTERNAL_PUBLISH'
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,        -- 'COUNT', 'TOKENS', 'BYTES'
  reference_type TEXT,       -- 'PROJECT', 'PLATFORM_CONTENT', etc.
  reference_id UUID,
  billing_period TEXT NOT NULL, -- YYYY-MM 포맷
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4) error_logs (개발/운영 통합 장애 감사용 테이블)
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id TEXT,
  feature TEXT NOT NULL,      -- 'AI_GENERATION', 'PUBLICATION', 'INTEGRATION'
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5) RLS 활성화 및 인덱싱 처리
ALTER TABLE public.platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_platform_accounts_workspace ON public.platform_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_publications_workspace ON public.publications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_workspace_period ON public.usage_records(workspace_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);

-- 6) RLS Policies
-- 멤버십 기반 격리 보장 + 어드민은 조건 없이 접근 가능(is_admin = true)
DROP POLICY IF EXISTS "Workspace members can view/manage integrations" ON public.platform_accounts;
CREATE POLICY "Workspace members can view/manage integrations" ON public.platform_accounts
  FOR ALL USING (
    (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = platform_accounts.workspace_id AND user_id = auth.uid() AND status = 'ACTIVE'))
    OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  );

DROP POLICY IF EXISTS "Workspace members can view/manage publications" ON public.publications;
CREATE POLICY "Workspace members can view/manage publications" ON public.publications
  FOR ALL USING (
    (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = publications.workspace_id AND user_id = auth.uid() AND status = 'ACTIVE'))
    OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  );

DROP POLICY IF EXISTS "Workspace members can read usage records" ON public.usage_records;
CREATE POLICY "Workspace members can read usage records" ON public.usage_records
  FOR SELECT USING (
    (EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = usage_records.workspace_id AND user_id = auth.uid() AND status = 'ACTIVE'))
    OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  );

DROP POLICY IF EXISTS "Admins can manage usage records" ON public.usage_records;
CREATE POLICY "Admins can manage usage records" ON public.usage_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can manage error logs" ON public.error_logs;
CREATE POLICY "Admins can manage error logs" ON public.error_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
