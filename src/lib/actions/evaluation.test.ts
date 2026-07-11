import { describe, it, expect, vi, beforeEach } from "vitest";

// 테이블별 모의 데이터 저장소
const tableMockData: Record<string, any[]> = {};
const tableMockError: Record<string, any[]> = {};

// 테이블별 모의 데이터 등록 헬퍼
function setTableMock(table: string, data: any, error: any = null) {
  if (!tableMockData[table]) {
    tableMockData[table] = [];
  }
  if (!tableMockError[table]) {
    tableMockError[table] = [];
  }
  tableMockData[table].push(data);
  tableMockError[table].push(error);
}

// 1. vi.hoisted를 활용하여 호이스팅 시점보다 빠르게 MockQueryBuilder 클래스 선언
const { MockQueryBuilder } = vi.hoisted(() => {
  class MockQueryBuilder {
    tableName: string;
    constructor(tableName: string) {
      this.tableName = tableName;
    }
    from() { return this; }
    select() { return this; }
    update() { return this; }
    insert() { return this; }
    delete() { return this; }
    eq() { return this; }
    in() { return this; }
    order() { return this; }
    limit() { return this; }
    single() { return this; }
    maybeSingle() { return this; }

    then(onFulfilled: any) {
      const dataArr = tableMockData[this.tableName] || [];
      const errArr = tableMockError[this.tableName] || [];
      const data = dataArr.shift() ?? null;
      const error = errArr.shift() ?? null;
      return onFulfilled({ data, error });
    }
  }
  return { MockQueryBuilder };
});

// 2. Next.js cache 모의 구성
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// 3. Supabase 서버 클라이언트 모의 구성 (auth.getUser 모킹 포함)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockImplementation((table) => new MockQueryBuilder(table)),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user999" } }, error: null })
    }
  }),
}));

// 4. 멤버십 확인 함수 모의 구성
vi.mock("./generation", () => ({
  verifyWorkspaceMembership: vi.fn().mockResolvedValue({ role: "EDITOR" }),
}));

import {
  evaluateContent,
  autoFixIssue,
  applyAutoFix,
  ignoreIssue,
  confirmFact,
  rejectFact,
  approveContent,
  revokeApproval,
  getLatestEvaluationAndFacts,
} from "./evaluation";

