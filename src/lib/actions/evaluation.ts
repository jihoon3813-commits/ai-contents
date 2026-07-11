"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAIProvider, EvaluationOutput } from "@/lib/ai/provider";
import { verifyWorkspaceMembership } from "./generation";

// ==========================================
// 1. 콘텐츠 정밀 평가 실행 Action
// ==========================================
export async function evaluateContent(platformContentId: string) {
  const supabase = await createClient();

  // 1. 플랫폼 콘텐츠 데이터 로드
  const { data: content, error: contentErr } = await supabase
    .from("platform_contents")
    .select("*, platforms(*)")
    .eq("id", platformContentId)
    .single();

  if (contentErr || !content) {
    throw new Error(`플랫폼 콘텐츠를 찾을 수 없습니다: ${contentErr?.message}`);
  }

  // 2. 권한 검증
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 3. 프로젝트 및 브랜드, 브리프 로드
  const { data: project, error: projErr } = await supabase
    .from("content_projects")
    .select("*, content_briefs(*)")
    .eq("id", content.project_id)
    .single();

  if (projErr || !project) {
    throw new Error(`프로젝트 조회를 실패했습니다: ${projErr?.message || "프로젝트가 존재하지 않습니다."}`);
  }

  const title: string = content.title || "";
  const bodyText: string = content.body_text || "";
  const bodyHtml: string = content.body_html || "";
  const platformCode: string = content.platforms?.code || "WORDPRESS";

  // --- [1단계] 로컬 규칙 기반 1차 검사 ---
  const localIssues: any[] = [];
  const localFacts: any[] = [];

  // (1) 제목 검사
  if (!title.trim()) {
    localIssues.push({
      severity: "CRITICAL",
      category: "SEO",
      issue_code: "EMPTY_TITLE",
      message: "콘텐츠 제목이 누락되었습니다.",
      suggested_action: "콘텐츠 제목 필드를 필히 입력해 주세요."
    });
  } else if (title.length < 10 || title.length > 50) {
    localIssues.push({
      severity: "WARNING",
      category: "SEO",
      issue_code: "TITLE_LENGTH_OUT_OF_RANGE",
      message: `제목 길이(${title.length}자)가 비정상적입니다. (10자~50자 권장)`,
      suggested_action: "검색엔진 가독성 및 노출 최적화를 위해 제목 길이를 10자에서 50자 이내로 조정해 주세요."
    });
  }

  // (2) 글자 수 검사
  const charCount = bodyText.replace(/\s+/g, "").length;
  if (platformCode === "WORDPRESS" || platformCode === "TISTORY") {
    if (charCount < 800) {
      localIssues.push({
        severity: "WARNING",
        category: "QUALITY",
        issue_code: "SHORT_CONTENT_LENGTH",
        message: `본문 글자 수(${charCount}자)가 너무 적습니다. (800자 이상 권장)`,
        suggested_action: "글의 깊이와 정보 제공 신뢰성 확보를 위해 글자 수를 보강해 주세요."
      });
    }
  } else if (platformCode === "NAVER_BLOG") {
    if (charCount < 1000) {
      localIssues.push({
        severity: "WARNING",
        category: "QUALITY",
        issue_code: "SHORT_CONTENT_LENGTH_NAVER",
        message: `네이버 블로그 본문 글자 수(${charCount}자)가 적습니다. (1000자 이상 권장)`,
        suggested_action: "충실한 체류 시간 확보를 위해 이미지 기획과 함께 텍스트 분량을 보충해 주세요."
      });
    }
  } else if (platformCode === "BLOGGER") {
    if (charCount < 600) {
      localIssues.push({
        severity: "WARNING",
        category: "QUALITY",
        issue_code: "SHORT_CONTENT_LENGTH_BLOGGER",
        message: `Blogger 본문 글자 수(${charCount}자)가 적습니다. (600자 이상 권장)`,
        suggested_action: "기초 정보 전달을 위해 글을 추가 기술해 주세요."
      });
    }
  } else if (platformCode === "INSTAGRAM") {
    if (bodyText.length > 2200) {
      localIssues.push({
        severity: "WARNING",
        category: "PLATFORM_FIT",
        issue_code: "CAPTION_TOO_LONG",
        message: `인스타그램 캡션 글자 수(${bodyText.length}자)가 정책 한도(2200자)를 초과합니다.`,
        suggested_action: "인스타그램 캡션을 요약 정리하거나 불필요한 줄바꿈을 제거해 주세요."
      });
    }
  }

  // (3) 긴 문장 / 긴 문단 검사
  const sentences = bodyText.split(/[.?!]+/).map((s: string) => s.trim()).filter(Boolean);
  sentences.forEach((s) => {
    if (s.length > 120) {
      localIssues.push({
        severity: "WARNING",
        category: "READABILITY",
        issue_code: "TOO_LONG_SENTENCE",
        message: `가독성이 매우 저해되는 긴 문장이 검출되었습니다: "${s.substring(0, 20)}..."`,
        suggested_action: "120자가 넘어 독자가 읽기 어려운 긴 문장은 두 개 이상의 짧은 문장으로 쪼개서 정리해 주세요.",
        auto_fix_available: true
      });
    }
  });

  const paragraphs = bodyHtml.split(/<\/p>|<br\s*\/?>/i).map(p => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
  paragraphs.forEach((p) => {
    if (p.length > 400) {
      localIssues.push({
        severity: "WARNING",
        category: "READABILITY",
        issue_code: "TOO_LONG_PARAGRAPH",
        message: `단일 문단 텍스트 분량(${p.length}자)이 한눈에 읽기 어렵습니다.`,
        suggested_action: "문단 구분을 지어주거나 중간에 개행을 추가해 여백을 확보해 주세요."
      });
    }
  });

  // (4) Heading 계층구조 검사
  if (bodyHtml.match(/<h1/i)) {
    localIssues.push({
      severity: "WARNING",
      category: "SEO",
      issue_code: "H1_IN_BODY",
      message: "본문 내에 H1 태그 제목이 검출되었습니다. 페이지당 H1은 하나(글 전체 제목)여야 합니다.",
      suggested_action: "본문 내 H1 제목 태그를 H2나 H3로 낮추어 계층구조를 표준화하세요."
    });
  }

  // (5) 키워드 밀도 검사
  const primaryKw = project.primary_keyword;
  const secondaryKws = project.secondary_keywords || [];
  const allKeywords = [primaryKw, ...secondaryKws].filter(Boolean);
  const keywordDensityMap: Record<string, number> = {};
  let totalKeywordHits = 0;

  allKeywords.forEach((kw) => {
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const matches = bodyText.match(regex) || [];
    const density = bodyText.length > 0 ? (matches.length * kw.length) / bodyText.length * 100 : 0;
    keywordDensityMap[kw] = parseFloat(density.toFixed(2));
    totalKeywordHits += matches.length;

    if (density > 4.0) {
      localIssues.push({
        severity: "WARNING",
        category: "SEO",
        issue_code: "KEYWORD_STUFFING",
        message: `키워드 "${kw}"의 밀도(${density.toFixed(1)}%)가 과다합니다. (4% 이하 권장)`,
        suggested_action: "스팸 필터링을 방지하기 위해 해당 키워드 표현 중 일부를 자연스러운 동의어로 바꾸거나 제거해 주세요.",
        auto_fix_available: true
      });
    }
  });

  if (bodyText.length > 0 && totalKeywordHits === 0) {
    localIssues.push({
      severity: "WARNING",
      category: "SEO",
      issue_code: "NO_KEYWORDS_FOUND",
      message: "본문에 타겟 지정 주요 키워드가 단 하나도 등장하지 않습니다.",
      suggested_action: "검색 노출을 확보하기 위해 제목 및 서두 부분에 지정 키워드를 적절히 분배해 주세요."
    });
  }

  // (6) 한국어 문법적 반복 검사
  // 어미 연속 반복 검사 (예: ~합니다, ~습니다가 연속 3번 이상 사용)
  let consecutiveSuffix = 0;
  let lastSuffixGroup = "";
  sentences.forEach((s) => {
    let currentGroup = "";
    if (s.endsWith("합니다") || s.endsWith("습니다") || s.endsWith("입니다")) {
      currentGroup = "HONORIFIC_NIDA";
    } else if (s.endsWith("해요") || s.endsWith("세요")) {
      currentGroup = "HONORIFIC_YO";
    } else if (s.endsWith("한다") || s.endsWith("했다") || s.endsWith("이다")) {
      currentGroup = "CASUAL_DA";
    }

    if (currentGroup && currentGroup === lastSuffixGroup) {
      consecutiveSuffix++;
      if (consecutiveSuffix >= 3) {
        localIssues.push({
          severity: "WARNING",
          category: "READABILITY",
          issue_code: "REPETITIVE_SENTENCE_ENDING",
          message: `동일한 스타일의 문장 종결 어미(${currentGroup === "HONORIFIC_NIDA" ? "습니다/합니다" : "한다/했다"})가 3회 이상 연속 노출되어 문맥이 단조롭습니다.`,
          suggested_action: "어미를 '~해보세요', '~할 수 있습니다', '~해보시길 추천합니다' 등으로 다양하게 다채롭게 번갈아가며 사용해 주세요.",
          auto_fix_available: true
        });
        consecutiveSuffix = 0; // 중복 경보 방지
      }
    } else {
      consecutiveSuffix = 1;
      lastSuffixGroup = currentGroup;
    }
  });

  // 동일 접속사 연속 사용 검사
  let lastConj = "";
  sentences.forEach((s) => {
    const conjList = ["그리고", "하지만", "그러나", "그래서", "또한", "그런데", "따라서"];
    let startConj = "";
    for (const c of conjList) {
      if (s.startsWith(c)) {
        startConj = c;
        break;
      }
    }

    if (startConj && startConj === lastConj) {
      localIssues.push({
        severity: "WARNING",
        category: "READABILITY",
        issue_code: "CONSECUTIVE_CONJUNCTIONS",
        message: `동일한 접속사 "${startConj}"가 두 문장 연속으로 시작 부분에 남발되었습니다.`,
        suggested_action: "대체 지시형 표현을 쓰거나 접속 문구를 제거하여 흐름을 깔끔하게 만들어 주세요.",
        auto_fix_available: true
      });
    }
    lastConj = startConj;
  });

  // (7) 이미지 ALT 검사
  if (platformCode !== "INSTAGRAM" && bodyHtml.includes("<img")) {
    const missingAltCount = (bodyHtml.match(/<img[^>]+(?!alt=)[^>]*>/gi) || []).length + 
                           (bodyHtml.match(/alt=""/gi) || []).length;
    if (missingAltCount > 0) {
      localIssues.push({
        severity: "WARNING",
        category: "SEO",
        issue_code: "MISSING_IMAGE_ALT",
        message: `${missingAltCount}개의 이미지에 웹 접근성 ALT 대체 텍스트 설명이 누락되어 있습니다.`,
        suggested_action: "검색엔진 이미지 크롤링 색인 최적화 및 접근성을 위해 img 태그에 alt 설명을 추가해 주세요.",
        auto_fix_available: true
      });
    }
  }

  // (8) CTA 검사
  if (project.content_goal === "SEARCH_TRAFFIC" || project.content_goal === "CONVERSION") {
    if (!content.cta_text && !bodyHtml.includes("href") && !bodyHtml.includes("cta")) {
      localIssues.push({
        severity: "WARNING",
        category: "INTENT",
        issue_code: "MISSING_CTA_LINK",
        message: "독자의 행동 유도를 이끄는 핵심 CTA 행동 촉구 링크나 버튼 기획이 식별되지 않습니다.",
        suggested_action: "원고 최하단 영역에 사이트 바로가기나 가입 혜택 유도 링크 및 CTA 라인을 삽입해 주세요.",
        auto_fix_available: true
      });
    }
  }

  // (9) 브랜드 금지 표현 검출
  const forbiddenList = project.forbidden_phrases || [];
  forbiddenList.forEach((fp: string) => {
    if (bodyText.includes(fp) || title.includes(fp)) {
      localIssues.push({
        severity: "CRITICAL",
        category: "TRUST",
        issue_code: `FORBIDDEN_PHRASE_DETECTED`,
        message: `브랜드 금지 단어/문구 "${fp}"가 콘텐츠 내부에서 검출되었습니다.`,
        suggested_action: "금지 표현 규정 준수를 위해 원고 본문 또는 제목에서 해당 표현을 즉각 다른 단어로 수정하거나 완전히 삭제해 주세요."
      });
    }
  });

  // (10) 로컬 팩트 검출 (숫자, 가격, 퍼센트, 최고/최초 등 과장 표현)
  const numberRegex = /\b\d{2,}[\d,]*\b/g;
  const priceRegex = /\b\d+[\d,]*원\b|\d+달러|\b만원\b/g;
  const pctRegex = /\b\d+%\b|\b퍼센트\b/g;
  const superlatives = ["최고", "최저", "최초", "유일", "보장", "무조건", "공식", "인증", "치료", "절감", "수익", "할인", "100%"];

  const matchedNumbers = bodyText.match(numberRegex) || [];
  const matchedPrices = bodyText.match(priceRegex) || [];
  const matchedPct = bodyText.match(pctRegex) || [];

  const foundFactsTexts = new Set<string>();

  // 문장별로 팩트체크 후보 추출
  sentences.forEach((s) => {
    let hasFactKeyword = false;
    for (const sup of superlatives) {
      if (s.includes(sup)) {
        hasFactKeyword = true;
        break;
      }
    }
    const hasNum = numberRegex.test(s) || priceRegex.test(s) || pctRegex.test(s);
    
    if (hasFactKeyword || hasNum) {
      if (s.length > 10 && s.length < 150) {
        foundFactsTexts.add(s);
      }
    }
  });

  foundFactsTexts.forEach((ft) => {
    localFacts.push({
      fact_text: ft,
      fact_type: "NEEDS_VERIFICATION",
      verification_status: "UNVERIFIED"
    });
  });

  // --- [2단계] AI 기반 심층 평가 연동 ---
  const aiProvider = getAIProvider();
  const briefContext = JSON.stringify({
    audience: project.target_audience,
    intent: project.content_briefs?.search_intent,
    goal: project.content_goal,
    keywords: [project.primary_keyword, ...project.secondary_keywords]
  });

  let aiResult: EvaluationOutput;
  try {
    aiResult = await aiProvider.evaluateContent(
      null, // Prompt template is resolved inside or defaults
      bodyText,
      title,
      platformCode,
      briefContext
    );
  } catch (err: any) {
    console.error("AI 평가 호출 실패: ", err.message);
    // AI 실패 시 로컬 기본 점수로 구성
    aiResult = {
      intent_score: 80,
      quality_score: 80,
      readability_score: 80,
      technical_seo_score: 80,
      trust_score: 80,
      platform_fit_score: 80,
      overall_score: 80,
      keyword_density: keywordDensityMap,
      repetition_rate: 3.5,
      issues: [],
      facts: []
    };
  }

  // --- [3단계] 로컬 및 AI 평가 병합 ---
  const combinedIssues = [...localIssues];
  // AI 이슈 병합 시 로컬 이슈 코드 중복 방지
  aiResult.issues.forEach((aiIssue) => {
    const exists = combinedIssues.some(li => li.issue_code === aiIssue.issue_code);
    if (!exists) {
      combinedIssues.push(aiIssue);
    }
  });

  const combinedFacts = [...localFacts];
  aiResult.facts.forEach((aiFact) => {
    const exists = combinedFacts.some(lf => lf.fact_text === aiFact.fact_text);
    if (!exists) {
      combinedFacts.push(aiFact);
    }
  });

  // --- [4단계] 데이터베이스 적재 ---
  // (1) 기존 평가 데이터 정리 삭제 (Cascade 구조이므로 evaluation 지우면 issue도 정리됨)
  const { data: oldEvals } = await supabase
    .from("content_evaluations")
    .select("id")
    .eq("platform_content_id", platformContentId);

  if (oldEvals && oldEvals.length > 0) {
    const oldIds = oldEvals.map(e => e.id);
    await supabase.from("content_evaluations").delete().in("id", oldIds);
  }

  // (2) content_evaluations 적재
  const { data: newEval, error: evalInsertErr } = await supabase
    .from("content_evaluations")
    .insert({
      platform_content_id: platformContentId,
      evaluation_version: content.current_version_number || 1,
      intent_score: aiResult.intent_score,
      quality_score: aiResult.quality_score,
      readability_score: aiResult.readability_score,
      technical_seo_score: aiResult.technical_seo_score,
      trust_score: aiResult.trust_score,
      platform_fit_score: aiResult.platform_fit_score,
      overall_score: aiResult.overall_score,
      keyword_density: { ...keywordDensityMap, ...aiResult.keyword_density },
      repetition_rate: aiResult.repetition_rate,
      model_name: "gemini-1.5-pro",
      raw_result: aiResult
    })
    .select()
    .single();

  if (evalInsertErr || !newEval) {
    throw new Error(`평가 적재 실패: ${evalInsertErr?.message}`);
  }

  // (3) evaluation_issues 적재
  if (combinedIssues.length > 0) {
    const issuesPayload = combinedIssues.map(issue => ({
      evaluation_id: newEval.id,
      severity: issue.severity,
      category: issue.category,
      issue_code: issue.issue_code,
      message: issue.message,
      suggested_action: issue.suggested_action || "",
      auto_fix_available: !!issue.auto_fix_available,
      status: "OPEN"
    }));

    const { error: issueErr } = await supabase
      .from("evaluation_issues")
      .insert(issuesPayload);

    if (issueErr) {
      console.error("이슈 대량 삽입 에러: ", issueErr.message);
    }
  }

  // (4) content_facts 적재 (프로젝트 내 중복 팩트 회피하며 머지)
  if (combinedFacts.length > 0) {
    // 기존 프로젝트 사실 목록 로드
    const { data: existingFacts } = await supabase
      .from("content_facts")
      .select("fact_text")
      .eq("project_id", content.project_id);

    const existingSet = new Set(existingFacts?.map(f => f.fact_text) || []);

    const factsPayload = combinedFacts
      .filter(f => !existingSet.has(f.fact_text))
      .map(f => ({
        project_id: content.project_id,
        fact_text: f.fact_text,
        fact_type: f.fact_type,
        verification_status: "UNVERIFIED",
        user_confirmed: false
      }));

    if (factsPayload.length > 0) {
      const { error: factErr } = await supabase
        .from("content_facts")
        .insert(factsPayload);

      if (factErr) {
        console.error("팩트 대량 삽입 에러: ", factErr.message);
      }
    }
  }

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return newEval;
}

// ==========================================
// 2. 이슈 목록 조회 Action
// ==========================================
export async function listEvaluationIssues(evaluationId: string) {
  const supabase = await createClient();
  const { data: issues, error } = await supabase
    .from("evaluation_issues")
    .select("*")
    .eq("evaluation_id", evaluationId);

  if (error) {
    throw new Error(`이슈 로드 실패: ${error.message}`);
  }
  return issues || [];
}

// ==========================================
// 3. 이슈 자동 수정 제안 (Auto-Fix) Action
// ==========================================
export async function autoFixIssue(issueId: string) {
  const supabase = await createClient();

  // 1. 이슈 및 평가 데이터 로드
  const { data: issue, error: issueErr } = await supabase
    .from("evaluation_issues")
    .select("*, content_evaluations(*)")
    .eq("id", issueId)
    .single();

  if (issueErr || !issue) {
    throw new Error(`이슈 조회를 실패했습니다: ${issueErr?.message}`);
  }

  const evaluation = issue.content_evaluations;
  if (!evaluation) {
    throw new Error("연계된 콘텐츠 평가 정보를 찾을 수 없습니다.");
  }

  // 2. 플랫폼 콘텐츠 정보 로드
  const { data: content, error: contentErr } = await supabase
    .from("platform_contents")
    .select("*, platforms(*)")
    .eq("id", evaluation.platform_content_id)
    .single();

  if (contentErr || !content) {
    throw new Error(`콘텐츠 데이터를 찾을 수 없습니다: ${contentErr?.message}`);
  }

  // 3. 권한 및 멤버십
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 4. AI Provider에 자동 교정 요청
  const aiProvider = getAIProvider();
  const fixResult = await aiProvider.autoFixContent(
    content.body_text || "",
    content.title || "",
    issue,
    content.platforms?.code || "WORDPRESS"
  );

  return fixResult;
}

// ==========================================
// 3.5 이슈 자동 수정 실행 및 적용 Action
// ==========================================
export async function applyAutoFix(
  issueId: string,
  platformContentId: string,
  newText: string,
  updatedFields: any
) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1. 플랫폼 콘텐츠 로드
  const { data: content, error: contentErr } = await supabase
    .from("platform_contents")
    .select("*")
    .eq("id", platformContentId)
    .single();

  if (contentErr || !content) {
    throw new Error(`콘텐츠 조회를 실패했습니다: ${contentErr?.message}`);
  }

  // 2. 제목/본문 업데이트
  const updates: any = {};
  if (updatedFields && updatedFields.title) {
    updates.title = updatedFields.title;
  }
  if (updatedFields && updatedFields.meta_description) {
    updates.meta_description = updatedFields.meta_description;
  }

  if (newText && newText !== content.body_text) {
    updates.body_text = newText;
    updates.body_html = newText.startsWith("<") ? newText : `<p>${newText.replace(/\n/g, "</p><p>")}</p>`;
  }

  const { error: updateErr } = await supabase
    .from("platform_contents")
    .update(updates)
    .eq("id", platformContentId);

  if (updateErr) {
    throw new Error(`콘텐츠 업데이트 실패: ${updateErr.message}`);
  }

  // 3. 이슈 상태 FIXED 변경
  const { error: issueErr } = await supabase
    .from("evaluation_issues")
    .update({
      status: "FIXED",
      fixed_at: new Date().toISOString()
    })
    .eq("id", issueId);

  if (issueErr) {
    console.error("이슈 상태 FIXED 변경 실패: ", issueErr.message);
  }

  // 4. 콘텐츠 새 버전 생성
  const { data: versions } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", platformContentId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVer = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

  const { data: finalContent } = await supabase
    .from("platform_contents")
    .select("*")
    .eq("id", platformContentId)
    .single();

  if (finalContent) {
    await supabase.from("content_versions").insert({
      platform_content_id: platformContentId,
      version_number: nextVer,
      version_type: "MANUAL",
      title: finalContent.title,
      body_html: finalContent.body_html,
      body_text: finalContent.body_text,
      body_json: finalContent.body_json,
      metadata_snapshot: {
        seo_title: finalContent.seo_title,
        meta_description: finalContent.meta_description,
        slug: finalContent.slug,
        excerpt: finalContent.excerpt,
        tags: finalContent.tags,
        hashtags: finalContent.hashtags,
        categories: finalContent.categories
      },
      change_summary: `AI 자동 수정 적용 (이슈 코드: ${issueId.substring(0, 8)})`
    });
  }

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return { success: true };
}

