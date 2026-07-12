import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 1. 관리자 대시보드 데이터 조회
export const getAdminDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    const currentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", currentUserId))
      .unique();

    if (!currentProfile || !currentProfile.is_admin) {
      throw new Error("어드민 권한이 필요합니다.");
    }

    const profiles = await ctx.db.query("profiles").order("desc").collect();
    const workspaces = await ctx.db.query("workspaces").order("desc").collect();
    const errorLogs = await ctx.db.query("error_logs").order("desc").collect();
    const promptTemplates = await ctx.db.query("prompt_templates").order("desc").collect();

    return {
      profiles: profiles || [],
      workspaces: workspaces || [],
      errorLogs: errorLogs || [],
      promptTemplates: promptTemplates || [],
    };
  },
});

// 2. 에러 로그 조치 완료 처리
export const resolveErrorLog = mutation({
  args: { logId: v.id("error_logs") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    const currentProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", currentUserId))
      .unique();

    if (!currentProfile || !currentProfile.is_admin) {
      throw new Error("어드민 권한이 필요합니다.");
    }

    await ctx.db.patch(args.logId, {
      resolved: true,
      resolved_at: new Date().toISOString(),
    });

    return { success: true };
  },
});
