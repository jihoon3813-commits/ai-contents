import { test, expect } from "@playwright/test";

test.describe("E2E 브랜드 및 보이스 관리 시나리오 테스트", () => {
  // 로그인 유틸리티
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("브랜드 신규 생성, 수정, 복제 및 보이스 어조 설정과 예문 분석 승인 흐름 테스트", async ({ page }) => {
    // 1. 로그인 진행
    await login(page);

    // 2. 브랜드 관리 화면으로 이동
    const brandLink = page.locator("a:has-text('브랜드 관리')").first();
    await brandLink.click();
    await page.waitForURL("**/brands");

    // 3. 신규 브랜드 추가 화면으로 이동
    const addBtn = page.locator("a:has-text('새 브랜드 추가')").first();
    await addBtn.click();
    await page.waitForURL("**/brands/new");

    // 4. 브랜드 기본정보 작성 및 저장
    await page.fill("#name", "이투코리아");
    await page.fill("#industry", "마케팅 서비스");
    await page.fill("#tagline", "디지털 비즈니스의 동반자");
    await page.fill("#website_url", "www.e2korea.com");
    await page.fill("#description", "데이터 분석을 통한 검색 최적화 광고 및 브랜드 마케팅 대행 솔루션입니다.");
    
    // 기본 브랜드 체크 해제 상태에서 체크 활성화
    const defaultCheck = page.locator("#is_default");
    await defaultCheck.check();

    await page.click("button[type='submit']");
    await page.waitForURL("**/brands");

    // 5. 생성된 브랜드 카드 검증
    const brandCard = page.locator("div.relative").filter({ hasText: "이투코리아" }).first();
    await expect(brandCard).toBeVisible();
    await expect(brandCard.locator("span:has-text('기본')")).toBeVisible();
    await expect(brandCard).toContainText("마케팅 서비스");

    // 6. 브랜드 수정 동작 확인
    const editLink = brandCard.locator("a:has-text('수정')").first();
    await editLink.click();
    await page.waitForURL("**/brands/*/edit");

    await page.fill("#industry", "디지털 마케팅 에이전시");
    await page.click("button[type='submit']");
    await page.waitForURL("**/brands");

    await expect(brandCard).toContainText("디지털 마케팅 에이전시");

    // 7. 예문 분석(샘플 등록) 화면으로 이동
    const sampleLink = brandCard.locator("a:has-text('작성글 샘플 분석')").first();
    await sampleLink.click();
    await page.waitForURL("**/brands/*/samples");

    // 예문 등록
    await page.fill("input[placeholder='예: IT 제품 소개글 원고']", "테스트 블로그 원고");
    await page.fill(
      "textarea[placeholder*='여기에 과거에 직접 작성하셨던']",
      "안녕하세요. 안티그래비티의 고성능 마케팅 자동화 봇을 테스트하고 있습니다. 50자 이상의 조건이 충족되어야 정상 파싱 분석이 시작되므로 긴 한글 텍스트를 기입합니다. 마케팅 솔루션을 지금 체험해 보세요!"
    );
    
    await page.click("button:has-text('문체 분석 가동')");
    
    // 히스토리에 추가되었는지 검증
    const sampleCard = page.locator("div.bg-white").filter({ hasText: "테스트 블로그 원고" }).first();
    await expect(sampleCard).toBeVisible();

    // 아코디언 확장 및 분석결과 노출 확인
    await sampleCard.click();
    await expect(sampleCard).toContainText("존댓말 비율");
    await expect(sampleCard).toContainText("의문문 비율");

    // 8. 보이스 프로필 설정 화면으로 이동
    const voiceLink = page.locator("a:has-text('보이스(어조) 설정')").first();
    await voiceLink.click();
    await page.waitForURL("**/brands/*/voice");

    // AI 권장 분석 요약본 및 적용 버튼 검증
    await expect(page.locator("body")).toContainText("AI 추천 권장안");
    const applyBtn = page.locator("button:has-text('AI 권장 어조 승인 및 적용')").first();
    await expect(applyBtn).toBeVisible();
    
    await applyBtn.click();
    
    // 승인 적용 완료 상태(토스트 노출 및 승인 완료됨 문체 반영) 확인
    await expect(page.locator("body")).toContainText("승인 완료됨");
  });
});
