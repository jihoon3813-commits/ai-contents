"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAIProvider } from "@/lib/ai/provider";
import { getPromptTemplate } from "@/lib/supabase/prompt_seeder";
import { sanitizeHtml } from "@/lib/utils/sanitizer";
import { getProject, getProjectExperience, getProjectPlatforms } from "./project";

// 헬퍼: 워크스페이스 권한 검증
export async function verifyWorkspaceMembership(requiredRoles: string[] = ["OWNER", "ADMIN", "EDITOR"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    try {
      const { convexAuthNextjsToken } = await import("@convex-dev/auth/nextjs/server");
      const token = await convexAuthNextjsToken();
      if (token) {
        const { fetchQuery } = await import("convex/nextjs");
        const { api } = await import("../../../convex/_generated/api");
        const profile = await fetchQuery(api.profiles.get, {}, { token });
        if (profile) {
          const workspaces = await fetchQuery(api.workspaces.getMyWorkspaces, {}, { token });
          if (workspaces.length > 0) {
            const activeWs = workspaces[0];
            if (!requiredRoles.includes(activeWs.role)) {
              throw new Error("해당 작업을 수행할 권한이 없습니다.");
            }
            return { userId: profile.userId, workspaceId: activeWs.id, userRole: activeWs.role };
          }
        }
      }
    } catch (convexAuthErr) {
      console.error("verifyWorkspaceMembership Convex Auth Fallback Error:", convexAuthErr);
    }
    throw new Error("인증되지 않은 사용자입니다.");
  }

  let { data: member, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !member) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const adminSupabase = createAdminClient();
      const userName = user.user_metadata?.name || user.email?.split("@")[0] || "사용자";
      
      // 1) 프로필 확인 및 생성
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!profile) {
        await adminSupabase.from("profiles").insert({
          id: user.id,
          name: userName,
          timezone: "Asia/Seoul",
          language: "ko",
          onboarding_completed: false,
          is_admin: false,
        });
      }

      // 2) 워크스페이스 생성 및 ID 조회
      const slug = `ws-${user.id.slice(0, 8)}-${Math.random().toString(36).substring(2, 6)}`;
      const { data: newWs, error: wsError } = await adminSupabase
        .from("workspaces")
        .insert({
          name: `${userName}의 워크스페이스`,
          slug,
          owner_id: user.id,
          plan_code: "FREE",
          status: "ACTIVE",
          settings: {},
        })
        .select("id")
        .single();

      if (wsError || !newWs) {
        throw new Error(wsError?.message || "워크스페이스 생성 실패");
      }

      // 3) 워크스페이스 멤버 추가
      await adminSupabase.from("workspace_members").insert({
        workspace_id: newWs.id,
        user_id: user.id,
        role: "OWNER",
        status: "ACTIVE",
      });

      // 4) 구독 추가
      await adminSupabase.from("subscriptions").insert({
        workspace_id: newWs.id,
        plan_code: "FREE",
        status: "ACTIVE",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        limits: { words_limit: 10000, images_limit: 20 },
      });

      // 다시 한 번 멤버 조회
      const retryResult = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (retryResult.data) {
        member = retryResult.data;
      } else {
        throw new Error("워크스페이스 멤버십 재로드 실패");
      }
    } catch (createErr: any) {
      console.error("verifyWorkspaceMembership Auto-Create Error:", createErr);
      throw new Error("워크스페이스 멤버십이 존재하지 않으며, 자동 생성에 실패했습니다.");
    }
  }

  if (!requiredRoles.includes(member.role)) {
    throw new Error("해당 작업을 수행할 권한이 없습니다.");
  }

  return { userId: user.id, workspaceId: member.workspace_id, userRole: member.role };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 1. 브리프 생성 및 승인 (generateBrief, approveBrief)
// ==========================================

