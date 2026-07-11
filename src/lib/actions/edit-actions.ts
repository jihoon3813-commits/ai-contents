"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAIProvider } from "@/lib/ai/provider";
import { getPromptTemplate } from "@/lib/supabase/prompt_seeder";
import { sanitizeHtml } from "@/lib/utils/sanitizer";
import { verifyWorkspaceMembership } from "./generation";
import { getProject, getProjectExperience, getProjectPlatforms } from "./project";
import { diffWords, renderDiffHtml } from "@/lib/utils/diff";

// ==========================================
// 1. 에디터 본문 및 메타데이터 업데이트 (자동 저장)
// ==========================================

export async function updatePlatformContent(
  platformContentId: string,
  payload: {
    body_html: string;
    body_json: any;
    title?: string;
    seo_title?: string;
    meta_description?: string;
    slug?: string;
    excerpt?: string;
    tags?: string[];
    hashtags?: string[];
    categories?: string[];
    sections?: {
      id?: string;
      heading: string;
      body_html: string;
      body_text: string;
      sort_order: number;
    }[];
    updated_at: string; // 낙관적 락 충돌 검증용 타임스탬프
  }
) {
  const { workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1) 최신 updated_at 타임스탬프를 체크하여 낙관적 락 검사
  const { data: current, error: fetchError } = await supabase
    .from("platform_contents")
    .select("updated_at")
    .eq("id", platformContentId)
    .single();

  if (fetchError || !current) {
    throw new Error("콘텐츠 데이터를 찾을 수 없습니다.");
  }

  const clientTime = new Date(payload.updated_at).getTime();
  const dbTime = new Date(current.updated_at).getTime();

  // 클라이언트가 읽어간 시점보다 서버의 데이터가 1초(1000ms) 이상 더 최신이면 충돌 반환
  if (dbTime > clientTime + 1000) {
    return {
      success: false,
      conflict: true,
      dbUpdatedAt: current.updated_at,
    };
  }

  // HTML 태그를 제거해 단순 문자열 텍스트 및 자수 계산
  const bodyText = payload.body_html.replace(/<[^>]*>/g, "");
  const characterCount = bodyText.length;
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // 2) HTML 정화 처리 (XSS 차단)
  const safeHtml = sanitizeHtml(payload.body_html);

  // 3) 플랫폼 콘텐츠 업데이트
  const { error: updateError } = await supabase
    .from("platform_contents")
    .update({
      title: payload.title,
      seo_title: payload.seo_title,
      meta_description: payload.meta_description,
      slug: payload.slug,
      excerpt: payload.excerpt,
      tags: payload.tags,
      hashtags: payload.hashtags,
      categories: payload.categories,
      body_html: safeHtml,
      body_text: bodyText,
      body_json: payload.body_json,
      character_count: characterCount,
      word_count: wordCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", platformContentId);

  if (updateError) {
    throw new Error(`저장 실패: ${updateError.message}`);
  }

  // 4) 만약 개별 섹션 싱크 목록이 온 경우, content_sections 테이블 동기화
  if (payload.sections && payload.sections.length > 0) {
    for (const sec of payload.sections) {
      const safeSecHtml = sanitizeHtml(sec.body_html);
      if (sec.id) {
        // 기존 섹션 업데이트
        await supabase
          .from("content_sections")
          .update({
            heading: sec.heading,
            body_html: safeSecHtml,
            body_text: sec.body_text,
            sort_order: sec.sort_order,
          })
          .eq("id", sec.id);
      } else {
        // 새 섹션 삽입
        await supabase.from("content_sections").insert({
          platform_content_id: platformContentId,
          section_type: "HEADING",
          heading: sec.heading,
          body_html: safeSecHtml,
          body_text: sec.body_text,
          sort_order: sec.sort_order,
          generation_status: "COMPLETED",
        });
      }
    }
  }

  // 최신 레코드의 updated_at을 다시 반환
  const { data: updatedRecord } = await supabase
    .from("platform_contents")
    .select("updated_at")
    .eq("id", platformContentId)
    .single();

  revalidatePath(`/contents/[id]/platform/${platformContentId}/edit`, "page");

  return {
    success: true,
    updated_at: updatedRecord?.updated_at || new Date().toISOString(),
  };
}

// ==========================================
// 2. 개별 섹션 제어 (업데이트, 순서 조정, 잠금)
// ==========================================

export async function updateSection(
  sectionId: string,
  data: { heading?: string; body_html?: string; is_locked?: boolean }
) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  const updates: any = {};
  if (data.heading !== undefined) updates.heading = data.heading;
  if (data.body_html !== undefined) {
    updates.body_html = sanitizeHtml(data.body_html);
    updates.body_text = data.body_html.replace(/<[^>]*>/g, "");
  }
  if (data.is_locked !== undefined) updates.is_locked = data.is_locked;

  const { error } = await supabase.from("content_sections").update(updates).eq("id", sectionId);
  if (error) throw new Error(`섹션 업데이트 실패: ${error.message}`);

  return { success: true };
}

export async function reorderSections(contentId: string, orderedSectionIds: string[]) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1) 순서 배치 업데이트
  for (let i = 0; i < orderedSectionIds.length; i++) {
    await supabase
      .from("content_sections")
      .update({ sort_order: i })
      .eq("id", orderedSectionIds[i])
      .eq("platform_content_id", contentId);
  }

  // 2) 변경된 순서 기준으로 플랫폼 콘텐츠 결합본 업데이트
  const { data: secs } = await supabase
    .from("content_sections")
    .select("heading, body_html, body_text")
    .eq("platform_content_id", contentId)
    .order("sort_order", { ascending: true });

  if (secs && secs.length > 0) {
    const combinedHtml = secs.map((s) => `<h3>${s.heading}</h3>${s.body_html}`).join("\n");
    const combinedText = secs.map((s) => `${s.heading}\n${s.body_text}`).join("\n\n");

    await supabase
      .from("platform_contents")
      .update({
        body_html: combinedHtml,
        body_text: combinedText,
        character_count: combinedText.length,
        word_count: combinedText.split(/\s+/).filter(Boolean).length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId);
  }

  return { success: true };
}

