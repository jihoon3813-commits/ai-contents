import { SupabaseClient } from "@supabase/supabase-js";

export type UsageType =
  | "PROJECT_CREATION"
  | "CONTENT_CREATION"
  | "BRAND_CREATION"
  | "ACCOUNT_CONNECTION"
  | "STORAGE_SIZE";

export interface PlanLimits {
  monthlyProjects: number;
  monthlyContents: number;
  maxBrands: number;
  maxAccounts: number;
  maxStorageBytes: number;
}

// 무료 플랜(FREE) 및 엔터프라이즈 플랜 제한 규칙 정의
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    monthlyProjects: 5,
    monthlyContents: 10,
    maxBrands: 1,
    maxAccounts: 1,
    maxStorageBytes: 500 * 1024 * 1024, // 500MB
  },
  ENTERPRISE: {
    monthlyProjects: 999999,
    monthlyContents: 999999,
    maxBrands: 999999,
    maxAccounts: 999999,
    maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100GB
  }
};

/**
 * 워크스페이스의 특정 리소스 사용 제한 상태를 실시간 검사합니다.
 */
export async function checkWorkspaceUsageLimits(
  supabase: SupabaseClient,
  workspaceId: string,
  type: UsageType
): Promise<{ allowed: boolean; current: number; limit: number; resetDate: string }> {
  // 1) 워크스페이스 정보 조회 (구독 플랜 획득)
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("plan_code")
    .eq("id", workspaceId)
    .single();

  if (wsErr || !ws) {
    throw new Error("워크스페이스 정보를 찾을 수 없습니다.");
  }

  const plan = ws.plan_code || "FREE";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  // 다음 초기화/리셋 날짜 계산 (다음 달 1일)
  const nextMonth = new Date(year, now.getMonth() + 1, 1);
  const resetDate = nextMonth.toISOString().split("T")[0];

  let current = 0;
  let limit = 0;

  switch (type) {
    case "PROJECT_CREATION": {
      limit = limits.monthlyProjects;
      const startOfMonth = new Date(year, now.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from("content_projects")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfMonth);

      if (error) throw error;
      current = count || 0;
      break;
    }
    case "CONTENT_CREATION": {
      limit = limits.monthlyContents;
      const startOfMonth = new Date(year, now.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from("platform_contents")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("created_at", startOfMonth);

      if (error) throw error;
      current = count || 0;
      break;
    }
    case "BRAND_CREATION": {
      limit = limits.maxBrands;
      const { count, error } = await supabase
        .from("brands")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null);

      if (error) throw error;
      current = count || 0;
      break;
    }
    case "ACCOUNT_CONNECTION": {
      limit = limits.maxAccounts;
      const { count, error } = await supabase
        .from("platform_accounts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      current = count || 0;
      break;
    }
    case "STORAGE_SIZE": {
      limit = limits.maxStorageBytes;
      const { data, error } = await supabase
        .from("assets")
        .select("file_size")
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      current = (data || []).reduce((acc, curr) => acc + (curr.file_size || 0), 0);
      break;
    }
    default:
      throw new Error(`알 수 없는 사용량 유형입니다: ${type}`);
  }

  const allowed = current < limit;
  return { allowed, current, limit, resetDate };
}

/**
 * 리소스 사용 내역을 usage_records 테이블에 기록합니다.
 */
export async function recordUsage(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string | null,
  type: string,
  quantity: number,
  unit: string,
  referenceType?: string,
  referenceId?: string,
  metadata?: any
) {
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await supabase.from("usage_records").insert({
    workspace_id: workspaceId,
    user_id: userId,
    usage_type: type,
    quantity,
    unit,
    reference_type: referenceType || null,
    reference_id: referenceId || null,
    billing_period: billingPeriod,
    metadata: metadata || {},
  });
}
