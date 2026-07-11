const http = require("http");

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- 가상 인메모리 데이터베이스 ---
let activeSessionToken = "mock-access-token"; // 로그인 기본 상태 활성화

let brands = [
  {
    id: "b1111111-1111-1111-a111-111111111111",
    workspace_id: "w1111111-1111-1111-a111-111111111111",
    name: "기본 브랜드",
    industry: "IT / 테크",
    description: "인공지능 콘텐츠 자동 제작 마케팅 솔루션 안티그래비티입니다.",
    tagline: "글쓰기의 중력을 벗어나다",
    website_url: "https://antigravity.ai",
    target_audience: "마케터, 소상공인, 1인 창업자",
    customer_problems: "블로그 포스팅 시간 부족, 각 채널별로 글 고쳐쓰는 번거로움",
    products_services: "멀티플랫폼 AI 마케팅 카피라이터",
    core_values: "고품질 원본 생성, 극도의 시간 효율성",
    default_cta: "지금 안티그래비티에서 무료 콘텐츠를 만들어 보세요!",
    legal_notice: "",
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  },
];

let voiceProfiles = {
  "b1111111-1111-1111-a111-111111111111": {
    id: "vp111111-1111-1111-a111-111111111111",
    brand_id: "b1111111-1111-1111-a111-111111111111",
    formal_level: 4,
    sentence_length: 3,
    expertise_level: 3,
    emotional_level: 2,
    sales_level: 4,
    humor_level: 2,
    emoji_level: 3,
    question_level: 2,
    honorific_style: "HONORIFIC",
    preferred_phrases: "혁신적인, 손쉽게, 획기적으로",
    forbidden_phrases: "최저가, 무조건, 100% 당첨",
    proprietary_terms: "안티그래비티, 콘텐츠 제작 봇",
    intro_style: "안녕하세요! 안티그래비티 마케팅 봇입니다.",
    closing_style: "지금 바로 무료 혜택을 체험해 보시기 바랍니다.",
    cta_style: "무료 체험 바로가기",
    analysis_summary: "전문적이며 정돈된 존댓말을 구사하는 공식적인 어조입니다.",
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

let samples = [];

let platforms = [
  {
    id: "p1111111-1111-1111-1111-111111111111",
    code: "WORDPRESS",
    name: "WordPress",
    category: "CMS",
    supports_api_publish: true,
    supports_draft_publish: true,
    is_active: true,
    default_rules: { default_char_limit: 2500, default_image_limit: 5, default_faq_limit: 3, default_outline: true }
  },
  {
    id: "p2222222-2222-2222-2222-222222222222",
    code: "BLOGGER",
    name: "Blogger",
    category: "CMS",
    supports_api_publish: true,
    supports_draft_publish: true,
    is_active: true,
    default_rules: { default_char_limit: 2200, default_image_limit: 5, default_faq_limit: 2, default_outline: false }
  },
  {
    id: "p3333333-3333-3333-3333-333333333333",
    code: "TISTORY",
    name: "티스토리",
    category: "CMS",
    supports_api_publish: true,
    supports_draft_publish: true,
    is_active: true,
    default_rules: { default_char_limit: 2200, default_image_limit: 6, default_faq_limit: 0, default_outline: false }
  },
  {
    id: "p4444444-4444-4444-4444-444444444444",
    code: "NAVER_BLOG",
    name: "네이버 블로그",
    category: "BLOG",
    supports_api_publish: false,
    supports_draft_publish: false,
    is_active: true,
    default_rules: { default_char_limit: 2000, default_image_limit: 8, default_faq_limit: 0, default_outline: false }
  },
  {
    id: "p5555555-5555-5555-5555-555555555555",
    code: "INSTAGRAM",
    name: "인스타그램",
    category: "SOCIAL",
    supports_api_publish: false,
    supports_draft_publish: false,
    is_active: true,
    default_rules: { default_char_limit: 800, default_image_limit: 8, default_hashtag_limit: 10, default_outline: false }
  }
];

let projects = [
  {
    id: "p7777777-7777-7777-a777-777777777777",
    workspace_id: "w1111111-1111-1111-1111-111111111111",
    brand_id: "b1111111-1111-1111-a111-111111111111",
    topic: "E2E 발행 검증용 프로젝트",
    status: "NEEDS_REVIEW",
    primary_keyword: "E2E 테스트",
    created_at: new Date().toISOString(),
  }
];
let projectPlatformsMap = [
  {
    project_id: "p7777777-7777-7777-a777-777777777777",
    platform_id: "p1111111-1111-1111-1111-111111111111", // WordPress
  }
];
let experiences = [];

let promptTemplates = [];
let contentBriefs = [];
let contentOutlines = [];
let outlineItems = [];
let platformContents = [
  {
    id: "pc777777-7777-7777-a777-777777777777",
    workspace_id: "w1111111-1111-1111-1111-111111111111",
    project_id: "p7777777-7777-7777-a777-777777777777",
    platform_id: "p1111111-1111-1111-1111-111111111111", // WordPress
    title: "워드프레스 E2E 발행 원고",
    seo_title: "워드프레스 E2E 발행 원고",
    body_html: "<p>E2E 본문 내용입니다.</p>",
    body_text: "E2E 본문 내용입니다.",
    status: "APPROVED", // 최종 승인 완료 상태!
    generation_status: "COMPLETED",
    created_at: new Date().toISOString(),
  }
];
let contentSections = [];
let imagePlans = [];
let aiJobs = [];
let contentVersions = [];
let contentEvaluations = [];
let evaluationIssues = [];
let contentFacts = [];
let assets = [];
let exportLogs = [];

let mockWorkspace = {
  id: "w1111111-1111-1111-1111-111111111111",
  name: "테스터의 워크스페이스",
  slug: "테스터-workspace-w1111111",
  owner_id: "d3b07384-d113-4ec5-a587-f82343801234",
  plan_code: "ENTERPRISE", // Default to ENTERPRISE so E2E tests don't fail due to limits
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let profiles = [
  {
    id: "d3b07384-d113-4ec5-a587-f82343801234",
    name: "테스터",
    avatar_url: "",
    timezone: "Asia/Seoul",
    language: "ko",
    onboarding_completed: true,
    is_admin: false,
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];
let platformAccounts = [];
let publications = [];
let usageRecords = [];
let errorLogs = [];

// 정량적 Mock 분석 연산기 (Server Action 구현을 미리 검증하기 위해 REST POST 시에도 실행)
function runMockAnalysis(text) {
  const charCount = text.length;
  const sentenceCount = text.split(/[.?!]+/).filter(Boolean).length || 1;
  const paragraphCount = text.split(/\n+/).filter(Boolean).length || 1;

  // 한국어 어휘 분석 흉내내기
  const hasHonorific = (text.match(/합니다|습니다|해요|세요|입니다/g) || []).length;
  const hasCasual = (text.match(/한다|했다|이다|이지|어라|어|지/g) || []).length;
  const honorificRatio = Math.round((hasHonorific / (hasHonorific + hasCasual + 0.1)) * 100);

  const questionMarkCount = (text.match(/\?/g) || []).length;
  const exclamationMarkCount = (text.match(/!/g) || []).length;
  const questionRatio = Math.round((questionMarkCount / sentenceCount) * 100);

  // 이모지 정규식 매칭
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiRegex) || []).length;

  // 자주 쓰는 접속사 계측
  const conjunctions = ["그리고", "하지만", "그러나", "그래서", "또한", "한편"];
  const conjCounts = {};
  conjunctions.forEach((c) => {
    const count = (text.split(c).length - 1);
    if (count > 0) conjCounts[c] = count;
  });

  return {
    char_count: charCount,
    avg_sentence_length: Math.round(charCount / sentenceCount),
    avg_paragraph_length: Math.round(charCount / paragraphCount),
    honorific_ratio: honorificRatio,
    question_ratio: questionRatio,
    exclamation_count: exclamationMarkCount,
    emoji_count: emojiCount,
    conjunction_counts: conjCounts,
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url || "";
  const method = req.method;
  const authHeader = req.headers["authorization"] || "";
  const cookieHeader = req.headers["cookie"] || "";

  const hasSessionCookie =
    cookieHeader.includes("sb-access-token") ||
    cookieHeader.includes("access-token") ||
    activeSessionToken !== null;

  // 1. 유저 정보 API
  if (url.includes("/auth/v1/user")) {
    if (authHeader.includes("Bearer") || hasSessionCookie) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          id: "d3b07384-d113-4ec5-a587-f82343801234",
          email: "test@example.com",
          user_metadata: { name: "테스터" },
          aud: "authenticated",
          role: "authenticated",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );
    } else {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "unauthorized" }));
    }
    return;
  }

  // 2. 로그인 API
  if (url.includes("/auth/v1/token") && method === "POST") {
    activeSessionToken = "mock-access-token";
    res.writeHead(200);
    res.end(
      JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 3600,
        user: {
          id: "d3b07384-d113-4ec5-a587-f82343801234",
          email: "test@example.com",
          user_metadata: { name: "테스터" },
          aud: "authenticated",
          role: "authenticated",
        },
      })
    );
    return;
  }

  // 3. 회원가입 API
  if (url.includes("/auth/v1/signup") && method === "POST") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        user: {
          id: "d3b07384-d113-4ec5-a587-f82343801234",
          email: "test@example.com",
          user_metadata: { name: "테스터" },
          aud: "authenticated",
          role: "authenticated",
        },
      })
    );
    return;
  }

  // 4. 로그아웃 API
  if (url.includes("/auth/v1/logout") && method === "POST") {
    activeSessionToken = null;
    res.writeHead(204);
    res.end();
    return;
  }

  // 5. REST Profiles
  if (url.includes("/rest/v1/profiles")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;

      if (targetId) {
        const profile = profiles.find((p) => p.id === targetId);
        res.writeHead(200);
        const acceptHeader = req.headers["accept"] || "";
        if (acceptHeader.includes("vnd.pgrst.object")) {
          res.end(JSON.stringify(profile || null));
        } else {
          res.end(JSON.stringify(profile ? [profile] : []));
        }
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(profiles));
      }
      return;
    }

    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = profiles.findIndex((p) => p.id === targetId);
        if (idx !== -1) {
          profiles[idx] = { ...profiles[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(profiles[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "profile not found" }));
        }
      });
      return;
    }
  }

  // 6. REST Workspace Members
  if (url.includes("/rest/v1/workspace_members")) {
    res.writeHead(200);
    res.end(
      JSON.stringify([
        {
          workspace_id: "w1111111-1111-1111-1111-111111111111",
          role: "OWNER",
          workspaces: {
            id: "w1111111-1111-1111-1111-111111111111",
            name: "테스터의 워크스페이스",
            slug: "테스터-workspace-w1111111",
            owner_id: "d3b07384-d113-4ec5-a587-f82343801234",
            plan_code: mockWorkspace.plan_code,
          },
        },
      ])
    );
    return;
  }

  // 7. REST Subscriptions
  if (url.includes("/rest/v1/subscriptions")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        workspace_id: "w1111111-1111-1111-1111-111111111111",
        plan_code: mockWorkspace.plan_code,
        status: "ACTIVE",
        limits: mockWorkspace.plan_code === "ENTERPRISE" 
          ? { words_limit: 1000000, images_limit: 200 }
          : { words_limit: 10000, images_limit: 20 },
      })
    );
    return;
  }

  // 7-1. REST Workspaces
  if (url.includes("/rest/v1/workspaces")) {
    if (method === "GET") {
      res.writeHead(200);
      const acceptHeader = req.headers["accept"] || "";
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.end(JSON.stringify(mockWorkspace));
      } else {
        res.end(JSON.stringify([mockWorkspace]));
      }
      return;
    }
    if (method === "PATCH") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        mockWorkspace = { ...mockWorkspace, ...updates, updated_at: new Date().toISOString() };
        res.writeHead(200);
        res.end(JSON.stringify(mockWorkspace));
      });
      return;
    }
  }

  // 8. REST Brands API
  if (url.includes("/rest/v1/brands")) {
    // 8-1. 브랜드 GET
    if (method === "GET") {
      const activeBrands = brands.filter((b) => b.deleted_at === null);
      
      // 개별 브랜드 조회 체크 (?id=eq.UUID)
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const targetId = idMatch[1];
        const brand = activeBrands.find((b) => b.id === targetId);
        res.writeHead(200);
        res.end(JSON.stringify(brand || null));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(activeBrands));
      return;
    }

    // 8-2. 브랜드 POST (추가)
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const newBrand = JSON.parse(body);
        newBrand.id = newBrand.id || generateUUID();
        newBrand.created_at = new Date().toISOString();
        newBrand.updated_at = new Date().toISOString();
        newBrand.deleted_at = null;

        // 트리거 모사: is_default가 true인 경우 다른 모든 브랜드의 is_default를 false로 처리
        if (newBrand.is_default === true) {
          brands.forEach((b) => {
            b.is_default = false;
          });
        }

        brands.push(newBrand);

        // 신규 보이스 프로필 자동 생성
        voiceProfiles[newBrand.id] = {
          id: generateUUID(),
          brand_id: newBrand.id,
          formal_level: 3,
          sentence_length: 3,
          expertise_level: 3,
          emotional_level: 3,
          sales_level: 3,
          humor_level: 3,
          emoji_level: 3,
          question_level: 3,
          honorific_style: "HONORIFIC",
          preferred_phrases: "",
          forbidden_phrases: "",
          proprietary_terms: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        res.writeHead(201);
        res.end(JSON.stringify(newBrand));
      });
      return;
    }

    // 8-3. 브랜드 PATCH (수정)
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (!idMatch) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing id parameter" }));
        return;
      }
      const targetId = idMatch[1];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const updates = JSON.parse(body);
        const brandIndex = brands.findIndex((b) => b.id === targetId);
        
        if (brandIndex !== -1) {
          // 트리거 모사: is_default를 true로 바꾼 경우 다른 모든 브랜드를 해제
          if (updates.is_default === true) {
            brands.forEach((b) => {
              b.is_default = false;
            });
          }
          
          brands[brandIndex] = {
            ...brands[brandIndex],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          res.writeHead(200);
          res.end(JSON.stringify(brands[brandIndex]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "brand not found" }));
        }
      });
      return;
    }

    // 8-4. 브랜드 DELETE (소프트 삭제)
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (!idMatch) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing id parameter" }));
        return;
      }
      const targetId = idMatch[1];
      const brandIndex = brands.findIndex((b) => b.id === targetId);
      if (brandIndex !== -1) {
        // 소프트 삭제
        brands[brandIndex].deleted_at = new Date().toISOString();
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "brand not found" }));
      }
      return;
    }
  }

  // 9. REST Brand Voice Profiles API
  if (url.includes("/rest/v1/brand_voice_profiles")) {
    const brandIdMatch = url.match(/brand_id=eq\.([a-zA-Z0-9_-]+)/);
    const targetBrandId = brandIdMatch ? brandIdMatch[1] : null;

    if (method === "GET") {
      if (targetBrandId) {
        const vp = voiceProfiles[targetBrandId];
        res.writeHead(200);
        res.end(JSON.stringify(vp ? [vp] : []));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(Object.values(voiceProfiles)));
      }
      return;
    }

    if (method === "PATCH" && targetBrandId) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const updates = JSON.parse(body);
        if (voiceProfiles[targetBrandId]) {
          voiceProfiles[targetBrandId] = {
            ...voiceProfiles[targetBrandId],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          res.writeHead(200);
          res.end(JSON.stringify(voiceProfiles[targetBrandId]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "voice profile not found" }));
        }
      });
      return;
    }
  }

  // 10. REST Brand Samples API
  if (url.includes("/rest/v1/brand_samples")) {
    if (method === "GET") {
      const brandIdMatch = url.match(/brand_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetBrandId = brandIdMatch ? brandIdMatch[1] : null;

      if (targetBrandId) {
        const filtered = samples.filter((s) => s.brand_id === targetBrandId);
        res.writeHead(200);
        res.end(JSON.stringify(filtered));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(samples));
      }
      return;
    }

    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const newSample = JSON.parse(body);
        newSample.id = newSample.id || generateUUID();
        newSample.character_count = newSample.raw_text.length;
        newSample.analysis_status = "COMPLETED";
        newSample.analysis_result = runMockAnalysis(newSample.raw_text);
        newSample.created_at = new Date().toISOString();

        samples.push(newSample);

        res.writeHead(201);
        res.end(JSON.stringify(newSample));
      });
      return;
    }

    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const targetId = idMatch[1];
        samples = samples.filter((s) => s.id !== targetId);
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing id" }));
      }
      return;
    }
  }
  
  // 11. REST Platforms API
  if (url.includes("/rest/v1/platforms")) {
    if (method === "GET") {
      res.writeHead(200);
      res.end(JSON.stringify(platforms));
      return;
    }
  }

  // 12. REST Content Projects API
  if (url.includes("/rest/v1/content_projects")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;

      const fs = require("fs");
      const path = require("path");
      fs.appendFileSync(
        path.join(process.cwd(), "server-debug.log"),
        `[${new Date().toISOString()}] MOCK GET content_projects URL: ${url}, targetId: ${targetId}\n`
      );

      if (targetId) {
        const proj = projects.find((p) => p.id === targetId && !p.deleted_at);
        fs.appendFileSync(
          path.join(process.cwd(), "server-debug.log"),
          `[${new Date().toISOString()}] MOCK GET content_projects found: ${JSON.stringify(proj || null)}\n`
        );
        res.writeHead(200);
        const acceptHeader = req.headers["accept"] || "";
        if (acceptHeader.includes("vnd.pgrst.object")) {
          res.end(JSON.stringify(proj || null));
        } else {
          res.end(JSON.stringify(proj ? [proj] : []));
        }
      } else {
        // Filter out soft deleted projects
        const activeProjects = projects.filter((p) => !p.deleted_at);
        res.writeHead(200);
        res.end(JSON.stringify(activeProjects));
      }
      return;
    }

    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const newProj = JSON.parse(body);
        const fs = require("fs");
        const path = require("path");
        fs.appendFileSync(
          path.join(process.cwd(), "server-debug.log"),
          `[${new Date().toISOString()}] MOCK POST content_projects payload: ${JSON.stringify(newProj)}\n`
        );
        newProj.id = newProj.id || generateUUID();
        newProj.status = newProj.status || "SETUP";
        newProj.generation_status = newProj.generation_status || "NOT_STARTED";
        newProj.current_step = newProj.current_step || 1;
        newProj.wizard_data = newProj.wizard_data || {};
        newProj.secondary_keywords = newProj.secondary_keywords || [];
        newProj.excluded_keywords = newProj.excluded_keywords || [];
        newProj.forbidden_phrases = newProj.forbidden_phrases || [];
        newProj.created_at = new Date().toISOString();
        newProj.updated_at = new Date().toISOString();
        newProj.deleted_at = null;

        const idx = projects.findIndex((p) => p.id === newProj.id);
        if (idx !== -1) {
          projects[idx] = { ...projects[idx], ...newProj, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(projects[idx]));
        } else {
          projects.push(newProj);
          res.writeHead(201);
          res.end(JSON.stringify(newProj));
        }
      });
      return;
    }

    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (!idMatch) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing id parameter" }));
        return;
      }
      const targetId = idMatch[1];
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const updates = JSON.parse(body);
        const index = projects.findIndex((p) => p.id === targetId);
        if (index !== -1) {
          projects[index] = {
            ...projects[index],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          res.writeHead(200);
          res.end(JSON.stringify(projects[index]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "project not found" }));
        }
      });
      return;
    }

    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        const targetId = idMatch[1];
        projects = projects.filter((p) => p.id !== targetId);
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing id" }));
      }
      return;
    }
  }

  // 13. REST Project Platforms API
  if (url.includes("/rest/v1/project_platforms")) {
    if (method === "GET") {
      const projectIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetProjId = projectIdMatch ? projectIdMatch[1] : null;

      if (targetProjId) {
        const filtered = projectPlatformsMap.filter((pp) => pp.project_id === targetProjId);
        res.writeHead(200);
        res.end(JSON.stringify(filtered));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(projectPlatformsMap));
      }
      return;
    }

    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const payload = JSON.parse(body);
        const results = [];
        
        // Handle array insert
        if (Array.isArray(payload)) {
          payload.forEach((item) => {
            const newItem = {
              ...item,
              id: item.id || generateUUID(),
              created_at: new Date().toISOString(),
            };
            // Replace on conflict unique(project_id, platform_id)
            projectPlatformsMap = projectPlatformsMap.filter(
              (pp) => !(pp.project_id === newItem.project_id && pp.platform_id === newItem.platform_id)
            );
            projectPlatformsMap.push(newItem);
            results.push(newItem);
          });
          res.writeHead(201);
          res.end(JSON.stringify(results));
        } else {
          const newItem = {
            ...payload,
            id: payload.id || generateUUID(),
            created_at: new Date().toISOString(),
          };
          projectPlatformsMap = projectPlatformsMap.filter(
            (pp) => !(pp.project_id === newItem.project_id && pp.platform_id === newItem.platform_id)
          );
          projectPlatformsMap.push(newItem);
          res.writeHead(201);
          res.end(JSON.stringify(newItem));
        }
      });
      return;
    }

    if (method === "DELETE") {
      const projectIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetProjId = projectIdMatch ? projectIdMatch[1] : null;

      if (targetProjId) {
        projectPlatformsMap = projectPlatformsMap.filter((pp) => pp.project_id !== targetProjId);
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing project_id" }));
      }
      return;
    }
  }

  // 14. REST Content Experiences API
  if (url.includes("/rest/v1/content_experiences")) {
    if (method === "GET") {
      const projectIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetProjId = projectIdMatch ? projectIdMatch[1] : null;

      if (targetProjId) {
        const exp = experiences.find((e) => e.project_id === targetProjId);
        res.writeHead(200);
        res.end(JSON.stringify(exp ? [exp] : []));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(experiences));
      }
      return;
    }

    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const newExp = JSON.parse(body);
        newExp.id = newExp.id || generateUUID();
        newExp.created_at = new Date().toISOString();
        newExp.updated_at = new Date().toISOString();

        // Unique project_id constraint simulation
        experiences = experiences.filter((e) => e.project_id !== newExp.project_id);
        experiences.push(newExp);

        res.writeHead(201);
        res.end(JSON.stringify(newExp));
      });
      return;
    }

    if (method === "PATCH") {
      const projectIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetProjId = projectIdMatch ? projectIdMatch[1] : null;
      const targetId = idMatch ? idMatch[1] : null;

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const updates = JSON.parse(body);
        const index = experiences.findIndex(
          (e) => (targetProjId && e.project_id === targetProjId) || (targetId && e.id === targetId)
        );
        if (index !== -1) {
          experiences[index] = {
            ...experiences[index],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          res.writeHead(200);
          res.end(JSON.stringify(experiences[index]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "experience not found" }));
        }
      });
      return;
    }
  }

  // 12. REST Prompt Templates API
  if (url.includes("/rest/v1/prompt_templates")) {
    if (method === "GET") {
      let filtered = [...promptTemplates];
      
      const keyMatch = url.match(/key=eq\.([A-Z_]+)/);
      if (keyMatch) {
        const targetKey = keyMatch[1];
        filtered = filtered.filter((t) => t.key === targetKey);
      }
      
      const activeMatch = url.match(/is_active=eq\.(true|false)/);
      if (activeMatch) {
        const targetActive = activeMatch[1] === "true";
        filtered = filtered.filter((t) => t.is_active === targetActive);
      }

      const acceptHeader = req.headers["accept"] || "";
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.writeHead(200);
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(filtered));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            promptTemplates.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          promptTemplates.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
  }

  // 13. REST Content Briefs API
  if (url.includes("/rest/v1/content_briefs")) {
    if (method === "GET") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      if (projIdMatch) {
        const targetProjId = projIdMatch[1];
        const brief = contentBriefs.find((b) => b.project_id === targetProjId);
        res.writeHead(200);
        res.end(JSON.stringify(brief ? [brief] : []));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(contentBriefs));
      return;
    }
    if (method === "POST" || method === "PUT") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        data.id = data.id || generateUUID();
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();
        // unique constraint simulation
        contentBriefs = contentBriefs.filter((b) => b.project_id !== data.project_id);
        contentBriefs.push(data);
        res.writeHead(201);
        res.end(JSON.stringify(data));
      });
      return;
    }
    if (method === "PATCH") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const targetProjId = projIdMatch ? projIdMatch[1] : null;
        const idx = contentBriefs.findIndex((b) => b.project_id === targetProjId);
        if (idx !== -1) {
          contentBriefs[idx] = { ...contentBriefs[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(contentBriefs[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "brief not found" }));
        }
      });
      return;
    }
  }

  // 14. REST Content Outlines API
  if (url.includes("/rest/v1/content_outlines")) {
    if (method === "GET") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (projIdMatch) {
        const targetProjId = projIdMatch[1];
        // filter outlines
        let filtered = contentOutlines.filter((o) => o.project_id === targetProjId);
        const platformMatch = url.match(/platform_id=is\.null/);
        if (platformMatch) {
          filtered = filtered.filter((o) => o.platform_id === null);
        }
        res.writeHead(200);
        res.end(JSON.stringify(filtered));
        return;
      }
      if (idMatch) {
        const targetId = idMatch[1];
        const outline = contentOutlines.find((o) => o.id === targetId);
        res.writeHead(200);
        res.end(JSON.stringify(outline ? [outline] : []));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(contentOutlines));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        data.id = data.id || generateUUID();
        data.created_at = new Date().toISOString();
        data.updated_at = new Date().toISOString();
        contentOutlines.push(data);
        res.writeHead(201);
        res.end(JSON.stringify(data));
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = contentOutlines.findIndex((o) => o.id === targetId);
        if (idx !== -1) {
          contentOutlines[idx] = { ...contentOutlines[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(contentOutlines[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "outline not found" }));
        }
      });
      return;
    }
  }

  // 15. REST Outline Items API
  if (url.includes("/rest/v1/outline_items")) {
    if (method === "GET") {
      const outlineIdMatch = url.match(/outline_id=eq\.([a-zA-Z0-9_-]+)/);
      if (outlineIdMatch) {
        const targetOutlineId = outlineIdMatch[1];
        const items = outlineItems.filter((i) => i.outline_id === targetOutlineId);
        res.writeHead(200);
        res.end(JSON.stringify(items));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(outlineItems));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            outlineItems.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          outlineItems.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        outlineItems = outlineItems.filter((i) => i.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = outlineItems.findIndex((i) => i.id === targetId);
        if (idx !== -1) {
          outlineItems[idx] = { ...outlineItems[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(outlineItems[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "outline item not found" }));
        }
      });
      return;
    }
  }

  // 16. REST Platform Contents API
  if (url.includes("/rest/v1/platform_contents")) {
    if (method === "GET") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      
      const joinPlatform = (content) => {
        if (!content) return null;
        const plat = platforms.find((p) => p.id === content.platform_id);
        return {
          ...content,
          platform: plat || null
        };
      };

      if (projIdMatch) {
        const targetProjId = projIdMatch[1];
        const rawList = platformContents.filter((c) => c.project_id === targetProjId);
        const list = rawList.map(joinPlatform);
        res.writeHead(200);
        res.end(JSON.stringify(list));
        return;
      }
      if (idMatch) {
        const targetId = idMatch[1];
        const content = platformContents.find((c) => c.id === targetId);
        console.log(`>>> [MOCK GET platform_contents] targetId: ${targetId}, found: ${!!content}, total: ${platformContents.length}`);
        const joined = joinPlatform(content);
        res.writeHead(200);
        const acceptHeader = req.headers["accept"] || "";
        if (acceptHeader.includes("vnd.pgrst.object")) {
          res.end(JSON.stringify(joined));
        } else {
          res.end(JSON.stringify(joined ? [joined] : []));
        }
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(platformContents.map(joinPlatform)));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            platformContents.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          platformContents.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = platformContents.findIndex((c) => c.id === targetId);
        if (idx !== -1) {
          platformContents[idx] = { ...platformContents[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(platformContents[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "platform content not found" }));
        }
      });
      return;
    }
  }

  // 17. REST Content Sections API
  if (url.includes("/rest/v1/content_sections")) {
    if (method === "GET") {
      const contentIdMatch = url.match(/platform_content_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      if (contentIdMatch) {
        const targetContentId = contentIdMatch[1];
        const list = contentSections.filter((s) => s.platform_content_id === targetContentId);
        res.writeHead(200);
        res.end(JSON.stringify(list));
        return;
      }
      if (idMatch) {
        const targetId = idMatch[1];
        const sec = contentSections.find((s) => s.id === targetId);
        console.log(">>> [MOCK GET content_sections] targetId:", targetId, "found:", !!sec, "sec:", JSON.stringify(sec));
        res.writeHead(200);
        const acceptHeader = req.headers["accept"] || "";
        if (acceptHeader.includes("vnd.pgrst.object")) {
          res.end(JSON.stringify(sec || null));
        } else {
          res.end(JSON.stringify(sec ? [sec] : []));
        }
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(contentSections));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            contentSections.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          contentSections.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = contentSections.findIndex((s) => s.id === targetId);
        if (idx !== -1) {
          contentSections[idx] = { ...contentSections[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(contentSections[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "section not found" }));
        }
      });
      return;
    }
  }

  // 18. REST Image Plans API
  if (url.includes("/rest/v1/image_plans")) {
    if (method === "GET") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      if (projIdMatch) {
        const targetProjId = projIdMatch[1];
        const list = imagePlans.filter((ip) => ip.project_id === targetProjId);
        res.writeHead(200);
        res.end(JSON.stringify(list));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(imagePlans));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            imagePlans.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          imagePlans.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
  }

  // 19. REST AI Jobs API
  if (url.includes("/rest/v1/ai_jobs")) {
    if (method === "GET") {
      const projIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const acceptHeader = req.headers["accept"] || "";
      if (projIdMatch) {
        const targetProjId = projIdMatch[1];
        const jobTypeMatch = url.match(/job_type=eq\.([A-Z_]+)/);
        const targetJobType = jobTypeMatch ? jobTypeMatch[1] : null;

        let list = aiJobs.filter((j) => j.project_id === targetProjId);
        if (targetJobType) {
          list = list.filter((j) => j.job_type === targetJobType);
        }

        // 최신순 정렬 시뮬레이션
        const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Accept 헤더에 vnd.pgrst.object가 있거나 URL에 limit=1이 포함된 경우 단건 반환
        // getJobStatus는 언제나 단일 객체 응답을 기대하므로 sorted[0] 또는 null 반환
        res.writeHead(200);
        res.end(JSON.stringify(sorted[0] || null));
        return;
      }
      if (idMatch) {
        const targetId = idMatch[1];
        const job = aiJobs.find((j) => j.id === targetId);
        res.writeHead(200);
        res.end(JSON.stringify(job || null));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(aiJobs));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.started_at = item.started_at || new Date().toISOString();
            aiJobs.push(item);
            console.log(`>>> [MOCK Supabase POST ai_jobs] Created job: ${item.id}, status: ${item.status}`);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.started_at = data.started_at || new Date().toISOString();
          aiJobs.push(data);
          console.log(`>>> [MOCK Supabase POST ai_jobs] Created job: ${data.id}, status: ${data.status}`);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = aiJobs.findIndex((j) => j.id === targetId);
        console.log(`>>> [MOCK Supabase PATCH ai_jobs] targetId: ${targetId}, idx: ${idx}, updates:`, updates);
        if (idx !== -1) {
          aiJobs[idx] = { ...aiJobs[idx], ...updates, completed_at: (updates.status === "COMPLETED" || updates.status === "FAILED" || updates.status === "CANCELLED") ? new Date().toISOString() : aiJobs[idx].completed_at };
          console.log(`>>> [MOCK Supabase PATCH ai_jobs] Updated job ${targetId} status to: ${aiJobs[idx].status}`);
          res.writeHead(200);
          res.end(JSON.stringify(aiJobs[idx]));
        } else {
          console.warn(`>>> [MOCK Supabase PATCH ai_jobs] Job not found for targetId: ${targetId}`);
          res.writeHead(404);
          res.end(JSON.stringify({ error: "job not found" }));
        }
      });
      return;
    }
  }

  // 20. REST Content Versions API
  if (url.includes("/rest/v1/content_versions")) {
    if (method === "GET") {
      const contentIdMatch = url.match(/platform_content_id=eq\.([a-zA-Z0-9_-]+)/);
      const versionNumMatch = url.match(/version_number=eq\.(\d+)/);
      const acceptHeader = req.headers["accept"] || "";

      let list = contentVersions;
      if (contentIdMatch) {
        const targetContentId = contentIdMatch[1];
        list = list.filter((v) => v.platform_content_id === targetContentId);
      }
      if (versionNumMatch) {
        const num = parseInt(versionNumMatch[1]);
        list = list.filter((v) => v.version_number === num);
      }

      // version_number 기준 기본 내림차순 정렬 시뮬레이션
      list.sort((a, b) => b.version_number - a.version_number);

      const isSingleObject = acceptHeader.includes("vnd.pgrst.object");
      const hasLimit1 = url.includes("limit=1") || url.includes("limit=eq.1");

      let result = list;
      if (hasLimit1) {
        result = list.slice(0, 1);
      }

      if (isSingleObject) {
        res.writeHead(200);
        res.end(JSON.stringify(result[0] || null));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result));
      }
      return;
    }

    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            contentVersions.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          contentVersions.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }

    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        contentVersions = contentVersions.filter((v) => v.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 21. REST Content Evaluations API
  if (url.includes("/rest/v1/content_evaluations")) {
    if (method === "GET") {
      const contentIdMatch = url.match(/platform_content_id=eq\.([a-zA-Z0-9_-]+)/);
      const acceptHeader = req.headers["accept"] || "";
      let list = contentEvaluations;
      if (contentIdMatch) {
        const targetContentId = contentIdMatch[1];
        list = list.filter((e) => e.platform_content_id === targetContentId);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const isSingleObject = acceptHeader.includes("vnd.pgrst.object");
      const hasLimit1 = url.includes("limit=1") || url.includes("limit=eq.1");
      let result = list;
      if (hasLimit1) {
        result = list.slice(0, 1);
      }

      if (isSingleObject) {
        res.writeHead(200);
        res.end(JSON.stringify(result[0] || null));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(result));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            contentEvaluations.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          contentEvaluations.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        contentEvaluations = contentEvaluations.filter((e) => e.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 22. REST Evaluation Issues API
  if (url.includes("/rest/v1/evaluation_issues")) {
    if (method === "GET") {
      const evalIdMatch = url.match(/evaluation_id=eq\.([a-zA-Z0-9_-]+)/);
      const severityMatch = url.match(/severity=eq\.([a-zA-Z0-9_-]+)/);
      const statusMatch = url.match(/status=eq\.([a-zA-Z0-9_-]+)/);
      let list = evaluationIssues;
      if (evalIdMatch) {
        const targetEvalId = evalIdMatch[1];
        list = list.filter((i) => i.evaluation_id === targetEvalId);
      }
      if (severityMatch) {
        const targetSeverity = severityMatch[1];
        list = list.filter((i) => i.severity === targetSeverity);
      }
      if (statusMatch) {
        const targetStatus = statusMatch[1];
        list = list.filter((i) => i.status === targetStatus);
      }
      res.writeHead(200);
      res.end(JSON.stringify(list));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        console.log(">>> [MOCK Supabase POST evaluation_issues] data:", JSON.stringify(data));
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            evaluationIssues.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          evaluationIssues.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = evaluationIssues.findIndex((i) => i.id === targetId);
        if (idx !== -1) {
          evaluationIssues[idx] = { 
            ...evaluationIssues[idx], 
            ...updates, 
            fixed_at: updates.status === "FIXED" ? new Date().toISOString() : (evaluationIssues[idx].fixed_at || null)
          };
          res.writeHead(200);
          res.end(JSON.stringify(evaluationIssues[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "issue not found" }));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        evaluationIssues = evaluationIssues.filter((i) => i.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 23. REST Content Facts API
  if (url.includes("/rest/v1/content_facts")) {
    if (method === "GET") {
      const projectIdMatch = url.match(/project_id=eq\.([a-zA-Z0-9_-]+)/);
      const verificationStatusMatch = url.match(/verification_status=eq\.([a-zA-Z0-9_-]+)/);
      let list = contentFacts;
      if (projectIdMatch) {
        const targetProjId = projectIdMatch[1];
        list = list.filter((f) => f.project_id === targetProjId);
      }
      if (verificationStatusMatch) {
        const targetStatus = verificationStatusMatch[1];
        list = list.filter((f) => f.verification_status === targetStatus);
      }
      res.writeHead(200);
      res.end(JSON.stringify(list));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            contentFacts.push(item);
          });
          res.writeHead(201);
          res.end(JSON.stringify(data));
        } else {
          data.id = data.id || generateUUID();
          data.created_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
          contentFacts.push(data);
          res.writeHead(201);
          res.end(JSON.stringify(data));
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = contentFacts.findIndex((f) => f.id === targetId);
        if (idx !== -1) {
          contentFacts[idx] = { ...contentFacts[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(contentFacts[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "fact not found" }));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        contentFacts = contentFacts.filter((f) => f.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 23.5 REST Assets API
  if (url.includes("/rest/v1/assets")) {
    if (method === "GET") {
      const contentIdMatch = url.match(/platform_content_id=eq\.([a-zA-Z0-9_-]+)/);
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);

      if (idMatch) {
        const targetId = idMatch[1];
        const asset = assets.find((a) => a.id === targetId);
        res.writeHead(200);
        const acceptHeader = req.headers["accept"] || "";
        if (acceptHeader.includes("vnd.pgrst.object")) {
          res.end(JSON.stringify(asset || null));
        } else {
          res.end(JSON.stringify(asset ? [asset] : []));
        }
        return;
      }

      let list = assets;
      const fs = require("fs");
      const path = require("path");
      fs.appendFileSync(
        path.join(process.cwd(), "server-debug.log"),
        `[${new Date().toISOString()}] MOCK GET assets URL: ${url}\n` +
        `[${new Date().toISOString()}] MOCK GET assets array count: ${assets.length}, content: ${JSON.stringify(assets)}\n`
      );
      if (contentIdMatch) {
        const targetContentId = contentIdMatch[1];
        fs.appendFileSync(
          path.join(process.cwd(), "server-debug.log"),
          `[${new Date().toISOString()}] MOCK GET targetContentId: ${targetContentId}\n`
        );
        list = list.filter((a) => a.platform_content_id === targetContentId);
        fs.appendFileSync(
          path.join(process.cwd(), "server-debug.log"),
          `[${new Date().toISOString()}] MOCK GET assets filtered list count: ${list.length}\n`
        );
      }
      list.sort((a, b) => a.sort_order - b.sort_order);
      res.writeHead(200);
      res.end(JSON.stringify(list));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        const fs = require("fs");
        const path = require("path");
        fs.appendFileSync(
          path.join(process.cwd(), "server-debug.log"),
          `[${new Date().toISOString()}] MOCK POST assets payload: ${JSON.stringify(data)}\n`
        );
        const acceptHeader = req.headers["accept"] || "";
        const isSingle = acceptHeader.includes("vnd.pgrst.object");

        if (Array.isArray(data)) {
          data.forEach((item) => {
            item.id = item.id || generateUUID();
            item.created_at = new Date().toISOString();
            item.updated_at = new Date().toISOString();
            assets.push(item);
          });
          res.writeHead(201);
          if (isSingle) {
            res.end(JSON.stringify(data[0] || null));
          } else {
            res.end(JSON.stringify(data));
          }
        } else {
          data.id = data.id || generateUUID();
          data.created_at = data.created_at || new Date().toISOString();
          data.updated_at = data.updated_at || new Date().toISOString();
          assets.push(data);
          res.writeHead(201);
          if (isSingle) {
            res.end(JSON.stringify(data));
          } else {
            res.end(JSON.stringify([data]));
          }
        }
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = assets.findIndex((a) => a.id === targetId);
        if (idx !== -1) {
          assets[idx] = { ...assets[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(assets[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "asset not found" }));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        assets = assets.filter((a) => a.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 23.6 REST Export Logs API
  if (url.includes("/rest/v1/export_logs")) {
    if (method === "GET") {
      res.writeHead(200);
      res.end(JSON.stringify(exportLogs));
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        data.id = data.id || generateUUID();
        data.created_at = new Date().toISOString();
        exportLogs.push(data);
        res.writeHead(201);
        res.end(JSON.stringify(data));
      });
      return;
    }
  }

  // 23.7 REST Platform Accounts API
  if (url.includes("/rest/v1/platform_accounts")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      const workspaceIdMatch = url.match(/[?&]workspace_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetWorkspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;

      let filtered = platformAccounts;
      if (targetId) filtered = filtered.filter(a => a.id === targetId);
      if (targetWorkspaceId) filtered = filtered.filter(a => a.workspace_id === targetWorkspaceId);

      const acceptHeader = req.headers["accept"] || "";
      res.writeHead(200);
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.end(JSON.stringify(filtered));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const payload = JSON.parse(body);
        const data = Array.isArray(payload) ? payload : [payload];
        data.forEach(item => {
          item.id = item.id || generateUUID();
          item.created_at = new Date().toISOString();
          item.updated_at = new Date().toISOString();
          platformAccounts.push(item);
        });
        res.writeHead(201);
        res.end(JSON.stringify(Array.isArray(payload) ? data : data[0]));
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = platformAccounts.findIndex((a) => a.id === targetId);
        if (idx !== -1) {
          platformAccounts[idx] = { ...platformAccounts[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(platformAccounts[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "account not found" }));
        }
      });
      return;
    }
    if (method === "DELETE") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      if (targetId) {
        platformAccounts = platformAccounts.filter((a) => a.id !== targetId);
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // 23.8 REST Publications API
  if (url.includes("/rest/v1/publications")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      const contentIdMatch = url.match(/[?&]platform_content_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetContentId = contentIdMatch ? contentIdMatch[1] : null;

      let filtered = publications;
      if (targetId) filtered = filtered.filter(p => p.id === targetId);
      if (targetContentId) filtered = filtered.filter(p => p.platform_content_id === targetContentId);

      const acceptHeader = req.headers["accept"] || "";
      res.writeHead(200);
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.end(JSON.stringify(filtered));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const payload = JSON.parse(body);
        const data = Array.isArray(payload) ? payload : [payload];
        data.forEach(item => {
          item.id = item.id || generateUUID();
          item.created_at = new Date().toISOString();
          item.updated_at = new Date().toISOString();
          publications.push(item);
        });
        res.writeHead(201);
        res.end(JSON.stringify(Array.isArray(payload) ? data : data[0]));
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = publications.findIndex((p) => p.id === targetId);
        if (idx !== -1) {
          publications[idx] = { ...publications[idx], ...updates, updated_at: new Date().toISOString() };
          res.writeHead(200);
          res.end(JSON.stringify(publications[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "publication not found" }));
        }
      });
      return;
    }
  }

  // 23.9 REST Usage Records API
  if (url.includes("/rest/v1/usage_records")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      const workspaceIdMatch = url.match(/[?&]workspace_id=eq\.([a-zA-Z0-9_-]+)/);
      const targetWorkspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;

      let filtered = usageRecords;
      if (targetId) filtered = filtered.filter(u => u.id === targetId);
      if (targetWorkspaceId) filtered = filtered.filter(u => u.workspace_id === targetWorkspaceId);

      const acceptHeader = req.headers["accept"] || "";
      res.writeHead(200);
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.end(JSON.stringify(filtered));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const payload = JSON.parse(body);
        const data = Array.isArray(payload) ? payload : [payload];
        data.forEach(item => {
          item.id = item.id || generateUUID();
          item.created_at = new Date().toISOString();
          usageRecords.push(item);
        });
        res.writeHead(201);
        res.end(JSON.stringify(Array.isArray(payload) ? data : data[0]));
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = usageRecords.findIndex((u) => u.id === targetId);
        if (idx !== -1) {
          usageRecords[idx] = { ...usageRecords[idx], ...updates };
          res.writeHead(200);
          res.end(JSON.stringify(usageRecords[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "usage record not found" }));
        }
      });
      return;
    }
  }

  // 23.10 REST Error Logs API
  if (url.includes("/rest/v1/error_logs")) {
    if (method === "GET") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;

      let filtered = errorLogs;
      if (targetId) filtered = filtered.filter(e => e.id === targetId);

      const acceptHeader = req.headers["accept"] || "";
      res.writeHead(200);
      if (acceptHeader.includes("vnd.pgrst.object")) {
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.end(JSON.stringify(filtered));
      }
      return;
    }
    if (method === "POST") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const payload = JSON.parse(body);
        const data = Array.isArray(payload) ? payload : [payload];
        data.forEach(item => {
          item.id = item.id || generateUUID();
          item.created_at = new Date().toISOString();
          errorLogs.push(item);
        });
        res.writeHead(201);
        res.end(JSON.stringify(Array.isArray(payload) ? data : data[0]));
      });
      return;
    }
    if (method === "PATCH") {
      const idMatch = url.match(/[?&]id=eq\.([a-zA-Z0-9_-]+)/);
      const targetId = idMatch ? idMatch[1] : null;
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const updates = JSON.parse(body);
        const idx = errorLogs.findIndex((e) => e.id === targetId);
        if (idx !== -1) {
          errorLogs[idx] = { ...errorLogs[idx], ...updates };
          res.writeHead(200);
          res.end(JSON.stringify(errorLogs[idx]));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "error log not found" }));
        }
      });
      return;
    }
  }

  // 23.11 Storage Mock API
  if (url.includes("/storage/v1/object/")) {
    if (url.includes("/sign/assets/")) {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        const data = JSON.parse(body);
        const expires = data.expiresIn || 60;
        const filePath = url.split("/sign/assets/")[1];
        res.writeHead(200);
        res.end(JSON.stringify({
          signedURL: `http://localhost:9099/storage/v1/object/assets/${filePath}?token=signed-mock-token&expires=${expires}`
        }));
      });
      return;
    }

    if (url.includes("/assets/")) {
      const filePath = url.split("/assets/")[1].split("?")[0];
      if (method === "POST" || method === "PUT") {
        res.writeHead(200);
        res.end(JSON.stringify({ Key: `assets/${filePath}`, Id: generateUUID() }));
        return;
      }
      if (method === "GET") {
        res.writeHead(200, { "Content-Type": "image/webp" });
        const dummyBuffer = Buffer.alloc(100);
        res.end(dummyBuffer);
        return;
      }
      if (method === "DELETE") {
        res.writeHead(200);
        res.end(JSON.stringify({ message: "Deleted successfully" }));
        return;
      }
    }
  }

  // 24. 기본 빈 배열 반환
  res.writeHead(200);
  res.end("[]");
});

server.listen(9099, () => {
  console.log("Mock Supabase server listening on http://localhost:9099");
});
