import { describe, it, expect } from "vitest";
import { analyzeText } from "./analyzer";

describe("analyzeText (Mock 문체 분석기)", () => {
  it("비어있는 텍스트는 빈 결과 구조를 반환하고, 존댓말 비율은 중립(50)이어야 함", () => {
    const result = analyzeText("");
    expect(result.char_count).toBe(0);
    expect(result.honorific_ratio).toBe(50);
  });

  it("존댓말 문체 분석이 올바르게 100%에 가깝게 나와야 함", () => {
    const text = "안녕하세요. AI 콘텐츠 봇 팀입니다. 우리는 혁신적인 마케팅 솔루션을 제공합니다. 지금 무료로 체험해 보세요!";
    const result = analyzeText(text);

    expect(result.char_count).toBeGreaterThan(50);
    expect(result.honorific_ratio).toBeGreaterThan(80); // 입니다, 합니다, 보세요 -> 존댓말 비율 높음
    expect(result.exclamation_count).toBe(1); // ! 1개
    expect(result.emoji_count).toBe(0);
  });

  it("반말 및 종결 어미 분석이 올바르게 0%에 가깝게 나와야 함", () => {
    const text = "나는 오늘 코딩을 한다. 날씨가 아주 좋다. 이제 밥 먹으러 간다. 같이 갈래?";
    const result = analyzeText(text);

    expect(result.honorific_ratio).toBeLessThan(20); // 한다, 좋다, 간다 -> 반말 비율 높음
    expect(result.question_ratio).toBeGreaterThan(0); // ? 있음
  });

  it("이모지와 기호 및 접속사가 올바르게 검출되어야 함", () => {
    const text = "와! 느낌표가 많군요!! 🚀 그리고 이모지도 들어있습니다. 😊 하지만 괜찮아요.";
    const result = analyzeText(text);

    expect(result.exclamation_count).toBe(3); // !, !! -> 3개
    expect(result.emoji_count).toBe(2); // 🚀, 😊 -> 2개
    expect(result.conjunction_counts["그리고"]).toBe(1);
    expect(result.conjunction_counts["하지만"]).toBe(1);
  });

  it("자주 사용하는 문장 종결 어미가 올바르게 추출되어야 함", () => {
    const text = "밥을 먹습니다. 잠을 잡니다. 걷기도 합니다.";
    const result = analyzeText(text);

    expect(result.common_endings.some((e) => e.endsWith("니다"))).toBe(true);
  });
});
