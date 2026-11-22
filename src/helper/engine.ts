import type { Bill, Budget, CurrencyCode, Entry, EntryType, Order, Project, ProjectPart } from "@type";
import { addMonths, daysInMonth, monthOf } from "./date";
import { newId } from "./money";

// Calculation rules from PRD section 7. Everything is derived from raw rows; nothing calculated is stored.

/** Rounds money to cents. */
const cents = (n: number) => Math.round(n * 100) / 100;

const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.amount, 0);
const ofType = (entries: Entry[], type: EntryType) => entries.filter((e) => e.type === type);
const inMonth = (entries: Entry[], month: string) => entries.filter((e) => monthOf(e.date) === month);

/** Built-in category: an expense or bill in it still comes out of the month, and the money goes into savings. */
export const SAVINGS_CATEGORY = "Savings";

/** Adds the Savings category when it's missing (it can't be removed). */
export const withSavingsCategory = (b: Budget): Budget =>
  b.categories.some((c) => c.name === SAVINGS_CATEGORY)
    ? b
    : { ...b, categories: [...b.categories, { name: SAVINGS_CATEGORY, monthlyLimit: 0 }] };

/** Expenses not tied to an order or project part (nor put into savings): the everyday spending used for projections. */
const everyday = (entries: Entry[]) =>
  ofType(entries, "expense").filter((e) => !e.linkId && e.category !== SAVINGS_CATEGORY);

const due = (bill: Bill, month: string) =>
  (!bill.startMonth || bill.startMonth <= month) && (!bill.endMonth || month <= bill.endMonth);

/**
 * Active bills due in `month` (bills with a start / end month only count inside it). Without a month: every active
 * bill, which is what the safety cushion covers.
 */
export const monthBills = (b: Budget, month?: string) =>
  b.bills.filter((bill) => bill.active && (!month || due(bill, month))).reduce((t, bill) => t + bill.amount, 0);

/** Bills that haven't ended by `month`, including ones starting later: the usual monthly commitments from now on. */
const ongoingBills = (b: Budget, month: string) =>
  b.bills
    .filter((bill) => bill.active && (!bill.endMonth || bill.endMonth >= month))
    .reduce((t, bill) => t + bill.amount, 0);

export const monthIncome = (b: Budget, month: string) => {
  const entries = inMonth(b.entries, month);
  const salary = ofType(entries, "income_salary");
  return (salary.length ? sum(salary) : b.settings.usualIncome) + sum(ofType(entries, "income_extra"));
};

export const CURRENCIES: CurrencyCode[] = ["AMD", "USD", "EUR", "RUB", "GBP"];
const SYMBOLS: Record<string, CurrencyCode> = { "֏": "AMD", $: "USD", "€": "EUR", "₽": "RUB", "£": "GBP" };

/** The base currency behind Setup's currency symbol; `null` for a symbol we can't convert to (a custom one). */
export const baseCurrency = (b: Budget): CurrencyCode | null =>
  SYMBOLS[b.settings.currency] ??
  (CURRENCIES.includes(b.settings.currency as CurrencyCode) ? (b.settings.currency as CurrencyCode) : null);

/**
 * `amount` of `currency` in the base currency, at the stored rates; `null` when there's no usable rate (no rates
 * yet, rates for another base, or a custom base symbol). Same currency as the base needs no rate.
 */
export const toBase = (b: Budget, amount: number, currency: CurrencyCode) => {
  const base = baseCurrency(b);
  if (base === currency) return amount;
  const rate = b.rates?.base === base ? b.rates.perBase[currency] : undefined;
  return rate && rate > 0 ? amount / rate : null;
};

/** The currency a Setup symbol stands for (֏ → AMD…); `null` for a custom symbol. */
export const currencyOfSymbol = (symbol: string): CurrencyCode | null =>
  SYMBOLS[symbol] ?? (CURRENCIES.includes(symbol as CurrencyCode) ? (symbol as CurrencyCode) : null);

/**
 * The budget with its base currency switched to `symbol`: every amount kept in the base currency (income, opening
 * savings, bills, category limits, entries, order prices, project parts) multiplied by `factor` (1 old = `factor`
 * new). Savings kept per currency stay as they are: they're in their own currency.
 */
export const convertBudget = (b: Budget, factor: number, symbol: string): Budget => {
  // Drams aren't used with fractions: whole drams; other currencies keep cents.
  const round = currencyOfSymbol(symbol) === "AMD" ? Math.round : cents;
  const convert = (n: number) => round(n * factor);
  return {
    ...b,
    settings: {
      ...b.settings,
      currency: symbol,
      usualIncome: convert(b.settings.usualIncome),
    },
    bills: b.bills.map((bill) => ({ ...bill, amount: convert(bill.amount) })),
    categories: b.categories.map((c) => ({ ...c, monthlyLimit: convert(c.monthlyLimit) })),
    entries: b.entries.map((e) => ({ ...e, amount: convert(e.amount) })),
    orders: b.orders.map((o) => ({ ...o, price: convert(o.price) })),
    parts: b.parts.map((p) => ({ ...p, cost: convert(p.cost) })),
  };
};

