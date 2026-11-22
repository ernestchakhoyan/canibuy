// Self-check for the calculation engine. Run: bun run test
import assert from "node:assert/strict";
import type { Budget } from "@type";
import { periodRange } from "./date";
import { defaultBudget } from "./default-budget";
import {
  affordOptions,
  averageEveryday,
  baseCurrency,
  convertBudget,
  cushion,
  fundProject,
  loanPayment,
  monthBills,
  monthSummary,
  orderVerdict,
  payChoices,
  paymentSplit,
  projectFunding,
  projectPartsFor,
  projectPlan,
  projectRank,
  projectStart,
  projectStarted,
  projectSummary,
  projectsOf,
  recordSavingsBills,
  repairProjects,
  restoreInstallments,
  savingsAccounts,
  savingsBalance,
  savingsForecast,
  splitStartedProjects,
  toBase,
  usableSavings,
  withSavingsCategory,
} from "./engine";
import { parseAmount } from "./money";
import { INITIAL_SYNC_META, mergeFromSheet, SHEET_TABS, tabsToWrite } from "./sheet-sync";

const budget: Budget = {
  settings: {
    currency: "$",
    usualIncome: 1500,
    cushionMonths: 1,
    loanRate: 12,
    loanTermMonths: 12,
    startMonth: "2026-09",
  },
  personal: { appMode: "system", locale: "en" },
  bills: [{ id: "b1", name: "Rent", amount: 500, dueDay: 1, category: "Home", active: true }],
  categories: [],
  entries: [
    {
      id: "e1",
      date: "2026-10-05",
      type: "expense",
      category: "Food",
      amount: 400,
      note: "",
      linkId: "",
      createdAt: "",
    },
    {
      id: "e2",
      date: "2026-11-02",
      type: "expense",
      category: "Food",
      amount: 100,
      note: "",
      linkId: "",
      createdAt: "",
    },
    { id: "s1", date: "2026-11-03", type: "saving", category: "", amount: 200, note: "", linkId: "", createdAt: "" },
  ],
  orders: [],
  parts: [],
  savings: [{ id: "s0", name: "Opening", amount: 1000, currency: "USD" }], // savings come from the Savings section
};
const today = "2026-11-10"; // November has 30 days

assert.equal(parseAmount("20,000"), 20000);
assert.equal(parseAmount("$20 000"), 20000);
assert.equal(parseAmount("12,5"), 12.5);
assert.equal(parseAmount("abc"), null);

assert.equal(savingsBalance(budget), 1200);
assert.equal(usableSavings(budget), 700); // 1200 − 1 month of bills

const s = monthSummary(budget, today);
assert.equal(s.left, 1500 - 500 - 100 - 200);
assert.equal(s.daysLeft, 21);
assert.equal(s.projectedSpend, 100 + (100 / 10) * 20);
assert.equal(s.canStillSave, 1500 - 500 - 300 - 200);

assert.equal(Math.round(loanPayment(12000, 12, 12) * 100) / 100, 1066.19);
assert.equal(loanPayment(1200, 0, 12), 100);

// usable 700 + can save 500 = 1200; usual free money = 1500 − 500 − 400 = 600/month
assert.equal(orderVerdict(budget, { price: 1000, deadlineMonths: null }, today).verdict, "pay_now");
const tv = orderVerdict(budget, { price: 3000, deadlineMonths: 4 }, today);
assert.equal(tv.verdict, "save_up");
assert.equal(tv.saveMonths, 3);
assert.equal(orderVerdict(budget, { price: 20000, deadlineMonths: 2 }, today).verdict, "not_affordable");

