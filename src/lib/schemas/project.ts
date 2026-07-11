import { z } from "zod";

// --- Enums ---

export const CONTENT_GOALS = [
  "SEARCH_TRAFFIC",
  "ADSENSE_APPROVAL",
  "ADSENSE_REVENUE",
  "LEAD_GENERATION",
  "PRODUCT_SALES",
  "BRAND_AWARENESS",
  "ENGAGEMENT",
  "STORE_VISIT",
  "AFFILIATE_CLICK",
  "EDUCATION",
] as const;

export const CONTENT_TYPES = [
  "INFORMATIONAL",
  "REVIEW",
  "EXPERIENCE",
  "COMPARISON",
  "HOW_TO",
  "CHECKLIST",
  "FAQ",
  "CASE_STUDY",
  "PRODUCT_INTRO",
  "LOCAL_GUIDE",
  "PROMOTIONAL",
  "STORYTELLING",
  "NEWS_ANALYSIS",
] as const;

export const IMAGE_STYLES = [
  "PHOTO_REALISTIC",
  "LIFESTYLE",
  "EDITORIAL",
  "MINIMAL",
  "INFOGRAPHIC",
  "ILLUSTRATION",
  "PRODUCT_FOCUSED",
  "USER_PHOTO",
] as const;

export const PLATFORM_CODES = [
  "WORDPRESS",
  "BLOGGER",
  "TISTORY",
  "NAVER_BLOG",
  "INSTAGRAM",
] as const;

// --- Platform Default Recommendations ---

export interface PlatformDefaults {
  target_character_count: number;
  title_candidates_count: number;
  subheadings_count: number;
  requested_image_count: number;
  faq_count: number;
  has_toc: boolean;
  has_metadata: boolean;
  instagram_carousel_count?: number;
  instagram_hashtag_count?: number;
}

export const PLATFORM_DEFAULTS: Record<typeof PLATFORM_CODES[number], PlatformDefaults> = {
  WORDPRESS: {
    target_character_count: 2500,
    title_candidates_count: 5,
    subheadings_count: 5,
    requested_image_count: 5,
    faq_count: 3,
    has_toc: true,
    has_metadata: true,
  },
  BLOGGER: {
    target_character_count: 2200,
    title_candidates_count: 5,
    subheadings_count: 5,
    requested_image_count: 5,
    faq_count: 2,
    has_toc: false,
    has_metadata: false,
  },
  TISTORY: {
    target_character_count: 2200,
    title_candidates_count: 5,
    subheadings_count: 5,
    requested_image_count: 6,
    faq_count: 0,
    has_toc: false,
    has_metadata: false,
  },
  NAVER_BLOG: {
    target_character_count: 2000,
    title_candidates_count: 5,
    subheadings_count: 4,
    requested_image_count: 8,
    faq_count: 0,
    has_toc: false,
    has_metadata: false,
  },
  INSTAGRAM: {
    target_character_count: 800,
    title_candidates_count: 5,
    subheadings_count: 0,
    requested_image_count: 8, // 캐러셀 이미지 수 대용
    faq_count: 0,
    has_toc: false,
    has_metadata: false,
    instagram_carousel_count: 8,
    instagram_hashtag_count: 10,
  },
};

// --- Step-by-Step Zod Schemas ---

// STEP 1: 기본 설정
export const step1Schema = z.object({
  brand_id: z.string().uuid({ message: "브랜드를 선택해 주세요." }),
  content_goal: z.enum(CONTENT_GOALS, { message: "올바른 목적을 선택해 주세요." }),
  platforms: z.array(z.enum(PLATFORM_CODES)).min(1, { message: "플랫폼을 최소 1개 이상 선택해 주세요." }),
  category: z.string().min(1, { message: "카테고리를 입력해 주세요." }).max(50),
  content_type: z.enum(CONTENT_TYPES, { message: "올바른 콘텐츠 유형을 선택해 주세요." }),
  target_audience: z.string().min(1, { message: "예상 독자를 입력해 주세요." }).max(200),
  audience_stage: z.string().min(1, { message: "독자 인지 단계를 입력해 주세요." }).max(100),
});

// STEP 2: 주제와 키워드
export const step2Schema = z.object({
  title: z.string().min(1, { message: "프로젝트명을 입력해 주세요." }).max(150),
  topic: z.string().min(1, { message: "주제를 입력해 주세요." }).max(300),
  primary_keyword: z.string().min(1, { message: "핵심 키워드를 입력해 주세요." }).max(50),
  secondary_keywords: z.array(z.string()).default([]),
  excluded_keywords: z.array(z.string()).default([]),
  region_name: z.string().optional().default(""),
  product_name: z.string().optional().default(""),
  required_points: z.string().optional().default(""),
  forbidden_phrases: z.array(z.string()).default([]),
  source_notes: z.string().optional().default(""),
});