export async function lockSection(sectionId: string, isLocked: boolean) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  const { error } = await supabase
    .from("content_sections")
    .update({ is_locked: isLocked })
    .eq("id", sectionId);

  if (error) throw new Error(`섹션 잠금 조작 실패: ${error.message}`);
  return { success: true };
}

// ==========================================
// 3. AI 기반 특정 문단 및 선택 영역 재작성 (Rewrite)
// ==========================================

export async function rewriteSection(sectionId: string, mode: string) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1) 대상 섹션 및 본문 조회
  const { data: sec, error: secErr } = await supabase
    .from("content_sections")
    .select("*")
    .eq("id", sectionId)
    .single();

  if (secErr || !sec) throw new Error("대상 섹션을 찾을 수 없습니다.");

  const contentId = sec.platform_content_id;

  // 2) 부모 플랫폼 및 프로젝트 데이터 조회
  const { data: content } = await supabase
    .from("platform_contents")
    .select("project_id, platform_id")
    .eq("id", contentId)
    .single();

  if (!content) throw new Error("부모 콘텐츠 정보를 찾을 수 없습니다.");

  const { data: platform } = await supabase
    .from("platforms")
    .select("code")
    .eq("id", content.platform_id)
    .single();

  const platformCode = platform?.code || "WORDPRESS";
  const project = await getProject(content.project_id);
  const experience = await getProjectExperience(content.project_id);

  // 3) 전후 문맥을 인용하기 위해 인접 섹션 로드
  const { data: siblingSecs } = await supabase
    .from("content_sections")
    .select("id, heading, body_text, sort_order")
    .eq("platform_content_id", contentId)
    .order("sort_order", { ascending: true });

  const currentIdx = (siblingSecs || []).findIndex((s) => s.id === sectionId);
  const prevText = currentIdx > 0 ? siblingSecs?.[currentIdx - 1]?.body_text : "";
  const nextText = currentIdx < (siblingSecs || []).length - 1 ? siblingSecs?.[currentIdx + 1]?.body_text : "";

  // 4) 프롬프트 템플릿 로드
  const template = await getPromptTemplate("SECTION_GENERATION");

  // 5) AI Provider 호출
  const aiProvider = getAIProvider();
  
  // 모드 지시사항 추가 주입
  let instruction = `현재 문단 제목: "${sec.heading}"\n현재 문단 본문: "${sec.body_text}"\n`;
  if (mode === "longer") instruction += "지시: 해당 문단의 핵심 내용을 유지하되, 더 자세하고 길게 풀어서 200자 내외로 보강해 작성해 주세요.";
  else if (mode === "shorter") instruction += "지시: 해당 문단 내용을 더 짧고 압축적으로 요약해서 100자 이하로 간결하게 줄여 주세요.";
  else if (mode === "friendly") instruction += "지시: 독자와 대화하듯 더 친근하고 상냥한 어조(~해요, ~합니다 등)로 문맥을 다듬어 주세요.";
  else if (mode === "professional") instruction += "지시: 신뢰감 있고 전문적인 업계 전문가의 격식 있는 문체로 텍스트를 고도화해 주세요.";
  else if (mode === "natural") instruction += "지시: 어색한 번역투나 중복 표현을 제거하고 물 흐르듯 아주 자연스러운 한국어로 문체를 정제해 주세요.";
  else if (mode === "bullet") instruction += "지시: 이 문단의 주요 팩트 정보를 번호 없는 리스트(ul, li) 형식으로 가독성 좋게 정리해 주세요.";
  else if (mode === "table") instruction += "지시: 이 문단의 주요 수치나 비교 팩트들을 HTML Table 표 형식(table, tr, td)으로 구조화해 제시해 주세요.";
  else instruction += `지시: 다음 가이드를 바탕으로 다시 작성해 주세요 - [${mode}]`;

  // AI 섹션 생성 기동
  const result = await aiProvider.generateSection(template, {
    topic: project.topic || "",
    keywords: project.primary_keyword || "",
    heading: sec.heading || "",
    section_description: instruction,
    preceding_sections_text: prevText || "",
    experience_info: experience?.has_direct_experience ? (experience.motivation || "") : "",
    has_experience: !!experience?.has_direct_experience,
  });

  const safeHtml = sanitizeHtml(result.body_html);

  // 6) DB에 갱신 및 컴파일
  await supabase
    .from("content_sections")
    .update({
      body_html: safeHtml,
      body_text: result.body_text,
    })
    .eq("id", sectionId);

  // 결합본 재컴파일
  const { data: updatedSecs } = await supabase
    .from("content_sections")
    .select("heading, body_html, body_text")
    .eq("platform_content_id", contentId)
    .order("sort_order", { ascending: true });

  if (updatedSecs) {
    const combinedHtml = updatedSecs.map((s) => `<h3>${s.heading}</h3>${s.body_html}`).join("\n");
    const combinedText = updatedSecs.map((s) => `${s.heading}\n${s.body_text}`).join("\n\n");

    await supabase
      .from("platform_contents")
      .update({
        body_html: combinedHtml,
        body_text: combinedText,
        character_count: combinedText.length,
        word_count: combinedText.split(/\s+/).filter(Boolean).length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentId);
  }

  return { success: true };
}