export async function generateBrief(projectId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 기획안, 브랜드, 보이스, 경험 데이터 로드
  const project = await getProject(projectId);
  
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", project.brand_id)
    .single();

  if (!brand) throw new Error("브랜드를 찾을 수 없습니다.");

  const { data: voice } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("brand_id", project.brand_id)
    .maybeSingle();

  const experience = await getProjectExperience(projectId);

  // 시드 템플릿 로드
  const template = await getPromptTemplate("BRIEF_GENERATION");

  // AI 연동 파라미터 조립
  const brandInfo = `이름: ${brand.name}, 산업: ${brand.industry}, 정의: ${brand.description}, 소구: ${brand.products_services}, CTA: ${brand.default_cta || ""}`;
  
  let experienceInfo = "실제 사용자 직접체험 정보 없음 (일반 정보 수집 요약형).";
  if (experience?.has_direct_experience) {
    experienceInfo = `사용기간: ${experience.usage_period || ""}, 가격: ${experience.price_info || ""}, 동기: ${experience.motivation || ""}, 전후비교: ${experience.problem_before || ""} -> ${experience.change_after || ""}, 장단점: 장점 [${experience.advantages || ""}] / 단점 [${experience.disadvantages || ""}], 에피소드: ${experience.real_episode || ""}`;
  }

  const aiInputs = {
    topic: project.topic || "새 마케팅 카피 기획",
    keywords: `핵심: ${project.primary_keyword}, 보조: ${(project.secondary_keywords || []).join(", ")}`,
    brand_info: brandInfo,
    experience_info: experienceInfo,
  };

  const aiProvider = getAIProvider();

  // AI 엔진 기동 (브리프 JSON 구조 반환됨)
  const aiBrief = await aiProvider.generateBrief(template, aiInputs);

  // DB 적재 (content_briefs)
  const { data: brief, error } = await supabase
    .from("content_briefs")
    .upsert({
      project_id: projectId,
      target_audience: aiBrief.targetAudience,
      search_intent: aiBrief.searchIntent,
      audience_problem: aiBrief.audienceProblem,
      core_answer: aiBrief.coreAnswer,
      core_message: aiBrief.coreMessage,
      supporting_points: aiBrief.supportingPoints,
      proposed_cta: aiBrief.proposedCta,
      restrictions: aiBrief.restrictions,
      facts_summary: aiBrief.facts,
      raw_ai_response: aiBrief as any,
      prompt_version_id: template.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id" })
    .select()
    .single();

  if (error) throw new Error(`브리프 저장 실패: ${error.message}`);

  // AI Jobs 로그 기록
  await supabase.from("ai_jobs").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    job_type: "BRIEF_GENERATION",
    provider: process.env.AI_PROVIDER || "MOCK",
    model_name: process.env.AI_TEXT_MODEL || "gemini-1.5-pro",
    status: "COMPLETED",
    output_snapshot: brief as any,
    prompt_version_id: template.id,
  });

  revalidatePath(`/contents/${projectId}/brief`);
  return brief;
}

export async function approveBrief(projectId: string) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_briefs")
    .update({ approved_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 프로젝트 상태 전이 (SETUP -> OUTLINE_READY 등 상태 보완)
  revalidatePath(`/contents/${projectId}/brief`);
  return data;
}

// ==========================================
// 2. 공통 개요 생성 및 승인 (generateCommonOutline, updateOutline, approveOutline)
// ==========================================

export async function generateCommonOutline(projectId: string) {
  const { workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  const brief = await supabase
    .from("content_briefs")
    .select("*")
    .eq("project_id", projectId)
    .single();

  if (!brief.data) {
    throw new Error("승인된 기획 브리프가 존재하지 않습니다. 브리프 생성을 먼저 진행해 주세요.");
  }

  const template = await getPromptTemplate("OUTLINE_GENERATION");
  const aiProvider = getAIProvider();

  // AI 공통 개요 생성
  const aiOutline = await aiProvider.generateCommonOutline(template, brief.data as any);

  // 1. 기존 공통 개요 제거 (Cascade 설정으로 outline_items 도 함께 청소됨)
  await supabase
    .from("content_outlines")
    .delete()
    .eq("project_id", projectId)
    .is("platform_id", null);

  // 2. 새 개요 삽입
  const { data: outline, error: oError } = await supabase
    .from("content_outlines")
    .insert({
      project_id: projectId,
      platform_id: null,
      title_candidates: aiOutline.title_candidates,
      selected_title: aiOutline.selected_title,
      intro_direction: aiOutline.intro_direction,
      conclusion_direction: aiOutline.conclusion_direction,
      cta_direction: aiOutline.cta_direction,
      status: "DRAFT",
    })
    .select()
    .single();

  if (oError) throw new Error(`공통 개요 생성 오류: ${oError.message}`);

  // 3. 개요 상세 아이템들 삽입
  const itemsToInsert = aiOutline.sections.map((item, idx) => ({
    outline_id: outline.id,
    item_type: item.item_type,
    heading_level: item.heading_level,
    title: item.title,
    description: item.description,
    sort_order: idx + 1,
  }));

  const { error: itemsError } = await supabase
    .from("outline_items")
    .insert(itemsToInsert);

  if (itemsError) throw new Error(`개요 항목 배치 오류: ${itemsError.message}`);

  // AI Jobs 기록
  await supabase.from("ai_jobs").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    job_type: "OUTLINE_GENERATION",
    provider: process.env.AI_PROVIDER || "MOCK",
    model_name: process.env.AI_TEXT_MODEL || "gemini-1.5-pro",
    status: "COMPLETED",
    prompt_version_id: template.id,
  });

  revalidatePath(`/contents/${projectId}/outline`);
  return { outline, items: itemsToInsert };
}

