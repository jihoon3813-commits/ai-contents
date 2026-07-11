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
