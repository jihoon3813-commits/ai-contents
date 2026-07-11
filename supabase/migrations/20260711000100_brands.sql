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