export async function updateOutline(
  outlineId: string,
  selectedTitle: string,
  items: { id?: string; title: string; description: string; item_type: string; heading_level: number; sort_order: number; is_locked: boolean }[]
) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1. 타이틀 업데이트
  const { data: outline, error: uError } = await supabase
    .from("content_outlines")
    .update({ selected_title: selectedTitle, updated_at: new Date().toISOString() })
    .eq("id", outlineId)
    .select()
    .single();

  if (uError) throw new Error(uError.message);

  // 2. 기존 상세 목차 삭제 후 신규 재입력 (간결성 보장)
  await supabase.from("outline_items").delete().eq("outline_id", outlineId);

  const itemsToInsert = items.map((i, idx) => ({
    outline_id: outlineId,
    item_type: i.item_type,
    heading_level: i.heading_level,
    title: i.title,
    description: i.description,
    sort_order: idx + 1,
    is_locked: i.is_locked,
  }));

  const { error: iError } = await supabase.from("outline_items").insert(itemsToInsert);
  if (iError) throw new Error(`목차 수동 저장 에러: ${iError.message}`);

  revalidatePath(`/contents/${outline.project_id}/outline`);
  return { outline, items: itemsToInsert };
}

export async function approveOutline(outlineId: string) {
  await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 개요 상태를 APPROVED로 승인
  const { data: outline, error } = await supabase
    .from("content_outlines")
    .update({ status: "APPROVED", approved_at: new Date().toISOString() })
    .eq("id", outlineId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 프로젝트 메인 상태를 기획 완료 상태로 갱신 (예: OUTLINE_READY -> GENERATING 전이 준비)
  revalidatePath(`/contents/${outline.project_id}/outline`);
  return outline;
}

// ==========================================
// 3. 플랫폼별 본문 생성 가동 (generatePlatformContents) 및 백그라운드 태스크
// ==========================================

export async function generatePlatformContents(projectId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 1. 프로젝트 및 승인된 공통 개요 검증
  const project = await getProject(projectId);
  
  const { data: commonOutline } = await supabase
    .from("content_outlines")
    .select("*")
    .eq("project_id", projectId)
    .is("platform_id", null)
    .eq("status", "APPROVED")
    .maybeSingle();

  if (!commonOutline) {
    throw new Error("승인된 공통 개요가 없습니다. 개요 기획을 먼저 승인해 주세요.");
  }

  const { data: commonItems } = await supabase
    .from("outline_items")
    .select("*")
    .eq("outline_id", commonOutline.id)
    .order("sort_order", { ascending: true });

  if (!commonItems || commonItems.length === 0) {
    throw new Error("공통 개요에 상세 단락 항목이 부재합니다.");
  }

  // 2. 지정 플랫폼들 로드
  const projectPlats = await getProjectPlatforms(projectId);
  if (!projectPlats || projectPlats.length === 0) {
    throw new Error("매핑된 마케팅 발행 채널 플랫폼이 없습니다.");
  }

  // 3. 이전 생성 이력이나 잡이 있다면 취소/삭제 처리
  const { data: oldContents } = await supabase
    .from("platform_contents")
    .select("id")
    .eq("project_id", projectId);
  
  if (oldContents && oldContents.length > 0) {
    const oldIds = oldContents.map((oc) => oc.id);
    await supabase.from("platform_contents").delete().in("id", oldIds);
  }

  // 4. 비동기 백그라운드 추적용 마스터 Job 생성
  const { data: masterJob, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      job_type: "PLATFORM_TRANSFORMATION",
      provider: process.env.AI_PROVIDER || "MOCK",
      model_name: process.env.AI_TEXT_MODEL || "gemini-1.5-pro",
      status: "PROCESSING",
    })
    .select()
    .single();

  if (jobError) throw new Error(`AI Job 생성 실패: ${jobError.message}`);

  // 5. 플랫폼 콘텐츠 레코드 및 섹션 레코드 사전 적재 (QUEUED)
  const createdContents: any[] = [];
  
  for (const pp of projectPlats) {
    // 5-1. 플랫폼별 맞춤 개요 분기 생성 (AI Provider 활용)
    const platTemplate = await getPromptTemplate("PLATFORM_OUTLINE_GENERATION");
    const aiProvider = getAIProvider();
    
    const plainOutlineInput = {
      title_candidates: commonOutline.title_candidates || [],
      selected_title: commonOutline.selected_title || "",
      intro_direction: commonOutline.intro_direction || "",
      sections: commonItems.map((ci) => ({
        title: ci.title,
        description: ci.description || "",
        item_type: ci.item_type as any,
        heading_level: ci.heading_level,
      })),
      conclusion_direction: commonOutline.conclusion_direction || "",
      cta_direction: commonOutline.cta_direction || "",
    };

    const platOutline = await aiProvider.generatePlatformOutline(
      platTemplate,
      plainOutlineInput,
      pp.platform_code,
      pp.platform_rules
    );

    // 5-2. 플랫폼 개요 DB 등록
    const { data: pOutline } = await supabase
      .from("content_outlines")
      .insert({
        project_id: projectId,
        platform_id: pp.platform_id,
        title_candidates: platOutline.title_candidates,
        selected_title: platOutline.selected_title,
        intro_direction: platOutline.intro_direction,
        conclusion_direction: platOutline.conclusion_direction,
        cta_direction: platOutline.cta_direction,
        status: "APPROVED",
      })
      .select()
      .single();

    if (!pOutline) throw new Error(`${pp.platform_name}용 개요 작성 실패`);

    // 플랫폼 개요 상세 항목 적재
    const platItemsToInsert = platOutline.sections.map((item, idx) => ({
      outline_id: pOutline.id,
      item_type: item.item_type,
      heading_level: item.heading_level,
      title: item.title,
      description: item.description,
      sort_order: idx + 1,
    }));
    await supabase.from("outline_items").insert(platItemsToInsert);

    // 5-3. platform_contents 행 삽입
    const { data: pContent } = await supabase
      .from("platform_contents")
      .insert({
        workspace_id: workspaceId,
        project_id: projectId,
        platform_id: pp.platform_id,
        title: platOutline.selected_title,
        status: "NEEDS_REVIEW",
        generation_status: "QUEUED",
      })
      .select()
      .single();

    if (!pContent) throw new Error(`${pp.platform_name} 본문 홀더 생성 실패`);

    // 5-4. content_sections 단락별 뼈대 행 삽입 (QUEUED)
    const { data: reloadedPlatItems } = await supabase
      .from("outline_items")
      .select("*")
      .eq("outline_id", pOutline.id)
      .order("sort_order", { ascending: true });

    const sectionsToInsert = (reloadedPlatItems || []).map((item, idx) => ({
      platform_content_id: pContent.id,
      outline_item_id: item.id,
      section_type: item.item_type,
      heading_level: item.heading_level,
      heading: item.title,
      sort_order: idx + 1,
      generation_status: "QUEUED",
    }));

    await supabase.from("content_sections").insert(sectionsToInsert);

    createdContents.push({
      contentId: pContent.id,
      platformCode: pp.platform_code,
      platformId: pp.platform_id,
      imageStyle: project.wizard_data?.step6?.style || "PHOTO_REALISTIC",
      imageCount: pp.requested_image_count || 0,
    });
  }

  const experience = await getProjectExperience(projectId);
  const secTemplate = await getPromptTemplate("SECTION_GENERATION");
  const metaTemplate = await getPromptTemplate("METADATA_GENERATION");
  const imgTemplate = await getPromptTemplate("IMAGE_PLAN_GENERATION");

  // 6. 비동기 백그라운드 원고 채우기 워커 기동 (await 없이 실행해 즉시 호출 종료 유도)
  runBackgroundGeneration(
    masterJob.id,
    projectId,
    workspaceId,
    userId,
    createdContents,
    project,
    experience,
    secTemplate,
    metaTemplate,
    imgTemplate
  );

  // 프로젝트 상태 업데이트 (OUTLINE_READY -> GENERATING)
  await supabase
    .from("content_projects")
    .update({ status: "GENERATING" })
    .eq("id", projectId);

  revalidatePath(`/contents/${projectId}/generating`);
  return { jobId: masterJob.id };
}

