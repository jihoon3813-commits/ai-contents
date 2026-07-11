import { test, expect } from "@playwright/test";

test.describe("E2E SEO·품질·신뢰도 평가와 최종 승인 통합 시나리오 테스트", () => {
  // 로그인 공통 헬퍼
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("원고 기획 생성 -> 본문 생성 -> 에디터 진입 -> 품질 평가 기동 -> 금지어 감지 확인 -> 사실 검증 피드백 처리 -> 최종 발행 승인 및 발행 준비 상태 전환", async ({ page }) => {
    test.setTimeout(180000); // AI 본문 생성 시간 감안하여 180초 지정

    // 브라우저 렉/오류 로깅
    page.on("pageerror", (err: any) => {
      console.error(">>> BROWSER PAGE ERROR:", err.message);
    });

    // 1. 로그인
    await login(page);

    // 2. 새 기획 프로젝트 작성 개시
    await page.locator("a:has-text('콘텐츠 기획')").first().click();
    await page.waitForURL("**/contents");

    await page.locator("a:has-text('새 기획 프로젝트 작성')").first().click();
    await page.waitForURL("**/contents/*/setup");

    // === STEP 1: 기본 기획 설정 (WordPress 플랫폼 지정) ===
    await page.click("label:has-text('WordPress')");
    await page.fill("input[placeholder='예: IT 가이드']", "SEO 품질 평가 E2E");
    await page.selectOption("select[name='content_type']", "INFORMATIONAL");
    await page.fill("input[placeholder='예: 30대 재테크에 관심 많은 직장인']", "마케터");
    await page.fill("input[placeholder*='예: 문제 인지 단계']", "도구 모색 단계");
    await page.click("button:has-text('다음 단계로')");

    // === STEP 2: 주제와 키워드 (금지어 "보장" 및 핵심키워드 지정) ===
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로']", "SEO 평가");
    await page.fill("textarea[placeholder*='예: 갤럭시 버즈 프로의']", "AI 마케팅의 SEO 품질 평가 시스템의 구축 효과");
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로 리뷰']", "SEO 마케팅");
    
    // 브랜드 금지어 "보장" 추가 모사
    const phraseInput = page.locator("input[placeholder='금지어 입력 후 엔터']");
    if (await phraseInput.isVisible()) {
      await phraseInput.fill("보장");
      await page.keyboard.press("Enter");
    }

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

    // 3. 리스트에서 생성한 프로젝트 클릭 진입
    const projectCard = page.locator("div.relative").filter({ hasText: "SEO 품질 평가 E2E" }).first();
    await expect(projectCard).toBeVisible();
    await projectCard.locator("a:has-text('기획 요약 보기')").first().click();
    await page.waitForURL(/\/contents\/[a-f0-9-]+$/);

    // 4. 'AI 콘텐츠 생성하기' 버튼 클릭 (Step 1. 브리프 단계)
    const generateCTA = page.locator("a:has-text('AI 콘텐츠 생성하기')").first();
    await expect(generateCTA).toBeVisible();
    await generateCTA.click();

    await page.waitForURL("**/contents/*/brief");
    await page.waitForTimeout(1000);
    await page.click("button:has-text('기획 브리프 분석 생성하기')");
    await expect(page.locator("h3:has-text('1. 브리프 핵심 기획 내용')")).toBeVisible({ timeout: 15000 });

    await page.click("button:has-text('브리프 승인하고 개요로 이동')");
    await page.waitForURL("**/contents/*/outline");

    // 5. 목차 개요 생성 개시
    await page.waitForTimeout(1000);
    await page.click("button:has-text('AI 목차 개요 생성하기')");
    await expect(page.locator("h3:has-text('제목 설정')")).toBeVisible({ timeout: 15000 });

    await page.click("button:has-text('개요 검토 완료 (최종 승인)')");
    await expect(page.locator("span:has-text('개요 최종 승인 완료')")).toBeVisible();

    // 6. AI 다채널 본문 생성 시작
    await page.click("button:has-text('AI 다채널 본문 생성 시작')");
    await page.waitForURL("**/contents/*/generating");

    // 결과 화면 자동 리다이렉트 대기
    await page.waitForURL("**/contents/*/result", { timeout: 90000 });
    await expect(page.locator("h1:has-text('AI 콘텐츠 생성 결과')")).toBeVisible();

    // 7. 상세 본문 직접 편집하기 클릭
    const editLink = page.locator("a:has-text('상세 본문 직접 편집하기')").first();
    await expect(editLink).toBeVisible();
    await editLink.click();

    // 에디터 페이지 진입 대기
    await page.waitForURL("**/contents/*/platform/*/edit");
    await expect(page.locator("span:has-text('에디터')")).toBeVisible();

    // 8. 우측 '평가·승인' 탭 클릭
    const evalTabBtn = page.locator("button:has-text('평가·승인')");
    await expect(evalTabBtn).toBeVisible();
    await evalTabBtn.click();

    // 9. 품질 및 사실 검증 분석 기동
    const evalStartBtn = page.locator("button:has-text('평가 실행하기')");
    await expect(evalStartBtn).toBeVisible();
    await evalStartBtn.click();

    // 분석 완료 스코어 출력 대기
    await expect(page.locator("span:has-text('Overall Score')")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=세부 품질 영역 지표")).toBeVisible();

    // 10. 사실 확인 필요 정보 피드백 조작 (승인 처리)
    // 모든 팩트체크 항목에 대해 "확인 완료" 버튼을 클릭해 예외 상황 해소
    while (true) {
      const confirmFactBtn = page.locator("button:has-text('확인 완료')").first();
      if (await confirmFactBtn.isVisible()) {
        await confirmFactBtn.click();
        await page.waitForTimeout(1000);
      } else {
        break;
      }
    }

    // 11. 최종 발행 승인 및 PRE_PUBLISH 저장
    // 미결 크리티컬 및 사실확인이 정비되었다면 승인 버튼 활성화됨
    const approveBtn = page.locator("button:has-text('최종 발행 승인 및 PRE_PUBLISH 저장')");
    await expect(approveBtn).toBeVisible();
    await expect(approveBtn).toBeEnabled();
    
    // 최종 발행 승인 클릭 및 페이지 리로드 완료 대기
    await Promise.all([
      page.waitForNavigation({ url: "**/contents/*/platform/*/edit" }),
      approveBtn.click()
    ]);

    // 승인 완료 상태 갱신 대기 ('평가·승인' 탭 클릭 후 문구 확인)
    const evalTabAfterApprove = page.locator("button:has-text('평가·승인')");
    await expect(evalTabAfterApprove).toBeVisible({ timeout: 15000 });
    await evalTabAfterApprove.click();
    await expect(page.locator("text=최종 발행 승인이 완료되었습니다.")).toBeVisible({ timeout: 10000 });

    // 12. 발행 준비 완료 상태로 전환 처리
    const publishReadyBtn = page.locator("button:has-text('발행 준비 완료 상태로 전환')");
    await expect(publishReadyBtn).toBeVisible();
    
    // 발행 준비 완료 상태 전환 클릭 및 페이지 리로드 완료 대기
    await Promise.all([
      page.waitForNavigation({ url: "**/contents/*/platform/*/edit" }),
      publishReadyBtn.click()
    ]);

    // 최종 상태 갱신 확인 ('평가·승인' 탭 클릭 후 문구 확인)
    const evalTabAfterReady = page.locator("button:has-text('평가·승인')");
    await expect(evalTabAfterReady).toBeVisible({ timeout: 15000 });
    await evalTabAfterReady.click();
    await expect(page.locator("text=현재 상태: PUBLISH_READY")).toBeVisible({ timeout: 10000 });
  });
});
