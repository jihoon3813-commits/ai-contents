import { createBrowserClient } from "@supabase/ssr";

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