// 비동기 백그라운드 생성 실행 핵심 제어 루프
async function runBackgroundGeneration(
  jobId: string,
  projectId: string,
  workspaceId: string,
  userId: string,
  contentsList: { contentId: string; platformCode: string; platformId: string; imageStyle: string; imageCount: number }[],
  project: any,
  experience: any,
  secTemplate: any,
  metaTemplate: any,
  imgTemplate: any
) {
  console.log(">>> [BG WORKER] runBackgroundGeneration started:", { jobId, projectId, workspaceId, userId, contentsListLength: contentsList.length });
  try {
    const supabase = createAdminClient();
    const aiProvider = getAIProvider();

    // 프로젝트 기획, 보이스, 경험 데이터 사전 획득 (파라미터 전달받았으므로 DB 재호출 생략)
    const isMock = (process.env.AI_PROVIDER || "MOCK").toUpperCase() === "MOCK";

    let hasError = false;

    for (const item of contentsList) {
      try {
        console.log(`>>> [BG WORKER] Processing platform content id: ${item.contentId}, platform: ${item.platformCode}`);
        // 1. 중간 취소 체크
        const { data: jobCheck } = await supabase.from("ai_jobs").select("status").eq("id", jobId).single();
        if (jobCheck?.status === "CANCELLED") {
          console.log(">>> [BG WORKER] Job was cancelled, breaking loop.");
          break;
        }

        // 2. 플랫폼 진행 상태 변경 (QUEUED -> PROCESSING)
        await supabase
          .from("platform_contents")
          .update({ generation_status: "PROCESSING" })
          .eq("id", item.contentId);

        // 3. 섹션 목록 로드
        const { data: sections } = await supabase
          .from("content_sections")
          .select("*")
          .eq("platform_content_id", item.contentId)
          .order("sort_order", { ascending: true });

        if (!sections) {
          console.log(`>>> [BG WORKER] No sections found for content: ${item.contentId}`);
          continue;
        }

        console.log(`>>> [BG WORKER] Found ${sections.length} sections to generate.`);
        let precedingText = "";

        for (const sec of sections) {
          // 단락 처리 전 취소 체크
          const { data: jc } = await supabase.from("ai_jobs").select("status").eq("id", jobId).single();
          if (jc?.status === "CANCELLED") {
            console.log(">>> [BG WORKER] Job cancelled during sections loop.");
            // 남은 섹션들 취소 마킹
            await supabase
              .from("content_sections")
              .update({ generation_status: "FAILED" })
              .eq("platform_content_id", item.contentId)
              .eq("generation_status", "QUEUED");
            break;
          }

          // 섹션 진행 상태 변경 (QUEUED -> PROCESSING)
          await supabase
            .from("content_sections")
            .update({ generation_status: "PROCESSING" })
            .eq("id", sec.id);

          // 테스트 환경 E2E 시나리오 상 진행률바 스캔을 위해 인위적 지연 주입
          if (isMock) {
            await sleep(400);
          }

          try {
            console.log(`>>> [BG WORKER] Generating section: ${sec.heading}`);
            // 4. 개별 소제목 AI 생성 요청
            const secResult = await aiProvider.generateSection(secTemplate, {
              topic: project.topic || "",
              keywords: project.primary_keyword || "",
              heading: sec.heading || "",
              section_description: "", // 개요 설명
              preceding_sections_text: precedingText,
              experience_info: experience?.has_direct_experience ? (experience.motivation || "") : "",
              has_experience: !!experience?.has_direct_experience,
            });

            // HTML 정화 처리
            const cleanHtml = sanitizeHtml(secResult.body_html);

            // 저장
            await supabase
              .from("content_sections")
              .update({
                body_html: cleanHtml,
                body_text: secResult.body_text,
                generation_status: "COMPLETED",
              })
              .eq("id", sec.id);

            precedingText += `\n\n${sec.heading}\n${secResult.body_text}`;
            console.log(`>>> [BG WORKER] Section generated successfully: ${sec.heading}`);
          } catch (sErr: any) {
            console.error(`>>> [BG WORKER] Error generating section ${sec.heading}:`, sErr.message);
            hasError = true;
            await supabase
              .from("content_sections")
              .update({ generation_status: "FAILED" })
              .eq("id", sec.id);
            
            // 개별 Job 오류 기록
            await supabase.from("ai_jobs").insert({
              workspace_id: workspaceId,
              project_id: projectId,
              platform_content_id: item.contentId,
              section_id: sec.id,
              job_type: "SECTION_GENERATION",
              provider: process.env.AI_PROVIDER || "MOCK",
              model_name: process.env.AI_TEXT_MODEL || "gemini-1.5-pro",
              status: "FAILED",
              error_message: sErr.message,
            });
          }
        }

        // 5. 완료 후 전체 메타데이터 생성 및 결합
        const { data: jobCheckFinal } = await supabase.from("ai_jobs").select("status").eq("id", jobId).single();
        if (jobCheckFinal?.status === "CANCELLED") {
          await supabase
            .from("platform_contents")
            .update({ generation_status: "FAILED" })
            .eq("id", item.contentId);
          continue;
        }

        console.log(`>>> [BG WORKER] Combining sections for content: ${item.contentId}`);
        // 최종 결합을 위해 성공한 섹션들 로드
        const { data: successSecs } = await supabase
          .from("content_sections")
          .select("*")
          .eq("platform_content_id", item.contentId)
          .eq("generation_status", "COMPLETED")
          .order("sort_order", { ascending: true });

        const combinedHtml = (successSecs || []).map((s) => `<h3>${s.heading}</h3>${s.body_html}`).join("\n");
        const combinedText = (successSecs || []).map((s) => `${s.heading}\n${s.body_text}`).join("\n\n");

        console.log(`>>> [BG WORKER] Generating metadata & image plan for platform: ${item.platformCode}`);
        // AI 메타데이터 및 이미지 계획 생성 (전달받은 템플릿 이용)
        const meta = await aiProvider.generatePlatformMetadata(metaTemplate, item.platformCode, combinedText);
        const imgPlans = await aiProvider.generateImagePlan(imgTemplate, item.platformCode, combinedText, item.imageStyle, item.imageCount);

        console.log(`>>> [BG WORKER] Saving image plans to DB...`);
        // 이미지 계획 DB 저장
        const plansToInsert = imgPlans.map((ip) => ({
          project_id: projectId,
          platform_content_id: item.contentId,
          sequence_number: ip.sequence_number,
          role: ip.role,
          description: ip.description,
          prompt: ip.prompt,
          negative_prompt: ip.negative_prompt,
          aspect_ratio: ip.aspect_ratio,
          overlay_text: ip.overlay_text,
          status: "PENDING",
        }));
        await supabase.from("image_plans").insert(plansToInsert);

        console.log(`>>> [BG WORKER] Updating platform content combined version...`);
        // 플랫폼 콘텐츠 결합본 업데이트 및 정보 조회
        const { data: updatedContent } = await supabase
          .from("platform_contents")
          .update({
            seo_title: meta.seoTitle,
            meta_description: meta.metaDescription,
            slug: meta.slug,
            excerpt: meta.excerpt,
            hashtags: meta.hashtags,
            categories: meta.categories,
            tags: meta.tags,
            body_html: combinedHtml,
            body_text: combinedText,
            character_count: combinedText.length,
            word_count: combinedText.split(/\s+/).filter(Boolean).length,
            generation_status: "COMPLETED",
          })
          .eq("id", item.contentId)
          .select()
          .single();

        console.log(`>>> [BG WORKER] Creating initial GENERATED version snapshot...`);
        if (updatedContent) {
          const { error: verErr } = await supabase.from("content_versions").insert({
            platform_content_id: item.contentId,
            version_number: 1,
            version_type: "GENERATED",
            title: updatedContent.title || "초기 생성본",
            body_html: updatedContent.body_html,
            body_text: updatedContent.body_text,
            metadata_snapshot: {
              seo_title: updatedContent.seo_title,
              meta_description: updatedContent.meta_description,
              slug: updatedContent.slug,
              excerpt: updatedContent.excerpt,
              tags: updatedContent.tags,
              hashtags: updatedContent.hashtags,
              categories: updatedContent.categories,
            },
            change_summary: "AI 최초 콘텐츠 초안 생성 완료",
          });
          if (verErr) {
            console.error(">>> [BG WORKER] Initial version creation failed:", verErr.message);
          } else {
            console.log(">>> [BG WORKER] Initial version creation success!");
          }
        }

        console.log(`>>> [BG WORKER] Platform content ${item.platformCode} fully completed!`);

      } catch (pErr: any) {
        console.error(`>>> [BG WORKER] Error during loop item for content ${item.contentId}:`, pErr.stack || pErr.message);
        hasError = true;
        await supabase
          .from("platform_contents")
          .update({ generation_status: "FAILED" })
          .eq("id", item.contentId);
      }
    }

    // 6. 마스터 Job 완료 처리
    const { data: finalJob } = await supabase.from("ai_jobs").select("status").eq("id", jobId).single();
    if (finalJob?.status !== "CANCELLED") {
      const nextStatus = hasError ? "FAILED" : "COMPLETED";
      console.log(`>>> [BG WORKER] Setting final job status to: ${nextStatus}`);
      await supabase
        .from("ai_jobs")
        .update({ status: nextStatus, completed_at: new Date().toISOString() })
        .eq("id", jobId);

      // 프로젝트 최종 상태 업데이트 (GENERATING -> NEEDS_REVIEW)
      await supabase
        .from("content_projects")
        .update({ status: "NEEDS_REVIEW" })
        .eq("id", projectId);
      console.log(">>> [BG WORKER] Finished background generation worker.");
    }
  } catch (fatalErr: any) {
    console.error(">>> [BG WORKER] FATAL UNCAUGHT ERROR IN runBackgroundGeneration:", fatalErr.stack || fatalErr.message);
  }
}

