import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // 1. Supabase Auth 세션 갱신만 전담 수행
  // (미들웨어와 서버 컴포넌트 간 세션 동기화 지연으로 인한 무한 리다이렉션을 방지하기 위해 
  // 리다이렉트 결정은 각 Layout 및 Page 레이어로 위임합니다.)
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

// 프록시 필터링 설정
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
