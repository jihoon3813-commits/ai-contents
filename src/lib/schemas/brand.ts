import { z } from "zod";

// 1. 브랜드 기본정보 생성/수정 스키마
export const brandSchema = z.object({
  name: z
    .string()
    .min(1, { message: "브랜드명을 입력해 주세요." })
    .max(100, { message: "브랜드명은 100자 이하로 입력해 주세요." }),
  industry: z
    .string()
    .min(1, { message: "업종을 입력해 주세요." })
    .max(100, { message: "업종은 100자 이하로 입력해 주세요." }),
  description: z.string(),
  tagline: z.string(),
  website_url: z
    .string()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          new URL(val.startsWith("http") ? val : `https://${val}`);
          return true;
        } catch {
          return false;
        }
      },
      { message: "올바른 홈페이지 URL 형식이 아닙니다." }
    ),
  target_audience: z.string(),
  customer_problems: z.string(),
  products_services: z.string(),
  core_values: z.string(),
  default_cta: z.string(),
  legal_notice: z.string(),
  is_default: z.boolean(),
});

export type BrandInput = z.infer<typeof brandSchema>;

// 2. 브랜드 보이스 프로필 (8개 1-5 범위 척도 및 세부 설정) 스키마
export const voiceProfileSchema = z.object({
  formal_level: z.number().int().min(1).max(5),
  sentence_length: z.number().int().min(1).max(5),
  expertise_level: z.number().int().min(1).max(5),
  emotional_level: z.number().int().min(1).max(5),
  sales_level: z.number().int().min(1).max(5),
  humor_level: z.number().int().min(1).max(5),
  emoji_level: z.number().int().min(1).max(5),
  question_level: z.number().int().min(1).max(5),
  honorific_style: z.enum(["HONORIFIC", "CASUAL", "NEUTRAL"]),
  preferred_phrases: z.string(),
  forbidden_phrases: z.string(),
  proprietary_terms: z.string(),
  intro_style: z.string(),
  closing_style: z.string(),
  cta_style: z.string(),
  analysis_summary: z.string(),
});

export type VoiceProfileInput = z.infer<typeof voiceProfileSchema>;

// 3. 문체 분석용 브랜드 샘플 텍스트 등록 스키마
export const brandSampleSchema = z.object({
  title: z
    .string()
    .min(1, { message: "샘플 제목을 입력해 주세요." })
    .max(200, { message: "제목은 200자 이하로 입력해 주세요." }),
  source_type: z.enum(["PASTED", "FILE"]),
  source_url: z
    .string()
    .optional()
    .default("")
    .refine(
      (val) => {
        if (!val) return true;
        try {
          new URL(val.startsWith("http") ? val : `https://${val}`);
          return true;
        } catch {
          return false;
        }
      },
      { message: "올바른 참고 URL 형식이 아닙니다." }
    ),
  raw_text: z
    .string()
    .min(50, { message: "분석을 위해 최소 50자 이상의 텍스트를 입력해 주세요." })
    .max(50000, { message: "단일 분석 텍스트 한도는 최대 50,000자입니다." }),
  file_path: z.string().optional().default(""),
});

export type BrandSampleInput = z.infer<typeof brandSampleSchema>;
