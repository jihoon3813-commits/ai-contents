import { test, expect } from "@playwright/test";

test.describe("E2E AI 콘텐츠 생성 엔진 통합 시나리오 테스트", () => {
  // 로그인 유틸리티
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("신규 기획 -> 브리프 분석 -> 목차 개요 조작/승인 -> 비동기 본문 생성률 추적 -> 최종 다채널 결과 탭 검증", async ({ page }) => {
    test.setTimeout(90000);
    // 디버그용 브라우저 콘솔/에러 리스너
    page.on("pageerror", (err: any) => {
      console.log("BROWSER ERROR >>>", err.message);
    });
    page.on("console", (msg: any) => {
      console.log("BROWSER CONSOLE >>>", msg.text());
    });

    // 1. 로그인 진행
    await login(page);

    // 2. 콘텐츠 기획 메뉴 이동
    await page.locator("a:has-text('콘텐츠 기획')").first().click();
    await page.waitForURL("**/contents");

    // 3. 새 기획 작성 개시
    await page.locator("a:has-text('새 기획 프로젝트 작성')").first().click();
    await page.waitForURL("**/contents/*/setup");

    // === STEP 1: 기본 기획 설정 ===
    await page.click("label:has-text('WordPress')");
    await page.click("label:has-text('네이버 블로그')");
    await page.fill("input[placeholder='예: IT 가이드']", "AI 라이팅");
    await page.selectOption("select[name='content_type']", "INFORMATIONAL");
    await page.fill("input[placeholder='예: 30대 재테크에 관심 많은 직장인']", "콘텐츠 크리에이터");
    await page.fill("input[placeholder*='예: 문제 인지 단계']", "도구 모색 단계");
    await page.click("button:has-text('다음 단계로')");

    // === STEP 2: 주제와 키워드 ===
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로']", "AI Generation E2E Test Project");
    await page.fill("textarea[placeholder*='예: 갤럭시 버즈 프로의']", "AI 마케팅 기획 도구를 사용하여 시간 효율성을 극대화하는 블로그 칼럼 가이드");
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로 리뷰']", "인공지능 글쓰기");
    await page.click("button:has-text('다음 단계로')");

    // === STEP 3: 사용자 경험 ===
    await page.click("button:has-text('다음 단계로')");

    // === STEP 4: 구성 구성 ===
    await page.click("button:has-text('다음 단계로')");

    // === STEP 5: 문체 설정 ===
    await page.click("button:has-text('다음 단계로')");

    // === STEP 6: 최종 검토 및 기획 확정 ===
    await page.click("button:has-text('최종 기획안 확정')");
    await page.waitForURL("**/contents");

    // 4. 리스트에서 생성한 프로젝트 클릭 진입
    const projectCard = page.locator("div.relative").filter({ hasText: "AI Generation E2E Test Project" }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.locator("a:has-text('기획 요약 보기')").first().click();
    
    // 프로젝트 상세 페이지 도달
    await page.waitForURL(/\/contents\/[a-f0-9-]+$/);
    await expect(page.locator("h1:has-text('기획 프로젝트 상세 요약')")).toBeVisible();

    // 5. 'AI 콘텐츠 생성하기' 버튼 클릭 (Step 1. 브리프 단계 전이)
    const generateCTA = page.locator("a:has-text('AI 콘텐츠 생성하기')").first();
    await expect(generateCTA).toBeVisible();
    await generateCTA.click();

    // 브리프 페이지 진입 대기
    await page.waitForURL("**/contents/*/brief");
    await expect(page.locator("span:has-text('STEP 1. 기획 브리프')")).toBeVisible();

    // 6. 브리프 분석 개시
    await page.waitForTimeout(1500);
    const createBriefBtn = page.locator("button:has-text('기획 브리프 분석 생성하기')").first();
    await expect(createBriefBtn).toBeVisible();
    await createBriefBtn.click();

    // 브리프 생성 완료 대기 및 내용 확인
    await expect(page.locator("h3:has-text('1. 브리프 핵심 기획 내용')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("span:has-text('독자 타겟 페르소나')")).toBeVisible();
    await expect(page.locator("p:has-text('30대 직장인 마케터')")).toBeVisible();

    // 7. 브리프 승인하고 개요로 이동
    const approveBriefBtn = page.locator("button:has-text('브리프 승인하고 개요로 이동')").first();
    await expect(approveBriefBtn).toBeVisible();
    await approveBriefBtn.click();

    // 개요 페이지 진입 대기
    await page.waitForURL("**/contents/*/outline");
    await expect(page.locator("span:has-text('STEP 2. 목차 개요')")).toBeVisible();

    // 8. 목차 개요 생성 개시
    await page.waitForTimeout(1500);
    const createOutlineBtn = page.locator("button:has-text('AI 목차 개요 생성하기')").first();
    await expect(createOutlineBtn).toBeVisible();
    await createOutlineBtn.click();

    // 소제목 리스트 로드 대기
    await expect(page.locator("h3:has-text('제목 설정')")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("h3:has-text('상세 단락 목차 리스트')")).toBeVisible();

    // 제목 추천군 클릭하여 제목 교체 모사
    const firstTitleCandidate = page.locator("button:has-text('마케팅 글쓰기 지옥 탈출기')").first();
    await expect(firstTitleCandidate).toBeVisible();
    await firstTitleCandidate.click();

    // 9. 목차 순서 조정 및 수동 항목 삽입 검증
    // 첫 단락 순서 내리기
    const moveDownBtn = page.locator("button:has(svg.lucide-arrow-down)").first();
    await expect(moveDownBtn).toBeVisible();
    await moveDownBtn.click();

    // 개요 최종 승인
    const approveOutlineBtn = page.locator("button:has-text('개요 검토 완료 (최종 승인)')").first();
    await expect(approveOutlineBtn).toBeVisible();
    await approveOutlineBtn.click();

    // 승인 완료 상태 뱃지 확인
    await expect(page.locator("span:has-text('개요 최종 승인 완료')")).toBeVisible();

    // 10. AI 다채널 본문 생성 시작
    await page.waitForTimeout(1500);
    const startBodyBtn = page.locator("button:has-text('AI 다채널 본문 생성 시작')").first();
    await expect(startBodyBtn).toBeEnabled();
    await startBodyBtn.click();

    // 비동기 생성 스크린 진입 대기
    await page.waitForURL("**/contents/*/generating");
    await expect(page.locator("h1:has-text('플랫폼별 콘텐츠 초안 생성 중')")).toBeVisible();

    // 11. 결과 화면 자동 리다이렉트 대기
    await page.waitForURL("**/contents/*/result", { timeout: 35000 });
    await expect(page.locator("h1:has-text('AI 콘텐츠 생성 결과')")).toBeVisible();

    // 12. 다채널 결과 탭 및 메타데이터, 이미지 기획 데이터 렌더링 검증
    const wordpressTab = page.locator("button:has-text('워드프레스')").first();
    const naverBlogTab = page.locator("button:has-text('네이버 블로그')").first();
    await expect(wordpressTab).toBeVisible();
    await expect(naverBlogTab).toBeVisible();

    // 이미지 기획 목록 존재 검증
    await expect(page.locator("h3:has-text('추천 이미지 기획 구성안')")).toBeVisible();

    // 최종 확정 완료 클릭 및 기획 상세로 정상 귀환 확인
    const finishBtn = page.locator("button:has-text('초안 검토 완료 및 종료')").first();
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    await page.waitForURL("**/contents/*");
    await expect(page.locator("h1:has-text('기획 프로젝트 상세 요약')")).toBeVisible();
  });
});
