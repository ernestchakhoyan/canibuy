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

export type Bill = { id: string; name: string; amount: number; dueDay: number; category: string; active: boolean };

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
};

export type Budget = {
  settings: Settings;
  bills: Bill[];
  categories: Category[];
  entries: Entry[];
  orders: Order[];
  parts: ProjectPart[];
};
