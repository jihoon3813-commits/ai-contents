import { z } from "zod";

// --- 1. Zod 출력 스키마 정의 ---

export const briefOutputSchema = z.object({
  targetAudience: z.string(),
  audienceProblem: z.string(),
  searchIntent: z.string(),
  contentGoal: z.string(),
  coreAnswer: z.string(),
  coreMessage: z.string(),
  supportingPoints: z.array(z.string()),
  proposedCta: z.string(),
  facts: z.array(z.string()),
  restrictions: z.array(z.string()),
  tone: z.string(),
});

export type BriefOutput = z.infer<typeof briefOutputSchema>;

export const outlineItemSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  item_type: z.enum(["INTRO", "HEADING", "FAQ", "CONCLUSION", "CTA"]),
  heading_level: z.number().int().min(2).max(4).default(2),
});

export const outlineOutputSchema = z.object({
  title_candidates: z.array(z.string()),
  selected_title: z.string(),
  intro_direction: z.string(),
  sections: z.array(outlineItemSchema),
  conclusion_direction: z.string(),
  cta_direction: z.string(),
});

export type OutlineOutput = z.infer<typeof outlineOutputSchema>;

export const sectionOutputSchema = z.object({
  heading: z.string(),
  body_html: z.string(),
  body_text: z.string(),
});

export type SectionOutput = z.infer<typeof sectionOutputSchema>;

