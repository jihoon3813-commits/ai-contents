import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // 보호 대상인 라우트 정의 (/dashboard 및 /settings 하위 페이지들)
  const isProtectedRoute =
    path.startsWith("/dashboard") || path.startsWith("/settings");

  // 인증 관련 페이지 정의 (/login, /signup, /forgot-password, /reset-password)
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password");

  // 1. 비로그인 사용자가 보호 대상 페이지에 접근하려고 할 때 -> 로그인 페이지로 리다이렉트
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    // 원래 접근하려던 페이지 경로를 next 쿼리 파라미터로 넘겨줌
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // 2. 로그인된 사용자가 로그인/회원가입 등 인증 페이지에 접근하려고 할 때 -> 대시보드로 리다이렉트
  if (isAuthRoute && user) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

// 미들웨어가 실행될 경로 필터링 설정
export const config = {
  matcher: [
    /*
     * 아래 경로들을 제외한 모든 요청에서 미들웨어를 실행합니다:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘 파일)
     * - 이미지 파일 등 (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
