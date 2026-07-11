/**
 * HTML 및 JSON 데이터를 일반 텍스트, 마크다운, CSV 등으로 변환해 주는 내보내기 변환 유틸리티
 */

/**
 * HTML 코드를 일반 텍스트(TXT)로 정제합니다.
 * 이미지 태그는 `[이미지: alt_text]` 형태의 플레이스홀더로 치환하며,
 * 주요 줄바꿈과 HTML 엔티티를 정규 형태로 복구합니다.
 */
export function htmlToTxt(html: string): string {
  if (!html) return "";

  let txt = html;

  // HTML Entity 복구
  txt = txt
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // 이미지 태그 변환
  txt = txt.replace(/<img[^>]+alt="([^"]*)"[^>]*>/gi, " [이미지: $1] ");
  txt = txt.replace(/<img[^>]*>/gi, " [이미지] ");

  // 줄바꿈 매핑
  txt = txt.replace(/<h[1-6][^>]*>/gi, "\n\n");
  txt = txt.replace(/<\/h[1-6]>/gi, "\n");
  txt = txt.replace(/<\/p>/gi, "\n\n");
  txt = txt.replace(/<li[^>]*>/gi, "\n- ");
  txt = txt.replace(/<tr[^>]*>/gi, "\n");
  txt = txt.replace(/<(td|th)[^>]*>/gi, "\t");

  // 기타 HTML 태그 전부 탈락
  txt = txt.replace(/<[^>]*>/g, "");

  // 연속된 여러 줄바꿈 정리
  txt = txt.replace(/\n{3,}/g, "\n\n").trim();

  return txt;
}

/**
 * Tiptap HTML을 표준 Markdown(MD)으로 완벽하게 파싱 변환합니다.
 * H1~H6, Bold, Italic, Link, List 및 Table(표 구조 복원)을 완벽히 이식합니다.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let md = html;

  // HTML Entity 복구
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  // 1. Table(표) 태그 복원 (상대적으로 외부 태그이므로 선차적 파싱)
  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableBody) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        // 셀 안의 HTML 태그를 날리고 텍스트만 획득
        const cellText = cellMatch[2].replace(/<[^>]*>/g, "").trim();
        cells.push(cellText);
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return "";

    let tableMd = "";
    // 헤더 출력
    const headers = rows[0];
    tableMd += "| " + headers.join(" | ") + " |\n";
    tableMd += "| " + headers.map(() => "---").join(" | ") + " |\n";

    // 데이터 셀 출력
    for (let i = 1; i < rows.length; i++) {
      tableMd += "| " + rows[i].join(" | ") + " |\n";
    }

    return "\n" + tableMd + "\n";
  });

  // 2. 헤더 태그 변환
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // 3. 서식 장식 변환
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // 4. 하이퍼링크 변환
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // 5. 이미지 태그를 마크다운 이미지 자리표시자 포맷으로 변환
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]*>/gi, "\n![이미지 자리표시자: $1](image_placeholder)\n");
  md = md.replace(/<img[^>]*>/gi, "\n![이미지 자리표시자](image_placeholder)\n");

  // 6. 리스트 태그 변환
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "\n$1\n");
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, "\n$1\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

  // 7. 문단 및 개행 변환
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // 8. 잔여 HTML 태그 소거
  md = md.replace(/<[^>]*>/g, "");

  // 다중 개행 압축 정돈
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return md;
}

/**
 * 키-밸류 오브젝트 배열 데이터를 표준 CSV 문자열로 변환합니다.
 * 더블 쿼터 및 내부 쉼표를 완벽히 이스케이핑 처리합니다.
 */
export function jsonToCsv(data: Array<Record<string, any>>): string {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // 헤더 로우
  csvRows.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

  // 데이터 로우
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      const strVal = val === null || val === undefined ? "" : String(val);
      return `"${strVal.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
