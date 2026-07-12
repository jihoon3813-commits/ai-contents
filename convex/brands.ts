import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 1. 해당 워크스페이스의 브랜드 목록 조회 (삭제되지 않은 것)
export const getMyBrands = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("brands")
      .withIndex("by_workspace_active", (q) =>
        q.eq("workspace_id", args.workspaceId).eq("deleted_at", undefined)
      )
      .collect();
  },
});

// 2. 브랜드 상세 조회 (보이스 프로필 및 샘플 포함)
export const getDetails = query({
  args: { brandId: v.id("brands") },
  handler: async (ctx, args) => {
    const brand = await ctx.db.get(args.brandId);
    if (!brand || brand.deleted_at !== undefined) {
      return null;
    }

    const voiceProfile = await ctx.db
      .query("brand_voice_profiles")
      .withIndex("by_brand_id", (q) => q.eq("brand_id", args.brandId))
      .unique();

    const samples = await ctx.db
      .query("brand_samples")
      .withIndex("by_brand_id", (q) => q.eq("brand_id", args.brandId))
      .collect();

    return {
      ...brand,
      voice_profile: voiceProfile || null,
      samples: samples || [],
    };
  },
});

// 3. 신규 브랜드 생성
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    target_audience: v.optional(v.string()),
    brand_colors: v.optional(v.any()),
    is_default: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 만약 기본값(is_default)이 true라면 기존 기본 브랜드들은 모두 false로 변경
    if (args.is_default) {
      const activeBrands = await ctx.db
        .query("brands")
        .withIndex("by_workspace_active", (q) =>
          q.eq("workspace_id", args.workspaceId).eq("deleted_at", undefined)
        )
        .collect();

      for (const b of activeBrands) {
        if (b.is_default) {
          await ctx.db.patch(b._id, { is_default: false });
        }
      }
    }

    const brandId = await ctx.db.insert("brands", {
      workspace_id: args.workspaceId,
      name: args.name,
      industry: args.industry,
      description: args.description,
      target_audience: args.target_audience,
      brand_colors: args.brand_colors,
      is_default: args.is_default,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 기본 보이스 프로필 자동 생성
    await ctx.db.insert("brand_voice_profiles", {
      brand_id: brandId,
      style_description: "",
      tones: [],
      rules: [],
      prohibited_words: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return brandId;
  },
});

// 4. 브랜드 기본 정보 갱신
export const update = mutation({
  args: {
    brandId: v.id("brands"),
    name: v.string(),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    target_audience: v.optional(v.string()),
    brand_colors: v.optional(v.any()),
    is_default: v.boolean(),
  },
  handler: async (ctx, args) => {
    const brand = await ctx.db.get(args.brandId);
    if (!brand) throw new Error("브랜드가 존재하지 않습니다.");

    if (args.is_default && !brand.is_default) {
      const activeBrands = await ctx.db
        .query("brands")
        .withIndex("by_workspace_active", (q) =>
          q.eq("workspace_id", brand.workspace_id).eq("deleted_at", undefined)
        )
        .collect();

      for (const b of activeBrands) {
        if (b.is_default) {
          await ctx.db.patch(b._id, { is_default: false });
        }
      }
    }

    await ctx.db.patch(args.brandId, {
      name: args.name,
      industry: args.industry,
      description: args.description,
      target_audience: args.target_audience,
      brand_colors: args.brand_colors,
      is_default: args.is_default,
      updated_at: new Date().toISOString(),
    });

    return args.brandId;
  },
});

// 5. 브랜드 삭제 (소프트 딜리트)
export const remove = mutation({
  args: { brandId: v.id("brands") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.brandId, {
      deleted_at: new Date().toISOString(),
    });
    return { success: true };
  },
});

// 6. 보이스 프로필 정보 저장 및 업데이트
export const updateVoiceProfile = mutation({
  args: {
    brandId: v.id("brands"),
    style_description: v.optional(v.string()),
    tones: v.any(),
    rules: v.any(),
    prohibited_words: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("brand_voice_profiles")
      .withIndex("by_brand_id", (q) => q.eq("brand_id", args.brandId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        style_description: args.style_description,
        tones: args.tones,
        rules: args.rules,
        prohibited_words: args.prohibited_words,
        updated_at: new Date().toISOString(),
      });
      return existing._id;
    } else {
      const newProfileId = await ctx.db.insert("brand_voice_profiles", {
        brand_id: args.brandId,
        style_description: args.style_description,
        tones: args.tones,
        rules: args.rules,
        prohibited_words: args.prohibited_words,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return newProfileId;
    }
  },
});

// 7. 문서 샘플 추가
export const addSample = mutation({
  args: {
    brandId: v.id("brands"),
    title: v.string(),
    content_text: v.string(),
    content_type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sampleId = await ctx.db.insert("brand_samples", {
      brand_id: args.brandId,
      title: args.title,
      content_text: args.content_text,
      content_type: args.content_type,
      created_at: new Date().toISOString(),
    });
    return sampleId;
  },
});

// 8. 문서 샘플 삭제
export const removeSample = mutation({
  args: { sampleId: v.id("brand_samples") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sampleId);
    return { success: true };
  },
});