/** Savings kept per currency, converted to the base currency; ones that can't be converted are listed apart. */
export const savingsAccounts = (b: Budget) => {
  const rows = (b.savings ?? []).map((s) => ({ ...s, inBase: toBase(b, s.amount, s.currency) }));
  return {
    rows,
    total: rows.reduce((t, s) => t + (s.inBase ?? 0), 0),
    unconverted: [...new Set(rows.filter((s) => s.inBase === null).map((s) => s.currency))],
  };
};

/**
 * Records a `bill_paid` entry for every month an active Savings bill came due (on its due day, up to `today`) since
 * the later of the budget's start, the bill's start and its last recorded month. The entries are the history:
 * deactivating, editing or deleting the bill later doesn't change what already went into savings.
 */
export const recordSavingsBills = (b: Budget, today: string): Budget => {
  const added: Entry[] = [];
  for (const bill of b.bills) {
    if (!bill.active || bill.category !== SAVINGS_CATEGORY) continue;
    const last = b.entries
      .filter((e) => e.type === "bill_paid" && e.linkId === bill.id)
      .map((e) => monthOf(e.date))
      .sort()
      .at(-1);
    const from = [b.settings.startMonth, bill.startMonth ?? "", last ? addMonths(last, 1) : ""].sort().at(-1) ?? "";
    const to = bill.endMonth && bill.endMonth < monthOf(today) ? bill.endMonth : monthOf(today);
    for (let m = from; m <= to; m = addMonths(m, 1)) {
      const date = `${m}-${String(Math.min(Math.max(1, bill.dueDay), daysInMonth(m))).padStart(2, "0")}`;
      if (date > today) break;
      added.push({
        id: newId(),
        date,
        type: "bill_paid",
        category: SAVINGS_CATEGORY,
        amount: bill.amount,
        note: bill.name,
        linkId: bill.id,
        createdAt: `${date}T00:00`,
      });
    }
  }
  return added.length ? { ...b, entries: [...b.entries, ...added] } : b;
};

/** Paid into savings by the Savings category: its expenses and its bills' recorded payments. */
const intoSavings = (entries: Entry[]) =>
  sum(entries.filter((e) => (e.type === "expense" || e.type === "bill_paid") && e.category === SAVINGS_CATEGORY));

/**
 * Savings kept per currency (the Savings section, converted) + money moved in / out of savings + Savings-category
 * expenses and bill payments.
 */
export const savingsBalance = (b: Budget) =>
  sum(ofType(b.entries, "saving")) -
  sum(ofType(b.entries, "withdrawal")) +
  intoSavings(b.entries) +
  savingsAccounts(b).total;

/**
 * Safety cushion: `cushionMonths` of the regular bills (rent, utilities…). A project's payment bills and Savings bills
 * aren't in it: they're a plan you chose, not a cost of living the cushion has to carry you through.
 */
export const cushion = (b: Budget) =>
  b.settings.cushionMonths *
  b.bills
    .filter((bill) => bill.active && !bill.projectId && bill.category !== SAVINGS_CATEGORY)
    .reduce((t, bill) => t + bill.amount, 0);

export const usableSavings = (b: Budget) => Math.max(0, savingsBalance(b) - cushion(b));

/**
 * Usual everyday spending per month: the average of the last 3 months (before today's) that have any expense. With
 * no such month yet, this month's pace (spent so far, extended to the whole month), so a new budget doesn't count
 * the full salary as free money.
 */
export const averageEveryday = (b: Budget, today: string) => {
  const month = monthOf(today);
  const totals: number[] = [];
  for (let m = addMonths(month, -1); totals.length < 3 && m >= b.settings.startMonth; m = addMonths(m, -1)) {
    const spent = everyday(inMonth(b.entries, m));
    if (spent.length) totals.push(sum(spent));
  }
  if (totals.length) return totals.reduce((t, n) => t + n, 0) / totals.length;
  return (sum(everyday(inMonth(b.entries, month))) / Number(today.slice(8, 10))) * daysInMonth(month);
};

export const usualFreeMoney = (b: Budget, today: string) =>
  b.settings.usualIncome - ongoingBills(b, monthOf(today)) - averageEveryday(b, today);

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
  const bills = monthBills(b, month);
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

/** An order's own bank terms, falling back to Setup's. */
export const loanTermsFor = (b: Budget, order: Pick<Order, "loanRate" | "loanTermMonths">) => ({
  rate: order.loanRate ?? b.settings.loanRate,
  term: order.loanTermMonths ?? b.settings.loanTermMonths,
});

