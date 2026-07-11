import { describe, it, expect } from "vitest";
import { htmlToTxt, htmlToMarkdown, jsonToCsv } from "./export-converters";
import {
  getRealMimeType,
  validateFileSecurity,
  stripMetadata,
} from "./image-sanitizer";

describe("Export Converters (HTML -> TXT / MD / CSV)", () => {
  it("htmlToTxt should strip tags and replace images with placeholders", () => {
    const html = `
      <h1>블로그 제목</h1>
      <p>본문 첫 번째 단락입니다.</p>
      <img src="test.jpg" alt="고양이 이미지" />
      <p>본문 두 번째 단락입니다.</p>
    `;
    const txt = htmlToTxt(html);
    expect(txt).toContain("블로그 제목");
    expect(txt).toContain("본문 첫 번째 단락입니다.");
    expect(txt).toContain("[이미지: 고양이 이미지]");
    expect(txt).not.toContain("<p>");
    expect(txt).not.toContain("<img>");
  });

  it("htmlToMarkdown should translate headings, style decorators and links", () => {
    const html = `
      <h2>소제목 2단계</h2>
      <p>이것은 <strong>중요한</strong> 메시지이며 <em>기울임</em> 텍스트와 <a href="https://example.com">링크</a>를 포함합니다.</p>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain("## 소제목 2단계");
    expect(md).toContain("**중요한**");
    expect(md).toContain("*기울임*");
    expect(md).toContain("[링크](https://example.com)");
  });

  it("htmlToMarkdown should restore HTML tables into markdown table layout", () => {
    const html = `
      <table>
        <tr>
          <th>이름</th>
          <th>나이</th>
        </tr>
        <tr>
          <td>홍길동</td>
          <td>25</td>
        </tr>
        <tr>
          <td>임꺽정</td>
          <td>30</td>
        </tr>
      </table>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain("| 이름 | 나이 |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| 홍길동 | 25 |");
    expect(md).toContain("| 임꺽정 | 30 |");
  });

  it("jsonToCsv should generate valid double-quoted CSV data", () => {
    const data = [
      { id: 1, name: "홍길동", text: '안녕 "친구"' },
      { id: 2, name: "임꺽정", text: "테스트, 콤마 포함" },
    ];
    const csv = jsonToCsv(data);
    expect(csv).toContain('"id","name","text"');
    expect(csv).toContain('"1","홍길동","안녕 ""친구"""');
    expect(csv).toContain('"2","임꺽정","테스트, 콤마 포함"');
  });
});

describe("Image Sanitizer & Security Verification", () => {
  it("getRealMimeType should identify correct image mime types", () => {
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const invalidHeader = Buffer.alloc(12);

    expect(getRealMimeType(jpegHeader)).toBe("image/jpeg");
    expect(getRealMimeType(pngHeader)).toBe("image/png");
    expect(getRealMimeType(webpHeader)).toBe("image/webp");
    expect(getRealMimeType(invalidHeader)).toBeNull();
  });

  it("validateFileSecurity should block SVG and MZ executables", () => {
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03]); // MZ
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);

    expect(validateFileSecurity(jpegBuffer, "image.jpg").allowed).toBe(true);
    expect(validateFileSecurity(jpegBuffer, "image.svg").allowed).toBe(false);
    expect(validateFileSecurity(exeBuffer, "launcher.exe").allowed).toBe(false);
  });

  it("stripMetadata should strip APP1 EXIF segment from JPEG buffer", () => {
    // SOI(FFD8) + APP1(FFE1, len 10=000A) + APP0(FFE0, len 6=0006) + SOS(FFDA) + EOI(FFD9)
    const mockJpeg = Buffer.concat([
      Buffer.from([0xFF, 0xD8]), // SOI
      Buffer.from([0xFF, 0xE1, 0x00, 0x0A, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]), // APP1 (10 bytes length)
      Buffer.from([0xFF, 0xE0, 0x00, 0x06, 0xAA, 0xBB, 0xCC, 0xDD]), // APP0 (6 bytes length)
      Buffer.from([0xFF, 0xDA]), // SOS
      Buffer.from([0x99, 0x88, 0x77]), // Scan data
      Buffer.from([0xFF, 0xD9]), // EOI
    ]);

    const sanitized = stripMetadata(mockJpeg);
    
    // APP1 마커인 FFE1 이 파일 내에 존재해서는 안됨
    expect(sanitized.includes(Buffer.from([0xFF, 0xE1]))).toBe(false);
    // SOI(FFD8), APP0(FFE0), SOS(FFDA), EOI(FFD9)는 살아남아야 함
    expect(sanitized.includes(Buffer.from([0xFF, 0xD8]))).toBe(true);
    expect(sanitized.includes(Buffer.from([0xFF, 0xE0]))).toBe(true);
    expect(sanitized.includes(Buffer.from([0xFF, 0xDA]))).toBe(true);
    expect(sanitized.includes(Buffer.from([0xFF, 0xD9]))).toBe(true);
  });
});
