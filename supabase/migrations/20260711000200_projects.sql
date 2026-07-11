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
