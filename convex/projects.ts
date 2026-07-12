import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// 1. 워크스페이스 내 프로젝트 목록 조회
export const getMyProjects = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("content_projects")
      .withIndex("by_workspace_id", (q) => q.eq("workspace_id", args.workspaceId))
      .order("desc")
      .collect();
  },
});

// 2. 프로젝트 상세 정보 및 하위 데이터 조회
export const getDetails = query({
  args: { projectId: v.id("content_projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const experiences = await ctx.db
      .query("content_experiences")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .collect();

    const brief = await ctx.db
      .query("content_briefs")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .unique();

    const outline = await ctx.db
      .query("content_outlines")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .unique();

    let outlineItems: any[] = [];
    if (outline) {
      outlineItems = await ctx.db
        .query("outline_items")
        .withIndex("by_outline_id", (q) => q.eq("outline_id", outline._id))
        .collect();
    }

    const platformContents = await ctx.db
      .query("platform_contents")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .collect();

    const platformContentsWithDetails = [];
    for (const pc of platformContents) {
      const sections = await ctx.db
        .query("content_sections")
        .withIndex("by_platform_content_id", (q) => q.eq("platform_content_id", pc._id))
        .collect();

      const imagePlans = await ctx.db
        .query("image_plans")
        .withIndex("by_platform_content_id", (q) => q.eq("platform_content_id", pc._id))
        .collect();

      const evaluations = await ctx.db
        .query("content_evaluations")
        .withIndex("by_platform_content_id", (q) => q.eq("platform_content_id", pc._id))
        .collect();

      const assets = await ctx.db
        .query("assets")
        .withIndex("by_platform_content_id", (q) => q.eq("platform_content_id", pc._id))
        .collect();

      platformContentsWithDetails.push({
        ...pc,
        sections: sections || [],
        image_plans: imagePlans || [],
        evaluations: evaluations || [],
        assets: assets || [],
      });
    }

    const facts = await ctx.db
      .query("content_facts")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .collect();

    return {
      ...project,
      experiences: experiences || [],
      brief: brief || null,
      outline: outline || null,
      outline_items: outlineItems || [],
      platform_contents: platformContentsWithDetails || [],
      facts: facts || [],
    };
  },
});

// 3. 신규 프로젝트 생성
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    brandId: v.id("brands"),
    title: v.string(),
    subject: v.string(),
    keywords: v.any(),
    status: v.string(),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("content_projects", {
      workspace_id: args.workspaceId,
      brand_id: args.brandId,
      title: args.title,
      subject: args.subject,
      keywords: args.keywords,
      status: args.status,
      settings: args.settings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return projectId;
  },
});

// 4. 프로젝트 상태 갱신
export const updateStatus = mutation({
  args: { projectId: v.id("content_projects"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: args.status,
      updated_at: new Date().toISOString(),
    });
    return args.projectId;
  },
});

// 5. 사용자 경험 정보 데이터 생성
export const addExperience = mutation({
  args: {
    projectId: v.id("content_projects"),
    type: v.string(),
    content_text: v.string(),
    raw_data: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("content_experiences", {
      project_id: args.projectId,
      type: args.type,
      content_text: args.content_text,
      raw_data: args.raw_data,
      created_at: new Date().toISOString(),
    });
  },
});

// 6. 브리프 정보 생성 및 저장
export const saveBrief = mutation({
  args: {
    projectId: v.id("content_projects"),
    brief_text: v.string(),
    raw_output: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("content_briefs")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        brief_text: args.brief_text,
        raw_output: args.raw_output,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("content_briefs", {
        project_id: args.projectId,
        brief_text: args.brief_text,
        raw_output: args.raw_output,
        created_at: new Date().toISOString(),
      });
    }
  },
});

// 7. 아웃라인 생성 및 저장
export const saveOutline = mutation({
  args: {
    projectId: v.id("content_projects"),
    outline_text: v.string(),
    raw_output: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("content_outlines")
      .withIndex("by_project_id", (q) => q.eq("project_id", args.projectId))
      .unique();

    let outlineId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        outline_text: args.outline_text,
        raw_output: args.raw_output,
      });
      outlineId = existing._id;
    } else {
      outlineId = await ctx.db.insert("content_outlines", {
        project_id: args.projectId,
        outline_text: args.outline_text,
        raw_output: args.raw_output,
        created_at: new Date().toISOString(),
      });
    }

    return outlineId;
  },
});

// 8. 아웃라인 세부 항목 일괄 저장
export const saveOutlineItems = mutation({
  args: {
    outlineId: v.id("content_outlines"),
    items: v.array(v.object({ title: v.string(), sort_order: v.number() })),
  },
  handler: async (ctx, args) => {
    // 기존 아이템 삭제
    const existing = await ctx.db
      .query("outline_items")
      .withIndex("by_outline_id", (q) => q.eq("outline_id", args.outlineId))
      .collect();

    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // 신규 아이템 생성
    const createdIds = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("outline_items", {
        outline_id: args.outlineId,
        title: item.title,
        sort_order: item.sort_order,
        created_at: new Date().toISOString(),
      });
      createdIds.push(id);
    }

    return createdIds;
  },
});

// 9. 플랫폼 콘텐츠 저장 및 생성
export const savePlatformContent = mutation({
  args: {
    projectId: v.id("content_projects"),
    platformCode: v.string(),
    generationStatus: v.string(),
    characterCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("platform_contents")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("project_id", args.projectId).eq("platform_code", args.platformCode)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        generation_status: args.generationStatus,
        character_count: args.characterCount,
        updated_at: new Date().toISOString(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("platform_contents", {
        project_id: args.projectId,
        platform_code: args.platformCode,
        generation_status: args.generationStatus,
        character_count: args.characterCount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  },
});

// 10. AI 백엔드 작업 생성
export const createAIJob = mutation({
  args: {
    projectId: v.id("content_projects"),
    jobType: v.string(),
    inputPayload: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ai_jobs", {
      project_id: args.projectId,
      job_type: args.jobType,
      status: "PENDING",
      input_payload: args.inputPayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  },
});

// 11. AI 백엔드 작업 업데이트
export const updateAIJob = mutation({
  args: {
    jobId: v.id("ai_jobs"),
    status: v.string(),
    outputResult: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("AI 작업을 찾을 수 없습니다.");

    const updates: any = {
      status: args.status,
      updated_at: new Date().toISOString(),
    };
    if (args.outputResult !== undefined) updates.output_result = args.outputResult;
    if (args.errorMessage !== undefined) updates.error_message = args.errorMessage;

    await ctx.db.patch(args.jobId, updates);
    return args.jobId;
  },
});