export const loanOption = (
  b: Budget,
  amount: number,
  { rate, term } = { rate: b.settings.loanRate, term: b.settings.loanTermMonths }
) => {
  const payment = loanPayment(amount, rate, term);
  return { amount, payment, totalInterest: payment * term - amount };
};

export type Verdict = "pay_now" | "save_up" | "loan" | "not_affordable";

/** A loan "fits" when its monthly payment takes at most this share of the usual free money. */
export const LOAN_SHARE_LIMIT = 0.35;

/** Loan lengths compared on an order, besides the one in Setup. */
export const LOAN_TERMS = [6, 12, 24, 36];

/** At most this many "save first, then borrow" rows; long save-ups are sampled evenly. */
const MAX_COMBOS = 6;

/** `count` whole numbers spread evenly over 1…`n` (all of them when `n` ≤ `count`); always ends at `n`. */
const spread = (n: number, count: number) =>
  n <= count
    ? Array.from({ length: Math.max(0, n) }, (_, i) => i + 1)
    : [...new Set(Array.from({ length: count }, (_, i) => Math.round(((i + 1) * n) / count)))];

export const savedToward = (b: Budget, linkId: string) =>
  sum(ofType(b.entries, "saving").filter((e) => e.linkId === linkId));

/** How much of a purchase is paid from savings: never dips into the cushion beyond what was saved for it. */
export const fromSavings = (b: Budget, price: number, linkId: string) =>
  Math.min(price, savingsBalance(b), Math.max(usableSavings(b), savedToward(b, linkId)));

type OrderTerms = Pick<Order, "price" | "deadlineMonths" | "loanRate" | "loanTermMonths">;

export const orderVerdict = (b: Budget, order: OrderTerms, today: string) => {
  const usable = usableSavings(b);
  const canSave = monthSummary(b, today).canStillSave;
  const free = usualFreeMoney(b, today);
  const rest = Math.max(0, order.price - usable - canSave);

  const payNow = rest === 0;
  const saveMonths = payNow ? 0 : free > 0 ? Math.ceil(rest / free) : Number.POSITIVE_INFINITY;
  const loan = loanOption(b, Math.max(0, order.price - usable), loanTermsFor(b, order));

  let verdict: Verdict = "not_affordable";
  if (payNow) verdict = "pay_now";
  else if (saveMonths <= (order.deadlineMonths ?? 6)) verdict = "save_up";
  else if (free > 0 && loan.payment <= LOAN_SHARE_LIMIT * free) verdict = "loan";

  return { verdict, saveMonths, loan };
};

/**
 * Everything behind an order's verdict, for deciding how to pay: the money there is now, what's free each month,
 * and each way to cover the rest (save up, a bank loan over several terms, an interest-free loan from a friend).
 * Same rules as `orderVerdict`: usable savings keep the cushion, a loan covers what usable savings don't.
 */
export const affordOptions = (b: Budget, order: OrderTerms, today: string) => {
  const month = monthOf(today);
  const usable = usableSavings(b);
  const canSave = monthSummary(b, today).canStillSave;
  const spending = averageEveryday(b, today);
  const free = usualFreeMoney(b, today);
  const shortfall = Math.max(0, order.price - usable - canSave);
  // Affordable now → the plans keep savings untouched, so there's still a way to buy later or on credit.
  const keepSavings = shortfall === 0;
  const planUsable = keepSavings ? 0 : usable;
  const missing = Math.max(0, order.price - planUsable - canSave);
  const saveMonths = missing === 0 ? 0 : free > 0 ? Math.ceil(missing / free) : Number.POSITIVE_INFINITY;
  const borrow = Math.max(0, order.price - planUsable);
  const { rate, term } = loanTermsFor(b, order);

  const bank = [...new Set([...LOAN_TERMS, term])]
    .sort((a, z) => a - z)
    .map((months) => {
      const payment = loanPayment(borrow, rate, months);
      return {
        months,
        payment,
        interest: payment * months - borrow,
        share: free > 0 ? payment / free : Number.POSITIVE_INFINITY,
        fits: free > 0 && payment <= LOAN_SHARE_LIMIT * free,
      };
    });

  const deadline = order.deadlineMonths
    ? {
        months: order.deadlineMonths,
        perMonth: missing / order.deadlineMonths,
        fits: missing === 0 || (free > 0 && missing / order.deadlineMonths <= free),
      }
    : null;

  // Save first, then borrow: wait `wait` months putting all free money aside, buy, and borrow what's still missing
  // (usual rate and term). Only between "now" and the plain save-up date; past that no loan is needed.
  const loanFor = (amount: number) => {
    const payment = loanPayment(amount, rate, term);
    return {
      payment,
      interest: payment * term - amount,
      share: free > 0 ? payment / free : Number.POSITIVE_INFINITY,
      fits: free > 0 && payment <= LOAN_SHARE_LIMIT * free,
    };
  };
  const waits = Number.isFinite(saveMonths) ? spread(saveMonths - 1, MAX_COMBOS) : [];
  const combos = waits.map((wait) => {
    const amount = order.price - planUsable - canSave - free * wait;
    return { wait, buyMonth: addMonths(month, wait), borrow: amount, ...loanFor(amount) };
  });

  return {
    combos,
    keepSavings,
    now: { savings: savingsBalance(b), cushion: cushion(b), usable, canSave, shortfall },
    monthly: { income: b.settings.usualIncome, bills: ongoingBills(b, month), spending, free },
    save: {
      months: saveMonths,
      perMonth: free,
      readyMonth: Number.isFinite(saveMonths) ? addMonths(month, saveMonths) : null,
      deadline,
    },
    borrow,
    rate,
    term,
    bank,
    friend: {
      perMonth: borrow / term,
      months: term,
      fastestMonths: free > 0 ? Math.ceil(borrow / free) : Number.POSITIVE_INFINITY,
      interestSaved: loanPayment(borrow, rate, term) * term - borrow,
    },
  };
};