// Afford options for the same 3000 order: 1800 short after today's 1200; 600 free a month.
const options = affordOptions(budget, { price: 3000, deadlineMonths: 4 }, today);
assert.equal(options.now.shortfall, 1800);
assert.equal(options.monthly.free, 600);
assert.equal(options.save.months, 3); // same as the verdict
assert.equal(options.save.readyMonth, "2027-02");
assert.deepEqual(options.save.deadline, { months: 4, perMonth: 450, fits: true });
assert.equal(options.borrow, 2300); // price − usable savings (cushion kept)
assert.deepEqual(
  options.bank.map((l) => l.months),
  [6, 12, 24, 36]
); // Setup's 12 isn't duplicated
const twelve = options.bank.find((l) => l.months === 12);
assert.equal(Math.round(twelve?.payment ?? 0), 204);
assert.equal(twelve?.fits, true); // 204 ≤ 35% of 600
assert.equal(options.bank[0].fits, false); // 6 months: ~397/mo, too much
assert.equal(Math.round(options.friend.perMonth * 100) / 100, 191.67);
assert.equal(options.friend.fastestMonths, 4);
assert.equal(Math.round(options.friend.interestSaved), Math.round((twelve?.payment ?? 0) * 12 - 2300));
// Save first, then borrow: 3 months to save it all, so waiting 1 or 2 months leaves 1200 / 600 to borrow.
assert.deepEqual(
  options.combos.map((c) => [c.wait, c.buyMonth, c.borrow]),
  [
    [1, "2026-12", 1200],
    [2, "2027-01", 600],
  ]
);
assert.equal(
  Math.round((options.combos[0].payment ?? 0) * 100) / 100,
  Math.round(loanPayment(1200, 12, 12) * 100) / 100
);
assert.equal(options.combos[1].fits, true);
// A long save-up shows at most 6 rows, evenly spread, the last one being the month before no loan is needed.
const long = affordOptions(budget, { price: 15000, deadlineMonths: null }, today);
assert.equal(long.save.months, 23); // (15000 − 1200) / 600
assert.deepEqual(
  long.combos.map((c) => c.wait),
  [4, 7, 11, 15, 18, 22]
);
assert.ok(long.combos.every((c) => c.borrow > 0));
// Affordable now → nothing to combine.
assert.deepEqual(affordOptions(budget, { price: 1000, deadlineMonths: null }, today).combos, []);
// Per-order bank terms override Setup's (12% / 12 months) everywhere the order's loan is priced.
const ownTerms = { price: 3000, deadlineMonths: 4, loanRate: 0, loanTermMonths: 23 };
const own = affordOptions(budget, ownTerms, today);
assert.equal(own.rate, 0);
assert.equal(own.term, 23);
assert.ok(own.bank.some((l) => l.months === 23));
assert.equal(own.friend.interestSaved, 0); // 0% bank loan: nothing to save
assert.equal(orderVerdict(budget, ownTerms, today).loan.payment, 100); // 2300 / 23, no interest
assert.equal(affordOptions(budget, { ...ownTerms, loanRate: null, loanTermMonths: undefined }, today).rate, 12);
// Order → project: each way of paying becomes parts the project plan can simulate.
const names = {
  purchase: "TV",
  fromSavings: "From savings",
  loan: (i: number, n: number) => `Loan ${i}/${n}`,
  friend: (i: number, n: number) => `Friend ${i}/${n}`,
};
assert.deepEqual(payChoices(options), ["save", "bank", "combo-1", "combo-2", "friend"]);
assert.deepEqual(payChoices(affordOptions(budget, { price: 1000, deadlineMonths: null }, today)), ["now"]);
assert.deepEqual(projectPartsFor(options, 3000, "save", today, names), [
  { part: "TV", cost: 3000, payMonth: "2027-02" },
]);
const bankParts = projectPartsFor(options, 3000, "bank", today, names);
assert.equal(bankParts.length, 13); // savings now + 12 payments
assert.deepEqual(bankParts[0], { part: "From savings", cost: 700, payMonth: "2026-11" }); // usable savings
assert.deepEqual(bankParts[1], { part: "Loan 1/12", cost: 204.35, payMonth: "2026-12", installment: "bank" });
assert.equal(bankParts[0].installment, undefined); // the savings part is paid once, not a bill
assert.equal(bankParts[12].payMonth, "2027-11");
const comboParts = projectPartsFor(options, 3000, "combo-2", today, names);
assert.deepEqual(comboParts[0], { part: "From savings", cost: 2400, payMonth: "2027-01" }); // 3000 − 600 borrowed
assert.equal(comboParts[1].payMonth, "2027-02");
const friendParts = projectPartsFor(options, 3000, "friend", today, names);
assert.equal(friendParts[1].cost, 191.67);
assert.equal(friendParts[1].part, "Friend 1/12");
// Starting a financed project: instalments become a bill over their months; other parts are paid by hand.
const started = {
  ...budget,
  parts: [
    ...bankParts.map((p, i) => ({
      ...p,
      projectId: "car",
      project: "Car",
      partId: `c${i}`,
      status: "Planned" as const,
      paidDate: "",
    })),
  ],
};
assert.equal(projectStarted(started, "car"), false);
assert.equal(
  projectStarted({ ...started, parts: started.parts.map((p) => ({ ...p, startedDate: "2026-11-30" })) }, "car"),
  true
);
const start = projectStart(started, "car", "2026-11-30", (lender) => `Car · ${lender}`);
assert.equal(start.bills.length, 1); // one bill per lender; the instalment parts stay, to be paid one by one
assert.deepEqual(start.bills, [
  {
    name: "Car · bank",
    amount: 204.35,
    dueDay: 28,
    category: "Other",
    active: true,
    startMonth: "2026-12",
    endMonth: "2027-11",
    projectId: "car",
    project: "Car", // the card keeps its name even when no parts are left
  },
]);
// Paying a part: from savings uses usable savings (700) and takes the rest from this month; or all from this month.
assert.deepEqual(paymentSplit(budget, 1000, "c0", "savings"), { savings: 700, month: 300 });
assert.deepEqual(paymentSplit(budget, 500, "c0", "savings"), { savings: 500, month: 0 });
assert.deepEqual(paymentSplit(budget, 500, "c0", "month"), { savings: 0, month: 500 });
// A bill with start / end months only counts inside them; the cushion still counts every active bill.
const withLoan = { ...budget, bills: [...budget.bills, { id: "l", ...start.bills[0] }] };
assert.equal(monthBills(withLoan, "2026-11"), 500);
assert.equal(monthBills(withLoan, "2026-12"), 704.35);
assert.equal(monthBills(withLoan, "2027-12"), 500);
assert.equal(monthBills(withLoan), 704.35);
// Usual free money already counts a loan that starts next month: 600 − 204.35.
assert.equal(
  Math.round(affordOptions(withLoan, { price: 100, deadlineMonths: null }, today).monthly.free * 100),
  39565
);
// Project records, statuses and progress.
const proj = (parts: { cost: number; payMonth: string; status: "Planned" | "Paid" }[]) =>
  parts.map((p, i) => ({ ...p, projectId: "k", project: "Kitchen", partId: `k${i}`, part: `P${i}`, paidDate: "" }));
