import "server-only";
import { defaultBudget, monthOf, todayISO } from "@helper";
import type { Bill, Budget, Category, Entry, Order, Personal, Project, ProjectPart, Saving, Settings } from "@type";
import {
  billNamedRanges,
  billsUpdate,
  buildSpreadsheet,
  entriesUpdate,
  ordersUpdate,
  parseSheet,
  personalUpdate,
  projectsUpdate,
  resetRequests,
  SHEET_ID,
  savingsUpdate,
  setupUpdate,
} from "./sheet-template";

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

/** Overwrites the Setup tab's Personal block. Writes the header row too, so sheets made before it existed get it. */
export const writePersonal = async (accessToken: string, spreadsheetId: string, personal: Personal) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  const setup = meta.idOf("Setup");
  if (setup === undefined) throw new Error("The sheet has no Setup tab");
  await batchUpdate(accessToken, spreadsheetId, personalUpdate(setup, personal));
};

/** Makes the Orders tab's rows exactly `orders` (removed orders' rows are cleared), in one request. */
export const writeOrders = (accessToken: string, spreadsheetId: string, orders: Order[]) =>
  google(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify(ordersUpdate(orders)),
  });

/** Makes the Projects tab's rows exactly `projects` + their `parts`, in one request. */
export const writeProjects = (accessToken: string, spreadsheetId: string, projects: Project[], parts: ProjectPart[]) =>
  google(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify(projectsUpdate(projects, parts)),
  });

