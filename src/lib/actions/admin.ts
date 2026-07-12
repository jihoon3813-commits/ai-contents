"use server";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../../convex/_generated/api";

export async function getAdminDashboardData() {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return { success: false, error: "인증되지 않은 사용자입니다." };
    const data = await fetchQuery(api.admin.getAdminDashboardData, {}, { token });
    return { success: true, ...data };
  } catch (err: any) {
    console.error("getAdminDashboardData error:", err);
    return { success: false, error: err.message || "어드민 데이터 조회 중 예외가 발생했습니다." };
  }
}

export async function toggleAdminStatus(targetUserId: string, isAdmin: boolean) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return { success: false, error: "인증되지 않은 사용자입니다." };
    await fetchMutation(
      api.profiles.toggleAdmin,
      { targetUserId: targetUserId as any, isAdmin },
      { token }
    );
    return { success: true };
  } catch (err: any) {
    console.error("toggleAdminStatus error:", err);
    return { success: false, error: err.message || "관리자 권한 토글 중 예외가 발생했습니다." };
  }
}

export async function updateWorkspacePlan(workspaceId: string, planCode: string) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return { success: false, error: "인증되지 않은 사용자입니다." };
    await fetchMutation(
      api.workspaces.updatePlan,
      { workspaceId: workspaceId as any, planCode },
      { token }
    );
    return { success: true };
  } catch (err: any) {
    console.error("updateWorkspacePlan error:", err);
    return { success: false, error: err.message || "구독 정보 수정 중 예외가 발생했습니다." };
  }
}

export async function resolveErrorLog(logId: string) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return { success: false, error: "인증되지 않은 사용자입니다." };
    await fetchMutation(
      api.admin.resolveErrorLog,
      { logId: logId as any },
      { token }
    );
    return { success: true };
  } catch (err: any) {
    console.error("resolveErrorLog error:", err);
    return { success: false, error: err.message || "장애 상태 처리 중 예외가 발생했습니다." };
  }
}

export async function saveSystemSetting(key: string, value: string, description?: string) {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return { success: false, error: "인증되지 않은 사용자입니다." };
    await fetchMutation(
      api.admin.saveSystemSetting,
      { key, value, description },
      { token }
    );
    return { success: true };
  } catch (err: any) {
    console.error("saveSystemSetting error:", err);
    return { success: false, error: err.message || "시스템 설정 저장 중 예외가 발생했습니다." };
  }
}
