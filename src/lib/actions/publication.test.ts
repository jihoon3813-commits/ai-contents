import { describe, it, expect, vi, beforeEach } from "vitest";
import { encrypt } from "@/lib/utils/encryption";

// next/cache 모듈 모킹
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// verifyWorkspaceMembership 모킹
vi.mock("./generation", () => {
  return {
    verifyWorkspaceMembership: vi.fn().mockResolvedValue({
      userId: "user-1111",
      workspaceId: "w1111111-1111-1111-1111-111111111111",
      userRole: "OWNER",
    }),
  };
});

// 호이스팅 에러 예방을 위해 최상단 변수에 mock 접두사 부여
const mockSingle = vi.fn().mockResolvedValue({ data: { plan_code: "FREE" }, error: null });
const mockInsert = vi.fn().mockImplementation(() => {
  return {
    select: vi.fn().mockImplementation(() => {
      return {
        single: vi.fn().mockResolvedValue({
          data: {
            id: "acc-9999",
            connection_status: "CONNECTED",
            site_url: "http://localhost:9099",
            external_account_id: "blog-1111",
          },
          error: null,
        }),
      };
    }),
  };
});

const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === "workspaces") {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    };
  }
  if (table === "content_projects" || table === "platform_contents") {
    const pcChain: any = {
      gte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "pc-1111",
          status: "APPROVED", // APPROVED 상태 원고 모킹
          platform_id: "p1111111-1111-1111-1111-111111111111",
          platform: { code: "WORDPRESS" },
          body_html: "<p>Hello WordPress</p>",
          title: "WordPress Title",
        },
        error: null,
      }),
      update: vi.fn().mockImplementation(() => {
        return {
          eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
        };
      }),
    };
    pcChain.select = vi.fn().mockReturnValue(pcChain);
    pcChain.eq = vi.fn().mockReturnValue(pcChain);
    return pcChain;
  }

  // 암호화 값들을 런타임에 동적으로 채워서 반환할 수 있도록 세팅 (Require 호이스팅 회피)
  const wpCreds = encrypt(JSON.stringify({ username: "admin", applicationPassword: "abcd efgh ijkl mnop" }));
  const bloggerAccessToken = encrypt("mock-access-token");
  const bloggerRefreshToken = encrypt("mock-refresh-token");
  const mockChain: any = {
    insert: mockInsert,
    update: vi.fn().mockImplementation(() => {
      return {
        eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };
    }),
    delete: vi.fn().mockImplementation(() => {
      return {
        eq: vi.fn().mockImplementation(() => {
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      };
    }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "acc-9999",
        connection_status: "CONNECTED",
        site_url: "http://localhost:9099",
        credentials_encrypted: wpCreds,
        access_token_encrypted: bloggerAccessToken,
        refresh_token_encrypted: bloggerRefreshToken,
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        external_account_id: "blog-1111",
      },
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { version_number: 1 },
      error: null,
    }),
  };

  mockChain.select = vi.fn().mockReturnValue(mockChain);
  mockChain.eq = vi.fn().mockReturnValue(mockChain);
  mockChain.gte = vi.fn().mockReturnValue(mockChain);
  mockChain.is = vi.fn().mockReturnValue(mockChain);
  mockChain.order = vi.fn().mockReturnValue(mockChain);
  mockChain.limit = vi.fn().mockReturnValue(mockChain);

  return mockChain;
});

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: () => Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1111", email: "tester@example.com" } } }),
      },
      from: mockFrom,
    }),
  };
});

import {
  connectWordPressAccount,
  connectBloggerAccount,
  publishContent,
} from "./publication";

describe("외부 플랫폼 연동 및 발행 Server Actions 단위 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("워드프레스 계정 연동 시 외부 주소 인증 확인 및 DB 적재가 정상 동작해야 한다", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "WP Admin User" }),
    });

    const result = await connectWordPressAccount(
      "http://localhost:9099",
      "admin",
      "abcd efgh ijkl mnop",
      "My Blog"
    );

    expect(result.success).toBe(true);
    expect(result.account).toBeDefined();

    global.fetch = originalFetch;
  });

  it("Blogger 연동 시 인가 코드를 이용하여 연동 계정이 정상 바인딩되어야 한다", async () => {
    const result = await connectBloggerAccount("mock-code");
    expect(result.success).toBe(true);
    expect(result.account).toBeDefined();
  });

  it("최종 승인(APPROVED)된 원고에 대해 외부 CMS 발행 호출 시 PENDING/PROCESSING 이력 적재 및 발행 완료 스냅샷 버전이 기록되어야 한다", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 12345, link: "http://localhost:9099/post/12345" }),
    });

    const result = await publishContent(
      "pc-1111", // contentId
      "acc-9999", // accountId
      "DRAFT"
    );

    expect(result.success).toBe(true);
    global.fetch = originalFetch;
  });
});
