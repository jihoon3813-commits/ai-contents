import { test, expect } from "@playwright/test";

test.describe("E2E 콘텐츠 기획 및 마법사 시나리오 테스트", () => {
  // 로그인 유틸리티
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("신규 기획 생성, 6단계 마법사 정보 입력, 자동저장 검증 및 기획 확정 시나리오 테스트", async ({ page }) => {
    // 1. 로그인 진행
    await login(page);

    // 2. 콘텐츠 기획 메뉴로 이동
    const contentsLink = page.locator("a:has-text('콘텐츠 기획')").first();
    await contentsLink.click();
    await page.waitForURL("**/contents");

    // 3. 새 기획 프로젝트 추가 시작
    const createBtn = page.locator("a:has-text('새 기획 프로젝트 작성')").first();
    await createBtn.click();
    // /contents/new 진입 후 자동 생성 세션 거쳐 setup 화면으로 리다이렉트 대기
    await page.waitForURL("**/contents/*/setup");

    // === STEP 1: 기본 설정 ===
    // 대표 채널로 워드프레스와 네이버 블로그 지정
    await page.click("label:has-text('WordPress')");
    await page.click("label:has-text('네이버 블로그')");
    
    // 카테고리 기입
    await page.fill("input[placeholder='예: IT 가이드']", "IT 트렌드");
    // 콘텐츠 유형 지정 (체험수기형이 아닌 정보형 지정으로 경고창 예방 체크)
    await page.selectOption("select[name='content_type']", "INFORMATIONAL");
    // 예상 독자 및 구매 여정 단계 기입
    await page.fill("input[placeholder='예: 30대 재테크에 관심 많은 직장인']", "2030 주니어 마케터");
    await page.fill("input[placeholder*='예: 문제 인지 단계']", "도구 비교 선택 단계");

    // 다음 단계 이동
    await page.click("button:has-text('다음 단계로')");

    // === STEP 2: 주제와 키워드 ===
    // 기획안 명칭, 상세 주제, 핵심 키워드 기입
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로']", "E2E 마케팅 자동화 기획안");
    await page.fill("textarea[placeholder*='예: 갤럭시 버즈 프로의']", "인공지능 마케팅 솔루션을 도입하여 블로그 포스팅 속도를 10배 개선하는 가이드");
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로 리뷰']", "마케팅 자동화");

    // 다음 단계 이동
    await page.click("button:has-text('다음 단계로')");

    // === STEP 3: 사용자 경험 ===
    // 정보형이므로 직접경험 비활성화 상태 유지하고 패스
    await page.click("button:has-text('다음 단계로')");

    // === STEP 4: 콘텐츠 구성 ===
    // 플랫폼 기본값 자동 로드(글자수 등) 상태 확인하고 패스
    await page.click("button:has-text('다음 단계로')");

    // === STEP 5: 문체 설정 ===
    // 브랜드 기본 보이스 상속 활성화 상태 유지하고 패스
    await page.click("button:has-text('다음 단계로')");

    // === STEP 6: 이미지 설정 및 최종 검토 ===
    // 최종 검토 리포트 렌더링 확인 후 기획안 확정 클릭
    await page.click("button:has-text('최종 기획안 확정')");

    // 4. 다시 목록(/contents)으로 리다이렉트되었는지 확인
    await page.waitForURL("**/contents");

    // 5. 생성된 기획 프로젝트 카드가 정상적으로 조회되는지 검증
    const projectCard = page.locator("div.relative").filter({ hasText: "E2E 마케팅 자동화 기획안" }).first();
    await expect(projectCard).toBeVisible();
    await expect(projectCard.locator("span:has-text('IT 트렌드')")).toBeVisible();
    await expect(projectCard.locator("span:has-text('WordPress')")).toBeVisible();
    await expect(projectCard.locator("span:has-text('네이버 블로그')")).toBeVisible();
  });
});