// ==========================================
// 4. 생성 진행 상태 조회 및 취소 (getJobStatus, cancelJob, retrySection)
// ==========================================

export async function getJobStatus(projectId: string) {
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();

  // 최신 마스터 Job 조회
  const { data: job } = await supabase
    .from("ai_jobs")
    .select("*")
    .eq("project_id", projectId)
    .eq("job_type", "PLATFORM_TRANSFORMATION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log(">>> [getJobStatus] projectId:", projectId, "fetched job:", job);

  // 플랫폼별 콘텐츠 조회
  const { data: contents } = await supabase
    .from("platform_contents")
    .select("id, platform_id, generation_status, character_count")
    .eq("project_id", projectId);

  const contentIds = (contents || []).map((c) => c.id);

  // 섹션 목록 조회
  let sections: any[] = [];
  if (contentIds.length > 0) {
    const { data: secs } = await supabase
      .from("content_sections")
      .select("id, platform_content_id, heading, generation_status")
      .in("platform_content_id", contentIds)
      .order("sort_order", { ascending: true });
    sections = secs || [];
  }

  // 진행률 정량 계산
  const totalSections = sections.length;
  const completedSections = sections.filter((s) => s.generation_status === "COMPLETED").length;
  const progressPercent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  return {
    jobStatus: job?.status || "NOT_STARTED",
    jobId: job?.id || null,
    progressPercent,
    completedSections,
    totalSections,
    contents: contents || [],
    sections,
  };
}

export async function cancelJob(jobId: string) {
  const { workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // Job 취소 마킹
  const { data: job, error } = await supabase
    .from("ai_jobs")
    .update({ status: "CANCELLED", completed_at: new Date().toISOString() })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 진행 중이던 플랫폼 콘텐츠 및 대기 중 섹션들 실패처리 모사
  await supabase
    .from("platform_contents")
    .update({ generation_status: "FAILED" })
    .eq("project_id", job.project_id)
    .eq("generation_status", "PROCESSING");

  await supabase
    .from("content_projects")
    .update({ status: "SETUP" })
    .eq("id", job.project_id);

  revalidatePath(`/contents/${job.project_id}/generating`);
  return job;
}

export async function retrySection(sectionId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("content_sections")
    .select("*, platform_contents(*)")
    .eq("id", sectionId)
    .single();

  if (!section) throw new Error("섹션을 찾을 수 없습니다.");

  const projectId = (section.platform_contents as any).project_id;
  const contentId = section.platform_content_id;

  // 상태 변경
  await supabase
    .from("content_sections")
    .update({ generation_status: "PROCESSING" })
    .eq("id", sectionId);

  // 로드
  const project = await getProject(projectId);
  const experience = await getProjectExperience(projectId);
  
  const template = await getPromptTemplate("SECTION_GENERATION");
  const aiProvider = getAIProvider();

  try {
    const secResult = await aiProvider.generateSection(template, {
      topic: project.topic || "",
      keywords: project.primary_keyword || "",
      heading: section.heading || "",
      section_description: "",
      preceding_sections_text: "",
      experience_info: experience?.has_direct_experience ? (experience.motivation || "") : "",
      has_experience: !!experience?.has_direct_experience,
    });

    const cleanHtml = sanitizeHtml(secResult.body_html);

    await supabase
      .from("content_sections")
      .update({
        body_html: cleanHtml,
        body_text: secResult.body_text,
        generation_status: "COMPLETED",
      })
      .eq("id", sectionId);

    // 플랫폼 콘텐츠 본문 전체 재결합 업데이트
    const { data: successSecs } = await supabase
      .from("content_sections")
      .select("*")
      .eq("platform_content_id", contentId)
      .eq("generation_status", "COMPLETED")
      .order("sort_order", { ascending: true });

    const combinedHtml = (successSecs || []).map((s) => `<h3>${s.heading}</h3>${s.body_html}`).join("\n");
    const combinedText = (successSecs || []).map((s) => `${s.heading}\n${s.body_text}`).join("\n\n");

    await supabase
      .from("platform_contents")
      .update({
        body_html: combinedHtml,
        body_text: combinedText,
        character_count: combinedText.length,
        word_count: combinedText.split(/\s+/).filter(Boolean).length,
        generation_status: "COMPLETED",
      })
      .eq("id", contentId);

  } catch (err: any) {
    await supabase
      .from("content_sections")
      .update({ generation_status: "FAILED" })
      .eq("id", sectionId);
    throw err;
  }

  revalidatePath(`/contents/${projectId}/result`);
  return { success: true };
}

// 6. 단일 기획 화면에서 브리프-개요-콘텐츠 생성까지 논스톱 파이프라인 자동화
export async function startAutoGeneration(projectId: string) {
  // 1. 브리프 생성 및 승인
  await generateBrief(projectId);
  await approveBrief(projectId);

  // 2. 공통 개요 생성
  await generateCommonOutline(projectId);

  // 3. 생성된 공통 개요 ID 찾기
  const supabase = await createClient();
  const { data: outline } = await supabase
    .from("content_outlines")
    .select("id")
    .eq("project_id", projectId)
    .is("platform_id", null)
    .single();

  if (!outline) {
    throw new Error("공통 개요 생성 후 개요 정보를 찾을 수 없습니다.");
  }

  // 4. 개요 승인
  await approveOutline(outline.id);

  // 5. 플랫폼 콘텐츠 본문 생성 개시
  await generatePlatformContents(projectId);

  return { success: true };
}
