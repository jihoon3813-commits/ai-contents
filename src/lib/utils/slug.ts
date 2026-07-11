/**
 * 한글, 영문, 숫자를 지원하는 워크스페이스용 URL 친화적인 slug를 생성합니다.
 * @param name 워크스페이스 또는 사용자 이름
 * @returns slug 문자열
 */
export function generateSlug(name: string): string {
  if (!name) return "workspace";

  let slug = name.toLowerCase();

  // 1. 영어, 숫자, 한글(가-힣)을 제외한 모든 특수문자 및 공백을 하이픈(-)으로 변경
  slug = slug.replace(/[^a-z0-9가-힣]+/g, "-");

  // 2. 여러 개 연속된 하이픈을 하나로 합침
  slug = slug.replace(/-+/g, "-");

  // 3. 앞뒤에 위치한 하이픈 제거
  slug = slug.replace(/^-+|-+$/g, "");

  // 4. 결과가 비어있는 경우 기본값 반환
  return slug || "workspace";
}
