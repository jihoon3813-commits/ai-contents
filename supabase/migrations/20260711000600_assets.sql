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
