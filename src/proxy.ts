import { auth } from "@server";
import { NextResponse } from "next/server";

// Optimistic routing on the session cookie: anyone without a connected sheet → /connect, the only public page.
// Server actions that touch Google re-check the session themselves.

const CONNECT = "/connect";

export default auth((req) => {
  const connected = Boolean(req.auth?.sheet);
  const onConnect = req.nextUrl.pathname === CONNECT;
  if (connected === !onConnect) return NextResponse.next();
  return NextResponse.redirect(new URL(connected ? "/" : CONNECT, req.url));
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