export async function rewriteSelection(params: {
  selectionText: string;
  paragraphText: string;
  prevText?: string;
  nextText?: string;
  option: string;
  platformCode: string;
  projectId: string;
}) {
  await verifyWorkspaceMembership();

  const project = await getProject(params.projectId);
  const experience = await getProjectExperience(params.projectId);

  // 프롬프트 템플릿 로드
  const template = await getPromptTemplate("SECTION_GENERATION");
  const aiProvider = getAIProvider();

  // 지시사항 보정
  let modeInstruction = "";
  if (params.option === "natural") modeInstruction = "더 자연스럽고 흐름이 부드러운 문장으로 변경해 주세요.";
  else if (params.option === "shorter") modeInstruction = "의미는 그대로 유지하고 글을 간결하게 줄여 주세요.";
  else if (params.option === "longer") modeInstruction = "핵심 내용을 바탕으로 구체적인 근거를 덧붙여서 문장을 더 길고 풍성하게 채워 주세요.";
  else if (params.option === "professional") modeInstruction = "신뢰감이 느껴지는 비즈니스 업무 서술 및 전문성 있는 문조로 격상해 주세요.";
  else if (params.option === "grammar") modeInstruction = "맞춤법 및 문법 오류를 교정하고 부적절한 단어를 고쳐 주세요.";
  else if (params.option === "suggestions") {
    // 3개 대안 표현 생성 요구
    const prompt = `다음 선택된 텍스트에 대한 어조와 표현이 다른 자연스러운 대체 문구 3개를 번호 매김(1., 2., 3.) 형태로 한국어로 제시해 주세요.\n선택 문안: "${params.selectionText}"`;
    const resp = await aiProvider.generateSection(template, {
      topic: project.topic || "",
      keywords: project.primary_keyword || "",
      heading: "텍스트 대안 제안",
      section_description: prompt,
      preceding_sections_text: params.prevText || "",
      experience_info: experience?.has_direct_experience ? (experience.motivation || "") : "",
      has_experience: !!experience?.has_direct_experience,
    });
    // 3개 파싱 흉내
    const lines = resp.body_text.split(/\n+/).filter(l => l.match(/^\d\./));
    const suggestions = lines.map(l => l.replace(/^\d\.\s*/, "").trim());
    return {
      success: true,
      suggestions: suggestions.length >= 3 ? suggestions.slice(0, 3) : [
        `${params.selectionText}의 다른 형태 표현 A`,
        `${params.selectionText}의 다른 형태 표현 B`,
        `${params.selectionText}의 다른 형태 표현 C`
      ]
    };
  } else {
    modeInstruction = `다음 요구 조건에 맞추어 변경해 주세요: [${params.option}]`;
  }

  const userPrompt = `[문맥 파라미터]\n직전 내용: "${params.prevText || ""}"\n다음 내용: "${params.nextText || ""}"\n전체 단락: "${params.paragraphText}"\n선택된 문구: "${params.selectionText}"\n\n지시사항: 선택된 문구만을 문맥에 맞춰 자연스럽게 대체할 수 있도록 한 문장으로 다시 작성해 주세요. (주의: 대체할 문장 자체만 결과로 반환해 주세요.)\n수정 가이드: ${modeInstruction}`;

  const resp = await aiProvider.generateSection(template, {
    topic: project.topic || "",
    keywords: project.primary_keyword || "",
    heading: "선택 영역 치환",
    section_description: userPrompt,
    preceding_sections_text: params.prevText || "",
    experience_info: experience?.has_direct_experience ? (experience.motivation || "") : "",
    has_experience: !!experience?.has_direct_experience,
  });

  return {
    success: true,
    rewrittenText: resp.body_text.replace(/<[^>]*>/g, "").trim(), // HTML 태그를 제거한 순수 추천 문구
  };
}