// ==========================================
// 4. 이슈 무시 처리 Action
// ==========================================
export async function ignoreIssue(issueId: string, reason: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  const { data: updated, error } = await supabase
    .from("evaluation_issues")
    .update({
      status: "IGNORED",
      ignore_reason: reason
    })
    .eq("id", issueId)
    .select()
    .single();

  if (error) {
    throw new Error(`이슈 무시 처리 실패: ${error.message}`);
  }

  return updated;
}

// ==========================================
// 5. 사실 검증 승인/확인 Action
// ==========================================
export async function confirmFact(factId: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  const { data: updated, error } = await supabase
    .from("content_facts")
    .update({
      verification_status: "USER_CONFIRMED",
      user_confirmed: true,
      verified_at: new Date().toISOString()
    })
    .eq("id", factId)
    .select()
    .single();

  if (error) {
    throw new Error(`사실 검증 승인 실패: ${error.message}`);
  }

  return updated;
}

// ==========================================
// 6. 사실 검증 반려 Action
// ==========================================
export async function rejectFact(factId: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  const { data: updated, error } = await supabase
    .from("content_facts")
    .update({
      verification_status: "DISPUTED",
      user_confirmed: false
    })
    .eq("id", factId)
    .select()
    .single();

  if (error) {
    throw new Error(`사실 검증 반려 실패: ${error.message}`);
  }

  return updated;
}

