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
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Auth: ${isAuthenticated}, Cookies: ${allCookies.join(", ")}`);
  
  if (isProtectedRoute(request) && !isAuthenticated) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "undefined";
    return nextjsMiddlewareRedirect(request, `/login?error=middleware_unauthenticated&cookies=${encodeURIComponent(allCookies.join(","))}&convexUrl=${encodeURIComponent(convexUrl)}`);
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