const kitchen = { ...budget, parts: proj([{ cost: 300, payMonth: "2026-11", status: "Planned" }]) };
assert.deepEqual(projectsOf(kitchen), [{ id: "k", name: "Kitchen", startedDate: undefined }]); // older data: no record
const status = (b: typeof budget) => {
  const record = projectsOf(b).find((p) => p.id === "k");
  return record && projectSummary(b, record, today).status;
};
assert.equal(status(kitchen), "inactive");
const kitchenStarted = { ...kitchen, projects: [{ id: "k", name: "Kitchen", startedDate: "2026-11-01" }] };
assert.equal(status(kitchenStarted), "active");
const kitchenPaid = { ...kitchenStarted, parts: proj([{ cost: 300, payMonth: "2026-11", status: "Paid" }]) };
assert.equal(status(kitchenPaid), "completed");
assert.equal(
  status({
    ...kitchenPaid,
    projects: [{ id: "k", name: "Kitchen", startedDate: "2026-11-01", archivedDate: "2026-11-09" }],
  }),
  "archived"
);
// A running bill keeps a fully paid project active; its months still ahead count as left, past ones as paid.
const loanBill = {
  id: "x",
  name: "Loan",
  amount: 100,
  dueDay: 1,
  category: "",
  active: true,
  startMonth: "2026-12",
  endMonth: "2027-02",
  projectId: "k",
};
const billed = { ...kitchenPaid, bills: [loanBill] };
const record = { id: "k", name: "Kitchen", startedDate: "2026-11-01" };
const nov = projectSummary(billed, record, today);
assert.deepEqual([nov.status, nov.paid, nov.left, nov.total], ["active", 300, 300, 600]); // Dec, Jan, Feb ahead
assert.equal(nov.progress, 0.5);
assert.deepEqual(nov.next, { month: "2026-12", amount: 100 });
const jan = projectSummary(billed, record, "2027-01-15");
assert.deepEqual([jan.paid, jan.left], [400, 200]); // December has passed
assert.equal(projectSummary(billed, record, "2027-03-01").status, "completed");
// A project known only from its bill (all parts became the bill) still has a record.
assert.deepEqual(projectsOf({ ...budget, bills: [{ ...loanBill, project: "Car" }] }), [{ id: "k", name: "Car" }]);
// No free money: saving and repaying never finish.
const broke = affordOptions(
  { ...budget, settings: { ...budget.settings, usualIncome: 0 } },
  { price: 3000, deadlineMonths: null },
  today
);
assert.equal(broke.save.months, Number.POSITIVE_INFINITY);
assert.equal(broke.save.readyMonth, null);
assert.equal(
  broke.bank.some((l) => l.fits),
  false
);

