import { createBrowserClient } from "@supabase/ssr";

const dummyProxy: any = new Proxy(() => {}, {
  get(target, prop) {
    if (prop === "auth") {
      return {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      };
    }
    if (prop === "then") {
      return undefined;
    }
    return dummyProxy;
  },
  apply(target, thisArg, argumentsList) {
    return new Proxy(() => {}, {
      get(t, p) {
        if (p === "then") {
          return (resolve: any) => resolve({ data: [], error: null });
        }
        return dummyProxy;
      },
      apply(t, ta, al) {
        return dummyProxy;
      }
    });
  }
});

/**
 * 브라우저 환경(클라이언트 컴포넌트)에서 사용할 Supabase 클라이언트를 반환합니다.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return dummyProxy;
  }
  return createBrowserClient(url, anonKey);
}