// STEP 3: 사용자 경험
export const step3BaseSchema = z.object({
  has_direct_experience: z.boolean().default(false),
  usage_period: z.string().optional().default(""),
  motivation: z.string().optional().default(""),
  problem_before: z.string().optional().default(""),
  change_after: z.string().optional().default(""),
  advantages: z.string().optional().default(""),
  disadvantages: z.string().optional().default(""),
  recommended_for: z.string().optional().default(""),
  not_recommended_for: z.string().optional().default(""),
  real_episode: z.string().optional().default(""),
  price_info: z.string().optional().default(""),
  experienced_at: z.string().optional().default(""),
  additional_notes: z.string().optional().default(""),
  confirmed_by_user: z.boolean().default(false),
});

export const step3Schema = step3BaseSchema.refine(
  (data) => {
    if (data.has_direct_experience && !data.confirmed_by_user) {
      return false;
    }
    return true;
  },
  {
    message: "직접 경험한 사실이 틀림없음을 체크박스로 확인해 주세요.",
    path: ["confirmed_by_user"],
  }
);

// STEP 4: 콘텐츠 구성
export const step4Schema = z.object({
  target_character_count: z
    .number()
    .int()
    .min(100, { message: "목표 글자 수는 최소 100자 이상이어야 합니다." })
    .max(50000, { message: "목표 글자 수는 최대 50,000자까지 설정 가능합니다." }),
  title_candidates_count: z.number().int().min(1).max(20).default(5),
  subheadings_count: z.number().int().min(0).max(50).default(5),
  requested_image_count: z.number().int().min(0).max(50).default(0),
  faq_count: z.number().int().min(0).max(20).default(0),
  has_toc: z.boolean().default(false),
  has_table: z.boolean().default(false),
  has_list: z.boolean().default(false),
  has_summary_box: z.boolean().default(false),
  has_cta: z.boolean().default(false),
  has_sources: z.boolean().default(false),
  has_conclusion: z.boolean().default(true),
});

// STEP 5: 문체
export const step5BaseSchema = z.object({
  use_brand_voice: z.boolean().default(true),
  formal: z.number().int().min(0).max(100).default(0),
  friendly: z.number().int().min(0).max(100).default(0),
  honest: z.number().int().min(0).max(100).default(0),
  plain: z.number().int().min(0).max(100).default(0),
  luxury: z.number().int().min(0).max(100).default(0),
  witty: z.number().int().min(0).max(100).default(0),
  consultant: z.number().int().min(0).max(100).default(0),
  reviewer: z.number().int().min(0).max(100).default(0),
  journalist: z.number().int().min(0).max(100).default(0),
});

export const step5Schema = step5BaseSchema.refine(
  (data) => {
    if (data.use_brand_voice) return true;
    const sum =
      data.formal +
      data.friendly +
      data.honest +
      data.plain +
      data.luxury +
      data.witty +
      data.consultant +
      data.reviewer +
      data.journalist;
    return sum === 100;
  },
  {
    message: "사용자 정의 어조 가중치 합계는 반드시 100%여야 합니다.",
    path: ["formal"], // 에러가 걸릴 하위 대표 경로
  }
);

// STEP 6: 이미지
export const step6Schema = z.object({
  image_count: z.number().int().min(0).max(50).default(0),
  style: z.enum(IMAGE_STYLES, { message: "올바른 이미지 스타일을 지정해 주세요." }),
  aspect_ratio: z.string().default("16:9"),
  text_overlay: z.string().optional().default(""),
  include_logo: z.boolean().default(false),
  use_uploaded: z.boolean().default(false),
  generate_ai: z.boolean().default(false),
  prepare_personally: z.boolean().default(false),
});

// --- Types ---
export type Step1Input = z.input<typeof step1Schema>;
export type Step2Input = z.input<typeof step2Schema>;
export type Step3Input = z.input<typeof step3Schema>;
export type Step4Input = z.input<typeof step4Schema>;
export type Step5Input = z.input<typeof step5Schema>;
export type Step6Input = z.input<typeof step6Schema>;

// 마법사 전체 누적 데이터 Zod (서버 저장 및 복원용)
export const projectWizardDataSchema = z.object({
  step1: step1Schema.partial().optional(),
  step2: step2Schema.partial().optional(),
  step3: step3BaseSchema.partial().optional(),
  step4: step4Schema.partial().optional(),
  step5: step5BaseSchema.partial().optional(),
  step6: step6Schema.partial().optional(),
});

export type ProjectWizardData = z.infer<typeof projectWizardDataSchema>;
