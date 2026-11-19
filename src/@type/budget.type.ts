// Mirrors the Google Sheet template in the PRD (section 6) so the Sheets sync can map rows 1:1.

export type Settings = {
  currency: string;
  usualIncome: number;
  openingSavings: number;
  cushionMonths: number;
  loanRate: number;
  loanTermMonths: number;
  startMonth: string;
};

export type AppMode = "system" | "light" | "dark";
export type Locale = "en" | "hy" | "ru";

/** Per-person preferences: the "Personal" block of the sheet's Setup tab. */
export type Personal = { appMode: AppMode; locale: Locale };

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
  /** A monthly loan / friend repayment; starting the project turns these into one recurring bill. */
  installment?: "bank" | "friend";
  /** YYYY-MM-DD the project was started (same on all its parts); missing = not started, still a plan. */
  startedDate?: string;
};

/** A project's own record; its money lives in `parts` (and, once started, in bills). */
export type Project = {
  id: string;
  name: string;
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
};
