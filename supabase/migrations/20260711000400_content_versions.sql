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