// ==========================================
// 7. 콘텐츠 최종 발행 승인 (APPROVED) Action
// ==========================================
export async function approveContent(platformContentId: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1. 최근 평가 데이터 및 미해결 이슈 점검
  const { data: evalData } = await supabase
    .from("content_evaluations")
    .select("id, evaluation_version")
    .eq("platform_content_id", platformContentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!evalData) {
    throw new Error("콘텐츠 평가 이력이 없습니다. 먼저 품질 평가를 실행해 주세요.");
  }

  // OPEN 상태의 CRITICAL 이슈가 있는지 검증
  const { data: openCriticalIssues } = await supabase
    .from("evaluation_issues")
    .select("id")
    .eq("evaluation_id", evalData.id)
    .eq("severity", "CRITICAL")
    .eq("status", "OPEN");

  if (openCriticalIssues && openCriticalIssues.length > 0) {
    throw new Error("해결되지 않은 CRITICAL 등급의 심각한 오류가 존재하여 승인이 거절되었습니다.");
  }

  // 2. 콘텐츠 데이터 무결성 검증 (제목, 본문 존재여부)
  const { data: content } = await supabase
    .from("platform_contents")
    .select("*")
    .eq("id", platformContentId)
    .single();

  if (!content || !content.title || !content.body_text) {
    throw new Error("콘텐츠의 제목 또는 본문이 비어 있어 승인할 수 없습니다.");
  }

  // 3. 사실 확인 필요 사실 중 검토 안 된 팩트체크 존재여부 점검
  const { data: unconfirmedFacts } = await supabase
    .from("content_facts")
    .select("id")
    .eq("project_id", content.project_id)
    .eq("verification_status", "UNVERIFIED");

  if (unconfirmedFacts && unconfirmedFacts.length > 0) {
    throw new Error("검토 완료되지 않은 사실 확인 필요 정보가 존재합니다. 모든 팩트를 확인 및 승인 처리해 주세요.");
  }

  // 4. 승인 처리 업데이트
  const { data: approvedContent, error: updateErr } = await supabase
    .from("platform_contents")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: (await supabase.auth.getUser()).data.user?.id || null
    })
    .eq("id", platformContentId)
    .select()
    .single();

  if (updateErr || !approvedContent) {
    throw new Error(`승인 상태 업데이트 실패: ${updateErr?.message}`);
  }

  // 5. PRE_PUBLISH 버전 스냅샷 생성
  // 최신 버전 번호를 구함
  const { data: versions } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", platformContentId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVer = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

  await supabase.from("content_versions").insert({
    platform_content_id: platformContentId,
    version_number: nextVer,
    version_type: "PRE_PUBLISH",
    title: approvedContent.title,
    body_html: approvedContent.body_html,
    body_text: approvedContent.body_text,
    body_json: approvedContent.body_json,
    metadata_snapshot: {
      seo_title: approvedContent.seo_title,
      meta_description: approvedContent.meta_description,
      slug: approvedContent.slug,
      excerpt: approvedContent.excerpt,
      tags: approvedContent.tags,
      hashtags: approvedContent.hashtags,
      categories: approvedContent.categories
    },
    change_summary: "발행 전 승인 완료 최종본 백업 버전 스냅샷"
  });

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return approvedContent;
}

