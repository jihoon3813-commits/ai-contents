import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 환경(Server Component, Server Action, Route Handler)에서 사용할 Supabase 클라이언트를 반환합니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 setAll이 호출되면 무시할 수 있도록 예외처리
            // (미들웨어에서 세션 갱신을 주로 처리하므로 무방)
          }
        },
      },
      global: {
        fetch: (url, options) => {
          const fs = require("fs");
          const path = require("path");
          fs.appendFileSync(
            path.join(process.cwd(), "server-debug.log"),
            `[${new Date().toISOString()}] SERVER supabase fetch URL: ${url}\n`
          );
          return fetch(url, {
            ...options,
            cache: "no-store",
          });
        },
      },
    }
  );
}

/**
 * 테스트나 관리자 작업 등 RLS를 우회해야 할 때 백엔드/서버 전용으로 사용할 Supabase Admin 클라이언트를 반환합니다.
 * (클라이언트 사이드 유출 금지, service_role key 사용)
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      global: {
        fetch: (url, options) => {
          const fs = require("fs");
          const path = require("path");
          fs.appendFileSync(
            path.join(process.cwd(), "server-debug.log"),
            `[${new Date().toISOString()}] SERVER supabase admin fetch URL: ${url}\n`
          );
          return fetch(url, {
            ...options,
            cache: "no-store",
          });
        },
      },
    }
  );
}