export type AffordOptions = ReturnType<typeof affordOptions>;

/** How an order is paid when it becomes a project: one of the ways `affordOptions` lists. */
export type PayChoice = "now" | "save" | "bank" | "friend" | `combo-${number}`;

/** Ways that apply to an order, in the order the picker lists them. */
export const payChoices = (o: AffordOptions): PayChoice[] => {
  // Affordable now → "now" first; the rest are plans that keep savings (see `keepSavings`).
  return [
    ...(o.keepSavings ? (["now"] as const) : []),
    ...(o.save.readyMonth && o.save.months > 0 ? (["save"] as const) : []),
    ...(o.borrow > 0 ? (["bank"] as const) : []),
    ...o.combos.map((c) => `combo-${c.wait}` as const),
    ...(o.borrow > 0 ? (["friend"] as const) : []),
  ];
};

type NewPart = Pick<ProjectPart, "part" | "cost" | "payMonth" | "installment">;
type PartNames = {
  purchase: string;
  fromSavings: string;
  loan: (i: number, n: number) => string;
  friend: (i: number, n: number) => string;
};

/**
 * The project parts for paying `price` the chosen way. Loans become one part per monthly payment (interest
 * included, from the month after buying), so the project's month-by-month plan shows the real cost.
 */
export const projectPartsFor = (
  o: AffordOptions,
  price: number,
  choice: PayChoice,
  today: string,
  names: PartNames
) => {
  const month = monthOf(today);
  const buyNow = (payMonth: string): NewPart[] => [{ part: names.purchase, cost: price, payMonth }];
  // Savings cover what isn't borrowed (in the buying month); then `n` payments of `payment`.
  const financed = (
    buyMonth: string,
    borrowed: number,
    payment: number,
    label: PartNames["loan"],
    installment: "bank" | "friend"
  ): NewPart[] => [
    ...(price - borrowed > 0 ? [{ part: names.fromSavings, cost: cents(price - borrowed), payMonth: buyMonth }] : []),
    ...Array.from({ length: o.term }, (_, i) => ({
      part: label(i + 1, o.term),
      cost: cents(payment),
      payMonth: addMonths(buyMonth, i + 1),
      installment,
    })),
  ];

  if (choice === "now") return buyNow(month);
  if (choice === "save") return buyNow(o.save.readyMonth ?? month);
  const bank = o.bank.find((l) => l.months === o.term);
  if (choice === "bank") return financed(month, o.borrow, bank?.payment ?? 0, names.loan, "bank");
  if (choice === "friend") return financed(month, o.borrow, o.friend.perMonth, names.friend, "friend");
  const combo = o.combos.find((c) => `combo-${c.wait}` === choice);
  return combo ? financed(combo.buyMonth, combo.borrow, combo.payment, names.loan, "bank") : buyNow(month);
};

/**
 * Every project: the saved records, plus any known only from its parts or bill (budgets saved before projects had
 * records). Records first, then the rest in the order they appear.
 */
export const projectsOf = (b: Budget): Project[] => {
  const all = new Map((b.projects ?? []).map((p) => [p.id, p]));
  for (const part of b.parts) {
    if (!all.has(part.projectId)) {
      all.set(part.projectId, { id: part.projectId, name: part.project, startedDate: part.startedDate });
    }
  }
  for (const bill of b.bills) {
    if (bill.projectId && !all.has(bill.projectId)) {
      all.set(bill.projectId, { id: bill.projectId, name: bill.project ?? bill.name });
    }
  }
  return [...all.values()];
};

/** Started = the user pressed Start (older data: a started part, or instalments that already became a bill). */
export const projectStarted = (b: Budget, projectId: string) =>
  Boolean(projectsOf(b).find((p) => p.id === projectId)?.startedDate) ||
  b.parts.some((p) => p.projectId === projectId && p.startedDate) ||
  b.bills.some((bill) => bill.projectId === projectId);

