import { test, expect } from "@playwright/test";

test.describe("E2E 외부 플랫폼 연동 및 발행 통합 시나리오 테스트", () => {
  // 로그인 공통 헬퍼
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("외부 CMS 계정 연동(WordPress/Blogger) -> 연동 해제 -> 원고 상세 에디터에서 WordPress 발행 시나리오", async ({ page }) => {
    // 1. 로그인
    await login(page);

    // 1-1. E2E 테스트 연동 한도(1개 제한) 검증을 위해 워크스페이스를 FREE 요금제로 임시 전환
    const apiContext = page.request;
    const patchWSRecord = await apiContext.patch("http://localhost:9099/rest/v1/workspaces?id=eq.w1111111-1111-1111-1111-111111111111", {
      data: { plan_code: "FREE" }
    });
    expect(patchWSRecord.ok()).toBe(true);

    // 2. 연동 설정 페이지로 이동
    const settingsLink = page.locator("a:has-text('연동 설정')").first();
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();
    await page.waitForURL("**/settings/integrations");

    // 3. WordPress 계정 연동 시도 (FREE 플랜 최초 1개 연결 가능)
    await page.fill("input[placeholder='예: https://myblog.com']", "http://localhost:9099");
    await page.fill("input[placeholder='admin']", "tester");
    await page.fill("input[placeholder='abcd efgh ijkl mnop']", "mock-app-password");
    await page.fill("input[placeholder='예: 내 기술 블로그']", "WP E2E Blog");
    await page.click("button:has-text('WordPress 계정 연결')");

    // 연결 확인 배너/리스트 노출 대기
    await expect(page.locator("h3:has-text('WP E2E Blog')")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("CONNECTED").first()).toBeVisible();

    // 4. 원고 상세 에디터 페이지 진입 (미리 준비된 APPROVED 원고)
    await page.goto("/contents/p7777777-7777-7777-a777-777777777777/platform/pc777777-7777-7777-a777-777777777777/edit");
    await page.waitForURL("**/platform/*/edit");

    // 5. 발행 탭 클릭
    const publishTabBtn = page.locator("button:has-text('발행')");
    await expect(publishTabBtn).toBeVisible();
    await publishTabBtn.click();

    // 발행 상태 검증 및 외부 플랫폼에 원고 발행하기 버튼 노출 확인
    await expect(page.locator("text=원고 최종 승인(APPROVED) 여부")).toBeVisible();
    await expect(page.locator("text=연동 계정 존재 여부")).toBeVisible();

    const publishSubmitBtn = page.locator("button:has-text('외부 플랫폼에 원고 발행하기')");
    await expect(publishSubmitBtn).toBeVisible();
    await expect(publishSubmitBtn).toBeEnabled();

    // 발행 전송 실행
    await publishSubmitBtn.click();

    // 발행 성공 히스토리 목록 갱신 및 포스트 확인 링크 감지
    await expect(page.locator("text=생성된 포스트 확인하기")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("DRAFT_CREATED").first()).toBeVisible();

    // 6. 다시 연동 설정으로 복귀하여 계정 연동 해제 검증 및 Blogger 교차 연동 검증
    await page.goto("/settings/integrations");
    await page.waitForURL("**/settings/integrations");

    // WP 블로그 연동 해제 쓰레기통 버튼 클릭
    const trashBtn = page.locator("button[title='연동 해제']").first();
    await expect(trashBtn).toBeVisible();

    // confirm 다이얼로그 가로채기 승인
    page.on("dialog", (dialog) => dialog.accept());
    await trashBtn.click();

    // 해제된 계정이 화면에서 사라졌는지 확인
    await expect(page.locator("h3:has-text('WP E2E Blog')")).not.toBeVisible({ timeout: 5000 });

    // 7. 이제 요금 제한 슬롯이 비었으므로 Blogger 연동이 차단되지 않고 가능해야 함!
    await page.fill("input[placeholder*='E2E 시']", "mock-code");
    await page.click("button:has-text('Blogger 계정 연결')");

    // Blogger 연결 확인
    await expect(page.locator("h3:has-text('테스터의 Blogger 일기장')")).toBeVisible({ timeout: 10000 });

    // 8. E2E 한도 검증이 종료되었으므로 워크스페이스 요금제를 다시 ENTERPRISE로 원상 복구하여 타 테스트들의 리소스 생성 제한을 회피
    const restoreWSRecord = await apiContext.patch("http://localhost:9099/rest/v1/workspaces?id=eq.w1111111-1111-1111-1111-111111111111", {
      data: { plan_code: "ENTERPRISE" }
    });
    expect(restoreWSRecord.ok()).toBe(true);
  });

  test("관리자 권한 차단 필터(일반 사용자 403 및 어드민 대시보드 정상 접근/장애 조치 완료) 시나리오", async ({ page }) => {
    // 1. 로그인 (기본 is_admin = false)
    await login(page);

    // 2. 비관리자 /admin 강제 진입 시 403 Forbidden 노출 검증
    await page.goto("/admin");
    await expect(page.locator("h1:has-text('403 Forbidden')")).toBeVisible();
    await expect(page.locator("text=이 구역은 시스템 어드민 관리자만 접근할 수 있습니다.")).toBeVisible();

    // 3. Playwright API Request Context를 이용하여 모의 Supabase DB 상 유저 등급을 어드민으로 동적 승격!
    const apiContext = page.request;
    const patchRes = await apiContext.patch("http://localhost:9099/rest/v1/profiles?id=eq.d3b07384-d113-4ec5-a587-f82343801234", {
      data: { is_admin: true }
    });
    expect(patchRes.ok()).toBe(true);

    // 4. 승격 후 /admin 재진입 시 어드민 콘솔 대시보드가 성공적으로 열리고 가입자/통계 정보가 표시되는지 검증
    await page.goto("/admin");
    await page.waitForURL("**/admin");

    // 타이틀 및 어드민 전용 탭/수치 출력 체크
    await expect(page.locator("h1:has-text('시스템 관리자 대시보드')")).toBeVisible();
    await expect(page.locator("text=가입 사용자 관리")).toBeVisible();
    await expect(page.locator("text=워크스페이스 요금제 통제")).toBeVisible();

    // 5. 사용 후 등급 복원 (원상태 복귀)
    const restoreRes = await apiContext.patch("http://localhost:9099/rest/v1/profiles?id=eq.d3b07384-d113-4ec5-a587-f82343801234", {
      data: { is_admin: false }
    });
    expect(restoreRes.ok()).toBe(true);
  });
});