// ==========================================
// 8. 콘텐츠 승인 철회 Action
// ==========================================
export async function revokeApproval(platformContentId: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  const { data: updated, error } = await supabase
    .from("platform_contents")
    .update({
      status: "NEEDS_REVIEW",
      approved_at: null,
      approved_by: null
    })
    .eq("id", platformContentId)
    .select()
    .single();

  if (error) {
    throw new Error(`승인 철회 실패: ${error.message}`);
  }

  revalidatePath(`/contents/${updated.project_id}/platform/${platformContentId}/edit`);
  return updated;
}

// ==========================================
// 9. 최신 평가 및 사실 검증 목록 조회 Action
// ==========================================
export async function getLatestEvaluationAndFacts(platformContentId: string, projectId: string) {
  const supabase = await createClient();

  const { data: evaluation } = await supabase
    .from("content_evaluations")
    .select("*")
    .eq("platform_content_id", platformContentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let issues: any[] = [];
  if (evaluation) {
    const { data: issueData } = await supabase
      .from("evaluation_issues")
      .select("*")
      .eq("evaluation_id", evaluation.id);
    issues = issueData || [];
  }

  const { data: facts } = await supabase
    .from("content_facts")
    .select("*")
    .eq("project_id", projectId);

  return { evaluation, issues, facts: facts || [] };
}

// ==========================================
// 10. 콘텐츠 발행 준비 완료 (PUBLISH_READY) 상태 전환 Action
// ==========================================
export async function publishReadyContent(platformContentId: string) {
  const supabase = await createClient();
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1. 콘텐츠 상태 및 프로젝트 ID 조회
  const { data: content, error: fetchErr } = await supabase
    .from("platform_contents")
    .select("status, project_id")
    .eq("id", platformContentId)
    .single();

  if (fetchErr || !content) {
    throw new Error("콘텐츠 정보를 찾을 수 없습니다.");
  }

  // 2. 상태 업데이트
  const { error: updateErr } = await supabase
    .from("platform_contents")
    .update({
      status: "PUBLISH_READY"
    })
    .eq("id", platformContentId);

  if (updateErr) {
    throw new Error(`상태 전환 실패: ${updateErr.message}`);
  }

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return { success: true };
}
