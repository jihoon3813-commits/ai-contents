import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
]);

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { error: "invalid_parts" };
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e: any) {
    return { error: e.message };
  }
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();
  const allCookies = request.cookies.getAll().map(c => c.name);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "undefined";
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "undefined";
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Auth: ${isAuthenticated}, Cookies: ${allCookies.join(", ")}, URL: ${convexUrl}, SiteURL: ${convexSiteUrl}`);
  
  if (isProtectedRoute(request) && !isAuthenticated) {
    const jwtCookie = request.cookies.get("__Host-__convexAuthJWT") || request.cookies.get("__convexAuthJWT");
    let jwtPayloadStr = "none";
    if (jwtCookie?.value) {
      const payload = decodeJwtPayload(jwtCookie.value);
      jwtPayloadStr = JSON.stringify(payload);
    }
    const response = nextjsMiddlewareRedirect(request, `/login?error=middleware_unauthenticated&cookies=${encodeURIComponent(allCookies.join(","))}&convexUrl=${encodeURIComponent(convexUrl)}&convexSiteUrl=${encodeURIComponent(convexSiteUrl)}&jwtPayload=${encodeURIComponent(jwtPayloadStr)}`);
    
    // 로컬호스트 여부에 맞게 secure 옵션을 설정하여 쿠키 삭제 처리합니다.
    const isLocalhost = request.headers.get("Host")?.includes("localhost") ?? false;
    const deleteOptions = {
      secure: !isLocalhost,
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      expires: new Date(0),
    };
    response.cookies.set("__Host-__convexAuthJWT", "", deleteOptions);
    response.cookies.set("__convexAuthJWT", "", deleteOptions);
    response.cookies.set("__convexAuthRefreshToken", "", deleteOptions);
    response.cookies.set("__Host-__convexAuthRefreshToken", "", deleteOptions);
    return response;
  }
  
  if (isSignInPage(request) && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
