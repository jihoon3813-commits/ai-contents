import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("E2E Phase 7: 내보내기, 이미지 자산 및 복사 기능 통합 E2E 테스트", () => {
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("이미지 자산 업로드 -> ALT 수정 -> 이미지 기획 매핑 -> 네이버 블록 복사 -> 포맷별 파일 다운로드 -> ZIP 패키지 생성 다운로드 E2E 흐름 검증", async ({ page, request }) => {
    test.setTimeout(90000);

    const projectId = "p7777777-7777-7777-7777-777777777777";
    const platformContentId = "c7777777-7777-7777-7777-777777777777";
    const workspaceId = "w1111111-1111-1111-1111-111111111111";

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    page.on("pageerror", (err: any) => {
      console.error(">>> E2E BROWSER PAGE ERROR:", err.message);
    });
    page.on("console", (msg: any) => {
      console.log(`>>> E2E BROWSER CONSOLE [${msg.type()}]:`, msg.text());
    });

    // 1. Mock Supabase 데이터 세트 시딩 (E2E 속도 단축용)
    // 1.1 프로젝트 시딩
    await request.post("http://localhost:9099/rest/v1/content_projects", {
      data: {
        id: projectId,
        workspace_id: workspaceId,
        title: "E2E 내보내기 프로젝트",
        keyword: "AI 카피라이터",
        content_type: "INFORMATIONAL",
        status: "WRITING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    // 1.2 플랫폼 콘텐츠 (NAVER_BLOG 지정) 시딩
    await request.post("http://localhost:9099/rest/v1/platform_contents", {
      data: {
        id: platformContentId,
        workspace_id: workspaceId,
        project_id: projectId,
        platform_id: "p4444444-4444-4444-4444-444444444444", // NAVER_BLOG
        title: "AI와 함께하는 스마트한 콘텐츠 제작 비법",
        body_html: "<h2>도입부 섹션</h2><p>본문에 들어갈 첫 멘트입니다.</p><table><tr><th>메리트</th><th>점수</th></tr><tr><td>속도</td><td>99점</td></tr></table>",
        body_text: "도입부 섹션\n\n본문에 들어갈 첫 멘트입니다.",
        status: "APPROVED",
        hashtags: ["AI마케팅", "자동화봇"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    // 1.3 이미지 기획안 시딩
    await request.post("http://localhost:9099/rest/v1/image_plans", {
      data: {
        id: "plan-7777-7777-7777-777777777777",
        project_id: projectId,
        platform_content_id: platformContentId,
        sequence_number: 1,
        role: "INTRO_IMAGE",
        description: "안티그래비티 로고와 마케팅 혁신을 상징하는 밝은 우주 공간",
        aspect_ratio: "1:1",
        overlay_text: "콘텐츠 지옥 탈출",
        status: "PENDING"
      }
    });

    // 2. 로그인 후 편집 화면 다이렉트 진입
    await login(page);
    await page.goto(`/contents/${projectId}/platform/${platformContentId}/edit`);
    await expect(page.locator("h2:text('도입부 섹션')").first()).toBeVisible();

    // 3. '이미지' 자산 관리 탭 진입
    await page.click("button:has-text('이미지')");
    await expect(page.locator("span:text('신규 이미지 자산 업로드')")).toBeVisible();

    // 4. 가상 파일 업로드 연동
    const fileBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01
    ]); // JPEG magic bytes dummy
    
    await page.setInputFiles("input#asset-file-input", {
      name: "e2e_mock_image.jpg",
      mimeType: "image/jpeg",
      buffer: fileBuffer
    });

    // 업로드 완료 및 자산 리스트 카드 노출 검증
    try {
      await expect(page.locator("span:text('e2e_mock_image.jpg')").first()).toBeVisible({ timeout: 15000 });
    } catch (error) {
      const alertTexts = await page.locator("div[role='alert']").allTextContents();
      console.error(">>> ALL ALERTS ON FAILURE:", alertTexts);
      const bodyText = await page.locator("body").innerText();
      console.error(">>> BODY INNER TEXT ON FAILURE:", bodyText.substring(0, 1000));
      throw error;
    }

    // 5. ALT 텍스트 기입 및 업데이트 트리거 검사
    const altInput = page.locator("input[placeholder*='ALT 텍스트']").first();
    await altInput.fill("E2E 마스크 고양이");
    await altInput.blur();
    
    // 6. 이미지 기획 매핑 연동
    const linkSelect = page.locator("select").filter({ hasText: "연결된 이미지 없음" }).first();
    await linkSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000); // 갱신 리로드 텀 대기
    
    // 7. '내보내기' 탭 전환 및 클립보드 복사 검증
    await page.click("button:has-text('내보내기')");
    await expect(page.locator("h4:has-text('클립보드 데이터 복사')")).toBeVisible();

    // 네이버 광고 고지 복사 테스트
    await page.click("button:has-text('광고 고지문 복사')");
    // 복사 성공 토스트 검출
    await expect(page.locator("div").filter({ hasText: "클립보드에 복사했습니다." }).first()).toBeVisible();

    // 8. 파일 포맷 다운로드 트리거 테스트
    // 8.1 HTML 다운로드
    const [htmlDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.click("button:has-text('워드프레스 HTML 다운로드')")
    ]);
    expect(htmlDownload.suggestedFilename()).toContain("html");

    // 8.2 마크다운 다운로드
    const [mdDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.click("button:has-text('마크다운 MD 다운로드')")
    ]);
    expect(mdDownload.suggestedFilename()).toContain("md");

    // 8.3 통합 ZIP 패키지 다운로드
    const [zipDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.click("button:has-text('프로젝트 통합 ZIP 패키지 다운로드')")
    ]);
    expect(zipDownload.suggestedFilename()).toContain("zip");
  });
});