const plan = projectPlan(
  {
    ...budget,
    parts: [
      {
        projectId: "r1",
        project: "Reno",
        partId: "p1",
        part: "Paint",
        cost: 1000,
        payMonth: "2026-11",
        status: "Planned",
        paidDate: "",
      },
      {
        projectId: "r1",
        project: "Reno",
        partId: "p2",
        part: "Sofa",
        cost: 2000,
        payMonth: "2026-12",
        status: "Planned",
        paidDate: "",
      },
    ],
  },
  "r1",
  today
);
assert.deepEqual(
  plan.months.map((m) => m.balance),
  [1200 - 1000, 200 + 600 - 2000]
);
assert.equal(plan.loan?.amount, 1200);
assert.equal(plan.affordableMonth, "2027-02"); // 1200 + 3 × 600 ≥ 3000

assert.deepEqual(periodRange("week", "2026-11-18"), ["2026-11-16", "2026-11-22"]);
assert.deepEqual(periodRange("month", "2026-02-10"), ["2026-02-01", "2026-02-28"]);

// Sheet sync rules: a new device never uploads empty tabs; dirty tabs are written and never overwritten.
const local = {
  ...budget,
  savings: [],
  orders: [
    {
      id: "o",
      item: "TV",
      price: 1,
      deadlineMonths: null,
      status: "Planned" as const,
      created: "",
      boughtDate: "",
      note: "",
    },
  ],
};
// First run after the update: orders were already synced (the sheet leads, deleted rows stay deleted); bills and
// entries were never uploaded, so this device's ones go up once.
assert.deepEqual(tabsToWrite(local, INITIAL_SYNC_META), ["bills", "entries", "setup"]);
assert.deepEqual(tabsToWrite(defaultBudget(), INITIAL_SYNC_META), ["setup"]); // fresh device: only its settings, once
assert.deepEqual(tabsToWrite(local, { uploaded: SHEET_TABS, dirty: ["bills"] }), ["bills"]); // later: only what changed
assert.deepEqual(tabsToWrite(local, { uploaded: SHEET_TABS, dirty: ["orders"] }), ["orders"]);
const fromSheet = {
  orders: [],
  projects: [],
  parts: [],
  bills: [],
  entries: [],
  settings: { usualIncome: 4000 },
  categories: [{ name: "Rent", monthlyLimit: 0 }],
  personal: { appMode: "dark" as const, amountsHidden: false },
  savings: [{ id: "s", name: "Cash", amount: 5, currency: "USD" as const }],
};
const merged = mergeFromSheet(local, fromSheet, ["orders"]);
assert.equal(merged.orders.length, 1); // dirty: kept
assert.equal(merged.entries.length, 0); // clean: the sheet wins (rows deleted there go away here)
assert.deepEqual(merged.settings, { ...local.settings, usualIncome: 4000 }); // merged key by key
assert.deepEqual(merged.categories, [
  { name: "Rent", monthlyLimit: 0 },
  { name: "Savings", monthlyLimit: 0 }, // built-in: re-added when the sheet lacks it
]);
assert.deepEqual(
  mergeFromSheet(local, { ...fromSheet, settings: null, categories: null, personal: null, savings: null }, [])
    .categories,
  withSavingsCategory(local).categories
); // no block: keep
assert.equal(mergeFromSheet(local, fromSheet, ["setup"]).settings, local.settings); // dirty: kept
assert.deepEqual(merged.personal, { ...local.personal, appMode: "dark", amountsHidden: false }); // key by key: locale kept
assert.equal(mergeFromSheet(local, fromSheet, ["personal"]).personal, local.personal); // dirty: kept
assert.deepEqual(merged.savings, fromSheet.savings);
assert.equal(mergeFromSheet(local, { ...fromSheet, savings: null }, []).savings, local.savings); // no tab: keep

