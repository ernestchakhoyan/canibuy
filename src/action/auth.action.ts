"use server";

import { DRIVE_FILE_SCOPE, googleToken, revokeToken, signIn, signOut } from "@server";

/**
 * The only entry point: one Google consent for identity + drive.file (the app sees only the sheet it creates),
 * offline so the server gets a refresh token. Merges the PRD's separate sign-in (AUTH-1) and connect (SHEET-1) steps.
 */
export async function connectGoogleSheet() {
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    throw new Error("Google isn't configured: set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env.local (README).");
  }
  await signIn(
    "google",
    { redirectTo: "/" },
    {
      scope: `openid email profile ${DRIVE_FILE_SCOPE}`,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }
  );
}

/** Forgets the connection on this device. */
export async function signOutAction() {
  await signOut({ redirectTo: "/connect" });
}

/** AUTH-3: revokes the app's Google access, then ends the session. The sheet stays in the user's Drive. */
export async function disconnectGoogle() {
  const token = await googleToken();
  const grant = token?.refreshToken ?? token?.accessToken;
  if (grant) await revokeToken(grant);
  await signOut({ redirectTo: "/connect" });
}
