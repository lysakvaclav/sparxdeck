import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY_PATHS, PUBLIC_PATHS, matchesPath } from "@/lib/routes";
import { contentSecurityPolicy, createNonce } from "@/lib/security-headers";
import { supabasePublicEnv } from "@/lib/supabase/public-env";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  // A nonce per request: Next.js reads the policy from the request headers and
  // puts the nonce on its scripts; the page's own inline script reads x-nonce.
  const nonce = createNonce();
  const policy = contentSecurityPolicy({
    nonce,
    supabaseUrl: supabasePublicEnv().url,
    dev: process.env.NODE_ENV === "development",
    https: request.nextUrl.protocol === "https:",
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);

  const { response, user } = await updateSession(request);
  response.headers.set("Content-Security-Policy", policy);
  const { pathname, search } = request.nextUrl;

  if (!user && !matchesPath(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (user && matchesPath(pathname, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

// Keep refreshed auth cookies when redirecting.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static files, images and metadata files.
    // vendor/: the map worker, base map tiles, fonts and sprites (public files,
    // read in byte ranges; a sign-in redirect would break them).
    "/((?!_next/static|_next/image|vendor/|favicon.ico|icon|apple-icon|manifest|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