// Savings per currency: converted to the base currency (Setup's "$" here) and added to the savings balance.
const rates = { base: "USD" as const, date: "2026-11-19", perBase: { AMD: 400, EUR: 0.8 } };
const withSavings = {
  ...budget,
  rates,
  savings: [
    ...(budget.savings ?? []),
    { id: "s1", name: "Cash", amount: 100, currency: "USD" as const },
    { id: "s2", name: "Deposit", amount: 40000, currency: "AMD" as const },
    { id: "s3", name: "Euro", amount: 80, currency: "EUR" as const },
    { id: "s4", name: "Pounds", amount: 10, currency: "GBP" as const }, // no rate for GBP
  ],
};
assert.equal(baseCurrency(withSavings), "USD");
assert.equal(toBase(withSavings, 40000, "AMD"), 100);
assert.equal(toBase(withSavings, 100, "USD"), 100); // same currency: no rate needed
const accounts = savingsAccounts(withSavings);
assert.equal(accounts.total, 1300); // 1000 + 100 + 100 + 100; GBP left out
assert.deepEqual(accounts.unconverted, ["GBP"]);
assert.equal(savingsBalance(withSavings), savingsBalance(budget) + 300);
assert.equal(usableSavings(withSavings), usableSavings(budget) + 300); // every calculation sees the converted total
assert.equal(toBase({ ...withSavings, rates: { ...rates, base: "EUR" } }, 40000, "AMD"), null); // stale base: no guess
assert.equal(baseCurrency({ ...budget, settings: { ...budget.settings, currency: "¤" } }), null); // custom symbol

// Switching the base currency converts every base amount; savings per currency and non-money numbers don't change.
const inAmd = convertBudget(withSavings, 400, "֏"); // 1 USD = 400 AMD
assert.equal(inAmd.settings.currency, "֏");
assert.equal(inAmd.settings.usualIncome, 1500 * 400);
assert.equal(inAmd.settings.cushionMonths, withSavings.settings.cushionMonths);
assert.equal(inAmd.settings.loanRate, withSavings.settings.loanRate);
assert.equal(inAmd.bills[0].amount, 500 * 400);
assert.deepEqual(
  inAmd.entries.map((e) => e.amount),
  [400 * 400, 100 * 400, 200 * 400]
);
assert.equal(inAmd.savings, withSavings.savings);
assert.equal(convertBudget(budget, 1 / 3, "x").settings.usualIncome, 500); // rounded to cents
assert.equal(convertBudget(budget, 359.0876, "֏").bills[0].amount, 179544); // whole drams (500 × 359.0876)
assert.equal(convertBudget(budget, 1 / 359.0876, "$").bills[0].amount, 1.39); // dollars keep cents
// Same money, new currency: the savings balance in AMD = the USD one × 400 (at a matching AMD-based rate).
const amdRates = { base: "AMD" as const, date: "2026-11-19", perBase: { USD: 1 / 400, EUR: 0.8 / 400 } };
assert.equal(Math.round(savingsBalance({ ...inAmd, rates: amdRates })), Math.round(savingsBalance(withSavings) * 400));

