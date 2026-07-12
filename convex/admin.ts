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

    const systemSettings = await ctx.db.query("system_settings").collect();

    return {
      profiles: profiles || [],
      workspaces: workspaces || [],
      errorLogs: errorLogs || [],
      promptTemplates: promptTemplates || [],
      systemSettings: systemSettings || [],
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

// 3. 시스템 설정 조회 (어드민 또는 백엔드 서버 액션)
export const getSystemSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return null;
    
    const setting = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value || null;
  },
});

// 4. 시스템 설정 저장 (어드민 전용)
export const saveSystemSetting = mutation({
  args: { key: v.string(), value: v.string(), description: v.optional(v.string()) },
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

    const existing = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description || existing.description,
        updated_at: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("system_settings", {
        key: args.key,
        value: args.value,
        description: args.description || "",
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});
