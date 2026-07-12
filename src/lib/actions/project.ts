"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  PLATFORM_DEFAULTS,
} from "@/lib/schemas/project";

// 헬퍼: 현재 로그인한 사용자의 워크스페이스 정보 및 권한 검증
async function verifyWorkspaceMembership(requiredRoles: string[] = ["OWNER", "ADMIN", "EDITOR"]) {
  // 1. Convex Auth 인증 상태 우선 확인
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

          const { createAdminClient } = await import("@/lib/supabase/server");
          const adminSupabase = createAdminClient();

          // 1) Convex User Email을 조회하여 Supabase User UUID 획득 및 프로필 동기화
          let email: string | null = null;
          try {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
              email = payload.email || payload.email_verified || null;
            }
          } catch (jwtErr) {
            console.error("Failed to decode Convex JWT:", jwtErr);
          }

          if (!email) {
            try {
              email = await fetchQuery(api.profiles.getCurrentUserEmail, {}, { token });
            } catch (convexErr) {
              console.error("Failed to fetch email from Convex query:", convexErr);
            }
          }

          if (!email) {
            throw new Error("사용자 이메일을 식별할 수 없습니다. Convex 함수가 동기화되지 않았거나 토큰이 유효하지 않습니다.");
          }

          const { data: listData } = await adminSupabase.auth.admin.listUsers();
          const targetUser = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          let supabaseUserId = targetUser?.id;

          if (!supabaseUserId) {
            // Supabase에 유저가 없을 경우 자동 생성
            const { data: createdUser } = await adminSupabase.auth.admin.createUser({
              email: email,
              email_confirm: true,
              user_metadata: { name: profile.name || "사용자" }
            });
            supabaseUserId = createdUser?.user?.id;
          }

          if (!supabaseUserId) {
            throw new Error("Supabase 사용자 동기화 실패");
          }

          // Supabase public.profiles 레코드 존재 보장
          const { data: supabaseProfile } = await adminSupabase
            .from("profiles")
            .select("id")
            .eq("id", supabaseUserId)
            .maybeSingle();

          if (!supabaseProfile) {
            await adminSupabase.from("profiles").insert({
              id: supabaseUserId,
              name: profile.name || "사용자",
              avatar_url: profile.avatar_url,
              timezone: profile.timezone || "Asia/Seoul",
              language: profile.language || "ko",
              onboarding_completed: true,
              is_admin: profile.is_admin || false,
            });
          }

          // 2) Convex Workspace Slug를 기준으로 Supabase Workspace UUID 조회 및 자동 생성 동기화
          const { data: supabaseWs } = await adminSupabase
            .from("workspaces")
            .select("id")
            .eq("slug", activeWs.slug)
            .maybeSingle();

          let supabaseWorkspaceId = supabaseWs?.id;
          if (!supabaseWorkspaceId) {
            const { data: newWs } = await adminSupabase
              .from("workspaces")
              .insert({
                name: activeWs.name,
                slug: activeWs.slug,
                plan_code: activeWs.plan_code || "FREE",
                status: "ACTIVE",
              })
              .select("id")
              .single();
            supabaseWorkspaceId = newWs?.id;
          }

          if (!supabaseWorkspaceId) {
            throw new Error("Supabase 워크스페이스 동기화 실패");
          }

          return { userId: supabaseUserId, workspaceId: supabaseWorkspaceId, userRole: activeWs.role };
        }
      }
    }
  } catch (convexAuthErr) {
    console.error("verifyWorkspaceMembership Convex Auth Error:", convexAuthErr);
  }

  // 2. Convex Auth 토큰이 없을 때만 기존 Supabase Auth 조회
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("인증되지 않은 사용자입니다.");
  }

  // 첫 번째 소속 워크스페이스 정보 로드
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

// 1. 활성 플랫폼 마스터 목록 조회
export async function getActivePlatforms() {
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platforms")
    .select("*")
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return data;
}

// 2. 프로젝트 단건 조회
export async function getProject(projectId: string) {
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("프로젝트를 찾을 수 없거나 접근 권한이 없습니다.");
  return data;
}

