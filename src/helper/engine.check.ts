// Self-check for the calculation engine. Run: bun run test
import assert from "node:assert/strict";
import type { Budget } from "@type";
import { periodRange } from "./date";
import {
  affordOptions,
  loanPayment,
  monthBills,
  monthSummary,
  orderVerdict,
  payChoices,
  paymentSplit,
  projectPartsFor,
  projectPlan,
  projectStart,
  projectStarted,
  projectSummary,
  projectsOf,
  savingsBalance,
  usableSavings,
} from "./engine";
import { parseAmount } from "./money";

const budget: Budget = {
  settings: {
    currency: "$",
    usualIncome: 1500,
    openingSavings: 1000,
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
assert.equal(start.remove.length, 12); // the 12 instalments; the savings part stays, to be paid by hand
assert.ok(!start.remove.includes("c0"));
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

console.log("engine: all checks passed");
