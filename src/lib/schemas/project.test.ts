import { describe, it, expect } from "vitest";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
} from "./project";

describe("Project Zod Schemas", () => {
  // STEP 1 검증
  describe("step1Schema (기본 설정)", () => {
    it("올바른 STEP 1 데이터는 성공해야 함", () => {
      const valid = {
        brand_id: "b1111111-1111-1111-a111-111111111111",
        content_goal: "SEARCH_TRAFFIC",
        platforms: ["WORDPRESS", "NAVER_BLOG"],
        category: "IT / 개발",
        content_type: "INFORMATIONAL",
        target_audience: "개발자 지망생",
        audience_stage: "관심 단계",
      };
      const result = step1Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("브랜드 선택 누락 및 플랫폼 공백은 실패해야 함", () => {
      const invalid = {
        brand_id: "invalid-uuid",
        content_goal: "SEARCH_TRAFFIC",
        platforms: [], // 1개 필수
        category: "IT",
        content_type: "INFORMATIONAL",
        target_audience: "독자",
        audience_stage: "단계",
      };
      const result = step1Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // STEP 2 검증
  describe("step2Schema (주제와 키워드)", () => {
    it("주제, 제목, 핵심 키워드는 필수임", () => {
      const valid = {
        title: "스마트 마케팅 포스팅 기획",
        topic: "AI를 이용한 블로그 작성 자동화의 실용성",
        primary_keyword: "AI 블로그",
        secondary_keywords: ["마케팅 자동화", "Next.js"],
        excluded_keywords: [],
        region_name: "",
        product_name: "",
        required_points: "",
        forbidden_phrases: [],
        source_notes: "",
      };
      const result = step2Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("필수 키워드가 비어있으면 실패함", () => {
      const invalid = {
        title: "기획",
        topic: "주제",
        primary_keyword: "", // 공백
      };
      const result = step2Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // STEP 3 검증
  describe("step3Schema (사용자 경험)", () => {
    it("직접 경험 여부가 false인 경우 확인 체크박스 없이 통과해야 함", () => {
      const valid = {
        has_direct_experience: false,
        confirmed_by_user: false,
      };
      const result = step3Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("직접 경험 여부가 true인데 확인 체크박스가 false이면 에러가 나야 함", () => {
      const invalid = {
        has_direct_experience: true,
        confirmed_by_user: false, // 동의 필요
      };
      const result = step3Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("직접 경험 여부가 true이고 확인 체크박스가 true이면 통과해야 함", () => {
      const valid = {
        has_direct_experience: true,
        confirmed_by_user: true,
        usage_period: "3개월",
        motivation: "포스팅 속도 개선 필요",
      };
      const result = step3Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  // STEP 4 검증
  describe("step4Schema (콘텐츠 구성)", () => {
    it("글자 수가 100자 미만이거나 최대 한도를 넘으면 실패해야 함", () => {
      const invalid = {
        target_character_count: 50, // 100 미만
        requested_image_count: 2,
      };
      const result = step4Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("정상 범위 내의 글자 수 설정은 통과해야 함", () => {
      const valid = {
        target_character_count: 2000,
        requested_image_count: 5,
        title_candidates_count: 3,
        subheadings_count: 4,
        faq_count: 2,
        has_toc: true,
        has_table: false,
      };
      const result = step4Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  // STEP 5 검증
  describe("step5Schema (문체 설정)", () => {
    it("브랜드 기본 보이스 사용 시 가중치 합계 조건이 면제되어야 함", () => {
      const valid = {
        use_brand_voice: true,
        formal: 10,
        friendly: 10, // 합계가 100이 안 되더라도 use_brand_voice: true면 상관없음
      };
      const result = step5Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("사용자 정의 보이스 설정 시 가중치 합이 정확히 100이어야 함", () => {
      const valid = {
        use_brand_voice: false,
        formal: 50,
        friendly: 30,
        honest: 20,
        plain: 0,
        luxury: 0,
        witty: 0,
        consultant: 0,
        reviewer: 0,
        journalist: 0,
      };
      const result = step5Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("사용자 정의 보이스 설정 시 가중치 합이 100이 아니면 에러가 나야 함", () => {
      const invalid = {
        use_brand_voice: false,
        formal: 50,
        friendly: 40, // 합계 90
        honest: 0,
        plain: 0,
        luxury: 0,
        witty: 0,
        consultant: 0,
        reviewer: 0,
        journalist: 0,
      };
      const result = step5Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // STEP 6 검증
  describe("step6Schema (이미지 기획)", () => {
    it("스타일 선택이 바르면 통과해야 함", () => {
      const valid = {
        image_count: 5,
        style: "PHOTO_REALISTIC",
        aspect_ratio: "4:3",
        include_logo: true,
      };
      const result = step6Schema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("잘못된 스타일 코드 기입 시 에러가 나야 함", () => {
      const invalid = {
        image_count: 5,
        style: "INVALID_STYLE_CODE",
      };
      const result = step6Schema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