export const metadataOutputSchema = z.object({
  seoTitle: z.string(),
  metaDescription: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  hashtags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type MetadataOutput = z.infer<typeof metadataOutputSchema>;

export const imagePlanOutputSchema = z.object({
  sequence_number: z.number().int(),
  role: z.string(),
  description: z.string(),
  prompt: z.string(),
  negative_prompt: z.string(),
  aspect_ratio: z.string(),
  overlay_text: z.string().default(""),
});

export type ImagePlanOutput = z.infer<typeof imagePlanOutputSchema>;

export interface QualityOutput {
  score: number;
  readability_score: number;
  seo_score: number;
  trust_score: number;
  feedback_notes: string[];
}

// --- Phase 6 Zod 스키마 추가 ---
export const evalIssueSchema = z.object({
  section_id: z.string().optional(),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  category: z.enum(["SEO", "INTENT", "QUALITY", "READABILITY", "TRUST", "PLATFORM_FIT"]),
  issue_code: z.string(),
  message: z.string(),
  suggested_action: z.string().optional(),
  auto_fix_available: z.boolean().default(false),
});

export const evalFactSchema = z.object({
  fact_text: z.string(),
  fact_type: z.enum(["USER_FACT", "SOURCE_FACT", "GENERAL_KNOWLEDGE", "AI_SUGGESTION", "NEEDS_VERIFICATION"]),
  verification_status: z.enum(["UNVERIFIED", "USER_CONFIRMED", "SOURCE_CONFIRMED", "OUTDATED", "DISPUTED"]).default("UNVERIFIED"),
});

export const evaluationOutputSchema = z.object({
  intent_score: z.number().int().min(0).max(100),
  quality_score: z.number().int().min(0).max(100),
  readability_score: z.number().int().min(0).max(100),
  technical_seo_score: z.number().int().min(0).max(100),
  trust_score: z.number().int().min(0).max(100),
  platform_fit_score: z.number().int().min(0).max(100),
  overall_score: z.number().int().min(0).max(100),
  keyword_density: z.record(z.string(), z.number()),
  repetition_rate: z.number().min(0).max(100),
  issues: z.array(evalIssueSchema),
  facts: z.array(evalFactSchema),
});

export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

export const autoFixOutputSchema = z.object({
  originalText: z.string(),
  newText: z.string(),
  explanation: z.string().default(""),
  updatedFields: z.record(z.string(), z.any()).default({}),
});

export type AutoFixOutput = z.infer<typeof autoFixOutputSchema>;

// --- 2. AI Provider 인터페이스 선언 ---

export interface AIProviderInterface {
  generateBrief(promptTemplate: any, inputs: { topic: string; keywords: string; brand_info: string; experience_info: string }): Promise<BriefOutput>;
  generateCommonOutline(promptTemplate: any, brief: BriefOutput): Promise<OutlineOutput>;
  generatePlatformOutline(promptTemplate: any, commonOutline: OutlineOutput, platformCode: string, rules: any): Promise<OutlineOutput>;
  generateSection(promptTemplate: any, context: { topic: string; keywords: string; heading: string; section_description: string; preceding_sections_text: string; experience_info: string; has_experience: boolean }): Promise<SectionOutput>;
  generatePlatformMetadata(promptTemplate: any, platformCode: string, bodyText: string): Promise<MetadataOutput>;
  generateImagePlan(promptTemplate: any, platformCode: string, bodyText: string, imageStyle: string, imageCount: number): Promise<ImagePlanOutput[]>;
  evaluateBasicQuality(bodyText: string): Promise<QualityOutput>;
  evaluateContent(promptTemplate: any, bodyText: string, title: string, platformCode: string, briefContext: string): Promise<EvaluationOutput>;
  autoFixContent(bodyText: string, title: string, issue: any, platformCode: string): Promise<AutoFixOutput>;
}

// --- 3. MockProvider 클래스 구현 ---

export class MockProvider implements AIProviderInterface {
  async generateBrief(promptTemplate: any, inputs: { topic: string; keywords: string; brand_info: string; experience_info: string }): Promise<BriefOutput> {
    return {
      targetAudience: "30대 직장인 마케터",
      audienceProblem: "소셜 채널 발행 원고 작성 리소스 및 시간 부족",
      searchIntent: "마케팅 자동화 도구를 찾고 효율적으로 기획하는 방법 탐색",
      contentGoal: "AI 컨텐츠 봇 SaaS 유도",
      coreAnswer: "AI 컨텐츠 봇 콘텐츠 비서로 원고 제작 시간을 90% 아끼는 솔루션 제안",
      coreMessage: "글쓰기 중력을 벗어나는 극도의 시간 효율성 확보",
      supportingPoints: [
        "1. 플랫폼별 100% 맞춤 독립 생성 알고리즘",
        "2. 리얼 내돈내산 경험담 이식으로 E-E-A-T 확보",
        "3. 6단계 위자드 마법사로 안전하고 신뢰할 수 있는 제획"
      ],
      proposedCta: "지금 AI 컨텐츠 봇 가입하고 첫 무료 콘텐츠 5개 생성해 보세요!",
      facts: inputs.experience_info ? [inputs.experience_info] : ["AI 컨텐츠 봇 마케팅 툴은 Next.js 기반 반응형 웹 앱이다."],
      restrictions: ["경험 사실이 누락된 경우 거짓 사용 후기 서술 금지"],
      tone: "차분하면서 신뢰를 주는 공식적인 대화형 말투",
    };
  }

  async generateCommonOutline(promptTemplate: any, brief: BriefOutput): Promise<OutlineOutput> {
    return {
      title_candidates: [
        "마케팅 글쓰기 지옥 탈출기: AI 콘텐츠 비서로 90% 시간 아끼기",
        "블로그 1일 1포스팅이 쉬워진다! AI 자동 카피라이터 활용법",
        "E-E-A-T 검색 노출 최적화의 열쇠: 리얼 경험담 콘텐츠 생성법"
      ],
      selected_title: "마케팅 글쓰기 지옥 탈출기: AI 콘텐츠 비서로 90% 시간 아끼기",
      intro_direction: "바쁜 소상공인 마케터들이 겪는 블로그 작작 스트레스 공감대 형성",
      sections: [
        { title: "도입부", description: "지속 가능한 채널 발행의 애로사항 지적", item_type: "INTRO", heading_level: 2 },
        { title: "1. 플랫폼별로 본문을 완전히 새로 써야 하는 이유", description: "단순 복사 붙여넣기의 검색엔진 패널티 지적", item_type: "HEADING", heading_level: 2 },
        { title: "2. AI 컨텐츠 봇 AI 자동화 솔루션 소개", description: "6단계 기획 마법사와 보이스 어조 믹서 작동법", item_type: "HEADING", heading_level: 2 },
        { title: "자주 묻는 질문 (FAQ)", description: "요금제 한도 및 API 호출 보안 관련 질문", item_type: "FAQ", heading_level: 2 },
        { title: "결론", description: "중력을 벗어난 창작 라이프 지향 권고", item_type: "CONCLUSION", heading_level: 2 }
      ],
      conclusion_direction: "무료 체험을 통해 생산성 혁신을 직접 체감할 것을 독려",
      cta_direction: "AI 컨텐츠 봇 무료 가입 링크 및 혜택 배지 표출"
    };
  }

  async generatePlatformOutline(promptTemplate: any, commonOutline: OutlineOutput, platformCode: string, rules: any): Promise<OutlineOutput> {
    // 플랫폼 맞춤형 개요 흉내
    const sections = commonOutline.sections.map((sec) => {
      if (platformCode === "INSTAGRAM") {
        return {
          ...sec,
          title: `[인스타 슬라이드] ${sec.title}`,
        };
      }
      return sec;
    });

    return {
      ...commonOutline,
      selected_title: `[${platformCode}] ${commonOutline.selected_title}`,
      sections,
    };
  }

  async generateSection(
    promptTemplate: any,
    context: { topic: string; keywords: string; heading: string; section_description: string; preceding_sections_text: string; experience_info: string; has_experience: boolean }
  ): Promise<SectionOutput> {
    let bodyHtml = "";
    let bodyText = "";

    // E-E-A-T 검사 규칙 모사: 경험담이 없는데 경험을 사칭하려 하면 일반 정보 수집 글로 변경하여 허위 정보 억제
    const isDeceptiveAttempt = !context.has_experience && (context.topic.includes("리뷰") || context.topic.includes("체험"));
    
    if (context.heading.includes("도입부") || context.heading.includes("INTRO")) {
      if (isDeceptiveAttempt) {
        bodyText = `본 글은 해당 제품에 대한 일반 정보를 바탕으로 구성한 종합 소개 정보글입니다. 최근 핫한 테마인 ${context.topic}에 대해 대중적인 여론과 공인 스펙 정보를 알기 쉽게 모아 정리해 드리겠습니다.`;
      } else if (context.has_experience && context.experience_info) {
        bodyText = `안녕하세요! 제가 실제로 ${context.experience_info}를 겪어본 생생한 체험기를 전달해 드립니다. 직접 사용하며 느낀 장단점을 가감 없이 공유하겠습니다.`;
      } else {
        bodyText = `안녕하세요! 오늘은 많은 분들이 관심을 가지고 계신 ${context.topic} 주제에 대해 핵심만 명료하게 요약해 전해드립니다.`;
      }
    } else if (context.heading.includes("FAQ")) {
      bodyText = `Q: 정말 90% 이상 시간이 단축되나요?\nA: 네, 마법사를 활용하면 10분 만에 3개 채널 맞춤 초안이 완벽히 추출되어 편집 리소스를 획기적으로 줄여줍니다.`;
    } else if (context.heading.includes("결론") || context.heading.includes("CONCLUSION")) {
      bodyText = `결론적으로 ${context.keywords}의 정답은 사전 기획의 깊이에 있습니다. 지금 바로 도구를 활용해 더 큰 가치를 창출해 보시기 바랍니다.`;
    } else {
      bodyText = `이번 문단에서는 ${context.heading}에 대해 다룹니다. 핵심 요약 설명: ${context.section_description || "세부 내용 준비 중"}. 키워드인 [${context.keywords}]를 유연하게 배합하여 가독성 높은 칼럼 스타일로 채워 나갑니다.`;
    }

    bodyHtml = `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>`;

    return {
      heading: context.heading,
      body_html: bodyHtml,
      body_text: bodyText,
    };
  }

  async generatePlatformMetadata(promptTemplate: any, platformCode: string, bodyText: string): Promise<MetadataOutput> {
    return {
      seoTitle: `[SEO 최적화] 마케팅 원고 효율적으로 쓰는 방법 (채널: ${platformCode})`,
      metaDescription: "AI 컨텐츠 봇 SaaS 콘텐츠 기획 마법사를 사용하여 3개 채널 맞춤 본문 원고를 실시간으로 빠르게 제작하는 지침서입니다.",
      slug: `marketing-automation-brief-${platformCode.toLowerCase()}`,
      excerpt: "블로그 기획부터 발행까지, AI 자동 작가 어조 조율 믹서로 다채널 마케팅을 성공시키는 방법론을 소개합니다.",
      hashtags: ["마케팅자동화", "콘텐츠제작", "AI컨텐츠봇"],
      categories: ["IT / 테크"],
      tags: ["AI", "SaaS", "글쓰기"],
    };
  }

  async generateImagePlan(promptTemplate: any, platformCode: string, bodyText: string, imageStyle: string, imageCount: number): Promise<ImagePlanOutput[]> {
    const plans: ImagePlanOutput[] = [];
    const count = imageCount > 0 ? imageCount : 1;

    for (let i = 1; i <= count; i++) {
      plans.push({
        sequence_number: i,
        role: i === 1 ? "메인 대표 썸네일 커버" : `본문 이해를 돕기 위한 보조 삽입용 이미지 ${i}`,
        description: `기획에 매핑된 ${imageStyle} 풍의 ${i}번째 이미지 레이아웃 구성`,
        prompt: `Premium high quality ${imageStyle.toLowerCase()} style graphic showing a clean office workspace, neon lights, pastel colors, professional digital art, 8k resolution`,
        negative_prompt: `worst quality, blurry, disfigured, extra limbs, text, logo, signature`,
        aspect_ratio: platformCode === "INSTAGRAM" ? "1:1" : "16:9",
        overlay_text: i === 1 ? "콘텐츠 작작 꿀팁 대방출" : "",
      });
    }

    return plans;
  }

  async evaluateBasicQuality(bodyText: string): Promise<QualityOutput> {
    return {
      score: 85,
      readability_score: 90,
      seo_score: 80,
      trust_score: 85,
      feedback_notes: [
        "키워드 분배가 조화로우며 소제목 배치가 독자의 가독성을 극대화합니다.",
        "인라인 이미지 기획이 적재적소에 배치되어 스크롤 잔존율 향상이 예상됩니다."
      ],
    };
  }

  async evaluateContent(
    promptTemplate: any,
    bodyText: string,
    title: string,
    platformCode: string,
    briefContext: string
  ): Promise<EvaluationOutput> {
    const intent_score = 80;
    const quality_score = 85;
    const readability_score = 90;
    const technical_seo_score = 80;
    const trust_score = 85;
    const platform_fit_score = 85;
    
    let overall_score = 80;
    if (platformCode === "INSTAGRAM") {
      overall_score = Math.round(
        intent_score * 0.25 +
        quality_score * 0.25 +
        readability_score * 0.20 +
        technical_seo_score * 0.05 +
        trust_score * 0.10 +
        platform_fit_score * 0.15
      );
    } else {
      overall_score = Math.round(
        intent_score * 0.25 +
        quality_score * 0.20 +
        readability_score * 0.15 +
        technical_seo_score * 0.15 +
        trust_score * 0.15 +
        platform_fit_score * 0.10
      );
    }

    const keyword_density: Record<string, number> = {
      "인공지능 글쓰기": 2.5,
      "AI컨텐츠봇": 1.2
    };

    const issues: any[] = [];
    
    if (!title || title.length < 10) {
      issues.push({
        severity: "WARNING",
        category: "SEO",
        issue_code: "TOO_SHORT_TITLE",
        message: "제목이 너무 짧습니다. 최소 10자 이상 작성을 권장합니다.",
        suggested_action: "핵심 소구점과 키워드를 포함하여 더 매력적인 제목으로 늘려주세요.",
        auto_fix_available: true
      });
    }

    if (bodyText.includes("무조건") || bodyText.includes("100%")) {
      issues.push({
        severity: "CRITICAL",
        category: "TRUST",
        issue_code: "OVER_PROMOTIONAL_CLAIMS",
        message: "본문에 '무조건', '100%' 등 과도한 홍보 및 보장성 표현이 검출되어 검색엔진 필터에 제약을 받을 수 있습니다.",
        suggested_action: "과장 표현을 '합리적으로', '안전하게' 등 완화된 표현으로 수정하세요.",
        auto_fix_available: true
      });
    }

    if (bodyText.includes("매우매우 길고 장황하여")) {
      issues.push({
        severity: "WARNING",
        category: "READABILITY",
        issue_code: "TOO_LONG_SENTENCE",
        message: "가독성을 저해하는 120자 이상의 장문이 검출되었습니다.",
        suggested_action: "긴 문장을 두 개의 짧은 문장으로 나누어 다듬어 주세요.",
        auto_fix_available: true
      });
    }

    const facts = [
      {
        fact_text: "AI 콘텐츠 봇은 10분만에 3개 채널 맞춤 초안을 완벽히 추출합니다.",
        fact_type: "NEEDS_VERIFICATION" as const,
        verification_status: "UNVERIFIED" as const
      },
      {
        fact_text: "AI 콘텐츠 봇 마케팅 툴은 Next.js 기반 반응형 웹 앱이다.",
        fact_type: "GENERAL_KNOWLEDGE" as const,
        verification_status: "UNVERIFIED" as const
      }
    ];

    return {
      intent_score,
      quality_score,
      readability_score,
      technical_seo_score,
      trust_score,
      platform_fit_score,
      overall_score,
      keyword_density,
      repetition_rate: 4.2,
      issues,
      facts
    };
  }

  async autoFixContent(
    bodyText: string,
    title: string,
    issue: any,
    platformCode: string
  ): Promise<AutoFixOutput> {
    let originalText = bodyText;
    let newText = bodyText;
    const updatedFields: Record<string, any> = {};

    if (issue.issue_code === "TOO_SHORT_TITLE") {
      updatedFields.title = "[확장 개정판] 마케팅 글쓰기 지옥 탈출기: AI 콘텐츠 비서로 90% 시간 아끼는 현실 가이드";
    } else if (issue.issue_code === "OVER_PROMOTIONAL_CLAIMS") {
      newText = bodyText.replace(/무조건/g, "부담 없이").replace(/100%/g, "대폭");
    } else if (issue.issue_code === "TOO_LONG_SENTENCE") {
      newText = bodyText.replace(
        /어쩌구 저쩌구 120글자가 넘는 매우매우 길고 장황하여 독해를 방해하고 가독성을 심하게 훼손하는 긴 문장입니다\./g,
        "이것은 길고 장황한 문장입니다. 가독성을 위해 짧게 두 문장으로 나누어 다듬었습니다."
      );
    }

    return {
      originalText,
      newText,
      explanation: `${issue.message} 문제를 완화하기 위해 AI가 문맥을 고려하여 표현을 다듬었습니다.`,
      updatedFields
    };
  }
}

// --- 4. GeminiProvider 클래스 구현 (Raw fetch API 기반) ---

export class GeminiProvider implements AIProviderInterface {
  private apiKey: string;
  private textModel: string;
  private fastModel: string;

  constructor() {
    this.apiKey = process.env.AI_API_KEY || "";
    this.textModel = process.env.AI_TEXT_MODEL || "gemini-1.5-pro";
    this.fastModel = process.env.AI_FAST_MODEL || "gemini-1.5-flash";
  }

  // AI에게 요청을 날리는 공통 헬퍼 메서드 (responseMimeType: "application/json" 탑재)
  private async callGemini(model: string, systemPrompt: string, userPrompt: string, retryCount = 0): Promise<string> {
    if (!this.apiKey) {
      throw new Error("AI_API_KEY 환경변수가 정의되어 있지 않습니다. MockProvider를 사용하거나 키를 등록해 주세요.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2, // 구조적 정확도를 위해 온도를 낮춤
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API HTTP Error (${response.status}): ${errorText}`);
      }

      const resJson = await response.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Gemini 응답 구조에 텍스트 데이터가 포함되어 있지 않습니다.");
      }

      return text;
    } catch (err: any) {
      if (retryCount < 2) {
        // 복구 생성 재시도
        return this.callGemini(model, systemPrompt, `${userPrompt}\n\n[REPAIR NOTICE: 이전 응답이 유효하지 않은 JSON이었습니다. 형식을 정확히 정제해 주세요. 오류: ${err.message}]`, retryCount + 1);
      }
      throw err;
    }
  }

  // Zod 검증 및 JSON 복구 팩토리 메서드
  private async validateAndParse<T>(jsonStr: string, schema: z.ZodSchema<T>, systemPrompt: string, userPrompt: string): Promise<T> {
    let cleanJson = jsonStr.trim();
    // 마크다운 백틱 코드블록이 딸려 나온 경우 청소
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    try {
      const parsed = JSON.parse(cleanJson);
      return schema.parse(parsed);
    } catch (err: any) {
      // 1차 파싱 실패 시 repairStructuredOutput 마인드로 AI 복구 요청 진행
      const repairPrompt = `이전 응답 결과는 다음과 같으며 JSON 파싱 중 에러(${err.message})가 발생했습니다. 아래 지시와 이전 입력값을 참고하여 오직 유효한 JSON 형식으로만 수정 출력해 주세요.\n\n[오류난 데이터]\n${jsonStr}`;
      const repairedStr = await this.callGemini(this.fastModel, "너는 파손된 JSON 데이터를 수리하여 유효한 JSON 구조로 리턴하는 도구다. 마크다운 백틱 없이 오직 유효한 JSON 문자열만 응답해야 한다.", repairPrompt);
      
      let cleanRepaired = repairedStr.trim();
      if (cleanRepaired.startsWith("```")) {
        cleanRepaired = cleanRepaired.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }
      const repairedParsed = JSON.parse(cleanRepaired);
      return schema.parse(repairedParsed);
    }
  }

  async generateBrief(promptTemplate: any, inputs: { topic: string; keywords: string; brand_info: string; experience_info: string }): Promise<BriefOutput> {
    const system = promptTemplate?.system_prompt || "너는 마케팅 콘텐츠 기획 전문가다. 사용자가 제시한 기획 주제를 바탕으로 대상 독자, 핵심 메시지, 강점 소구점을 가진 명확한 기획 브리프를 도출해야 한다.";
    let user = promptTemplate?.user_prompt_template || "주제: {{topic}}\n키워드: {{keywords}}\n브랜드: {{brand_info}}\n경험: {{experience_info}}";
    
    user = user
      .replace("{{topic}}", inputs.topic)
      .replace("{{keywords}}", inputs.keywords)
      .replace("{{brand_info}}", inputs.brand_info)
      .replace("{{experience_info}}", inputs.experience_info || "제공된 실제 직접경험 내용 없음.");

    const res = await this.callGemini(this.textModel, system, user);
    return this.validateAndParse(res, briefOutputSchema, system, user);
  }

  async generateCommonOutline(promptTemplate: any, brief: BriefOutput): Promise<OutlineOutput> {
    const system = promptTemplate?.system_prompt || "너는 기획 브리프를 활용해 글의 기둥이 될 공통 목차 개요를 설계하는 개요 설계 전문가다. 인트로, 본문 소제목, FAQ, 결론, CTA를 정비해 구조화된 배열로 리턴해야 한다.";
    const user = `기획 브리프:\n${JSON.stringify(brief, null, 2)}\n\n위 브리프를 바탕으로 공통 개요 아웃라인을 생성해 주세요.`;

    const res = await this.callGemini(this.textModel, system, user);
    return this.validateAndParse(res, outlineOutputSchema, system, user);
  }

  async generatePlatformOutline(promptTemplate: any, commonOutline: OutlineOutput, platformCode: string, rules: any): Promise<OutlineOutput> {
    const system = promptTemplate?.system_prompt || "너는 각 마케팅 채널의 양식과 규격 정책에 맞추어 공통 목차를 채널별 최적화된 형태의 목차로 정형화하는 맞춤 개요 전문가다.";
    const user = `대상 플랫폼: ${platformCode}\n규격 규칙: ${JSON.stringify(rules)}\n공통 개요:\n${JSON.stringify(commonOutline, null, 2)}`;

    const res = await this.callGemini(this.fastModel, system, user);
    return this.validateAndParse(res, outlineOutputSchema, system, user);
  }

  async generateSection(
    promptTemplate: any,
    context: { topic: string; keywords: string; heading: string; section_description: string; preceding_sections_text: string; experience_info: string; has_experience: boolean }
  ): Promise<SectionOutput> {
    const system = promptTemplate?.system_prompt || "너는 지정된 목차 단락의 설명과 전후 문맥을 인용하여 끊김 없고 매끄러운 단락 본문 원고를 작성하는 전문 작가다. 리치 텍스트 표현을 위해 p, strong, ul, li 태그를 배합한 HTML로 본문을 작성해야 한다.";
    
    // E-E-A-T 준수 사항 삽입
    let restriction = "";
    if (!context.has_experience) {
      restriction = "\n[중요 지시사항: 사용자가 직접 방문/구매/경험했다고 사칭하는 직접 체험 수기형 말투('내가 어제 가봤는데', '제가 써보니' 등)를 절대 기술하지 마십시오. 오직 객관적인 정보 요약 형태로 서술해야 합니다.]";
    }

    const user = `주제: ${context.topic}\n키워드: ${context.keywords}\n이번 단락 제목: ${context.heading}\n이번 단락 기술 방향: ${context.section_description}\n이전 단락 내용들:\n${context.preceding_sections_text}\n실사용자 직접경험 정보: ${context.experience_info || "없음"}${restriction}`;

    const res = await this.callGemini(this.textModel, system, user);
    return this.validateAndParse(res, sectionOutputSchema, system, user);
  }

  async generatePlatformMetadata(promptTemplate: any, platformCode: string, bodyText: string): Promise<MetadataOutput> {
    const system = promptTemplate?.system_prompt || "너는 완성된 본문을 분석해 검색엔진 상위 랭크를 위한 최적의 SEO 제목, 메타 설명, 웹 슬러그, 해시태그를 도출하는 마케팅 SEO 전문가다.";
    const user = `대상 플랫폼: ${platformCode}\n완성된 원고 텍스트:\n${bodyText}`;

    const res = await this.callGemini(this.fastModel, system, user);
    return this.validateAndParse(res, metadataOutputSchema, system, user);
  }

  async generateImagePlan(promptTemplate: any, platformCode: string, bodyText: string, imageStyle: string, imageCount: number): Promise<ImagePlanOutput[]> {
    const system = promptTemplate?.system_prompt || "너는 원고 본문을 분석하여 적재적소에 들어갈 이미지 구성 계획을 기획하는 미디어 비주얼 마케터다.";
    const user = `대상 플랫폼: ${platformCode}\n이미지 스타일: ${imageStyle}\n필요 이미지 장수: ${imageCount}\n원고 내용:\n${bodyText}`;

    const res = await this.callGemini(this.fastModel, system, user);
    return this.validateAndParse(res, z.array(imagePlanOutputSchema), system, user);
  }

  async evaluateBasicQuality(bodyText: string): Promise<QualityOutput> {
    const system = "너는 콘텐츠의 문장 완성도, 가독성, 검색엔진 최적화(SEO) 지수, 신뢰성(E-E-A-T) 점수를 평가하고 피드백을 전달하는 품질 보증 전문가다.";
    const user = `텍스트:\n${bodyText}`;

    const res = await this.callGemini(this.fastModel, system, user);
    const qualitySchema = z.object({
      score: z.number(),
      readability_score: z.number(),
      seo_score: z.number(),
      trust_score: z.number(),
      feedback_notes: z.array(z.string()),
    });
    return this.validateAndParse(res, qualitySchema, system, user);
  }

  async evaluateContent(
    promptTemplate: any,
    bodyText: string,
    title: string,
    platformCode: string,
    briefContext: string
  ): Promise<EvaluationOutput> {
    const system = promptTemplate?.system_prompt || `너는 콘텐츠의 검색 의도, 품질(E-E-A-T), 가독성, 기술 SEO, 신뢰도, 플랫폼 적합성을 정량적으로 평가하고 발견된 문제점 및 팩트체크 대상 문구를 지목하는 품질 평가 및 교정 전문가다.
반드시 제공된 output_schema JSON 규격으로만 응답해야 한다.`;

    const user = `제목: ${title}
대상 플랫폼: ${platformCode}
기획 브리프 맥락: ${briefContext}
본문 텍스트:
${bodyText}

[평가 요구사항]
1. 6개 세부 점수(intent, quality, readability, technical_seo, trust, platform_fit)를 0~100 사이로 책정하고 가중치를 연산해 overall_score를 계산해라.
2. 발견한 문제점(이슈)들을 severity(INFO, WARNING, CRITICAL), category, issue_code, message, suggested_action, auto_fix_available를 포함하는 리스트로 리턴해라.
3. 숫자가 포함되거나, 가격/날짜/퍼센트가 있거나, '최고', '최저', '유일', '최초' 등 과장 표현이 사용되어 팩트 확인이 필요한 문구들을 추출해 facts 리스트에 담아라.
4. 반복률(repetition_rate)과 키워드 밀도(keyword_density)도 연산해라.`;

    const res = await this.callGemini(this.textModel, system, user);
    return this.validateAndParse(res, evaluationOutputSchema, system, user);
  }

  async autoFixContent(
    bodyText: string,
    title: string,
    issue: any,
    platformCode: string
  ): Promise<AutoFixOutput> {
    const system = `너는 콘텐츠 품질 이슈를 해결하기 위해 텍스트를 자동으로 교정하고 다듬는 글쓰기 교정 편집자다.
반드시 아래 스키마에 따라 JSON으로만 응답해야 한다.
schema: {
  originalText: string,
  newText: string,
  explanation: string,
  updatedFields: { [key: string]: any }
}`;

    const user = `수정 대상 이슈 카테고리: ${issue.category}
이슈 코드: ${issue.issue_code}
수정 필요 메시지: ${issue.message}
권장 개선안: ${issue.suggested_action}
현재 콘텐츠 제목: ${title}
대상 플랫폼: ${platformCode}
본문 텍스트:
${bodyText}`;

    const res = await this.callGemini(this.fastModel, system, user);
    return this.validateAndParse(res, autoFixOutputSchema, system, user);
  }
}

// --- 5. AI Provider 팩토리 헬퍼 선언 ---

export function getAIProvider(): AIProviderInterface {
  const provider = process.env.AI_PROVIDER || "MOCK";
  if (provider.toUpperCase() === "GEMINI") {
    return new GeminiProvider();
  }
  // 기본 혹은 지정 없을 시 MockProvider 반환
  return new MockProvider();
}
