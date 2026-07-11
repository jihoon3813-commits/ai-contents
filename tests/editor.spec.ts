import { test, expect } from "@playwright/test";

test.describe("E2E 콘텐츠 에디터 및 버전 관리 통합 시나리오 테스트", () => {
  // 로그인 공통 헬퍼
  const login = async (page: any) => {
    await page.goto("/login");
    await page.fill("#email", "test@example.com");
    await page.fill("#password", "password123");
    await page.click("button[type='submit']");
    await page.waitForURL("**/dashboard");
  };

  test("원고 상세 에디터 진입 -> 제목/본문 수정 및 자동 저장 -> AI 문단 재작성 -> 섹션 잠금 -> 수동 버전 생성 -> 버전 비교 -> 버전 복원 -> 모바일 미리보기 검증", async ({ page }) => {
    test.setTimeout(180000); // 전체 빌드와 기획 단계를 거쳐야 하므로 180초 여유 할당

    // 브라우저 렉/오류 로깅
    page.on("pageerror", (err: any) => {
      console.error(">>> BROWSER PAGE ERROR:", err.message);
    });

    // 1. 로그인
    await login(page);

    // 2. 콘텐츠 기획 메뉴 이동 및 새 기획 작성 개시
    await page.locator("a:has-text('콘텐츠 기획')").first().click();
    await page.waitForURL("**/contents");

    await page.locator("a:has-text('새 기획 프로젝트 작성')").first().click();
    await page.waitForURL("**/contents/*/setup");

    // === STEP 1: 기본 기획 설정 ===
    await page.click("label:has-text('WordPress')");
    await page.click("label:has-text('네이버 블로그')");
    await page.fill("input[placeholder='예: IT 가이드']", "AI 에디터 E2E");
    await page.selectOption("select[name='content_type']", "INFORMATIONAL");
    await page.fill("input[placeholder='예: 30대 재테크에 관심 많은 직장인']", "콘텐츠 크리에이터");
    await page.fill("input[placeholder*='예: 문제 인지 단계']", "도구 모색 단계");
    await page.click("button:has-text('다음 단계로')");

    // === STEP 2: 주제와 키워드 ===
    await page.fill("input[placeholder*='예: 갤럭시 버즈 프로']", "AI 라이팅");
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

    // 3. 리스트에서 생성한 프로젝트 클릭 진입
    const projectCard = page.locator("div.relative").filter({ hasText: "AI 에디터 E2E" }).first();
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

    // 7. 새로 추가된 '상세 본문 직접 편집하기' 링크 클릭
    const editLink = page.locator("a:has-text('상세 본문 직접 편집하기')").first();
    await expect(editLink).toBeVisible();
    await editLink.click();

    // 에디터 페이지 진입 대기
    await page.waitForURL("**/contents/*/platform/*/edit");
    await expect(page.locator("span:has-text('에디터')")).toBeVisible();

    // 8. 제목 수정 조작
    const titleInput = page.locator("input[placeholder*='원고 제목']");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("마케팅 글쓰기 지옥 탈출기: 수정본 제목");

    // 9. Tiptap 에디터 본문 수정 입력
    const tiptapEditor = page.locator("div.ProseMirror");
    await expect(tiptapEditor).toBeVisible();
    await tiptapEditor.focus();
    // 기존 텍스트 뒤에 새 텍스트 타이핑 추가 모사
    await page.keyboard.type(" E2E 테스트 자동 저장 추가 검증 문구입니다.");

    // 10. 3초 대기 후 자동 저장 완료 확인 ("완료" 텍스트 배지 등장 여부 체크)
    await page.waitForTimeout(3500); // 3초 디바운싱 대기
    await expect(page.locator("span:has-text('완료')").first()).toBeVisible({ timeout: 5000 });

    // 11. AI 문단 재작성 기동
    const sparksBtn = page.locator("button:has(svg.lucide-sparkles)").first();
    await expect(sparksBtn).toBeVisible();
    await sparksBtn.click();

    const rewriteOption = page.locator("button:has-text('더 길게 보강')").first();
    await expect(rewriteOption).toBeVisible();
    await rewriteOption.click();
    
    // AI 문단 재작성 후 갱신 성공 토스트 대기
    await expect(page.locator("text=섹션 재작성에 성공했습니다")).toBeVisible({ timeout: 15000 });

    // 12. 섹션 잠금 설정
    const lockBtn = page.locator("button[title='문단 잠금 설정']").first();
    await expect(lockBtn).toBeVisible();
    await lockBtn.click();
    // 잠금 상태로 자물쇠가 변경되었는지 확인
    await expect(page.locator("button[title='AI 재생성 제외 잠금 상태']").first()).toBeVisible();

    // 13. 버전 백업 생성
    await page.click("button:has-text('버전')");
    const summaryInput = page.locator("input[placeholder*='팩트 검증']").first();
    await expect(summaryInput).toBeVisible();
    await summaryInput.fill("E2E 수동 백업본");
    await page.click("button:has-text('수동 백업 저장하기')");

    // 버전 리스트에 스냅샷 등장 대기
    await expect(page.locator("text=E2E 수동 백업본")).toBeVisible({ timeout: 5000 });

    // 14. 버전 비교
    // 최근 2개 체크박스 선택하여 비교
    const compareCheckboxes = page.locator("input[type='checkbox']");
    await expect(compareCheckboxes.nth(0)).toBeVisible();
    await compareCheckboxes.nth(0).check();
    await compareCheckboxes.nth(1).check();

    const compareBtn = page.locator("button:has-text('선택 버전 비교하기')");
    await expect(compareBtn).toBeVisible();
    await compareBtn.click();

    // 비교 Diff 모달 확인
    await expect(page.locator("h3:has-text('차이 비교')")).toBeVisible();
    await page.click("button:has-text('닫기')");

    // 15. 이전 버전 복원
    // dialog confirm() 승인 리스너 등록
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("복원하시겠습니까?");
      dialog.accept();
    });

    const restoreBtn = page.locator("button:has-text('이 스냅샷으로 복원')").first();
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // 복원 성공 토스트 확인
    await expect(page.locator("text=복원에 성공했습니다")).toBeVisible({ timeout: 5000 });

    // 16. 플랫폼 미리보기 탭 이동
    await page.click("button:has-text('미리보기')");
    await expect(page.locator("text=실시간 플랫폼 미리보기")).toBeVisible();
  });
});
