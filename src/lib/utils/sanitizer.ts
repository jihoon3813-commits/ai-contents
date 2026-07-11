/**
 * AI가 생성한 HTML 문자열을 정화하여 XSS 공격 요소(script, iframe, inline event handler 등)를 제거합니다.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let clean = html;

  // 1. 악성 태그 자체를 완전 제거 (<script>, <iframe>, <object>, <embed>, <applet>, <meta>, <link>, <style> 등)
  const forbiddenTags = [
    /<!--[\s\S]*?-->/g, // 주석 제거
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe\s*>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object\s*>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed\s*>/gi,
    /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet\s*>/gi,
    /<meta\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style\s*>/gi,
  ];

  forbiddenTags.forEach((regex) => {
    clean = clean.replace(regex, "");
  });

  // 2. 태그 내부의 인라인 이벤트 핸들러 제거 (온로드, 온클릭 등: on[a-zA-Z]+=)
  // 예: <img src="x" onerror="alert(1)"> -> <img src="x">
  // 정규식: \bon[a-zA-Z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)
  const eventHandlerRegex = /\bon[a-zA-Z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi;
  clean = clean.replace(eventHandlerRegex, "");

  // 3. javascript: 가상 프로토콜 차단 (href="javascript:..." or src="javascript:...")
  // 예: <a href="javascript:alert(1)"> -> <a href="#">
  const javascriptProtoRegex = /\b(href|src)\s*=\s*(['"])\s*javascript\s*:[^'"]*(['"])/gi;
  clean = clean.replace(javascriptProtoRegex, '$1=$2#$3');

  const javascriptProtoUnquotedRegex = /\b(href|src)\s*=\s*javascript\s*:[^\s>]+/gi;
  clean = clean.replace(javascriptProtoUnquotedRegex, '$1="#"');

  return clean;
}