export type ProjectStatus = "inactive" | "active" | "completed" | "archived";

/** Months of a bill from `from` to `to` (inclusive) that fall inside the bill's own start / end. */
const billMonthsBetween = (bill: Bill, from: string, to: string) => {
  const first = bill.startMonth && bill.startMonth > from ? bill.startMonth : from;
  const last = bill.endMonth && bill.endMonth < to ? bill.endMonth : to;
  let count = 0;
  for (let m = first; m <= last; m = addMonths(m, 1)) count++;
  return count;
};

/**
 * One project's money at a glance. Paid = paid parts + its bills' months already past (bill payments aren't
 * recorded one by one, so a month that has passed counts as paid); left = unpaid parts + bill months from this one
 * on. Status: archived wins; not started = inactive; anything left = active; else completed.
 */
export const projectSummary = (b: Budget, project: Project, today: string) => {
  const month = monthOf(today);
  const parts = b.parts.filter((p) => p.projectId === project.id);
  // A bill without an end month (only from manual edits) has no "left" to count.
  const bills = b.bills.filter((bill) => bill.projectId === project.id && bill.active && bill.endMonth);
  // Instalment parts track the bill's payments one by one: then they carry the money, the bill is only shown.
  const billMoney = parts.some((p) => p.installment) ? [] : bills;
  const planned = parts.filter((p) => p.status === "Planned");
  const billsPaid = billMoney.reduce(
    (t, bill) => t + bill.amount * billMonthsBetween(bill, bill.startMonth ?? month, addMonths(month, -1)),
    0
  );
  const billsLeft = billMoney.reduce(
    (t, bill) => t + bill.amount * billMonthsBetween(bill, month, bill.endMonth ?? month),
    0
  );
  const paid = parts.filter((p) => p.status === "Paid").reduce((t, p) => t + p.cost, 0) + billsPaid;
  const left = planned.reduce((t, p) => t + p.cost, 0) + billsLeft;

  const next =
    [
      ...planned.map((p) => ({ month: p.payMonth < month ? month : p.payMonth, amount: p.cost })),
      ...billMoney
        .filter((bill) => (bill.endMonth ?? month) >= month)
        .map((bill) => ({
          month: bill.startMonth && bill.startMonth > month ? bill.startMonth : month,
          amount: bill.amount,
        })),
    ].sort((a, z) => a.month.localeCompare(z.month))[0] ?? null;

  const started = projectStarted(b, project.id);
  const status: ProjectStatus = project.archivedDate
    ? "archived"
    : !started
      ? "inactive"
      : left > 0
        ? "active"
        : "completed";
  const total = paid + left;
  return { project, status, started, parts, bills, paid, left, total, progress: total > 0 ? paid / total : 0, next };
};

export type Lender = NonNullable<ProjectPart["installment"]>;

/**
 * What starting a project changes besides marking it started:
 * - loan / friend instalments: one recurring bill per lender, over the instalments' months;
 * - every planned part due after this month: split into equal monthly payments from this month to its month
 *   (the last one takes the rounding), with its own recurring bill. Each payment is then paid on its own.
 * Bills are due on today's day, capped at 28 so it exists every month. `name(lender, partName)` names a bill.
 */
export const projectStart = (
  b: Budget,
  projectId: string,
  today: string,
  name: (lender: Lender, part: string) => string
) => {
  const month = monthOf(today);
  const dueDay = Math.min(28, Number(today.slice(8, 10)));
  const planned = b.parts.filter((p) => p.projectId === projectId && p.status === "Planned");
  const bill = (lender: Lender, payments: ProjectPart[], label: string) => {
    const months = payments.map((p) => p.payMonth).sort();
    return {
      name: name(lender, label),
      amount: payments[0].cost,
      dueDay,
      category: "Other",
      active: true,
      startMonth: months[0],
      endMonth: months[months.length - 1],
      projectId,
      project: payments[0].project,
    } satisfies Omit<Bill, "id">;
  };

  const loans = planned.filter((p) => p.installment);
  const lenders = [...new Set(loans.map((p) => p.installment as Lender))];

  const split = planned
    .filter((p) => !p.installment && p.payMonth > month)
    .map((part) => {
      const count = monthsBetween(month, part.payMonth);
      const round = part.cost >= 1000 ? Math.round : cents; // whole units for big amounts, cents for small ones
      const share = round(part.cost / count);
      const payments: ProjectPart[] = Array.from({ length: count }, (_, i) => ({
        ...part,
        partId: `${part.partId}-${i + 1}`,
        part: `${part.part} ${i + 1}/${count}`,
        cost: i < count - 1 ? share : cents(part.cost - share * (count - 1)),
        payMonth: addMonths(month, i),
        installment: "saving" as const,
      }));
      return { from: part.partId, payments, bill: bill("saving", payments, part.part) };
    });

  return {
    split,
    bills: [
      ...lenders.map((lender) =>
        bill(
          lender,
          loans.filter((p) => p.installment === lender),
          ""
        )
      ),
      ...split.map((s) => s.bill),
    ],
  };
};