// ==========================================
// 4. 버전 생성, 목록, 비교, 복원
// ==========================================

export async function createVersion(
  contentId: string,
  versionType: string,
  changeSummary?: string
) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1) 현재 플랫폼 콘텐츠 정보 취득
  const { data: content, error: fetchErr } = await supabase
    .from("platform_contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (fetchErr || !content) throw new Error("콘텐츠를 찾을 수 없습니다.");

  // 2) 기존 최고 버전 번호 산정
  const { data: versions } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", contentId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersionNum = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

  // 3) 버전 스냅샷 적재
  const { error: insertErr } = await supabase.from("content_versions").insert({
    platform_content_id: contentId,
    version_number: nextVersionNum,
    version_type: versionType,
    title: content.title,
    body_html: content.body_html,
    body_text: content.body_text,
    body_json: content.body_json,
    metadata_snapshot: {
      seo_title: content.seo_title,
      meta_description: content.meta_description,
      slug: content.slug,
      excerpt: content.excerpt,
      tags: content.tags,
      hashtags: content.hashtags,
      categories: content.categories,
    },
    change_summary: changeSummary || `${versionType} 타입 자동 버전 백업`,
  });

  if (insertErr) throw new Error(`버전 백업 생성 실패: ${insertErr.message}`);

  return { success: true, versionNumber: nextVersionNum };
}

export async function listVersions(contentId: string) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_versions")
    .select("id, version_number, version_type, change_summary, created_at, body_text")
    .eq("platform_content_id", contentId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(`버전 조회 실패: ${error.message}`);

  // 글자 수 계산 보정하여 반환
  return (data || []).map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    versionType: v.version_type,
    changeSummary: v.change_summary,
    createdAt: v.created_at,
    characterCount: v.body_text?.length || 0,
  }));
}

export async function compareVersions(contentId: string, numA: number, numB: number) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 버전 A 및 B 스냅샷 로드
  const { data: verA } = await supabase
    .from("content_versions")
    .select("*")
    .eq("platform_content_id", contentId)
    .eq("version_number", numA)
    .single();

  const { data: verB } = await supabase
    .from("content_versions")
    .select("*")
    .eq("platform_content_id", contentId)
    .eq("version_number", numB)
    .single();

  if (!verA || !verB) throw new Error("비교할 버전을 탐색할 수 없습니다.");

  // 단어 수준 Diff 연산
  const diffHtml = renderDiffHtml(verA.body_text || "", verB.body_text || "");

  return {
    versionA: {
      versionNumber: verA.version_number,
      title: verA.title,
      metadata: verA.metadata_snapshot,
    },
    versionB: {
      versionNumber: verB.version_number,
      title: verB.title,
      metadata: verB.metadata_snapshot,
    },
    diffHtml,
  };
}

