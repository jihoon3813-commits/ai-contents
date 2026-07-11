"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// 관리자 권한 여부 내부 검증 헬퍼
async function verifyAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("인증되지 않은 사용자입니다.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.is_admin) {
    throw new Error("어드민 관리자 권한이 없습니다.");
  }

  return { adminId: user.id };
}

// 1. 관리자 대시보드 종합 데이터 로드
export async function getAdminDashboardData() {
  await verifyAdminUser();
  const supabase = await createClient();

  // 1) 프로필 전체 목록
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  // 2) 워크스페이스 전체 목록
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: false });

  // 3) 미해결 에러 로그 목록
  const { data: errorLogs } = await supabase
    .from("error_logs")
    .select("*")
    .order("created_at", { ascending: false });

  // 4) 시스템 프롬프트 템플릿 목록
  const { data: promptTemplates } = await supabase
    .from("prompt_templates")
    .select("*")
    .order("code", { ascending: true });

  return {
    profiles: profiles || [],
    workspaces: workspaces || [],
    errorLogs: errorLogs || [],
    promptTemplates: promptTemplates || [],
  };
}

// 2. 관리자 권한 부여/취소 토글
export async function toggleAdminStatus(targetUserId: string, isAdmin: boolean) {
  const { adminId } = await verifyAdminUser();
  if (targetUserId === adminId) {
    throw new Error("자신의 관리자 권한은 스스로 변경할 수 없습니다.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin, updated_at: new Date().toISOString() })
    .eq("id", targetUserId);

  if (error) {
    throw new Error(`관리자 권한 변경 실패: ${error.message}`);
  }

  revalidatePath("/admin");
  return { success: true };
}

// 3. 워크스페이스 구독 플랜 수동 조정
export async function updateWorkspacePlan(workspaceId: string, planCode: string) {
  await verifyAdminUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({ plan_code: planCode, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);

  if (error) {
    throw new Error(`워크스페이스 플랜 변경 실패: ${error.message}`);
  }

  revalidatePath("/admin");
  return { success: true };
}

// 4. 장애 에러 로그 해결 조치 완료 처리
export async function resolveErrorLog(logId: string) {
  await verifyAdminUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("error_logs")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    throw new Error(`장애 조치 완료 처리 실패: ${error.message}`);
  }

  revalidatePath("/admin");
  return { success: true };
}
