import type { Bill, Budget, Category, Entry, Order, Personal, Project, ProjectPart, Settings } from "@type";
import { projectsOf } from "./engine";

// Pure rules of the Google Sheet sync (the store runs them). Kept here so `bun run test` can check them.

/** "setup" = the Setup tab's settings (A–B) and categories (K–L); "personal" = its Personal block (N–O). */
export type SheetTab = "orders" | "projects" | "bills" | "entries" | "setup" | "personal";
export const SHEET_TABS: SheetTab[] = ["orders", "projects", "bills", "entries", "setup", "personal"];

/**
 * Kept across reloads. `uploaded`: tabs this device already gave the sheet its data for (after that, the sheet
 * leads). `dirty`: tabs with changes the sheet doesn't have yet.
 */
export type SyncMeta = { uploaded: SheetTab[]; dirty: SheetTab[] };

/** Before this bookkeeping existed, orders, projects and Personal were already written on every change. */
export const INITIAL_SYNC_META: SyncMeta = { uploaded: ["orders", "projects", "personal"], dirty: [] };

/** `settings`: the well-formed values only; `null` = no settings / categories block found (keep the app's). */
export type SheetData = {
  orders: Order[];
  projects: Project[];
  parts: ProjectPart[];
  bills: Bill[];
  entries: Entry[];
  settings: Partial<Settings> | null;
  categories: Category[] | null;
  personal: Partial<Personal> | null;
};

/**
 * Tabs to write before reading the sheet back: every dirty tab, and each tab this device has data for but never
 * uploaded (a new, empty device uploads nothing, so it can never empty the sheet; a tab already uploaded is never
 * re-uploaded, so rows deleted in the sheet don't come back).
 */
export const tabsToWrite = (b: Budget, { uploaded, dirty }: SyncMeta) => {
  const hasData: Record<SheetTab, boolean> = {
    orders: b.orders.length > 0,
    projects: projectsOf(b).length > 0,
    bills: b.bills.length > 0,
    entries: b.entries.length > 0,
    setup: true, // a device always has settings: upload them once, then the sheet leads
    personal: true,
  };
  return SHEET_TABS.filter((tab) => dirty.includes(tab) || (!uploaded.includes(tab) && hasData[tab]));
};

/** The sheet's data replaces every tab that's clean; dirty tabs (changes the sheet doesn't have yet) are kept. */
export const mergeFromSheet = (b: Budget, data: SheetData, dirty: SheetTab[]): Budget => {
  const take = (tab: SheetTab) => !dirty.includes(tab);
  return {
    ...b,
    ...(take("orders") && { orders: data.orders }),
    ...(take("projects") && { projects: data.projects, parts: data.parts }),
    ...(take("bills") && { bills: data.bills }),
    ...(take("entries") && { entries: data.entries }),
    ...(take("setup") && {
      settings: { ...b.settings, ...data.settings }, // key by key: a broken value in the sheet keeps the app's
      categories: data.categories ?? b.categories,
    }),
    ...(take("personal") && { personal: { ...b.personal, ...data.personal } }),
  };
};
