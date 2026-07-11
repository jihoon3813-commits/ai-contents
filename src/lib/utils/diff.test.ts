import { describe, it, expect } from "vitest";
import { diffWords, renderDiffHtml } from "./diff";

describe("Word LCS Diffing Unit Tests", () => {
  it("should detect added words correctly", () => {
    const oldStr = "안녕하세요 오늘 마케팅 글을 씁니다";
    const newStr = "안녕하세요 오늘 마케팅 AI 글을 씁니다";
    const diff = diffWords(oldStr, newStr);

    const addedPart = diff.find((d) => d.added);
    expect(addedPart).toBeDefined();
    expect(addedPart?.value).toContain("AI");
  });

  it("should detect removed words correctly", () => {
    const oldStr = "안전하고 신속한 AI 마케팅 자동화";
    const newStr = "안전하고 AI 마케팅 자동화";
    const diff = diffWords(oldStr, newStr);

    const removedPart = diff.find((d) => d.removed);
    expect(removedPart).toBeDefined();
    expect(removedPart?.value).toContain("신속한");
  });

  it("should merge contiguous added/removed words for cleaner rendering", () => {
    const oldStr = "기존 버전의 본문 내용";
    const newStr = "기존 버전의 신규 추가 내용 수정";
    const html = renderDiffHtml(oldStr, newStr);

    // ins 및 del 태그 가독성 점검
    expect(html).toContain("<ins class=");
    expect(html).toContain("신규 추가");
    expect(html).toContain("<del class=");
    expect(html).toContain("본문");
  });

  it("should handle empty or identical inputs gracefully", () => {
    const str = "동일한 텍스트 데이터";
    const html = renderDiffHtml(str, str);
    expect(html).toBe(str);

    const emptyHtml = renderDiffHtml("", "");
    expect(emptyHtml).toBe("");
  });
});
