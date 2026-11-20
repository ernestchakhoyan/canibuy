import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
// Deep imports, not the `@i18n` / `@server` barrels: those pull in next-intl's server config (reads
// `next/root-params`, which doesn't exist in middleware) and the app-icon renderer (`next/og`, wasm + fonts).
import { routing } from "./i18n/routing";
import { auth } from "./server/auth";

// Optimistic routing on the session cookie: anyone without a connected sheet → /connect, the only public page.
// Server actions that touch Google re-check the session themselves. Then next-intl rewrites the request to the
// hidden /[locale] segment, picked from the NEXT_LOCALE cookie.

const CONNECT = "/connect";
const handleI18n = createMiddleware(routing);
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

export default auth((req) => {
  const connected = Boolean(req.auth?.sheet);
  const onConnect = req.nextUrl.pathname.replace(LOCALE_PREFIX, "") === CONNECT;
  if (connected !== !onConnect) return NextResponse.redirect(new URL(connected ? "/" : CONNECT, req.url));
  return handleI18n(req);
});

export const config = {
  // Every path but Next's internals and the files the app serves (public/icons, the app icons, the manifest; the
  // Apple icon has no extension and must load before sign-in). Unknown paths like a stale service worker's
  // /notifications-sw.js must come through here too: next-intl gives them a real locale, so they 404 normally
  // instead of reaching /[locale] with "notifications-sw.js" as the locale (an error in the root layout).
  // ponytail: new files in public/ need their path added here.
  matcher: ["/((?!api|_next|_vercel|icons/|apple-icon|icon\\.svg|icon-\\d+\\.png|manifest\\.webmanifest).*)"],
};