describe("Content Quality Evaluation Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 데이터 저장소 초기화
    for (const key in tableMockData) delete tableMockData[key];
    for (const key in tableMockError) delete tableMockError[key];
  });

  describe("evaluateContent", () => {
    it("본문 텍스트 내 브랜드 금지어 및 기본 코드 규칙(H1 중복, CTA 등)을 로컬 정규식으로 잡아내야 함", async () => {
      const mockContent = {
        id: "c111",
        project_id: "p111",
        title: "최고의 마케팅 전략",
        body_text: "저희는 100% 효과를 보장하는 최저 마케팅 서비스입니다.",
        body_html: "<h1>최고의 마케팅 전략</h1><h1>중복된 H1</h1><p>저희는 100% 효과를 보장하는 최저 마케팅 서비스입니다.</p>",
        platforms: { code: "WORDPRESS" }
      };

      const mockProject = {
        id: "p111",
        forbidden_phrases: ["보장", "최저"],
        target_keywords: ["마케팅"],
        primary_keyword: "마케팅",
        secondary_keywords: ["마케팅자동화", "Next.js"],
        content_briefs: {
          cta_phrase: "지금 상담받기",
          main_intent: "정보 제공"
        }
      };

      setTableMock("platform_contents", mockContent);
      setTableMock("content_projects", mockProject);
      setTableMock("content_evaluations", []); // Select old evals
      setTableMock("content_evaluations", { id: "eval_999" }); // Insert new eval
      setTableMock("evaluation_issues", { success: true });
      setTableMock("content_facts", []); // Select existing facts
      setTableMock("content_facts", { success: true }); // Insert new facts

      const result = await evaluateContent("c111");
      expect(result.id).toBe("eval_999");
    });
  });

  describe("autoFixIssue & applyAutoFix", () => {
    it("자동 수정 제안을 생성하고 본문에 적용하여 새로운 버전을 생성해야 함", async () => {
      const mockIssue = {
        id: "issue123",
        evaluation_id: "eval123",
        severity: "WARNING",
        category: "READABILITY",
        message: "어조 수정 권장",
        content_evaluations: { platform_content_id: "c111" }
      };

      const mockContent = {
        id: "c111",
        project_id: "p111",
        title: "기존 제목",
        body_text: "수정 전 본문",
        body_html: "<p>수정 전 본문</p>",
        platforms: { code: "WORDPRESS" }
      };

      setTableMock("evaluation_issues", mockIssue); // autoFixIssue query
      setTableMock("platform_contents", mockContent); // autoFixIssue platform_contents

      const fixResult = await autoFixIssue("issue123");
      expect(fixResult.newText).toBeDefined();

      // applyAutoFix 동작을 위한 순차 Mock 등록
      setTableMock("platform_contents", mockContent); // select 1
      setTableMock("platform_contents", { success: true }); // update content
      setTableMock("evaluation_issues", { success: true }); // update issue status
      setTableMock("content_versions", [{ version_number: 2 }]); // select version_number order limit 1
      setTableMock("platform_contents", { ...mockContent, body_text: "수정 후 본문" }); // select final
      setTableMock("content_versions", { success: true }); // insert new version snapshot

      const applyResult = await applyAutoFix("issue123", "c111", fixResult.newText, fixResult.updatedFields);
      expect(applyResult.success).toBe(true);
    });
  });

  describe("confirmFact & rejectFact", () => {
    it("사실 검증 항목을 완료 또는 반려 처리해야 함", async () => {
      setTableMock("content_facts", { id: "fact999", verification_status: "USER_CONFIRMED" });
      const confirmRes = await confirmFact("fact999");
      expect(confirmRes.verification_status).toBe("USER_CONFIRMED");

      setTableMock("content_facts", { id: "fact999", verification_status: "DISPUTED" });
      const rejectRes = await rejectFact("fact999");
      expect(rejectRes.verification_status).toBe("DISPUTED");
    });
  });

  describe("ignoreIssue", () => {
    it("Warning 등급 이슈를 무시 사유 입력 하에 예외 허용 처리해야 함", async () => {
      setTableMock("evaluation_issues", { id: "issue123", status: "IGNORED" });
      const result = await ignoreIssue("issue123", "브랜드 정책상 부득이하게 허용함");
      expect(result.status).toBe("IGNORED");
    });
  });

  describe("approveContent", () => {
    it("CRITICAL 이슈가 없고 미검토 사실이 없는 경우 최종 승인 처리를 완료하고 PRE_PUBLISH 버전을 적재해야 함", async () => {
      const mockContent = {
        id: "c111",
        project_id: "p111",
        title: "우수한 마케팅 정보",
        body_text: "풍부한 본문 텍스트입니다. 200자 이상 구성되어 있습니다.",
        body_html: "<p>풍부한 본문 텍스트입니다. 200자 이상 구성되어 있습니다.</p>"
      };

      setTableMock("content_evaluations", { id: "eval123", evaluation_version: 1 }); // select latest eval
      setTableMock("evaluation_issues", []); // select open critical issues = 0
      setTableMock("platform_contents", mockContent); // select 1
      setTableMock("content_facts", []); // select unverified facts = 0
      setTableMock("content_versions", []); // select versions limit 1 -> return empty to start nextVer at 1
      setTableMock("platform_contents", { success: true }); // update content status to APPROVED
      setTableMock("content_versions", { success: true }); // insert PRE_PUBLISH snapshot

      const result = await approveContent("c111");
      expect(result.success).toBe(true);
    });

    it("미결 CRITICAL 이슈가 있는 경우 승인 처리를 차단해야 함", async () => {
      const mockContent = {
        id: "c111",
        project_id: "p111",
        title: "부실한 정보",
        body_text: "짧음",
        body_html: "<p>짧음</p>"
      };

      setTableMock("content_evaluations", { id: "eval123", evaluation_version: 1 }); // select latest eval
      setTableMock("evaluation_issues", [{ id: "issue99", severity: "CRITICAL", status: "OPEN" }]); // open critical count = 1
      setTableMock("platform_contents", mockContent); // select content
      setTableMock("content_facts", []); // unverified facts = 0

      await expect(approveContent("c111")).rejects.toThrow("해결되지 않은 CRITICAL 등급의 심각한 오류가 존재하여 승인이 거절되었습니다.");
    });
  });
});