// 3. 프로젝트 채널 매핑 조회 (JS단에서 마스터 플랫폼 정보와 결합하여 전달)
export async function getProjectPlatforms(projectId: string) {
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();

  const { data: projectPlats, error: ppError } = await supabase
    .from("project_platforms")
    .select("*")
    .eq("project_id", projectId);

  if (ppError) throw new Error(ppError.message);

  const { data: plats, error: pError } = await supabase
    .from("platforms")
    .select("*");

  if (pError) throw new Error(pError.message);

  return projectPlats.map((pp) => {
    const platform = plats.find((p) => p.id === pp.platform_id);
    return {
      ...pp,
      platform_code: platform?.code || "",
      platform_name: platform?.name || "",
      platform_category: platform?.category || "",
      platform_rules: platform?.default_rules || {},
    };
  });
}

// 4. 프로젝트 경험 요약 조회
export async function getProjectExperience(projectId: string) {
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_experiences")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data || null;
}

// 5. 프로젝트 전체 목록 조회 (워크스페이스 필터링 필수)
export async function getProjects(filters?: {
  brand_id?: string;
  platform_id?: string;
  status?: string;
  content_goal?: string;
  content_type?: string;
  search?: string;
}) {
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();

  let query = supabase
    .from("content_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filters?.brand_id) {
    query = query.eq("brand_id", filters.brand_id);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.content_goal) {
    query = query.eq("content_goal", filters.content_goal);
  }
  if (filters?.content_type) {
    query = query.eq("content_type", filters.content_type);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,topic.ilike.%${filters.search}%`);
  }

  const { data: rawProjects, error } = await query;
  if (error) throw new Error(error.message);

  // platform_id 필터가 있는 경우 JS단에서 필터링
  let filtered = rawProjects;
  if (filters?.platform_id) {
    const { data: projectPlats } = await supabase
      .from("project_platforms")
      .select("project_id")
      .eq("platform_id", filters.platform_id);
    
    const matchedProjectIds = new Set((projectPlats || []).map((pp) => pp.project_id));
    filtered = rawProjects.filter((p) => matchedProjectIds.has(p.id));
  }

  // 브랜드 정보 결합을 위해 브랜드 목록 조회
  const { data: brands } = await supabase
    .from("brands")
    .select("id, name");

  const brandMap = new Map((brands || []).map((b) => [b.id, b.name]));

  // 매핑된 플랫폼 목록 결합
  const { data: allProjectPlats } = await supabase
    .from("project_platforms")
    .select("project_id, platform_id");
  const { data: allPlats } = await supabase
    .from("platforms")
    .select("id, code, name");

  const platMap = new Map((allPlats || []).map((p) => [p.id, p]));
  const projectPlatsGroup: Record<string, { code: string; name: string }[]> = {};

  (allProjectPlats || []).forEach((pp) => {
    const plat = platMap.get(pp.platform_id);
    if (plat) {
      if (!projectPlatsGroup[pp.project_id]) {
        projectPlatsGroup[pp.project_id] = [];
      }
      projectPlatsGroup[pp.project_id].push({ code: plat.code, name: plat.name });
    }
  });

  return filtered.map((p) => ({
    ...p,
    brand_name: brandMap.get(p.brand_id) || "알 수 없는 브랜드",
    platforms: projectPlatsGroup[p.id] || [],
  }));
}

// 6. 신규 빈 프로젝트 생성 (최초 SETUP 단계 발급)
export async function createProject(brandId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  const { data: newProj, error } = await supabase
    .from("content_projects")
    .insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      title: "새 콘텐츠 기획안",
      topic: "",
      primary_keyword: "",
      content_goal: "SEARCH_TRAFFIC",
      content_type: "INFORMATIONAL",
      status: "SETUP",
      generation_status: "NOT_STARTED",
      current_step: 1,
      wizard_data: {},
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return newProj;
}

// 7. 마법사 단계 저장 (디바운스/수동 다음 스텝 저장 공용)
export async function saveProjectStep(projectId: string, stepNumber: number, stepData: any) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 기존 프로젝트 확인
  const project = await getProject(projectId);

  let parsedData: any = {};
  const currentWizard = { ...(project.wizard_data || {}) };

  // 각 단계별 스키마 검증 및 데이터베이스 동기화 필드 추출
  const updates: Record<string, any> = {
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (stepNumber === 1) {
    parsedData = step1Schema.parse(stepData);
    currentWizard.step1 = parsedData;

    updates.brand_id = parsedData.brand_id;
    updates.content_goal = parsedData.content_goal;
    updates.content_type = parsedData.content_type;
    updates.category = parsedData.category;
    updates.target_audience = parsedData.target_audience;
    updates.audience_stage = parsedData.audience_stage;

    // 선택된 플랫폼 매핑 초기화/동기화
    const { data: activePlats } = await supabase.from("platforms").select("*");
    const platCodesToIds = new Map((activePlats || []).map((p) => [p.code, p.id]));

    // 기존 매핑 삭제
    await supabase
      .from("project_platforms")
      .delete()
      .eq("project_id", projectId);

    // 새 매핑 배치 삽입
    const platformInserts = parsedData.platforms.map((code: string) => {
      const platformId = platCodesToIds.get(code);
      if (!platformId) throw new Error(`지원하지 않는 플랫폼 코드: ${code}`);

      const defaults = PLATFORM_DEFAULTS[code as keyof typeof PLATFORM_DEFAULTS];
      return {
        project_id: projectId,
        platform_id: platformId,
        target_character_count: defaults.target_character_count,
        requested_image_count: defaults.requested_image_count,
        platform_settings: defaults,
      };
    });

    if (platformInserts.length > 0) {
      const { error: piError } = await supabase.from("project_platforms").insert(platformInserts);
      if (piError) throw new Error(`플랫폼 매핑 저장 실패: ${piError.message}`);
    }
  } else if (stepNumber === 2) {
    parsedData = step2Schema.parse(stepData);
    currentWizard.step2 = parsedData;

    updates.title = parsedData.title;
    updates.topic = parsedData.topic;
    updates.primary_keyword = parsedData.primary_keyword;
    updates.secondary_keywords = parsedData.secondary_keywords;
    updates.excluded_keywords = parsedData.excluded_keywords;
    updates.region_name = parsedData.region_name;
    updates.product_name = parsedData.product_name;
    updates.required_points = parsedData.required_points;
    updates.forbidden_phrases = parsedData.forbidden_phrases;
    updates.source_notes = parsedData.source_notes;
  } else if (stepNumber === 3) {
    parsedData = step3Schema.parse(stepData);
    currentWizard.step3 = parsedData;

    // content_experiences 데이터 upsert
    const { error: expError } = await supabase
      .from("content_experiences")
      .upsert({
        project_id: projectId,
        has_direct_experience: parsedData.has_direct_experience,
        usage_period: parsedData.usage_period,
        motivation: parsedData.motivation,
        problem_before: parsedData.problem_before,
        change_after: parsedData.change_after,
        advantages: parsedData.advantages,
        disadvantages: parsedData.disadvantages,
        recommended_for: parsedData.recommended_for,
        not_recommended_for: parsedData.not_recommended_for,
        real_episode: parsedData.real_episode,
        price_info: parsedData.price_info,
        experienced_at: parsedData.experienced_at || null,
        additional_notes: parsedData.additional_notes,
        confirmed_by_user: parsedData.confirmed_by_user,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id" });

    if (expError) throw new Error(`경험 정보 저장 실패: ${expError.message}`);
  } else if (stepNumber === 4) {
    parsedData = step4Schema.parse(stepData);
    currentWizard.step4 = parsedData;

    updates.target_character_count = parsedData.target_character_count;
    updates.requested_image_count = parsedData.requested_image_count;

    // 만약 개별 플랫폼 상세가 있다면 매핑 테이블 개별 업데이트
    const { data: projectPlats } = await supabase
      .from("project_platforms")
      .select("*")
      .eq("project_id", projectId);

    if (projectPlats && projectPlats.length > 0) {
      for (const pp of projectPlats) {
        // 단일 플랫폼에 대해서도 목표 글자수 및 이미지수 업데이트
        await supabase
          .from("project_platforms")
          .update({
            target_character_count: parsedData.target_character_count,
            requested_image_count: parsedData.requested_image_count,
            platform_settings: {
              ...pp.platform_settings,
              title_candidates_count: parsedData.title_candidates_count,
              subheadings_count: parsedData.subheadings_count,
              faq_count: parsedData.faq_count,
              has_toc: parsedData.has_toc,
            },
          })
          .eq("id", pp.id);
      }
    }
  } else if (stepNumber === 5) {
    parsedData = step5Schema.parse(stepData);
    currentWizard.step5 = parsedData;
  } else if (stepNumber === 6) {
    parsedData = step6Schema.parse(stepData);
    currentWizard.step6 = parsedData;

    updates.requested_image_count = parsedData.image_count;
    // 이미지 스타일 업데이트 적용
    const { data: projectPlats } = await supabase
      .from("project_platforms")
      .select("*")
      .eq("project_id", projectId);

    if (projectPlats && projectPlats.length > 0) {
      for (const pp of projectPlats) {
        await supabase
          .from("project_platforms")
          .update({
            requested_image_count: parsedData.image_count,
            platform_settings: {
              ...pp.platform_settings,
              image_style: parsedData.style,
              aspect_ratio: parsedData.aspect_ratio,
              text_overlay: parsedData.text_overlay,
            },
          })
          .eq("id", pp.id);
      }
    }
  }

  // wizard_data 객체 합산 갱신
  updates.wizard_data = currentWizard;
  
  // 신규 단계 이동 여부
  if (stepNumber < 6) {
    updates.current_step = Math.max(project.current_step, stepNumber + 1);
  }

  const { data: updatedProj, error: uError } = await supabase
    .from("content_projects")
    .update(updates)
    .eq("id", projectId)
    .select()
    .single();

  if (uError) throw new Error(uError.message);
  revalidatePath("/contents");
  return updatedProj;
}

// 8. 콘텐츠 기획 최종 승인 확정 (SETUP -> OUTLINE_READY로 전환)
export async function finalizeProjectSetup(projectId: string) {
  const { userId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  const project = await getProject(projectId);
  if (!project.wizard_data.step1 || !project.wizard_data.step2) {
    throw new Error("필수 설정 단계(기본 설정 및 주제)를 먼저 저장해야 기획안을 확정할 수 있습니다.");
  }

  const { data, error } = await supabase
    .from("content_projects")
    .update({
      status: "OUTLINE_READY",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/contents");
  return data;
}

// 9. 프로젝트 복제 (Duplication)
export async function duplicateProject(projectId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 원본 프로젝트 데이터 조회
  const original = await getProject(projectId);

  // 1. content_projects 삽입
  const { data: duplicated, error: cpError } = await supabase
    .from("content_projects")
    .insert({
      workspace_id: workspaceId,
      brand_id: original.brand_id,
      title: `[복제본] ${original.title}`,
      topic: original.topic,
      category: original.category,
      content_goal: original.content_goal,
      content_type: original.content_type,
      target_audience: original.target_audience,
      audience_stage: original.audience_stage,
      primary_keyword: original.primary_keyword,
      secondary_keywords: original.secondary_keywords,
      excluded_keywords: original.excluded_keywords,
      region_name: original.region_name,
      product_name: original.product_name,
      required_points: original.required_points,
      forbidden_phrases: original.forbidden_phrases,
      source_notes: original.source_notes,
      target_character_count: original.target_character_count,
      requested_image_count: original.requested_image_count,
      status: "SETUP", // 복사본은 처음부터 조율 가능하도록 SETUP으로 초기화
      generation_status: "NOT_STARTED",
      current_step: original.current_step,
      wizard_data: original.wizard_data,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (cpError) throw new Error(cpError.message);

  // 2. project_platforms 복제
  const { data: originalPlats } = await supabase
    .from("project_platforms")
    .select("*")
    .eq("project_id", projectId);

  if (originalPlats && originalPlats.length > 0) {
    const platInserts = originalPlats.map((op) => ({
      project_id: duplicated.id,
      platform_id: op.platform_id,
      target_character_count: op.target_character_count,
      requested_image_count: op.requested_image_count,
      platform_settings: op.platform_settings,
    }));
    await supabase.from("project_platforms").insert(platInserts);
  }

  // 3. content_experiences 복제
  const originalExp = await getProjectExperience(projectId);
  if (originalExp) {
    await supabase.from("content_experiences").insert({
      project_id: duplicated.id,
      has_direct_experience: originalExp.has_direct_experience,
      usage_period: originalExp.usage_period,
      motivation: originalExp.motivation,
      problem_before: originalExp.problem_before,
      change_after: originalExp.change_after,
      advantages: originalExp.advantages,
      disadvantages: originalExp.disadvantages,
      recommended_for: originalExp.recommended_for,
      not_recommended_for: originalExp.not_recommended_for,
      real_episode: originalExp.real_episode,
      price_info: originalExp.price_info,
      experienced_at: originalExp.experienced_at,
      additional_notes: originalExp.additional_notes,
      confirmed_by_user: originalExp.confirmed_by_user,
    });
  }

  revalidatePath("/contents");
  return duplicated;
}

// 10. 프로젝트 소프트 삭제 (Soft Delete)
export async function deleteProjectSoft(projectId: string) {
  const { userId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  // 소유 여부 먼저 검증
  await getProject(projectId);

  const { data, error } = await supabase
    .from("content_projects")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/contents");
  return data;
}

// 11. 프로젝트 보관 상태 변경 (ARCHIVED 토글)
export async function toggleArchiveProject(projectId: string, currentStatus: string) {
  const { userId } = await verifyWorkspaceMembership();
  const supabase = await createClient();

  const nextStatus = currentStatus === "ARCHIVED" ? "SETUP" : "ARCHIVED";

  const { data, error } = await supabase
    .from("content_projects")
    .update({
      status: nextStatus,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/contents");
  return data;
}

// 12. 단일 통합 기획 대시보드 저장 기능
export async function saveSimplifiedProject(
  projectId: string,
  data: {
    title: string;
    topic: string;
    demographics: {
      age: string[];
      gender: string;
      region: string;
      job: string;
      interests: string[];
    };
    referenceUrl?: string;
    imageCount: number;
    imageStyle: string;
    platforms: string[];
  }
) {
  try {
    const { userId, workspaceId } = await verifyWorkspaceMembership();
    const supabase = await createClient();

    // 1. 기본 브랜드 조회 (없을 시 일반 브랜드 폴백 및 자동 생성)
    let { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_default", true)
      .maybeSingle();

    if (!brand) {
      const { data: fallbackBrand } = await supabase
        .from("brands")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();
      
      brand = fallbackBrand;
    }

    if (!brand) {
      const adminSupabase = createAdminClient();
      const { data: newBrand, error: brandErr } = await adminSupabase
        .from("brands")
        .insert({
          workspace_id: workspaceId,
          name: "기본 브랜드",
          industry: "마케팅",
          description: "기본 마케팅 브랜드 프로필",
          is_default: true,
        })
        .select("id")
        .single();

      if (brandErr || !newBrand) {
        return { success: false, error: `기본 브랜드 자동 생성 실패: ${brandErr?.message || "알 수 없는 오류"}` };
      }
      
      // voice profile도 함께 생성
      await adminSupabase.from("voice_profiles").insert({
        brand_id: newBrand.id,
        style_description: "일반적이고 친근한 톤",
        tones: [],
        rules: [],
        prohibited_words: [],
      });

      brand = newBrand;
    }

    // 2. 타겟 오디언스 설명 조합
    const ageStr = data.demographics.age.length > 0 ? `연령대: ${data.demographics.age.join(", ")}` : "";
    const genderStr = data.demographics.gender ? `성별: ${data.demographics.gender}` : "";
    const regionStr = data.demographics.region ? `지역: ${data.demographics.region}` : "";
    const jobStr = data.demographics.job ? `직업: ${data.demographics.job}` : "";
    const interestStr = data.demographics.interests.length > 0 ? `관심사: ${data.demographics.interests.join(", ")}` : "";

    const targetAudienceCombined = [ageStr, genderStr, regionStr, jobStr, interestStr]
      .filter(Boolean)
      .join(" | ");

    // 3. 업데이트 데이터 조립
    const updates: any = {
      brand_id: brand.id,
      title: data.title,
      topic: data.topic,
      primary_keyword: data.topic,
      target_audience: targetAudienceCombined,
      content_goal: "SEARCH_TRAFFIC",
      content_type: "INFORMATIONAL",
      source_notes: data.referenceUrl ? `참고 URL: ${data.referenceUrl}` : "",
      requested_image_count: data.imageCount,
      updated_by: userId,
      updated_at: new Date().toISOString(),

      // 필수 wizard_data 모조 채우기
      wizard_data: {
        step1: {
          platforms: data.platforms,
          category: "마케팅",
          target_audience: targetAudienceCombined,
          audience_stage: "AWARENESS"
        },
        step2: {
          title: data.title,
          topic: data.topic,
          primary_keyword: data.topic,
          secondary_keywords: [],
          excluded_keywords: []
        }
      }
    };

    const { error: updateError } = await supabase
      .from("content_projects")
      .update(updates)
      .eq("id", projectId);

    if (updateError) return { success: false, error: `프로젝트 정보 업데이트 실패: ${updateError.message}` };

    // 4. 플랫폼 연동 초기화
    const activePlats = await getActivePlatforms();
    const platCodesToIds = new Map((activePlats || []).map((p: any) => [p.code, p.id]));

    // 기존 매핑 삭제
    await supabase
      .from("project_platforms")
      .delete()
      .eq("project_id", projectId);

    // 새 매핑 배치 삽입
    const platformInserts = data.platforms.map((code: string) => {
      const platformId = platCodesToIds.get(code);
      if (!platformId) {
        const availableCodes = Array.from(platCodesToIds.keys()).join(", ");
        throw new Error(`지원하지 않는 플랫폼 코드: ${code} (DB 내 지원 코드: [${availableCodes || "없음"}])`);
      }

      const defaults = PLATFORM_DEFAULTS[code as keyof typeof PLATFORM_DEFAULTS];
      return {
        project_id: projectId,
        platform_id: platformId,
        target_character_count: defaults.target_character_count,
        requested_image_count: data.imageCount,
        platform_settings: {
          ...defaults,
          image_style: data.imageStyle,
          requested_image_count: data.imageCount,
        },
      };
    });

    if (platformInserts.length > 0) {
      const { error: piError } = await supabase.from("project_platforms").insert(platformInserts);
      if (piError) return { success: false, error: `플랫폼 매핑 저장 실패: ${piError.message}` };
    }

    revalidatePath("/contents");
    return { success: true };
  } catch (err: any) {
    console.error("saveSimplifiedProject error:", err);
    return { success: false, error: err.message || "기획 정보 저장 중 예외가 발생했습니다." };
  }
}

// 13. 워크스페이스 설정 데이터 조회용 서버 액션 (Convex Auth 유저 RLS 우회 지원)
export async function getWorkspaceSettingsData() {
  try {
    const { userId, workspaceId, userRole } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
    const supabase = await createClient();

    // 1. 워크스페이스 정보 조회
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", workspaceId)
      .single();

    if (wsErr || !ws) {
      return { success: false, error: wsErr?.message || "워크스페이스를 찾을 수 없습니다." };
    }

    // 2. 구독 정보 조회
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("plan_code, status, limits")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    return {
      success: true,
      workspaceId: ws.id,
      userRole,
      workspace: {
        name: ws.name || "",
        slug: ws.slug || "",
      },
      subscription: subs || null,
    };
  } catch (err: any) {
    console.error("getWorkspaceSettingsData error:", err);
    return { success: false, error: err.message || "워크스페이스 정보를 로드할 수 없습니다." };
  }
}

// 14. 워크스페이스 설정 정보 수정용 서버 액션
export async function updateWorkspaceSettings(workspaceId: string, data: { name: string; slug: string }) {
  try {
    const { userRole } = await verifyWorkspaceMembership(["OWNER"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("workspaces")
      .update({
        name: data.name,
        slug: data.slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("updateWorkspaceSettings error:", err);
    return { success: false, error: err.message || "워크스페이스 정보 저장 중 오류가 발생했습니다." };
  }
}

