import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 1. 현재 로그인한 사용자의 프로필 조회
export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile;
  },
});

// 2. ID 기준 프로필 조회 (서버/어드민용)
export const getById = query({
  args: { id: v.id("profiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// 3. 신규 회원가입 시 프로필 생성 또는 로그인 시 동기화
export const ensureProfileExists = mutation({
  args: { name: v.string(), avatar_url: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      // 신규 프로필 및 기본 워크스페이스 생성
      const profileId = await ctx.db.insert("profiles", {
        userId,
        name: args.name,
        avatar_url: args.avatar_url,
        timezone: "Asia/Seoul",
        language: "ko",
        onboarding_completed: false,
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 기본 워크스페이스 자동 생성
      const workspaceId = await ctx.db.insert("workspaces", {
        name: `${args.name}의 워크스페이스`,
        slug: `ws-${userId.toString().slice(0, 8)}-${Math.random().toString(36).substring(2, 6)}`,
        owner_id: userId,
        plan_code: "FREE",
        status: "ACTIVE",
        settings: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 멤버 관계 추가 (OWNER)
      await ctx.db.insert("workspace_members", {
        workspace_id: workspaceId,
        user_id: userId,
        role: "OWNER",
        status: "ACTIVE",
        created_at: new Date().toISOString(),
      });

      // 기본 구독 설정
      await ctx.db.insert("subscriptions", {
        workspace_id: workspaceId,
        plan_code: "FREE",
        status: "ACTIVE",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 뒤
        limits: {
          monthly_credits: 50,
          used_credits: 0,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      profile = await ctx.db.get(profileId);
    } else {
      // 기존 프로필 로그인 기록 갱신
      await ctx.db.patch(profile._id, {
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return profile;
  },
});

// 4. 프로필 정보 갱신
export const update = mutation({
  args: {
    name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    timezone: v.optional(v.string()),
    language: v.optional(v.string()),
    onboarding_completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("프로필이 존재하지 않습니다.");
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.avatar_url !== undefined) updates.avatar_url = args.avatar_url;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.language !== undefined) updates.language = args.language;
    if (args.onboarding_completed !== undefined) updates.onboarding_completed = args.onboarding_completed;

    await ctx.db.patch(profile._id, updates);
    return await ctx.db.get(profile._id);
  },
});

// 5. 어드민 권한 토글 (관리자용)
export const toggleAdmin = mutation({
  args: { targetUserId: v.id("users"), isAdmin: v.boolean() },
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

    const targetProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.targetUserId))
      .unique();

    if (!targetProfile) {
      throw new Error("대상 사용자의 프로필이 존재하지 않습니다.");
    }

    await ctx.db.patch(targetProfile._id, {
      is_admin: args.isAdmin,
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  },
});

// 6. 온보딩 완료 처리 및 기본 브랜드 생성
export const completeOnboarding = mutation({
  args: {
    goals: v.array(v.string()),
    brandData: v.optional(
      v.object({
        name: v.string(),
        industry: v.optional(v.string()),
        description: v.optional(v.string()),
        target_audience: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("인증되지 않은 사용자입니다.");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("프로필이 존재하지 않습니다.");
    }

    await ctx.db.patch(profile._id, {
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    });

    const member = await ctx.db
      .query("workspace_members")
      .withIndex("by_user_id", (q) => q.eq("user_id", userId))
      .first();

    if (member) {
      const workspace = await ctx.db.get(member.workspace_id);
      if (workspace) {
        await ctx.db.patch(workspace._id, {
          settings: { ...workspace.settings, onboarding_goals: args.goals },
          updated_at: new Date().toISOString(),
        });
      }

      if (args.brandData) {
        const activeBrands = await ctx.db
          .query("brands")
          .withIndex("by_workspace_active", (q) =>
            q.eq("workspace_id", member.workspace_id).eq("deleted_at", undefined)
          )
          .collect();

        for (const b of activeBrands) {
          if (b.is_default) {
            await ctx.db.patch(b._id, { is_default: false });
          }
        }

        const brandId = await ctx.db.insert("brands", {
          workspace_id: member.workspace_id,
          name: args.brandData.name,
          industry: args.brandData.industry,
          description: args.brandData.description,
          target_audience: args.brandData.target_audience,
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await ctx.db.insert("brand_voice_profiles", {
          brand_id: brandId,
          style_description: "",
          tones: [],
          rules: [],
          prohibited_words: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    return { success: true };
  },
});