/** Months from `from` to `to`, both counted. */
const monthsBetween = (from: string, to: string) => {
  let count = 0;
  for (let m = from; m <= to; m = addMonths(m, 1)) count++;
  return count;
};

/**
 * The budget after starting a project (see `projectStart`): split parts replaced by their monthly payments
 * (money saved toward a split part moves to its first payment), the bills added with ids from `billId`.
 */
export const applyProjectStart = (
  b: Budget,
  projectId: string,
  today: string,
  name: (lender: Lender, part: string) => string,
  billId: (index: number) => string
): Budget => {
  const { split, bills } = projectStart(b, projectId, today, name);
  const first = new Map(split.map((s) => [s.from, s.payments[0].partId]));
  return {
    ...b,
    parts: b.parts.flatMap((p) => split.find((s) => s.from === p.partId)?.payments ?? [p]),
    entries: b.entries.map((e) => (first.has(e.linkId) ? { ...e, linkId: first.get(e.linkId) ?? e.linkId } : e)),
    bills: [...b.bills, ...bills.map((bill, i) => ({ ...bill, id: billId(i) }))],
  };
};

/**
 * Started projects whose monthly payments became a bill with no payment parts left (started before Start kept
 * them) get them back from the bill: one unpaid part per month from its start to its end month. Part ids derive
 * from the bill's, so two devices repairing the same project create the same parts.
 */
export const restoreInstallments = (b: Budget): Budget => {
  const added: ProjectPart[] = [];
  for (const bill of b.bills) {
    const { projectId, startMonth, endMonth } = bill;
    if (!projectId || !startMonth || !endMonth || endMonth < startMonth) continue;
    if (b.parts.some((p) => p.projectId === projectId && p.installment)) continue;
    const months: string[] = [];
    for (let m = startMonth; m <= endMonth && months.length < 600; m = addMonths(m, 1)) months.push(m);
    months.forEach((payMonth, i) => {
      added.push({
        projectId,
        project: bill.project ?? bill.name,
        partId: `${bill.id}-${i + 1}`,
        part: `${bill.name} ${i + 1}/${months.length}`,
        cost: bill.amount,
        payMonth,
        status: "Planned",
        paidDate: "",
        installment: "bank",
      });
    });
  }
  return added.length > 0 ? { ...b, parts: [...b.parts, ...added] } : b;
};

/**
 * Projects started before Start split later parts into monthly payments (started, no bill yet, a part due after
 * this month) get split now, as if started today. Ids derive from the project's, so devices agree.
 */
export const splitStartedProjects = (b: Budget, today: string): Budget => {
  let next = b;
  for (const project of projectsOf(b)) {
    if (!project.startedDate || next.bills.some((bill) => bill.projectId === project.id)) continue;
    const later = next.parts.some(
      (p) => p.projectId === project.id && p.status === "Planned" && !p.installment && p.payMonth > monthOf(today)
    );
    if (!later) continue;
    next = applyProjectStart(
      next,
      project.id,
      today,
      (_, part) => part || project.name,
      (i) => `${project.id}-b${i + 1}`
    );
  }
  return next;
};

/** Everything older data needs to match how started projects work now. */
export const repairProjects = (b: Budget, today: string) => splitStartedProjects(restoreInstallments(b), today);

/**
 * Where a payment's money comes from. "savings": as much as savings allow without touching the cushion (plus what
 * was saved for it), the rest from this month; "month": all from this month's money.
 */
export type PaySource = "savings" | "month";
export const paymentSplit = (b: Budget, cost: number, linkId: string, source: PaySource) => {
  const savings = source === "savings" ? fromSavings(b, cost, linkId) : 0;
  return { savings, month: cost - savings };
};

export type PlanMonth = { month: string; added: number; paid: number; balance: number };

/**
 * Month-by-month project simulation: usable savings + what can still be saved this month, then each later
 * month's income minus bills and usual spending; each unpaid part is paid in its planned month.
 */
/**
 * Priority order: started projects first (their money is committed), then plans in the user's order (the order
 * of the projects list). Archived projects are left out.
 */
export const projectRank = (b: Budget) => {
  const live = projectsOf(b).filter((p) => !p.archivedDate);
  return [...live.filter((p) => projectStarted(b, p.id)), ...live.filter((p) => !projectStarted(b, p.id))];
};

/**
 * Unpaid parts of the projects ranked ahead of `projectId`, by month (overdue ones in `current`). Instalments
 * already in a recurring bill are in every month's bills, so they aren't counted again.
 */