// A started save-up project (one ֏10,000,000 part in April 2028, no bill): split into monthly payments from
// this month, with a recurring bill; the payments add up to the price exactly.
const saveUp = {
  ...budget,
  projects: [{ id: "car2", name: "Car", startedDate: "2026-11-19" }],
  parts: [
    {
      projectId: "car2",
      project: "Car",
      partId: "p1",
      part: "Car",
      cost: 10_000_000,
      payMonth: "2028-04",
      status: "Planned" as const,
      paidDate: "",
    },
  ],
};
const splitUp = splitStartedProjects(saveUp, today);
const payments = splitUp.parts.filter((p) => p.projectId === "car2");
assert.equal(payments.length, 18); // Nov 2026 … Apr 2028
assert.deepEqual([payments[0].payMonth, payments[17].payMonth], ["2026-11", "2028-04"]);
assert.equal(payments[0].cost, 555_556);
assert.equal(
  payments.reduce((t, p) => t + p.cost, 0),
  10_000_000
);
assert.ok(payments.every((p) => p.installment === "saving" && p.status === "Planned"));
assert.deepEqual(
  splitUp.bills.filter((x) => x.projectId === "car2").map((x) => [x.id, x.amount, x.startMonth, x.endMonth]),
  [["car2-b1", 555_556, "2026-11", "2028-04"]]
);
assert.equal(splitStartedProjects(splitUp, today), splitUp); // has a bill now: never split again
assert.equal(splitStartedProjects({ ...saveUp, projects: [{ id: "car2", name: "Car" }] }, today).parts.length, 1); // not started: left alone
// Counted once: the bill is in each month's bills, the payments carry the project's money.
const splitSummary = projectSummary(splitUp, { id: "car2", name: "Car", startedDate: "2026-11-19" }, today);
assert.deepEqual([splitSummary.status, splitSummary.left, splitSummary.paid], ["active", 10_000_000, 0]);
assert.deepEqual(splitSummary.next, { month: "2026-11", amount: 555_556 });
assert.equal(repairProjects(splitUp, today), splitUp);

// Started loan: the bill and its instalment parts are the same money, counted once.
const startLoanBill = { id: "lb", ...start.bills[0] };
const startedCar = {
  ...started,
  projects: [{ id: "car", name: "Car", startedDate: "2026-11-30" }],
  bills: [...started.bills, startLoanBill],
};
const carSummary = projectSummary(startedCar, { id: "car", name: "Car", startedDate: "2026-11-30" }, today);
assert.equal(Math.round(carSummary.left), Math.round(700 + 204.35 * 12)); // the parts only, not the bill again
// Adding the bill doesn't charge the same payments twice (and a project's bill isn't in the safety cushion).
assert.deepEqual(
  projectPlan(startedCar, "car", today).months.map((m) => Math.round(m.balance)),
  projectPlan(started, "car", today).months.map((m) => Math.round(m.balance))
);
assert.equal(cushion(startedCar), cushion(started)); // only regular bills (Rent) count
// Repair: a started loan whose instalments became a bill gets them back, once, with stable ids.
const lost = { ...startedCar, parts: startedCar.parts.filter((p) => !p.installment) };
const restored = restoreInstallments(lost).parts.filter((p) => p.installment);
assert.equal(restored.length, 12);
assert.deepEqual(
  [restored[0].partId, restored[0].payMonth, restored[0].cost, restored[0].status],
  ["lb-1", "2026-12", 204.35, "Planned"]
);
assert.equal(restoreInstallments(startedCar), startedCar); // instalments present: untouched

