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
