import { test, expect } from "@playwright/test";

test.describe("E2E 인증 시나리오 테스트", () => {
  test("비인증 사용자가 대시보드 접근 시 로그인 페이지로 자동 리다이렉트되어야 함 (보호 페이지 접근 차단)", async ({
    page,
  }) => {
    // 대시보드로 직접 접근 시도
    await page.goto("/dashboard");

    // 로그인 페이지로 튕겼는지 확인
    await page.waitForURL("**/login?next=%2Fdashboard");
    await expect(page.locator("h2")).toContainText("안티그래비티 시작하기");
  });

  test("Google 로그인 버튼이 정상적으로 화면에 렌더링되어야 함", async ({ page }) => {
    await page.goto("/login");
    const googleBtn = page.locator("button:has-text('Google 계정으로 로그인')");
    await expect(googleBtn).toBeVisible();
  });

  test("이메일 회원가입 프로세스가 정상적으로 동작해야 함", async ({ page }) => {
    await page.goto("/signup");

    // 회원가입 정보 입력
    await page.fill("#name", "테스터");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.fill("#passwordConfirm", "password123");

    // 약관동의 체크 (체크박스 ID로 직접 체크)
    await page.check("#termsAccepted");
    await page.check("#privacyAccepted");

    // 회원가입 양식 제출
    await page.click("button[type='submit']");

    // 성공 안내 화면 노출 확인
    await page.waitForSelector("h2:has-text('이메일 인증 필요')");
    await expect(page.locator("h2")).toContainText("이메일 인증 필요");
    await expect(page.getByText("인증 링크를 발송했습니다")).toBeVisible();
  });

  test("이메일 로그인 후 대시보드 진입, 새로고침 세션 유지, 로그아웃이 완료되어야 함", async ({ page }) => {
    // 1. 로그인 페이지 접속
    await page.goto("/login");

    // 로그인 진행
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");

    // 2. 대시보드로 정상 이동하는지 확인
    await page.waitForURL("**/dashboard");
    await expect(page.locator("h1")).toContainText("안녕하세요, 테스터님!");
    await expect(page.locator("body")).toContainText("Active Workspace");
    await expect(page.locator("body")).toContainText("테스터의 워크스페이스");

    // 3. 새로고침 후 세션 유지 검증
    await page.reload();
    await expect(page.locator("h1")).toContainText("안녕하세요, 테스터님!");

    // 4. 로그아웃 완료 검증
    const logoutBtn = page.locator("button:has-text('로그아웃')").first();
    await logoutBtn.click();

    await page.waitForURL("**/login");
    await expect(page.locator("h2")).toContainText("안티그래비티 시작하기");
  });
});