const aheadPayments = (b: Budget, projectId: string, current: string) => {
  const rank = projectRank(b);
  const i = rank.findIndex((p) => p.id === projectId);
  const ahead = new Set((i < 0 ? rank : rank.slice(0, i)).map((p) => p.id));
  const byMonth = new Map<string, number>();
  for (const p of b.parts) {
    if (!ahead.has(p.projectId) || p.status !== "Planned") continue;
    if (p.installment && b.bills.some((bill) => bill.projectId === p.projectId && bill.active)) continue;
    const m = p.payMonth < current ? current : p.payMonth;
    byMonth.set(m, (byMonth.get(m) ?? 0) + p.cost);
  }
  return { count: ahead.size, byMonth };
};

export const projectPlan = (b: Budget, projectId: string, today: string) => {
  const current = monthOf(today);
  const ahead = aheadPayments(b, projectId, current);
  const othersIn = (m: string) => ahead.byMonth.get(m) ?? 0;
  const parts = b.parts.filter((p) => p.projectId === projectId && p.status === "Planned");
  const payMonth = (m: string) => (m < current ? current : m);
  const last = parts.reduce((max, p) => (payMonth(p.payMonth) > max ? payMonth(p.payMonth) : max), current);
  const avg = averageEveryday(b, today);
  // A started project's bill is already subtracted from every month; its unpaid instalment parts are paid below,
  // so add the bill back in those months (the same money, counted once).
  const billed = b.bills.some((bill) => bill.projectId === projectId && bill.active);
  const instalmentsIn = (m: string) =>
    billed ? parts.filter((p) => p.installment && payMonth(p.payMonth) === m).reduce((t, p) => t + p.cost, 0) : 0;
  // Projects ahead of this one are paid first: their parts come out of the same money.
  const startBalance =
    usableSavings(b) + monthSummary(b, today).canStillSave + instalmentsIn(current) - othersIn(current);
  const freeIn = (m: string) => monthIncome(b, m) - monthBills(b, m) + instalmentsIn(m) - avg - othersIn(m);

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
    /** How many projects ahead of this one the plan pays first. */
    ahead: ahead.count,
  };
};

/**
 * One forecast month. `change` = income − bills + toSavings − spending − projects: how much the savings balance
 * moves that month, from its first day (so money already put into savings this month counts).
 */
export type ForecastMonth = {
  month: string;
  balance: number;
  change: number;
  /** This month's income (the salary entered, else Setup's usual income) + extra income. */
  income: number;
  /** Every active bill due that month, Savings bills included. */
  bills: number;
  /** Savings bills: paid like a bill, but the money lands in savings. */
  toSavings: number;
  /**
   * Spending that doesn't go into savings. This month: spent so far + the daily pace to month-end; later: the usual
   * everyday spending. Only the spent part can go past what's left: the projection stops at 0 left.
   */
  spending: number;
  /** Planned project payments due that month. */
  projects: number;
};

/**
 * Savings balance at the end of this month and the next `months − 1`, if what's left each month goes into savings:
 * income − recurring bills (as they start and end) − spending − planned project payments, + Savings bills (their
 * money lands in savings). Expected spending never takes more than is left, so it doesn't eat into savings; only
 * bills, project payments and money already spent can.
 */
export const savingsForecast = (b: Budget, today: string, months: number): ForecastMonth[] => {
  const current = monthOf(today);
  const avg = averageEveryday(b, today);
  const planned = aheadPayments(b, "", current).byMonth; // "" = no project: every ranked project's parts
  const savingsBillsIn = (m: string) =>
    b.bills
      .filter((bill) => bill.active && bill.category === SAVINGS_CATEGORY && due(bill, m))
      .reduce((t, bill) => t + bill.amount, 0);
  /** Expected spending, cut to what's left after bills and project payments (never below 0). */
  const fits = (spend: number, left: number) => Math.min(spend, Math.max(0, left));

  // This month: put into savings so far (moved in − taken out, Savings expenses and paid Savings bills) is part of
  // the month's change, so the month starts from the balance before it.
  const entries = inMonth(b.entries, current);
  const s = monthSummary(b, today);
  const savingExpenses = intoSavings(ofType(entries, "expense"));
  const billsPaidIn = intoSavings(ofType(entries, "bill_paid"));
  const projects = planned.get(current) ?? 0;
  const parts = [
    {
      month: current,
      income: s.income,
      bills: s.bills,
      toSavings: Math.max(billsPaidIn, savingsBillsIn(current)),
      spending: s.spent - savingExpenses + fits(s.projectedSpend - s.spent, s.left - projects),
      projects,
    },
  ];
  for (let m = addMonths(current, 1); parts.length < months; m = addMonths(m, 1)) {
    const income = monthIncome(b, m);
    const bills = monthBills(b, m);
    const due = planned.get(m) ?? 0;
    parts.push({
      month: m,
      income,
      bills,
      toSavings: savingsBillsIn(m),
      spending: fits(avg, income - bills - due),
      projects: due,
    });
  }
  let balance = savingsBalance(b) - (s.saved - s.taken) - savingExpenses - billsPaidIn;
  return parts.map((p) => {
    const change = p.income - p.bills + p.toSavings - p.spending - p.projects;
    balance += change;
    return { ...p, change, balance };
  });
};

