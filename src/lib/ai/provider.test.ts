import { describe, it, expect } from "vitest";
import { MockProvider, briefOutputSchema, outlineOutputSchema, sectionOutputSchema } from "./provider";

describe("AI Provider Unit Tests (MockProvider)", () => {
  const provider = new MockProvider();

  it("should generate a brief that complies with briefOutputSchema", async () => {
    const inputs = {
      topic: "안티그래비티 SaaS",
      keywords: "AI 마케터, 글쓰기",
      brand_info: "마케팅 솔루션",
      experience_info: "",
    };
    const brief = await provider.generateBrief(null, inputs);
    const parsed = briefOutputSchema.safeParse(brief);
    expect(parsed.success).toBe(true);
    expect(brief.targetAudience).toBe("30대 직장인 마케터");
  });

  it("should generate a common outline that complies with outlineOutputSchema", async () => {
    const brief = {
      targetAudience: "독자",
      audienceProblem: "문제",
      searchIntent: "의도",
      contentGoal: "목표",
      coreAnswer: "답변",
      coreMessage: "메시지",
      supportingPoints: ["포인트"],
      proposedCta: "CTA",
      facts: ["사실"],
      restrictions: ["제한"],
      tone: "어조",
    };
    const outline = await provider.generateCommonOutline(null, brief);
    const parsed = outlineOutputSchema.safeParse(outline);
    expect(parsed.success).toBe(true);
    expect(outline.sections.length).toBeGreaterThan(0);
  });

  it("should enforce E-E-A-T guideline by not generating personal experience claims if has_experience is false", async () => {
    const context = {
      topic: "화장품 체험 리뷰",
      keywords: "수분크림",
      heading: "도입부",
      section_description: "소개글",
      preceding_sections_text: "",
      experience_info: "",
      has_experience: false, // 경험 없음
    };

    const section = await provider.generateSection(null, context);
    const parsed = sectionOutputSchema.safeParse(section);
    expect(parsed.success).toBe(true);

    const bodyText = section.body_text;
    // 경험이 없는데 "내가 직접 가봤다", "써보니", "구매했다" 사칭이 들어가면 안 됨
    expect(bodyText).not.toContain("직접 사용");
    expect(bodyText).not.toContain("직접체험");
    expect(bodyText).not.toContain("가본 생생한");
    expect(bodyText).toContain("종합 소개 정보글"); // 정보형 관점으로 우회
  });

  it("should insert direct experience points if has_experience is true", async () => {
    const context = {
      topic: "수분크림 리뷰",
      keywords: "수분크림",
      heading: "도입부",
      section_description: "소개글",
      preceding_sections_text: "",
      experience_info: "3주간 매일 저녁 도포함",
      has_experience: true, // 경험 있음
    };

    const section = await provider.generateSection(null, context);
    expect(section.body_text).toContain("체험기를 전달");
    expect(section.body_text).toContain("3주간 매일 저녁 도포함");
  });
});
