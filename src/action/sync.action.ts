"use server";

import { auth, googleAccessToken, readSheet, writeBills, writeEntries, writeSetup } from "@server";
import type { Bill, Category, Entry, EntryType, Settings } from "@type";

const MAX_ROWS = 20_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const ENTRY_TYPES: EntryType[] = ["expense", "income_salary", "income_extra", "saving", "withdrawal", "bill_paid"];

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const optional = (v: unknown, valid: (v: string) => boolean) =>
  v === undefined || v === null || v === "" || (typeof v === "string" && valid(v));

/** The connected sheet and a working access token; `null` when no sheet is connected (nothing to sync). */
const connectedSheet = async () => {
  const spreadsheetId = (await auth())?.sheet?.id;
  const accessToken = spreadsheetId && (await googleAccessToken());
  return spreadsheetId && accessToken ? { spreadsheetId, accessToken } : null;
};

// Data comes from the browser: only well-formed rows may be written into the user's sheet.
const validBill = (b: Bill) =>
  text(b.id, 32) &&
  text(b.name, 200) &&
  Number.isFinite(b.amount) &&
  Number.isInteger(b.dueDay) &&
  b.dueDay >= 1 &&
  b.dueDay <= 31 &&
  text(b.category, 100) &&
  typeof b.active === "boolean" &&
  optional(b.startMonth, (v) => MONTH.test(v)) &&
  optional(b.endMonth, (v) => MONTH.test(v)) &&
  optional(b.projectId, (v) => v.length <= 32) &&
  optional(b.project, (v) => v.length <= 200);

const validEntry = (e: Entry) =>
  text(e.id, 32) &&
  text(e.date, 10) &&
  DATE.test(e.date) &&
  ENTRY_TYPES.includes(e.type) &&
  text(e.category, 100) &&
  Number.isFinite(e.amount) &&
  text(e.note, 1000) &&
  text(e.linkId, 32) &&
  text(e.createdAt, 30);

/** Mirrors the bills into the sheet's Bills tab. Returns `true` once written, `false` when no sheet is connected. */
export async function saveBills(bills: Bill[]) {
  if (!Array.isArray(bills) || bills.length > MAX_ROWS || !bills.every(validBill)) throw new Error("Invalid bills");
  const sheet = await connectedSheet();
  if (!sheet) return false; // nothing written: the caller must not count it as synced
  await writeBills(
    sheet.accessToken,
    sheet.spreadsheetId,
    bills.map(({ id, name, amount, dueDay, category, active, startMonth, endMonth, projectId, project }) => ({
      id,
      name,
      amount,
      dueDay,
      category,
      active,
      startMonth: startMonth || undefined,
      endMonth: endMonth || undefined,
      projectId: projectId || undefined,
      project: project || undefined,
    }))
  );
  return true;
}

/** Mirrors the entries into their month tabs. Returns `true` once written, `false` when no sheet is connected. */
export async function saveEntries(entries: Entry[]) {
  if (!Array.isArray(entries) || entries.length > MAX_ROWS || !entries.every(validEntry)) {
    throw new Error("Invalid entries");
  }
  const sheet = await connectedSheet();
  if (!sheet) return false;
  await writeEntries(
    sheet.accessToken,
    sheet.spreadsheetId,
    entries.map(({ id, date, type, category, amount, note, linkId, createdAt }) => ({
      id,
      date,
      type,
      category,
      amount,
      note,
      linkId,
      createdAt,
    }))
  );
  return true;
}

const amount = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const validSettings = (s: Settings) =>
  typeof s === "object" &&
  s !== null &&
  text(s.currency, 5) &&
  amount(s.usualIncome) &&
  amount(s.openingSavings) &&
  amount(s.cushionMonths) &&
  amount(s.loanRate) &&
  Number.isInteger(s.loanTermMonths) &&
  s.loanTermMonths >= 1 &&
  text(s.startMonth, 7) &&
  MONTH.test(s.startMonth);
const validCategory = (c: Category) => text(c.name, 100) && c.name.length > 0 && amount(c.monthlyLimit);

/** Writes the settings and categories to the Setup tab. Returns `true` once written, `false` when no sheet. */
export async function saveSetup(settings: Settings, categories: Category[]) {
  if (
    !validSettings(settings) ||
    !Array.isArray(categories) ||
    categories.length > 500 ||
    !categories.every(validCategory)
  ) {
    throw new Error("Invalid settings");
  }
  const sheet = await connectedSheet();
  if (!sheet) return false; // nothing written: the caller must not count it as synced
  const { currency, usualIncome, openingSavings, cushionMonths, loanRate, loanTermMonths, startMonth } = settings;
  await writeSetup(
    sheet.accessToken,
    sheet.spreadsheetId,
    { currency, usualIncome, openingSavings, cushionMonths, loanRate, loanTermMonths, startMonth },
    categories.map(({ name, monthlyLimit }) => ({ name, monthlyLimit }))
  );
  return true;
}

/** Reads orders, projects, bills, entries, settings and categories back from the sheet; `null` when no sheet is connected. */
export async function loadSheet() {
  const sheet = await connectedSheet();
  return sheet ? readSheet(sheet.accessToken, sheet.spreadsheetId) : null;
}
