import { describe, it, expect } from "vitest";
import { brandSchema, voiceProfileSchema, brandSampleSchema } from "./brand";

describe("Brand Zod Schemas", () => {
  describe("brandSchema (브랜드 기본정보)", () => {
    it("올바른 브랜드 입력값은 성공해야 함", () => {
      const valid = {
        name: "AI 콘텐츠 봇",
        industry: "IT / 마케팅",
        description: "AI 카피라이터 SaaS",
        tagline: "글쓰기 혁신",
        website_url: "https://aicontentsbot.ai",
        target_audience: "",
        customer_problems: "",
        products_services: "",
        core_values: "",
        default_cta: "",
        legal_notice: "",
        is_default: true,
      };
      const result = brandSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("브랜드명이나 업종이 누락되면 실패해야 함", () => {
      const invalid = {
        name: "",
        industry: "IT",
        description: "",
        tagline: "",
        website_url: "",
        target_audience: "",
        customer_problems: "",
        products_services: "",
        core_values: "",
        default_cta: "",
        legal_notice: "",
        is_default: false,
      };
      const result = brandSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("올바르지 않은 홈페이지 URL 형식은 에러가 나야 함", () => {
      const invalid = {
        name: "AI 콘텐츠 봇",
        industry: "IT",
        description: "",
        tagline: "",
        website_url: "invalid-url-format-!@#",
        target_audience: "",
        customer_problems: "",
        products_services: "",
        core_values: "",
        default_cta: "",
        legal_notice: "",
        is_default: false,
      };
      const result = brandSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("voiceProfileSchema (보이스 슬라이더)", () => {
    it("1~5 범위의 모든 정수 슬라이더 값은 허용되어야 함", () => {
      const valid = {
        formal_level: 5,
        sentence_length: 1,
        expertise_level: 3,
        emotional_level: 2,
        sales_level: 4,
        humor_level: 3,
        emoji_level: 2,
        question_level: 4,
        honorific_style: "HONORIFIC" as const,
        preferred_phrases: "",
        forbidden_phrases: "",
        proprietary_terms: "",
        intro_style: "",
        closing_style: "",
        cta_style: "",
        analysis_summary: "",
      };
      const result = voiceProfileSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("슬라이더 값이 범위를 초과(예: 0 또는 6)하면 에러가 나야 함", () => {
      const invalid = {
        formal_level: 6, // 5 초과
        sentence_length: 0, // 1 미만
        expertise_level: 3,
        emotional_level: 2,
        sales_level: 4,
        humor_level: 3,
        emoji_level: 2,
        question_level: 4,
        honorific_style: "HONORIFIC" as const,
        preferred_phrases: "",
        forbidden_phrases: "",
        proprietary_terms: "",
        intro_style: "",
        closing_style: "",
        cta_style: "",
        analysis_summary: "",
      };
      const result = voiceProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("brandSampleSchema (예문 등록)", () => {
    it("50자 이상의 정상 예문 텍스트는 허용되어야 함", () => {
      const valid = {
        title: "작성 샘플 1",
        source_type: "PASTED",
        raw_text: "AI 콘텐츠 봇은 사용자의 브랜드 보이스를 자동으로 분석하여 문맥에 맞는 최적화된 마케팅 글을 빠르고 쉽게 작성해 주는 멀티플랫폼 AI 카피라이팅 서비스입니다. 블로그, 인스타그램 등 최적화 글을 생성해 드립니다.",
      };
      const result = brandSampleSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("텍스트가 50자 미만이면 실패해야 함", () => {
      const invalid = {
        title: "짧은 예문",
        source_type: "PASTED",
        raw_text: "짧은 글입니다.", // 50자 미만
      };
      const result = brandSampleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
