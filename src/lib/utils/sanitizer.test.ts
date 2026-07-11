import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitizer";

describe("HTML Sanitizer Unit Tests", () => {
  it("should strip out script tags entirely", () => {
    const input = '<div>안전한 본문 <script>alert("xss");</script> 내용</div>';
    const expected = "<div>안전한 본문  내용</div>";
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it("should strip out iframe tags entirely", () => {
    const input = '<div>원고 내용 <iframe src="http://evil.com"></iframe> 마감</div>';
    const expected = "<div>원고 내용  마감</div>";
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it("should remove inline event handlers from tags", () => {
    const input = '<img src="thumbnail.jpg" onload="hack()" onerror="console.log(1)">';
    const expected = '<img src="thumbnail.jpg"  >';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it("should block javascript pseudo-protocol links", () => {
    const input = '<a href="javascript:alert(1)">자세히 보기</a>';
    const expected = '<a href="#">자세히 보기</a>';
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it("should preserve harmless HTML tags like paragraphs and bold marks", () => {
    const input = "<p>이것은 <strong>안전한</strong> 본문 문단입니다.</p><ul><li>항목 1</li></ul>";
    expect(sanitizeHtml(input)).toBe(input);
  });
});
