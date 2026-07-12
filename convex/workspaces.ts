import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 1. 현재 사용자가 속해 있는 워크스페이스 목록 및 관계 정보 조회
export const getMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const members = await ctx.db
      .query("workspace_members")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .collect();

    const workspaces = [];
    for (const m of members) {
      const ws = await ctx.db.get(m.workspace_id);
      if (ws) {
        workspaces.push({
          id: ws._id,
          name: ws.name,
          slug: ws.slug,
          role: m.role,
          status: m.status,
          plan_code: ws.plan_code,
        });
      }
    }

    return workspaces;
  },
});

// 2. 단일 워크스페이스 상세 조회 (멤버 권한 검증 포함)
export const getById = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    // 워크스페이스 멤버 여부 체크
    const member = await ctx.db
      .query("workspace_members")
      .withIndex("by_workspace_and_user", (q) =>
        q.eq("workspace_id", args.workspaceId).eq("user_id", userId)
      )
      .unique();

    if (!member) {
      throw new Error("해당 워크스페이스에 대한 접근 권한이 없습니다.");
    }

    const ws = await ctx.db.get(args.workspaceId);
    return ws;
  },
});

// 3. 신규 워크스페이스 생성
export const create = mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    // 슬러그 중복체크
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      throw new Error("이미 존재하는 슬러그(주소)입니다.");
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      slug: args.slug,
      owner_id: userId,
      plan_code: "FREE",
      status: "ACTIVE",
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 멤버 추가 (OWNER)
    await ctx.db.insert("workspace_members", {
      workspace_id: workspaceId,
      user_id: userId,
      role: "OWNER",
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    });

    // 기본 구독
    await ctx.db.insert("subscriptions", {
      workspace_id: workspaceId,
      plan_code: "FREE",
      status: "ACTIVE",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      limits: {
        monthly_credits: 50,
        used_credits: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return workspaceId;
  },
});

// 4. 워크스페이스 플랜 변경 (어드민 또는 빌딩용)
export const updatePlan = mutation({
  args: { workspaceId: v.id("workspaces"), planCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || !profile.is_admin) {
      throw new Error("어드민 권한이 필요합니다.");
    }

    await ctx.db.patch(args.workspaceId, {
      plan_code: args.planCode,
      updated_at: new Date().toISOString(),
    });

    // 구독 레코드 업데이트
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspace_id", (q) => q.eq("workspace_id", args.workspaceId))
      .unique();

    if (sub) {
      let credits = 50;
      if (args.planCode === "STANDARD") credits = 200;
      if (args.planCode === "PREMIUM") credits = 1000;

      await ctx.db.patch(sub._id, {
        plan_code: args.planCode,
        limits: {
          monthly_credits: credits,
          used_credits: sub.limits.used_credits || 0,
        },
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});