// Priority and funding. 1200 available this month, 600 free a month after. Plan A (3000 in Dec) is ranked ahead
// of plan B (600 in Dec): B alone fits, but not after A's part.
const part = (projectId: string, partId: string, cost: number, payMonth: string) => ({
  projectId,
  project: projectId,
  partId,
  part: partId,
  cost,
  payMonth,
  status: "Planned" as const,
  paidDate: "",
});
const two: Budget = {
  ...budget,
  projects: [
    { id: "A", name: "A" },
    { id: "B", name: "B" },
  ],
  parts: [part("A", "a1", 3000, "2026-12"), part("B", "b1", 600, "2026-12")],
};
assert.deepEqual(
  projectRank(two).map((p) => p.id),
  ["A", "B"]
);
assert.equal(projectPlan({ ...two, parts: [two.parts[1]] }, "B", today).covered, true);
const planB = projectPlan(two, "B", today);
assert.equal(planB.covered, false); // A's 3000 is paid first
assert.equal(planB.ahead, 1);
assert.equal(projectPlan(two, "A", today).ahead, 0); // B is behind: not counted
// A started → ranked first even when listed after B.
assert.deepEqual(
  projectRank({
    ...two,
    projects: [two.projects?.[1], { id: "A", name: "A", startedDate: today }] as Budget["projects"],
  }).map((p) => p.id),
  ["A", "B"]
);

// A: 1200 short in Dec. Save: Nov 1200, Dec 1800, Jan 2400, Feb 3000 → pay in Feb, a 2-month wait (the best).
const fundA = projectFunding(two, "A", today);
assert.ok(fundA);
assert.equal(fundA.month, "2026-12");
assert.equal(fundA.borrow, 1200);
assert.deepEqual(fundA.save, { month: "2027-02", wait: 2 });
assert.equal(fundA.best, "save");
assert.equal(Math.round(fundA.bank.payment * 100) / 100, 106.62);
assert.equal(fundA.friend.payment, 100);
const savedA = fundProject(two, "A", "save", today, String, String);
assert.equal(savedA.parts.find((p) => p.partId === "a1")?.payMonth, "2027-02");
assert.equal(projectPlan(savedA, "A", today).covered, true);
// Bank: the loan pays 1200 of the Dec part; 12 repayments from Jan.
const bankA = fundProject(
  two,
  "A",
  "bank",
  today,
  (i, n) => `Loan ${i}/${n}`,
  (i) => `l${i}`
);
const aParts = bankA.parts.filter((p) => p.projectId === "A");
assert.equal(aParts[0].cost, 1800);
assert.equal(aParts.length, 13);
assert.deepEqual(
  [aParts[1].part, aParts[1].cost, aParts[1].payMonth, aParts[1].installment],
  ["Loan 1/12", 106.62, "2027-01", "bank"]
);
assert.equal(projectFunding(bankA, "A", today), null); // already financed
assert.equal(fundProject(bankA, "A", "friend", today, String, String), bankA);

