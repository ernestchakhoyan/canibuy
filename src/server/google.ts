import "server-only";
import { defaultBudget, monthOf, todayISO } from "@helper";
import { buildSpreadsheet } from "./sheet-template";

// Google REST calls over fetch. Every Sheets/Drive call goes through the server; tokens never reach the browser.

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Drive appProperties tag: lets a new device find the app's sheet again (drive.file only sees app files). */
const APP_TAG = { key: "smartMoney", value: "1" };

const google = async <T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Google API ${res.status} ${url.split("?")[0]}: ${await res.text()}`);
  return res.json() as Promise<T>;
};

export const refreshAccessToken = async (refreshToken: string) => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Token refresh failed: ${data.error ?? res.status}`);
  return { accessToken: data.access_token, expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600) };
};

/** Revokes the grant: Google drops the refresh token and every access token issued from it. */
export const revokeToken = (token: string) =>
  fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token }) });

/** Returns the app's spreadsheet ID, creating the sheet from the template when the user has none (SHEET-2). */
export const findOrCreateSpreadsheet = async (accessToken: string) => {
  const q = `appProperties has { key='${APP_TAG.key}' and value='${APP_TAG.value}' } and trashed=false`;
  const found = await google<{ files: { id: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q, orderBy: "createdTime desc", fields: "files(id)" })}`,
    accessToken
  );
  if (found.files[0]) return found.files[0].id;

  const created = await google<{ spreadsheetId: string }>(
    "https://sheets.googleapis.com/v4/spreadsheets",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(buildSpreadsheet(defaultBudget(), monthOf(todayISO()))),
    }
  );
  await google(`https://www.googleapis.com/drive/v3/files/${created.spreadsheetId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ appProperties: { [APP_TAG.key]: APP_TAG.value } }),
  });
  return created.spreadsheetId;
};

export const spreadsheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