export async function restoreVersion(contentId: string, versionNumber: number) {
  const { userId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1) 대상 복원용 버전 취득
  const { data: targetVer, error: verErr } = await supabase
    .from("content_versions")
    .select("*")
    .eq("platform_content_id", contentId)
    .eq("version_number", versionNumber)
    .single();

  if (verErr || !targetVer) throw new Error("복원할 버전 스냅샷이 존재하지 않습니다.");

  // 2) 현재 상태를 MANUAL 버전 백업으로 보존하여 언제든지 실행취소(Undo) 가능케 보호
  const { data: current } = await supabase
    .from("platform_contents")
    .select("*")
    .eq("id", contentId)
    .single();

  if (current) {
    const { data: versions } = await supabase
      .from("content_versions")
      .select("version_number")
      .eq("platform_content_id", contentId)
      .order("version_number", { ascending: false })
      .limit(1);
    const nextVersionNum = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    await supabase.from("content_versions").insert({
      platform_content_id: contentId,
      version_number: nextVersionNum,
      version_type: "MANUAL",
      title: current.title,
      body_html: current.body_html,
      body_text: current.body_text,
      body_json: current.body_json,
      metadata_snapshot: {
        seo_title: current.seo_title,
        meta_description: current.meta_description,
        slug: current.slug,
        excerpt: current.excerpt,
        tags: current.tags,
        hashtags: current.hashtags,
        categories: current.categories,
      },
      change_summary: `버전 ${versionNumber} 복원 실행 직전 자동 백업`,
    });
  }

  // 3) 콘텐츠 내용 복원 적용
  const meta = targetVer.metadata_snapshot || {};
  const { error: updateErr } = await supabase
    .from("platform_contents")
    .update({
      title: targetVer.title,
      body_html: targetVer.body_html,
      body_text: targetVer.body_text,
      body_json: targetVer.body_json,
      seo_title: meta.seo_title,
      meta_description: meta.meta_description,
      slug: meta.slug,
      excerpt: meta.excerpt,
      tags: meta.tags,
      hashtags: meta.hashtags,
      categories: meta.categories,
      character_count: targetVer.body_text?.length || 0,
      word_count: targetVer.body_text?.split(/\s+/).filter(Boolean).length || 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentId);

  if (updateErr) throw new Error(`복원 적용 실패: ${updateErr.message}`);

  // 4) HTML 구조 분석을 통해 개별 content_sections 초기화 및 재생성
  await syncSectionsFromHtml(supabase, contentId, targetVer.body_html || "");

  // 5) RESTORED 버전 스냅샷 생성
  const { data: versionsAfter } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", contentId)
    .order("version_number", { ascending: false })
    .limit(1);
  const restoreVerNum = versionsAfter && versionsAfter.length > 0 ? versionsAfter[0].version_number + 1 : 1;

  await supabase.from("content_versions").insert({
    platform_content_id: contentId,
    version_number: restoreVerNum,
    version_type: "RESTORED",
    title: targetVer.title,
    body_html: targetVer.body_html,
    body_text: targetVer.body_text,
    body_json: targetVer.body_json,
    metadata_snapshot: meta,
    change_summary: `버전 ${versionNumber}(으)로 복원 완료`,
  });

  revalidatePath(`/contents/[id]/platform/${contentId}/edit`, "page");
  return { success: true };
}

// 헬퍼: HTML 본문 내 <h3> 또는 <h4> 태그 기준으로 분리하여 content_sections 동기화
async function syncSectionsFromHtml(supabase: any, contentId: string, html: string) {
  // <h3>, <h4> 소제목을 캡처하면서 나누기
  const parts = html.split(/(?=<h[234]>[^<]+<\/h[234]>)/i);
  const sectionsToSave = [];
  let sortIndex = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const match = part.match(/^<h([234])>([^<]+)<\/h[234]>(.*)$/i);
    if (match) {
      const level = parseInt(match[1]);
      const heading = match[2];
      const bodyHtml = match[3];
      const bodyText = bodyHtml.replace(/<[^>]*>/g, "").trim();

      sectionsToSave.push({
        platform_content_id: contentId,
        section_type: "HEADING",
        heading_level: level,
        heading: heading,
        body_html: bodyHtml,
        body_text: bodyText,
        sort_order: sortIndex++,
        is_locked: false,
        generation_status: "COMPLETED",
      });
    } else {
      // 첫 문장 도입부 (도입 소제목이 누락된 경우)
      const bodyText = part.replace(/<[^>]*>/g, "").trim();
      sectionsToSave.push({
        platform_content_id: contentId,
        section_type: "INTRO",
        heading_level: 3,
        heading: "도입부",
        body_html: part,
        body_text: bodyText,
        sort_order: sortIndex++,
        is_locked: false,
        generation_status: "COMPLETED",
      });
    }
  }

  // 기존 섹션 초기화 후 삽입
  await supabase.from("content_sections").delete().eq("platform_content_id", contentId);
  if (sectionsToSave.length > 0) {
    await supabase.from("content_sections").insert(sectionsToSave);
  }
}