/** The project's unpaid parts due before `month` moved to `month`. */
const delayParts = (b: Budget, projectId: string, month: string): Budget => ({
  ...b,
  parts: b.parts.map((p) =>
    p.projectId === projectId && p.status === "Planned" && p.payMonth < month ? { ...p, payMonth: month } : p
  ),
});

/** Waiting longer than this to save up makes a loan the better suggestion (same as an order's default deadline). */
const SAVE_WAIT_LIMIT = 6;

export type Funding = "save" | "bank" | "friend";

/**
 * Ways to cover a plan that isn't covered (savings + salary run short, after the projects ahead of it): save up
 * (pay later, when the money is there), a bank loan or an interest-free loan from a friend (Setup's rate / term),
 * borrowed in the month money first runs short. `null` when there's nothing to cover, the project already started,
 * or it already has loan payments. `best`: saving if the wait is short, else the first loan whose payment fits.
 */
export const projectFunding = (b: Budget, projectId: string, today: string) => {
  const parts = b.parts.filter((p) => p.projectId === projectId);
  if (projectStarted(b, projectId) || parts.some((p) => p.installment)) return null;
  const plan = projectPlan(b, projectId, today);
  const short = plan.months.find((m) => m.balance < 0);
  if (!short || !plan.loan) return null;

  const borrow = cents(plan.loan.amount);
  const { loanRate: rate, loanTermMonths: term } = b.settings;
  const free = usualFreeMoney(b, today);
  const fits = (payment: number) => free > 0 && payment <= LOAN_SHARE_LIMIT * free;

  // ponytail: tries each later month (10 years at most) until delaying the parts makes the plan covered.
  let saveMonth: string | null = null;
  for (let m = addMonths(short.month, 1), i = 0; i < 120; m = addMonths(m, 1), i++) {
    if (projectPlan(delayParts(b, projectId, m), projectId, today).covered) {
      saveMonth = m;
      break;
    }
  }
  const wait = saveMonth ? monthsBetween(short.month, saveMonth) - 1 : Number.POSITIVE_INFINITY;
  const bankPayment = loanPayment(borrow, rate, term);
  const friendPayment = borrow / term;
  const bank = { payment: bankPayment, interest: bankPayment * term - borrow, fits: fits(bankPayment) };
  const friend = { payment: friendPayment, interest: 0, fits: fits(friendPayment) };

  const best: Funding =
    saveMonth && wait <= SAVE_WAIT_LIMIT
      ? "save"
      : bank.fits
        ? "bank"
        : friend.fits
          ? "friend"
          : saveMonth
            ? "save"
            : "friend";
  return { borrow, month: short.month, rate, term, free, save: { month: saveMonth, wait }, bank, friend, best };
};

/**
 * The budget with a project's plan paid the `choice` way (see `projectFunding`). Save: parts due before the
 * month it's affordable move to that month. Bank / friend: the loan pays the earliest parts from the month money
 * runs short (their own share shrinks by it; fully paid ones go), and its monthly repayments become parts from the
 * month after (instalments, so Start turns them into a recurring bill). `label(i, n)` names repayment i of n.
 */
export const fundProject = (
  b: Budget,
  projectId: string,
  choice: Funding,
  today: string,
  label: (i: number, n: number) => string,
  partId: (i: number) => string
): Budget => {
  const f = projectFunding(b, projectId, today);
  if (!f) return b;
  if (choice === "save") return f.save.month ? delayParts(b, projectId, f.save.month) : b;

  const current = monthOf(today);
  const due = (p: ProjectPart) => (p.payMonth < current ? current : p.payMonth);
  const covered = new Map<string, number>();
  let left = f.borrow;
  for (const p of b.parts
    .filter((p) => p.projectId === projectId && p.status === "Planned" && due(p) >= f.month)
    .sort((a, z) => due(a).localeCompare(due(z)))) {
    const c = Math.min(p.cost, left);
    if (c > 0) covered.set(p.partId, c);
    left -= c;
  }
  const payment = cents(choice === "bank" ? f.bank.payment : f.friend.payment);
  const project = projectsOf(b).find((p) => p.id === projectId)?.name ?? "";
  return {
    ...b,
    parts: [
      ...b.parts.flatMap((p) => {
        const c = covered.get(p.partId);
        if (!c) return [p];
        const rest = cents(p.cost - c);
        return rest > 0 ? [{ ...p, cost: rest }] : [];
      }),
      ...Array.from({ length: f.term }, (_, i) => ({
        projectId,
        project,
        partId: partId(i),
        part: label(i + 1, f.term),
        cost: payment,
        payMonth: addMonths(f.month, i + 1),
        status: "Planned" as const,
        paidDate: "",
        installment: choice,
      })),
    ],
  };
};
