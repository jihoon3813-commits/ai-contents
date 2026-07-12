"use server";

import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../../convex/_generated/api";

export async function getAdminDashboardData() {
  const token = await convexAuthNextjsToken();
  if (!token) throw new Error("인증되지 않은 사용자입니다.");
  return await fetchQuery(api.admin.getAdminDashboardData, {}, { token });
}

export async function toggleAdminStatus(targetUserId: string, isAdmin: boolean) {
  const token = await convexAuthNextjsToken();
  if (!token) throw new Error("인증되지 않은 사용자입니다.");
  return await fetchMutation(
    api.profiles.toggleAdmin,
    { targetUserId: targetUserId as any, isAdmin },
    { token }
  );
}

export async function updateWorkspacePlan(workspaceId: string, planCode: string) {
  const token = await convexAuthNextjsToken();
  if (!token) throw new Error("인증되지 않은 사용자입니다.");
  return await fetchMutation(
    api.workspaces.updatePlan,
    { workspaceId: workspaceId as any, planCode },
    { token }
  );
}

export async function resolveErrorLog(logId: string) {
  const token = await convexAuthNextjsToken();
  if (!token) throw new Error("인증되지 않은 사용자입니다.");
  return await fetchMutation(
    api.admin.resolveErrorLog,
    { logId: logId as any },
    { token }
  );
}
