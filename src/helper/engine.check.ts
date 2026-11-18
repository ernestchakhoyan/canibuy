// Self-check for the calculation engine. Run: bun run test
import assert from "node:assert/strict";
import type { Budget } from "@type";
import { periodRange } from "./date";
import { loanPayment, monthSummary, orderVerdict, projectPlan, savingsBalance, usableSavings } from "./engine";
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
