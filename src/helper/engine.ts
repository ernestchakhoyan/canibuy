import type { Bill, Budget, CurrencyCode, Entry, EntryType, Order, Project, ProjectPart } from "@type";
import { addMonths, daysInMonth, monthOf } from "./date";

// Calculation rules from PRD section 7. Everything is derived from raw rows; nothing calculated is stored.

/** Rounds money to cents. */
const cents = (n: number) => Math.round(n * 100) / 100;

const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.amount, 0);
const ofType = (entries: Entry[], type: EntryType) => entries.filter((e) => e.type === type);
const inMonth = (entries: Entry[], month: string) => entries.filter((e) => monthOf(e.date) === month);

/** Expenses not tied to an order or project part: the everyday spending used for projections. */
const everyday = (entries: Entry[]) => ofType(entries, "expense").filter((e) => !e.linkId);

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
      openingSavings: convert(b.settings.openingSavings),
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

/** Setup's "current savings" + money moved in / out of savings + savings kept per currency (converted). */
export const savingsBalance = (b: Budget) =>
  b.settings.openingSavings +
  sum(ofType(b.entries, "saving")) -
  sum(ofType(b.entries, "withdrawal")) +
  savingsAccounts(b).total;

/**
 * Safety cushion: `cushionMonths` of the regular bills (rent, utilities…). A project's payment bills aren't in it:
 * they're a plan you chose, not a cost of living the cushion has to carry you through.
 */
export const cushion = (b: Budget) =>
  b.settings.cushionMonths *
  b.bills.filter((bill) => bill.active && !bill.projectId).reduce((t, bill) => t + bill.amount, 0);

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
  b.settings.usualIncome - ongoingBills(b, month) - averageEveryday(b, month);

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
  const month = monthOf(today);
  const usable = usableSavings(b);
  const canSave = monthSummary(b, today).canStillSave;
  const free = usualFreeMoney(b, month);
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
  const spending = averageEveryday(b, month);
  const free = usualFreeMoney(b, month);
  const shortfall = Math.max(0, order.price - usable - canSave);
  const saveMonths = shortfall === 0 ? 0 : free > 0 ? Math.ceil(shortfall / free) : Number.POSITIVE_INFINITY;
  const borrow = Math.max(0, order.price - usable);
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
        perMonth: shortfall / order.deadlineMonths,
        fits: shortfall === 0 || (free > 0 && shortfall / order.deadlineMonths <= free),
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
    const amount = order.price - usable - canSave - free * wait;
    return { wait, buyMonth: addMonths(month, wait), borrow: amount, ...loanFor(amount) };
  });

  return {
    combos,
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
  // Affordable now → just buy; a loan is only a way to cover money that's actually missing.
  if (o.now.shortfall === 0) return ["now"];
  return [
    ...(o.save.readyMonth ? (["save"] as const) : []),
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
export const projectPlan = (b: Budget, projectId: string, today: string) => {
  const current = monthOf(today);
  const parts = b.parts.filter((p) => p.projectId === projectId && p.status === "Planned");
  const payMonth = (m: string) => (m < current ? current : m);
  const last = parts.reduce((max, p) => (payMonth(p.payMonth) > max ? payMonth(p.payMonth) : max), current);
  const avg = averageEveryday(b, current);
  // A started project's bill is already subtracted from every month; its unpaid instalment parts are paid below,
  // so add the bill back in those months (the same money, counted once).
  const billed = b.bills.some((bill) => bill.projectId === projectId && bill.active);
  const instalmentsIn = (m: string) =>
    billed ? parts.filter((p) => p.installment && payMonth(p.payMonth) === m).reduce((t, p) => t + p.cost, 0) : 0;
  const startBalance = usableSavings(b) + monthSummary(b, today).canStillSave + instalmentsIn(current);
  const freeIn = (m: string) => monthIncome(b, m) - monthBills(b, m) + instalmentsIn(m) - avg;

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
