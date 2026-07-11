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
