import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저 환경(클라이언트 컴포넌트)에서 사용할 Supabase 클라이언트를 반환합니다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
