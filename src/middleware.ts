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
    return nextjsMiddlewareRedirect(request, `/login?error=middleware_unauthenticated&cookies=${encodeURIComponent(allCookies.join(","))}&convexUrl=${encodeURIComponent(convexUrl)}&convexSiteUrl=${encodeURIComponent(convexSiteUrl)}&jwtPayload=${encodeURIComponent(jwtPayloadStr)}`);
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
