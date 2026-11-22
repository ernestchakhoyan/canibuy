// Mirrors the Google Sheet template in the PRD (section 6) so the Sheets sync can map rows 1:1.

export type Settings = {
  currency: string;
  usualIncome: number;
  cushionMonths: number;
  loanRate: number;
  loanTermMonths: number;
  startMonth: string;
};

export type AppMode = "system" | "light" | "dark";
export type Locale = "en" | "hy" | "ru";

/** Per-person preferences: the "Personal" block of the sheet's Setup tab. */
export type Personal = {
  appMode: AppMode;
  locale: Locale;
  /** The eye toggle: money amounts masked as "֏ ••••" on This month and Setup. Missing (older data) = hidden. */
  amountsHidden?: boolean;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  active: boolean;
  /** First / last month (YYYY-MM) a bill is due, e.g. a started project's loan payments. Missing = no limit. */
  startMonth?: string;
  endMonth?: string;
  /** The started project this bill pays off, and its name (the project may have no parts left). */
  projectId?: string;
  project?: string;
};

export type Category = { name: string; monthlyLimit: number };

export type EntryType = "expense" | "income_salary" | "income_extra" | "saving" | "withdrawal" | "bill_paid";

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  type: EntryType;
  category: string;
  amount: number;
  note: string;
  linkId: string; // order id or project part id, "" when none
  createdAt: string;
};

export type OrderStatus = "Planned" | "Saving" | "Bought" | "Dropped";

export type Order = {
  id: string;
  item: string;
  price: number;
  deadlineMonths: number | null;
  status: OrderStatus;
  created: string;
  boughtDate: string;
  note: string;
  /** Bank terms for this order; `null` (or missing on older orders) = Setup's loan rate / term. */
  loanRate?: number | null;
  loanTermMonths?: number | null;
  /** YYYY-MM the user plans to buy it; the forecast counts its price then. Missing = no date yet. */
  buyMonth?: string;
};

export type ProjectPart = {
  projectId: string;
  project: string;
  partId: string;
  part: string;
  cost: number;
  payMonth: string; // YYYY-MM
  status: "Planned" | "Paid";
  paidDate: string;
  /**
   * One monthly payment: a loan / friend repayment, or ("saving") a share of a later part split over the months
   * up to it when the project starts. Each lender's / part's payments are one recurring bill.
   */
  installment?: "bank" | "friend" | "saving";
  /** YYYY-MM-DD the project was started (same on all its parts); missing = not started, still a plan. */
  startedDate?: string;
};

/** Currencies savings can be kept in (and the base currency, from Setup's currency symbol). */
export type CurrencyCode = "AMD" | "USD" | "EUR" | "RUB" | "GBP";

/** A saving kept in its own currency (cash, a deposit…); counted in the savings balance at today's rate. */
export type Saving = { id: string; name: string; amount: number; currency: CurrencyCode };

/** Exchange-rate snapshot: 1 `base` = `perBase[code]` of each currency. Stored so calculations work offline. */
export type Rates = { base: CurrencyCode; date: string; perBase: Partial<Record<CurrencyCode, number>> };

/** A project's own record; its money lives in `parts` (and, once started, in bills). */
export type Project = {
  id: string;
  name: string;
  /** An idea, not planned yet: holds no money in the plans and can't start. Missing = planned (older rows too). */
  draft?: boolean;
  /** YYYY-MM-DD the user pressed Start; missing = still a plan. */
  startedDate?: string;
  /** YYYY-MM-DD the user archived it; missing = not archived. */
  archivedDate?: string;
};

export type Budget = {
  settings: Settings;
  personal: Personal;
  bills: Bill[];
  categories: Category[];
  entries: Entry[];
  orders: Order[];
  parts: ProjectPart[];
  /** Missing in budgets saved before projects had records; `projectsOf` fills the gaps. */
  projects?: Project[];
  /** Savings kept per currency (missing in older budgets). */
  savings?: Saving[];
  /** Latest exchange rates for converting `savings` (device only, not synced). */
  rates?: Rates;
};