// Savings category: an expense / bill in it comes out of the month and goes into savings (not the cushion).
const deposit = {
  id: "b9",
  name: "Deposit",
  amount: 100,
  dueDay: 15,
  category: "Savings",
  active: true,
  startMonth: "2026-10",
};
const intoSavings: Budget = recordSavingsBills(
  {
    ...budget,
    bills: [...budget.bills, deposit],
    entries: [
      ...budget.entries,
      {
        id: "e9",
        date: "2026-11-02",
        type: "expense",
        category: "Savings",
        amount: 50,
        note: "",
        linkId: "",
        createdAt: "",
      },
    ],
  },
  today
);
// Due on the 15th: October is recorded, November (today is the 10th) not yet.
assert.deepEqual(
  intoSavings.entries.filter((e) => e.linkId === "b9").map((e) => e.date),
  ["2026-10-15"]
);
assert.equal(recordSavingsBills(intoSavings, today), intoSavings); // nothing new: no duplicates
const later = recordSavingsBills(intoSavings, "2026-12-20");
assert.equal(later.entries.filter((e) => e.linkId === "b9").length, 3); // + Nov 15, Dec 15
assert.equal(savingsBalance(intoSavings), savingsBalance(budget) + 50 + 100);
// Deactivating keeps what was already paid in; no new payments are recorded.
const off = { ...intoSavings, bills: intoSavings.bills.map((x) => (x.id === "b9" ? { ...x, active: false } : x)) };
assert.equal(savingsBalance(recordSavingsBills(off, "2026-12-20")), savingsBalance(intoSavings));
assert.equal(monthSummary(intoSavings, today).left, monthSummary(budget, today).left - 50 - 100);
assert.equal(monthSummary(intoSavings, today).projectedSpend, monthSummary(budget, today).projectedSpend + 50);
assert.equal(cushion(intoSavings), cushion(budget));
// Forecast: each month's change = income − bills + Savings bills − spending − project payments, from the month's
// first day; what's left goes into savings.
const forecast = savingsForecast(intoSavings, today, 3);
assert.deepEqual(
  forecast.map((f) => f.month),
  ["2026-11", "2026-12", "2027-01"]
);
for (const f of forecast) assert.equal(f.change, f.income - f.bills + f.toSavings - f.spending - f.projects);
// November: 150 spent (50 of it into savings) + 200 more at the daily pace; 550 left covers it.
assert.deepEqual(
  [forecast[0].income, forecast[0].bills, forecast[0].toSavings, forecast[0].spending],
  [1500, 600, 100, 300]
);
assert.equal(forecast[0].change, 700);
// Already put into savings this month (saved 200, Savings expense 50) is part of November's change, not on top.
assert.equal(forecast[0].balance, savingsBalance(intoSavings) - 200 - 50 + 700);
assert.equal(forecast[1].change, 1500 - 600 + 100 - averageEveryday(intoSavings, today));
assert.equal(forecast[1].balance, forecast[0].balance + forecast[1].change);
// Spent nearly everything: the projection stops at what's left (50), so the month adds just what went into savings.
const spentAll = {
  ...intoSavings,
  entries: [
    ...intoSavings.entries,
    {
      id: "big",
      date: "2026-11-03",
      type: "expense" as const,
      category: "Fun",
      amount: 500,
      note: "",
      linkId: "",
      createdAt: "",
    },
  ],
};
const [spentNov] = savingsForecast(spentAll, today, 1);
assert.equal(spentNov.change, 200 + 50 + 100); // saved + Savings expense + Deposit bill
assert.equal(spentNov.balance, savingsBalance(spentAll) + 100); // + the Deposit still due this month
// No past month with expenses: this month's pace (spent so far, extended to the whole month) is the usual spending.
const fresh = { ...budget, settings: { ...budget.settings, startMonth: "2026-11" } };
assert.equal(averageEveryday(fresh, today), (100 / 10) * 30); // 100 by the 10th of a 30-day month
assert.equal(averageEveryday({ ...fresh, entries: [] }, today), 0); // nothing to go on yet
const endsLoan = {
  ...budget,
  bills: [...budget.bills, { ...budget.bills[0], id: "l", amount: 200, endMonth: "2026-12" }],
};
const [f0, f1, f2] = savingsForecast(endsLoan, today, 3).map((f) => f.balance);
assert.equal(f2 - f1 - (f1 - f0), 200); // the 200 bill ends in December: January saves 200 more
assert.ok(defaultBudget().categories.some((c) => c.name === "Savings"));
assert.equal(withSavingsCategory(budget).categories.at(-1)?.name, "Savings");
assert.equal(withSavingsCategory(defaultBudget()).categories.filter((c) => c.name === "Savings").length, 1);

console.log("engine: all checks passed");
