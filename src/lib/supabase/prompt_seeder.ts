import { createClient } from "@/lib/supabase/server";

export interface PromptTemplateData {
  key: string;
  function_type: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string;
  version: number;
  is_active: boolean;
}

const DEFAULT_TEMPLATES: PromptTemplateData[] = [
  {
    key: "BRIEF_GENERATION",
    function_type: "BRIEF_GENERATION",
    name: "기획 브리프 생성 템플릿",
    system_prompt: "너는 마케팅 콘텐츠 기획 전문가다. 사용자가 제시한 기획 주제, 브랜드 정보, 리얼 사용자 체험담을 분석하여 검색 의도, 페인포인트, 핵심 요약 메시지를 도출한 브리프 JSON을 출력해야 한다. 반드시 지정된 JSON 구조 스키마를 엄격히 준수하라.",
    user_prompt_template: "주제: {{topic}}\n키워드: {{keywords}}\n브랜드: {{brand_info}}\n경험: {{experience_info}}",
    version: 1,
    is_active: true,
  },
  {
    key: "OUTLINE_GENERATION",
    function_type: "OUTLINE_GENERATION",
    name: "공통 개요 설계 템플릿",
    system_prompt: "너는 기획 브리프를 활용해 글의 뼈대가 될 공통 개요(도입부, 본문 단락 제목군, FAQ, 결론, CTA 방향)를 설계하는 전문가다. 반드시 지정된 JSON 구조 스키마를 준수하라.",
    user_prompt_template: "기획 브리프:\n{{brief}}",
    version: 1,
    is_active: true,
  },
  {
    key: "PLATFORM_OUTLINE_GENERATION",
    function_type: "PLATFORM_OUTLINE_GENERATION",
    name: "플랫폼 맞춤 개요 템플릿",
    system_prompt: "너는 공통 개요를 특정 소셜 발행 플랫폼의 규격 규칙에 맞도록 목차명과 세부 기술 방향을 변형시키는 맞춤형 개요 설계 전문가다. 지정된 JSON 규격을 엄수하라.",
    user_prompt_template: "대상 플랫폼: {{platform_code}}\n플랫폼 권장 규격: {{platform_rules}}\n공통 개요:\n{{common_outline}}",
    version: 1,
    is_active: true,
  },
  {
    key: "SECTION_GENERATION",
    function_type: "SECTION_GENERATION",
    name: "본문 문단 생성 템플릿",
    system_prompt: "너는 지정된 목차 단락의 제목과 요약 설명을 해석하여 끊김 없는 매끄러운 단락 본문 원고를 작성하는 전문 작가다. 리치 텍스트 표현을 위해 p, strong, ul, li 태그를 배합한 HTML로 본문을 작성해야 한다. 반드시 지정된 JSON 구조 스키마를 준수하라.",
    user_prompt_template: "주제: {{topic}}\n키워드: {{keywords}}\n단락 제목: {{heading}}\n단락 설명: {{description}}\n이전 단락 내용들:\n{{preceding_text}}\n직접경험 정보: {{experience}}\n경험유무: {{has_experience}}",
    version: 1,
    is_active: true,
  },
  {
    key: "METADATA_GENERATION",
    function_type: "METADATA_GENERATION",
    name: "플랫폼 메타데이터 생성 템플릿",
    system_prompt: "너는 완성된 본문을 분석해 검색엔진 최적화용 제목(seoTitle), 메타 설명(metaDescription), 웹 주소 슬러그(slug), 태그 및 해시태그를 도출하는 SEO 마케팅 전문가다. 지정된 JSON 규격을 준수하라.",
    user_prompt_template: "대상 플랫폼: {{platform_code}}\n완성된 원고 본문:\n{{body_text}}",
    version: 1,
    is_active: true,
  },
  {
    key: "IMAGE_PLAN_GENERATION",
    function_type: "IMAGE_PLAN_GENERATION",
    name: "이미지 구성안 생성 템플릿",
    system_prompt: "너는 본문 내용을 분석해 적재적소에 들어갈 이미지 구성 계획(역할, 썸네일 텍스트, 생성 AI 프롬프트)을 설계하는 미디어 비주얼 기획자다. 지정된 JSON 규격을 준수하라.",
    user_prompt_template: "대상 플랫폼: {{platform_code}}\n요청 이미지 장수: {{image_count}}\n이미지 테마 스타일: {{image_style}}\n원고 본문:\n{{body_text}}",
    version: 1,
    is_active: true,
  }
];

/**
 * 데이터베이스에 기본 프롬프트 템플릿들이 존재하지 않을 경우 시딩 작업을 수행합니다.
 */
export async function seedPromptTemplates() {
  const supabase = await createClient();

  // 1. 기존 프롬프트 존재 여부 체크
  const { data: existing, error: checkError } = await supabase
    .from("prompt_templates")
    .select("key, version");

  if (checkError) {
    console.error("프롬프트 템플릿 존재 여부 확인 실패:", checkError.message);
    return;
  }

  const existingKeys = new Set((existing || []).map((t) => `${t.key}_v${t.version}`));

  // 2. 누락된 템플릿 선별
  const toInsert = DEFAULT_TEMPLATES.filter(
    (t) => !existingKeys.has(`${t.key}_v${t.version}`)
  );

  if (toInsert.length === 0) {
    return; // 이미 모든 시드가 데이터베이스에 존재함
  }

  // 3. 누락된 템플릿 인서트
  const { error: insertError } = await supabase
    .from("prompt_templates")
    .insert(toInsert);

  if (insertError) {
    console.error("기본 프롬프트 템플릿 시딩 실패:", insertError.message);
  } else {
    console.log(`기본 프롬프트 템플릿 시딩 성공! (${toInsert.length}개 추가됨)`);
  }
}

/**
 * 특정 key의 활성화된 프롬프트 템플릿 단건을 조회합니다. 누락 시 자동 시딩 후 재조회합니다.
 */
export async function getPromptTemplate(key: string) {
  const supabase = await createClient();

  let { data, error } = await supabase
    .from("prompt_templates")
    .select("*")
    .eq("key", key)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`프롬프트 템플릿 로드 실패: ${error.message}`);
  }

  if (!data) {
    // 템플릿이 없는 경우 자동 시딩 기동
    await seedPromptTemplates();

    // 재조회
    const { data: reselect, error: reselectError } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("key", key)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reselectError || !reselect) {
      throw new Error(`기본 시딩 완료 후에도 프롬프트 템플릿(${key}) 조회 실패`);
    }

    return reselect;
  }

  return data;
}
