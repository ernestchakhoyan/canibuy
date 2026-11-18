import type { Budget, Entry, EntryType, Order } from "@type";
import { addMonths, daysInMonth, monthOf } from "./date";

// Calculation rules from PRD section 7. Everything is derived from raw rows; nothing calculated is stored.

const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.amount, 0);
const ofType = (entries: Entry[], type: EntryType) => entries.filter((e) => e.type === type);
const inMonth = (entries: Entry[], month: string) => entries.filter((e) => monthOf(e.date) === month);

/** Expenses not tied to an order or project part: the everyday spending used for projections. */
const everyday = (entries: Entry[]) => ofType(entries, "expense").filter((e) => !e.linkId);

export const monthBills = (b: Budget) => b.bills.filter((bill) => bill.active).reduce((t, bill) => t + bill.amount, 0);

export const monthIncome = (b: Budget, month: string) => {
  const entries = inMonth(b.entries, month);
  const salary = ofType(entries, "income_salary");
  return (salary.length ? sum(salary) : b.settings.usualIncome) + sum(ofType(entries, "income_extra"));
};

export const savingsBalance = (b: Budget) =>
  b.settings.openingSavings + sum(ofType(b.entries, "saving")) - sum(ofType(b.entries, "withdrawal"));

export const cushion = (b: Budget) => b.settings.cushionMonths * monthBills(b);

export const usableSavings = (b: Budget) => Math.max(0, savingsBalance(b) - cushion(b));

/** Average everyday spending over the last 3 months (before `month`) that have any expense. */
export const averageEveryday = (b: Budget, month: string) => {
  const totals: number[] = [];
  for (let m = addMonths(month, -1); totals.length < 3 && m >= b.settings.startMonth; m = addMonths(m, -1)) {
    const spent = everyday(inMonth(b.entries, m));
    if (spent.length) totals.push(sum(spent));
  }
  return totals.length ? totals.reduce((t, n) => t + n, 0) / totals.length : 0;
};

export const usualFreeMoney = (b: Budget, month: string) =>
  b.settings.usualIncome - monthBills(b) - averageEveryday(b, month);

export type MonthSummary = {
  income: number;
  bills: number;
  spent: number;
  saved: number;
  taken: number;
  left: number;
  projectedSpend: number;
  canStillSave: number;
  dailyAllowance: number;
  daysLeft: number;
};

export const monthSummary = (b: Budget, today: string): MonthSummary => {
  const month = monthOf(today);
  const entries = inMonth(b.entries, month);
  const income = monthIncome(b, month);
  const bills = monthBills(b);
  const spent = sum(ofType(entries, "expense"));
  const saved = sum(ofType(entries, "saving"));
  const taken = sum(ofType(entries, "withdrawal"));

  const day = Number(today.slice(8, 10));
  const daysLeft = daysInMonth(month) - day + 1; // counting today
  const everydaySpent = sum(everyday(entries));
  // Only everyday spending is extrapolated; one-off order/project payments are counted as they are.
  const projectedSpend = spent + (everydaySpent / day) * (daysLeft - 1);

  // Withdrawals add back what was paid from savings, matching the sheet's "Left" formula.
  const left = income - bills - spent - saved + taken;
  return {
    income,
    bills,
    spent,
    saved,
    taken,
    left,
    projectedSpend,
    canStillSave: Math.max(0, income - bills - projectedSpend - saved + taken),
    dailyAllowance: left / daysLeft,
    daysLeft,
  };
};

export const spendingByCategory = (entries: Entry[]) => {
  const totals = new Map<string, number>();
  for (const e of ofType(entries, "expense")) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  return [...totals].map(([category, amount]) => ({ category, amount })).sort((a, z) => z.amount - a.amount);
};

export const loanPayment = (amount: number, yearlyRate: number, months: number) => {
  const i = yearlyRate / 100 / 12;
  return i === 0 ? amount / months : (amount * i) / (1 - (1 + i) ** -months);
};

export const loanOption = (b: Budget, amount: number) => {
  const payment = loanPayment(amount, b.settings.loanRate, b.settings.loanTermMonths);
  return { amount, payment, totalInterest: payment * b.settings.loanTermMonths - amount };
};

export type Verdict = "pay_now" | "save_up" | "loan" | "not_affordable";

export const savedToward = (b: Budget, linkId: string) =>
  sum(ofType(b.entries, "saving").filter((e) => e.linkId === linkId));

/** How much of a purchase is paid from savings: never dips into the cushion beyond what was saved for it. */
export const fromSavings = (b: Budget, price: number, linkId: string) =>
  Math.min(price, savingsBalance(b), Math.max(usableSavings(b), savedToward(b, linkId)));

export const orderVerdict = (b: Budget, order: Pick<Order, "price" | "deadlineMonths">, today: string) => {
  const month = monthOf(today);
  const usable = usableSavings(b);
  const canSave = monthSummary(b, today).canStillSave;
  const free = usualFreeMoney(b, month);
  const rest = Math.max(0, order.price - usable - canSave);

  const payNow = rest === 0;
  const saveMonths = payNow ? 0 : free > 0 ? Math.ceil(rest / free) : Number.POSITIVE_INFINITY;
  const loan = loanOption(b, Math.max(0, order.price - usable));

  let verdict: Verdict = "not_affordable";
  if (payNow) verdict = "pay_now";
  else if (saveMonths <= (order.deadlineMonths ?? 6)) verdict = "save_up";
  else if (free > 0 && loan.payment <= 0.35 * free) verdict = "loan";

  return { verdict, saveMonths, loan };
};

export type PlanMonth = { month: string; added: number; paid: number; balance: number };

/**
 * Month-by-month project simulation: usable savings + what can still be saved this month, then each later
 * month's income minus bills and usual spending; each unpaid part is paid in its planned month.
 */
export const projectPlan = (b: Budget, projectId: string, today: string) => {
  const current = monthOf(today);
  const parts = b.parts.filter((p) => p.projectId === projectId && p.status === "Planned");
  const payMonth = (m: string) => (m < current ? current : m);
  const last = parts.reduce((max, p) => (payMonth(p.payMonth) > max ? payMonth(p.payMonth) : max), current);
  const bills = monthBills(b);
  const avg = averageEveryday(b, current);
  const startBalance = usableSavings(b) + monthSummary(b, today).canStillSave;
  const freeIn = (m: string) => monthIncome(b, m) - bills - avg;

  const months: PlanMonth[] = [];
  let balance = startBalance;
  let lowest = Number.POSITIVE_INFINITY;
  for (let m = current; m <= last; m = addMonths(m, 1)) {
    const added = m === current ? startBalance : freeIn(m);
    const paid = parts.filter((p) => payMonth(p.payMonth) === m).reduce((t, p) => t + p.cost, 0);
    if (m !== current) balance += added;
    balance -= paid;
    lowest = Math.min(lowest, balance);
    months.push({ month: m, added, paid, balance });
  }

  // ponytail: 10-year horizon; past that the project is treated as never affordable without a loan.
  const total = parts.reduce((t, p) => t + p.cost, 0);
  let affordableMonth: string | null = null;
  for (let m = current, have = startBalance, i = 0; i < 120; m = addMonths(m, 1), i++) {
    if (i > 0) have += freeIn(m);
    if (have >= total) {
      affordableMonth = m;
      break;
    }
  }

  const loanNeeded = Math.max(0, -lowest);
  return {
    months,
    total,
    covered: loanNeeded === 0,
    affordableMonth,
    loan: loanNeeded > 0 ? loanOption(b, loanNeeded) : null,
  };
};
