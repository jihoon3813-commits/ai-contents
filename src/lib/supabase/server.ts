import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const dummyProxy: any = new Proxy(() => {}, {
  get(target, prop) {
    if (prop === "then") {
      return (resolve: any) => resolve({ data: { user: null }, error: null });
    }
    return dummyProxy;
  },
  apply(target, thisArg, argumentsList) {
    return dummyProxy;
  }
});

/**
 * 서버 환경(Server Component, Server Action, Route Handler)에서 사용할 Supabase 클라이언트를 반환합니다.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return dummyProxy;
  }

  const cookieStore = await cookies();

  return createServerClient(
    url,
    anonKey,
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
          try {
            const fs = require("fs");
            const path = require("path");
            fs.appendFileSync(
              path.join(process.cwd(), "server-debug.log"),
              `[${new Date().toISOString()}] SERVER supabase fetch URL: ${url}\n`
            );
          } catch (err) {
            // Vercel 등 read-only 환경에서 파일 쓰기 에러 무시
          }
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return dummyProxy;
  }

  return createServerClient(
    url,
    serviceRoleKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
      global: {
        fetch: (url, options) => {
          try {
            const fs = require("fs");
            const path = require("path");
            fs.appendFileSync(
              path.join(process.cwd(), "server-debug.log"),
              `[${new Date().toISOString()}] SERVER supabase admin fetch URL: ${url}\n`
            );
          } catch (err) {
            // Vercel 등 read-only 환경에서 파일 쓰기 에러 무시
          }
          return fetch(url, {
            ...options,
            cache: "no-store",
          });
        },
      },
    }
  );
}
