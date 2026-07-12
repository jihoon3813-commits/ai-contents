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

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();
  const allCookies = request.cookies.getAll().map(c => c.name);
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "undefined";
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "undefined";
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Auth: ${isAuthenticated}, Cookies: ${allCookies.join(", ")}, URL: ${convexUrl}, SiteURL: ${convexSiteUrl}`);
  
  if (isProtectedRoute(request) && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, `/login?error=middleware_unauthenticated&cookies=${encodeURIComponent(allCookies.join(","))}&convexUrl=${encodeURIComponent(convexUrl)}&convexSiteUrl=${encodeURIComponent(convexSiteUrl)}`);
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
