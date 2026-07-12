import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth 테이블 정의 확장 (users, sessions, accounts 등)
  ...authTables,

  // 1. Profiles (프로필 테이블 - users와 1:1 관계)
  profiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    avatar_url: v.optional(v.string()),
    timezone: v.string(),
    language: v.string(),
    onboarding_completed: v.boolean(),
    is_admin: v.boolean(),
    last_login_at: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_is_admin", ["is_admin"]),

  // 2. Workspaces (워크스페이스 테이블)
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    owner_id: v.optional(v.id("users")),
    plan_code: v.string(),
    status: v.string(),
    settings: v.any(), // JSONB 대응
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner_id", ["owner_id"]),

  // 3. Workspace Members (워크스페이스 멤버 관계 테이블)
  workspace_members: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
    role: v.string(), // OWNER, ADMIN, EDITOR, VIEWER
    status: v.string(), // ACTIVE, INVITED, DISABLED
    invited_at: v.optional(v.string()),
    joined_at: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_user_id", ["user_id"])
    .index("by_workspace_and_user", ["workspace_id", "user_id"]),

  // 4. Subscriptions (구독 및 제한 테이블)
  subscriptions: defineTable({
    workspace_id: v.id("workspaces"),
    plan_code: v.string(),
    status: v.string(),
    current_period_start: v.string(),
    current_period_end: v.string(),
    limits: v.any(),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_workspace_id", ["workspace_id"]),

  // 5. Brands (브랜드 테이블)
  brands: defineTable({
    workspace_id: v.id("workspaces"),
    name: v.string(),
    industry: v.optional(v.string()),
    description: v.optional(v.string()),
    target_audience: v.optional(v.string()),
    brand_colors: v.optional(v.any()),
    is_default: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
    deleted_at: v.optional(v.string()),
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_workspace_active", ["workspace_id", "deleted_at"]),

  // 6. Brand Voice Profiles (브랜드 보이스 프로필)
  brand_voice_profiles: defineTable({
    brand_id: v.id("brands"),
    style_description: v.optional(v.string()),
    tones: v.any(),
    rules: v.any(),
    prohibited_words: v.any(),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_brand_id", ["brand_id"]),

  // 7. Brand Samples (브랜드 샘플 문서)
  brand_samples: defineTable({
    brand_id: v.id("brands"),
    title: v.string(),
    content_text: v.string(),
    content_type: v.optional(v.string()),
    created_at: v.string(),
  }).index("by_brand_id", ["brand_id"]),

  // 8. Platforms (플랫폼 마스터)
  platforms: defineTable({
    code: v.string(),
    name: v.string(),
    category: v.string(),
    icon_url: v.optional(v.string()),
    is_active: v.boolean(),
    created_at: v.string(),
  }).index("by_code", ["code"]),

  // 9. Content Projects (콘텐츠 제작 프로젝트)
  content_projects: defineTable({
    workspace_id: v.id("workspaces"),
    brand_id: v.id("brands"),
    title: v.string(),
    subject: v.string(),
    keywords: v.any(),
    status: v.string(),
    settings: v.any(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_brand_id", ["brand_id"]),

  // 10. Project Platforms (프로젝트 대상 플랫폼)
  project_platforms: defineTable({
    project_id: v.id("content_projects"),
    platform_code: v.string(),
    created_at: v.string(),
  }).index("by_project_id", ["project_id"]),

  // 11. Content Experiences (사용자 경험 데이터)
  content_experiences: defineTable({
    project_id: v.id("content_projects"),
    type: v.string(), // TEXT, IMAGE
    content_text: v.string(),
    raw_data: v.any(),
    created_at: v.string(),
  }).index("by_project_id", ["project_id"]),

  // 12. Prompt Templates (시스템 프롬프트 템플릿)
  prompt_templates: defineTable({
    code: v.string(),
    name: v.string(),
    system_prompt: v.string(),
    user_prompt_template: v.string(),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_code", ["code"]),

  // 13. Content Briefs (콘텐츠 기획안/브리프)
  content_briefs: defineTable({
    project_id: v.id("content_projects"),
    brief_text: v.string(),
    raw_output: v.any(),
    created_at: v.string(),
  }).index("by_project_id", ["project_id"]),

  // 14. Content Outlines (콘텐츠 개요/아웃라인)
  content_outlines: defineTable({
    project_id: v.id("content_projects"),
    outline_text: v.string(),
    raw_output: v.any(),
    created_at: v.string(),
  }).index("by_project_id", ["project_id"]),

  // 15. Outline Items (개요별 세부 항목)
  outline_items: defineTable({
    outline_id: v.id("content_outlines"),
    title: v.string(),
    sort_order: v.number(),
    created_at: v.string(),
  }).index("by_outline_id", ["outline_id"]),

  // 16. Platform Contents (플랫폼별 최종 생성본)
  platform_contents: defineTable({
    project_id: v.id("content_projects"),
    platform_code: v.string(),
    generation_status: v.string(),
    character_count: v.optional(v.number()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_project_id", ["project_id"])
    .index("by_project_and_platform", ["project_id", "platform_code"]),

  // 17. Content Sections (콘텐츠 섹션/문단 단위 정보)
  content_sections: defineTable({
    platform_content_id: v.id("platform_contents"),
    heading: v.optional(v.string()),
    body_text: v.string(),
    sort_order: v.number(),
    generation_status: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_platform_content_id", ["platform_content_id"])
    .index("by_content_and_order", ["platform_content_id", "sort_order"]),

  // 18. Image Plans (이미지 매칭 기획안)
  image_plans: defineTable({
    project_id: v.id("content_projects"),
    platform_content_id: v.id("platform_contents"),
    sequence_number: v.number(),
    role: v.string(),
    description: v.string(),
    prompt: v.string(),
    negative_prompt: v.optional(v.string()),
    aspect_ratio: v.string(),
    overlay_text: v.optional(v.string()),
    status: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_project_id", ["project_id"])
    .index("by_platform_content_id", ["platform_content_id"]),

  // 19. AI Jobs (배경 생성 작업 관리 상태)
  ai_jobs: defineTable({
    project_id: v.id("content_projects"),
    job_type: v.string(), // BRIEF, OUTLINE, SECTIONS, IMAGES 등
    status: v.string(), // PENDING, PROCESSING, COMPLETED, FAILED
    input_payload: v.any(),
    output_result: v.optional(v.any()),
    error_message: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_project_id", ["project_id"])
    .index("by_project_and_type", ["project_id", "job_type"]),

  // 20. Content Versions (콘텐츠 버전 히스토리)
  content_versions: defineTable({
    platform_content_id: v.id("platform_contents"),
    version_number: v.number(),
    version_type: v.string(),
    body_text: v.string(),
    change_summary: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_platform_content_id", ["platform_content_id"])
    .index("by_content_and_version", ["platform_content_id", "version_number"]),

  // 21. Content Evaluations (콘텐츠 평가 정보)
  content_evaluations: defineTable({
    platform_content_id: v.id("platform_contents"),
    seo_score: v.number(),
    readability_score: v.number(),
    credibility_score: v.number(),
    raw_output: v.any(),
    created_at: v.string(),
  }).index("by_platform_content_id", ["platform_content_id"]),

  // 22. Evaluation Issues (평가 시 발견된 문제점)
  evaluation_issues: defineTable({
    evaluation_id: v.id("content_evaluations"),
    category: v.string(),
    severity: v.string(),
    message: v.string(),
    suggestion: v.optional(v.string()),
    created_at: v.string(),
  }).index("by_evaluation_id", ["evaluation_id"]),

  // 23. Content Facts (신뢰 검증 사실 목록)
  content_facts: defineTable({
    project_id: v.id("content_projects"),
    fact_statement: v.string(),
    source_reference: v.optional(v.string()),
    verified: v.boolean(),
    created_at: v.string(),
  }).index("by_project_id", ["project_id"]),

  // 24. Assets (업로드된 리소스/이미지 목록)
  assets: defineTable({
    platform_content_id: v.id("platform_contents"),
    project_id: v.id("content_projects"),
    asset_type: v.string(),
    storage_path: v.string(),
    source_url: v.optional(v.string()),
    sort_order: v.number(),
    created_at: v.string(),
  })
    .index("by_platform_content_id", ["platform_content_id"])
    .index("by_project_id", ["project_id"]),

  // 25. Export Logs (다운로드/내보내기 로그)
  export_logs: defineTable({
    platform_content_id: v.id("platform_contents"),
    export_type: v.string(),
    export_status: v.string(),
    exported_at: v.string(),
  }).index("by_platform_content_id", ["platform_content_id"]),

  // 26. Platform Accounts (연동 SNS 계정 정보)
  platform_accounts: defineTable({
    workspace_id: v.id("workspaces"),
    platform_code: v.string(),
    account_name: v.string(),
    auth_data: v.any(), // JSON 형태 토큰 등
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_workspace_and_platform", ["workspace_id", "platform_code"]),

  // 27. Publications (초안/콘텐츠 발행 이력)
  publications: defineTable({
    platform_content_id: v.id("platform_contents"),
    platform_account_id: v.id("platform_accounts"),
    external_post_id: v.string(),
    external_post_url: v.optional(v.string()),
    status: v.string(),
    published_at: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_platform_content_id", ["platform_content_id"])
    .index("by_account_id", ["platform_account_id"]),

  // 28. Usage Records (SaaS AI 리소스 사용량)
  usage_records: defineTable({
    workspace_id: v.id("workspaces"),
    user_id: v.id("users"),
    action_type: v.string(),
    quantity: v.number(),
    details: v.any(),
    created_at: v.string(),
  })
    .index("by_workspace_id", ["workspace_id"])
    .index("by_user_id", ["user_id"]),

  // 29. Error Logs (시스템 예외 로그)
  error_logs: defineTable({
    user_id: v.optional(v.id("users")),
    error_message: v.string(),
    error_stack: v.optional(v.string()),
    context: v.any(),
    resolved: v.boolean(),
    resolved_at: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_resolved", ["resolved"])
    .index("by_user_id", ["user_id"]),

  // 30. System Settings (시스템 전역 설정 - API 키 등)
  system_settings: defineTable({
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    updated_at: v.string(),
  })
    .index("by_key", ["key"]),
});