const batchUpdate = (accessToken: string, spreadsheetId: string, requests: object[]) =>
  google(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, accessToken, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

type SheetMeta = {
  sheets: { properties: { sheetId: number; title: string } }[];
  namedRanges?: { namedRangeId: string; name: string }[];
};

/** The sheet's tabs and named ranges: tabs are found by title (a person may have moved or recreated them). */
const sheetMeta = async (accessToken: string, spreadsheetId: string) => {
  const meta = await google<SheetMeta>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title),namedRanges(namedRangeId,name)`,
    accessToken
  );
  const tabs = meta.sheets.map((s) => s.properties);
  return {
    tabs,
    namedRanges: meta.namedRanges ?? [],
    idOf: (title: string) => tabs.find((t) => t.title === title)?.sheetId,
  };
};

/** A sheet id no tab uses yet. */
const freeSheetId = (taken: number[], preferred?: number) => {
  if (preferred !== undefined && !taken.includes(preferred)) return preferred;
  let id = 1000 + Math.floor(Math.random() * 1_000_000);
  while (taken.includes(id)) id++;
  return id;
};

/**
 * Makes the Bills tab exactly `bills`. Sheets made before it existed (bills in Setup D–I) get the tab, their bill
 * named ranges repointed to it, and the old Setup block cleared, all in the same request.
 */
export const writeBills = async (accessToken: string, spreadsheetId: string, bills: Bill[]) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  let sheetId = meta.idOf("Bills");
  const requests: object[] = [];
  if (sheetId === undefined) {
    sheetId = freeSheetId(
      meta.tabs.map((t) => t.sheetId),
      SHEET_ID.bills
    );
    requests.push(
      { addSheet: { properties: { sheetId, title: "Bills", gridProperties: { frozenRowCount: 1 } } } },
      ...billNamedRanges(sheetId, meta.namedRanges),
      {
        updateCells: {
          range: { sheetId: SHEET_ID.setup, startRowIndex: 0, startColumnIndex: 3, endColumnIndex: 9 },
          fields: "userEnteredValue",
        },
      }
    );
  }
  requests.push(...billsUpdate(sheetId, bills));
  await batchUpdate(accessToken, spreadsheetId, requests);
};

/** Writes the settings (Setup A–B) and makes the categories (Setup K–L) exactly `categories`. */
export const writeSetup = async (
  accessToken: string,
  spreadsheetId: string,
  settings: Settings,
  categories: Category[]
) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  const setup = meta.idOf("Setup");
  if (setup === undefined) throw new Error("The sheet has no Setup tab");
  await batchUpdate(accessToken, spreadsheetId, setupUpdate(setup, settings, categories));
};

/** Empties the sheet for a fresh start (see `resetRequests`), with `budget`'s settings and categories in Setup. */
export const resetSheet = async (accessToken: string, spreadsheetId: string, month: string, budget: Budget) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  const requests = resetRequests(meta.tabs, month, budget);
  if (requests.length > 0) await batchUpdate(accessToken, spreadsheetId, requests);
};

/** Makes the Savings tab exactly `savings`, creating the tab on sheets made before it existed. */
export const writeSavings = async (accessToken: string, spreadsheetId: string, savings: Saving[]) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  let sheetId = meta.idOf("Savings");
  const requests: object[] = [];
  if (sheetId === undefined) {
    sheetId = freeSheetId(
      meta.tabs.map((t) => t.sheetId),
      SHEET_ID.savings
    );
    requests.push({ addSheet: { properties: { sheetId, title: "Savings", gridProperties: { frozenRowCount: 1 } } } });
  }
  requests.push(...savingsUpdate(sheetId, savings));
  await batchUpdate(accessToken, spreadsheetId, requests);
};

/** Makes every month tab's ledger exactly the entries dated in that month (new months copied from the template). */
export const writeEntries = async (accessToken: string, spreadsheetId: string, entries: Entry[]) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  const template = meta.idOf("_MonthTemplate");
  if (template === undefined) throw new Error("The sheet has no _MonthTemplate tab");
  const taken = meta.tabs.map((t) => t.sheetId);
  const requests = entriesUpdate(entries, meta.tabs, template, () => {
    const id = freeSheetId(taken);
    taken.push(id);
    return id;
  });
  if (requests.length > 0) await batchUpdate(accessToken, spreadsheetId, requests);
};

/**
 * Reads the synced tabs (Orders, Projects, Bills, every month tab) in one request and parses them. Sheets without
 * a Bills tab yet are read from their old Setup D–I block.
 */
export const readSheet = async (accessToken: string, spreadsheetId: string) => {
  const meta = await sheetMeta(accessToken, spreadsheetId);
  const months = meta.tabs.map((t) => t.title).filter((title) => /^\d{4}-\d{2}$/.test(title));
  const quote = (title: string) => `'${title.replaceAll("'", "''")}'`;
  const ranges = [
    meta.idOf("Orders") === undefined ? null : `Orders!A:Z`,
    meta.idOf("Projects") === undefined ? null : `Projects!A:Z`,
    meta.idOf("Bills") === undefined ? "Setup!D:I" : "Bills!A:Z",
    ...months.map((m) => `${quote(m)}!A:H`),
    meta.idOf("Setup") === undefined ? null : "Setup!A:B",
    meta.idOf("Setup") === undefined ? null : "Setup!K:L",
    meta.idOf("Setup") === undefined ? null : "Setup!N:O",
    meta.idOf("Savings") === undefined ? null : "Savings!A:Z",
  ];
  const wanted = ranges.filter((r): r is string => r !== null);
  const params = new URLSearchParams({
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  for (const r of wanted) params.append("ranges", r);
  const res = await google<{ valueRanges: { values?: (string | number | boolean)[][] }[] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`,
    accessToken
  );
  const byRange = new Map(wanted.map((r, i) => [r, res.valueRanges[i]?.values]));
  return parseSheet({
    orders: ranges[0] ? byRange.get(ranges[0]) : undefined,
    projects: ranges[1] ? byRange.get(ranges[1]) : undefined,
    bills: ranges[2] ? byRange.get(ranges[2]) : undefined,
    months: months.map((m) => byRange.get(`${quote(m)}!A:H`)),
    settings: byRange.get("Setup!A:B"),
    categories: byRange.get("Setup!K:L"),
    personal: byRange.get("Setup!N:O"),
    savings: byRange.get("Savings!A:Z"),
  });
};

export const spreadsheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;
