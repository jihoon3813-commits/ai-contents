import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth의 이메일 인증 메일 링크 및 OAuth 로그인 시 리다이렉트되어 들어오는 콜백 API 라우트입니다.
 * URL의 code를 세션과 교환하고 목적지(예: 대시보드)로 유저를 리다이렉트합니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 인증 후 이동할 타겟 경로 (기본값: 대시보드)
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 프록시 환경(예: Vercel) 고려하여 호스트 포워딩 처리
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // 인증 실패 시 로그인 페이지로 에러 코드와 함께 복귀
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
