import "server-only";
import { headers } from "next/headers";
import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { DRIVE_FILE_SCOPE, findOrCreateSpreadsheet, refreshAccessToken, spreadsheetUrl } from "./google";

// ponytail: no database. The Google tokens and spreadsheet ID live in Auth.js's encrypted (JWE), httpOnly session
// cookie; a new device finds the sheet again through its Drive appProperties tag. Add the PRD's server table
// (section 8) if we need server-side jobs or account deletion that outlives the cookie.

declare module "next-auth" {
  interface Session {
    /** The connected sheet; absent until the user grants drive.file (SHEET-1) or after access is lost (SHEET-7). */
    sheet?: { id: string; url: string };
    /** Why there is no sheet, shown on /connect. */
    connectError?: { kind: ConnectError; detail?: string };
  }
}

export type ConnectError = "NoDriveAccess" | "SheetFailed" | "RefreshFailed";

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // seconds since epoch
    spreadsheetId?: string;
    error?: ConnectError;
    errorDetail?: string;
  }
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Default scope for Auth.js-initiated sign-ins; the connect action asks for drive.file in the same consent.
  providers: [Google({ authorization: { params: { scope: "openid email profile" } } })],
  // AUTH-2: rolling 30-day session, refreshed at most daily while the user is active.
  session: { strategy: "jwt", maxAge: THIRTY_DAYS, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/connect", error: "/connect" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // A fresh Google grant. Google's consent screen lets the user untick Drive access; then there is no sheet.
        token.errorDetail = undefined;
        if (!account.scope?.includes(DRIVE_FILE_SCOPE) || !account.access_token || !account.refresh_token) {
          token.error = "NoDriveAccess";
          token.errorDetail = `Granted: ${account.scope ?? "nothing"}${account.refresh_token ? "" : " (no refresh token)"}`;
          return token;
        }
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.error = undefined;
        try {
          token.spreadsheetId = await findOrCreateSpreadsheet(account.access_token);
        } catch (error) {
          console.error(error);
          token.error = "SheetFailed";
          token.errorDetail = String(error).slice(0, 400); // Google's message, e.g. an API not enabled
        }
        return token;
      }

      if (!token.refreshToken || (token.expiresAt && Date.now() < (token.expiresAt - 60) * 1000)) return token;
      try {
        const refreshed = await refreshAccessToken(token.refreshToken);
        return { ...token, ...refreshed, error: undefined };
      } catch (error) {
        // Access revoked or expired: the user reconnects (SHEET-7). Keep the sheet ID to reuse it.
        console.error(error);
        return { ...token, accessToken: undefined, refreshToken: undefined, error: "RefreshFailed" as const };
      }
    },
    // Only what the UI needs. Tokens stay in the encrypted cookie and are read on the server with `googleToken()`.
    session({ session, token }) {
      if (token.spreadsheetId && token.refreshToken && !token.error) {
        session.sheet = { id: token.spreadsheetId, url: spreadsheetUrl(token.spreadsheetId) };
      } else if (token.error) {
        session.connectError = { kind: token.error, detail: token.errorDetail };
      }
      return session;
    },
  },
});

/** The raw Google tokens from the session cookie, for server actions that call Google. */
export const googleToken = async () => {
  const h = await headers();
  return getToken({
    req: { headers: h },
    secret: process.env.AUTH_SECRET,
    // Auth.js uses the __Secure- cookie name over https only; follow whichever cookie the browser actually sent.
    secureCookie: h.get("cookie")?.includes("__Secure-authjs.session-token") ?? false,
  });
};

/**
 * A usable access token for a server action. `googleToken()` reads the cookie as sent, which can hold an expired
 * token (the `jwt` callback only refreshes inside `auth()`); refresh here with the same 60 s margin. Not persisted:
 * the next `auth()` refreshes the cookie itself.
 */
export const googleAccessToken = async () => {
  const token = await googleToken();
  if (!token?.refreshToken || token.error) return null;
  if (token.accessToken && token.expiresAt && Date.now() < (token.expiresAt - 60) * 1000) return token.accessToken;
  return (await refreshAccessToken(token.refreshToken)).accessToken;
};
