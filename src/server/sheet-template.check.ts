// Self-check for the Google Sheet template. Run: bun run test
import assert from "node:assert/strict";
import { defaultBudget } from "@helper";
import {
  BILL_COLUMNS,
  billNamedRanges,
  billsUpdate,
  buildSpreadsheet,
  CATEGORY_COLUMN,
  ENTRY_COLUMNS,
  entriesUpdate,
  MONTH_CELL,
  ORDER_COLUMNS,
  ordersUpdate as ordersUpdateFn,
  PART_COLUMNS,
  PERSONAL_COLUMN,
  PROJECT_COLUMNS,
  parseSheet,
  personalUpdate,
  projectsUpdate,
  resetRequests,
  SAVING_COLUMNS,
  savingsUpdate,
  setupUpdate,
  TEMPLATE_VERSION,
} from "./sheet-template";

const body = buildSpreadsheet(defaultBudget(), "2026-11");
const titles = body.sheets.map((s) => s.properties.title);
assert.deepEqual(titles, [
  "Setup",
  "Orders",
  "Projects",
  "Project parts",
  "Bills",
  "Savings",
  "_MonthTemplate",
  "2026-11",
]);
const PARTS = 3;
const BILLS = 4;
const SAVINGS = 5;
const TEMPLATE = 6;
const MONTH = 7;
assert.equal(body.sheets[TEMPLATE].properties.hidden, true);
for (const s of body.sheets) {
  assert.equal(s.properties.gridProperties.frozenRowCount, 1, `${s.properties.title} freezes row 1`);
  assert.equal(s.protectedRanges[0].warningOnly, true);
}

type CellData = { userEnteredValue?: Record<string, unknown> };
const valueAt = (sheet: number, row: number, col: number) => {
  const c = body.sheets[sheet].data[0].rowData[row]?.values[col] as CellData | undefined;
  return c?.userEnteredValue && Object.values(c.userEnteredValue)[0];
};
const range = (name: string) => {
  const r = body.namedRanges.find((n) => n.name === name)?.range;
  assert.ok(r, `named range ${name}`);
  return r;
};

// Named ranges point at the right cells.
const usual = range("UsualIncome");
assert.equal(valueAt(0, usual.startRowIndex, 0), "usual_income");
assert.equal(usual.startColumnIndex, 1);
// Bill ranges live on the Bills tab now (v2); month formulas use them.
for (const [name, column] of [
  ["Bills_amount", "amount"],
  ["Bills_active", "active"],
  ["Bills_start", "start_month"],
  ["Bills_end", "end_month"],
]) {
  assert.equal(range(name).sheetId, body.sheets[BILLS].properties.sheetId, name);
  assert.equal(valueAt(BILLS, 0, range(name).startColumnIndex), column, name);
  assert.equal(range(name).startRowIndex, 1, name);
}
assert.equal(valueAt(BILLS, 0, BILL_COLUMNS.length - 1), "project");
assert.equal(valueAt(0, 0, 3), undefined); // Setup D–I no longer holds bills
assert.equal(valueAt(0, 0, range("Categories").startColumnIndex), "name");
assert.equal(valueAt(0, 7, 1), TEMPLATE_VERSION);
assert.equal(valueAt(0, 1, 10), "Food"); // default categories written
assert.equal(range("Personal").startColumnIndex, 13);
assert.equal(valueAt(0, 1, 13), "app_mode");
assert.equal(valueAt(0, 1, 14), "system");
assert.equal(valueAt(0, 2, 13), "locale");
assert.equal(valueAt(0, 3, 13), "amounts_hidden");
assert.equal(valueAt(0, 3, 14), true); // amounts start hidden
// personalUpdate rewrites the same cells the template creates (N–O).
assert.equal(range("Personal").startColumnIndex, PERSONAL_COLUMN);
const personalReq = personalUpdate(0, { appMode: "dark", locale: "hy", amountsHidden: false })[0].updateCells;
assert.deepEqual([personalReq.range.startColumnIndex, personalReq.range.endColumnIndex], [13, 15]);
assert.deepEqual(personalReq.rows[3].values, [
  { userEnteredValue: { stringValue: "amounts_hidden" } },
  { userEnteredValue: { boolValue: false } },
]);

// Month tab: ledger header in A–H, summary in J–K with "Left" on row 7 referencing K2–K6, its month in K8.
assert.equal(valueAt(MONTH, 0, 0), "id");
assert.equal(valueAt(MONTH, 0, 7), "created_at");
assert.equal(valueAt(MONTH, 1, 9), "Income");
assert.equal(valueAt(MONTH, 6, 9), "Left");
assert.equal(valueAt(MONTH, 6, 10), "=K2-K3-K4-K5+K6");
assert.equal(valueAt(MONTH, MONTH_CELL.row, MONTH_CELL.column), "2026-11");
assert.equal(valueAt(TEMPLATE, MONTH_CELL.row, MONTH_CELL.column), ""); // set when a month tab is copied
assert.match(String(valueAt(MONTH, 2, 10)), /Bills_start<=K8/); // bills only count in their months
// start_month is text, so Sheets doesn't turn "2026-11" into a date.
assert.deepEqual(body.sheets[0].data[0].rowData[6].values[1], {
  userEnteredValue: { stringValue: defaultBudget().settings.startMonth },
});

// Orders sync: same columns as the template header, rows from row 2, user text never parsed as a formula.
assert.equal(valueAt(1, 0, 0), "id");
assert.equal(valueAt(1, 0, ORDER_COLUMNS.length - 1), "loan_term_months");
const sync = ordersUpdateFn([
  {
    id: "o1",
    item: "=IMPORTXML(1)",
    price: 500,
    deadlineMonths: null,
    status: "Dropped",
    created: "2026-11-01",
    boughtDate: "",
    note: "",
  },
]).requests[0].updateCells;
assert.equal(sync.range.sheetId, body.sheets[1].properties.sheetId);
assert.equal(sync.range.startRowIndex, 0);
assert.deepEqual(sync.rows[0].values[0], { userEnteredValue: { stringValue: "id" } }); // header row first
assert.ok(!("endRowIndex" in sync.range)); // open-ended: rows past the list are cleared
assert.equal(sync.rows[1].values.length, ORDER_COLUMNS.length);
assert.deepEqual(sync.rows[1].values[1], { userEnteredValue: { stringValue: "=IMPORTXML(1)" } });
assert.deepEqual(sync.rows[1].values[3], {});
assert.deepEqual(sync.rows[1].values[8], {}); // no own loan rate → empty, Setup applies // no deadline → empty cell
assert.equal(ordersUpdateFn([]).requests[0].updateCells.rows.length, 1); // header only // removing the last order clears all rows

// Projects sync: Projects = one row per project (totals are formulas over the parts tab), Project parts = one row per
// part. Names never become formulas; the Projects rewrite also clears the old wider one-row-per-part layout.
assert.equal(valueAt(2, 0, PROJECT_COLUMNS.length - 1), "left"); // template header = sync header
assert.equal(valueAt(PARTS, 0, PART_COLUMNS.length - 1), "installment");
const [projectsReq, partsReq] = projectsUpdate(
  2,
  9,
  [
    { id: "p1", name: "=Kitchen", startedDate: "2026-11-19" },
    { id: "p2", name: "Car", startedDate: "2026-11-19", archivedDate: "2026-12-01" },
  ],
  [
    {
      projectId: "p1",
      project: "=Kitchen",
      partId: "a",
      part: "Tiles",
      cost: 1000,
      payMonth: "2026-11",
      status: "Paid",
      paidDate: "2026-11-19",
    },
    {
      projectId: "p1",
      project: "=Kitchen",
      partId: "b",
      part: "Loan 1/12",
      cost: 204.35,
      payMonth: "2026-12",
      status: "Planned",
      paidDate: "",
      installment: "bank",
    },
  ]
).map((r) => r.updateCells);
assert.equal(projectsReq.range.sheetId, 2);
assert.equal(projectsReq.range.endColumnIndex, 11); // clears the old layout's columns too
assert.equal(projectsReq.rows.length, 3); // header + one row per project, however many parts
assert.deepEqual(projectsReq.rows[1].values[1], { userEnteredValue: { stringValue: "=Kitchen" } });
assert.deepEqual(projectsReq.rows[2].values[3], { userEnteredValue: { stringValue: "2026-12-01" } }); // archived
assert.deepEqual(projectsReq.rows[1].values[4], {
  userEnteredValue: { formulaValue: "=SUMIFS('Project parts'!D:D,'Project parts'!A:A,A2)" },
});
assert.deepEqual(projectsReq.rows[2].values[6], { userEnteredValue: { formulaValue: "=E3-F3" } });
assert.equal(partsReq.range.sheetId, 9);
assert.equal(partsReq.rows.length, 3); // header + 2 parts
assert.deepEqual(partsReq.rows[2].values[7], { userEnteredValue: { stringValue: "bank" } });
assert.deepEqual(partsReq.rows[1].values[7], {}); // not an instalment
assert.ok(partsReq.rows.every((r) => r.values.length === PART_COLUMNS.length));

// Bills sync: older sheets' named ranges are updated in place, missing ones added.
const ranges = billNamedRanges(7, [{ name: "Bills_amount", namedRangeId: "r1" }]);
assert.deepEqual(ranges[1], {
  updateNamedRange: {
    namedRange: {
      namedRangeId: "r1",
      name: "Bills_amount",
      range: { sheetId: 7, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
    },
    fields: "range",
  },
});
assert.ok("addNamedRange" in ranges[3]); // Bills_start didn't exist
const loanBill = {
  id: "l",
  name: "=Car loan",
  amount: 204.35,
  dueDay: 19,
  category: "Other",
  active: true,
  startMonth: "2026-12",
  endMonth: "2027-11",
  projectId: "p1",
  project: "Car",
};
const billRows = billsUpdate(7, [loanBill])[0].updateCells.rows;
assert.deepEqual(billRows[1].values[1], { userEnteredValue: { stringValue: "=Car loan" } });
assert.deepEqual(billRows[1].values[5], { userEnteredValue: { boolValue: true } });

// Entries sync: rows go to their month's tab; a new month is copied from the template; an emptied month is cleared.
const entry = (id: string, date: string) => ({
  id,
  date,
  type: "expense" as const,
  category: "Food",
  amount: 10,
  note: "=x",
  linkId: "",
  createdAt: "",
});
let next = 100;
const entryRequests = entriesUpdate(
  [entry("e1", "2026-11-03"), entry("e2", "2026-12-01")],
  [
    { title: "2026-11", sheetId: 4 },
    { title: "2026-10", sheetId: 9 },
    { title: "Orders", sheetId: 1 },
  ],
  3,
  () => next++
) as Record<string, { [k: string]: unknown }>[];
const kinds = entryRequests.map((r) => Object.keys(r)[0]);
assert.deepEqual(kinds, [
  "updateCells",
  "updateCells",
  "duplicateSheet",
  "updateSheetProperties",
  "updateCells",
  "updateCells",
]);
// 2026-10 (sheet 9): emptied → header only
assert.equal((entryRequests[0].updateCells as { range: { sheetId: number }; rows: unknown[] }).range.sheetId, 9);
assert.equal((entryRequests[0].updateCells as { rows: unknown[] }).rows.length, 1);
// 2026-11 (sheet 4): header + e1, ledger columns only (A–H), so the summary J–K is untouched
const nov = entryRequests[1].updateCells as {
  range: { sheetId: number; endColumnIndex: number };
  rows: { values: unknown[] }[];
};
assert.deepEqual([nov.range.sheetId, nov.range.endColumnIndex, nov.rows.length], [4, ENTRY_COLUMNS.length, 2]);
assert.deepEqual(nov.rows[1].values[5], { userEnteredValue: { stringValue: "=x" } });
// 2026-12: copied from the template (sheet 3) as sheet 100, unhidden, K8 = month
assert.deepEqual(entryRequests[2].duplicateSheet, { sourceSheetId: 3, newSheetId: 100, newSheetName: "2026-12" });

// Reading back: columns found by header name, broken rows skipped, a part-less project kept.
const data = parseSheet({
  orders: [
    ["item", "id", "price", "status", "created", "loan_rate"], // shuffled columns: matched by name
    ["Car", "o1", 35000, "Planned", "2026-11-01", ""],
    ["Broken", "o2", "lots", "Planned"],
    ["No id", "", 5, "Planned"],
  ],
  projects: [
    PROJECT_COLUMNS,
    ["p1", "Kitchen", "2026-11-19", "", 1000, 1000, 0],
    ["p2", "Car", "2026-11-19", "2026-12-01", 0, 0, 0],
  ],
  projectParts: [PART_COLUMNS, ["p1", "a", "Tiles", 1000, "2026-11", "Paid", "2026-11-19", ""]],
  bills: [BILL_COLUMNS, ["l", "Car · loan", "2,963.5", 19, "Other", true, "2026-12", "2027-11", "p2", "Car"]],
  months: [
    [ENTRY_COLUMNS, ["e1", "2026-11-03", "expense", "Food", 10, "", "", ""], ["e2", "11/03/2026", "expense", "", 5]],
  ],
});
assert.deepEqual(
  data.orders.map((o) => [o.id, o.price, o.loanRate]),
  [["o1", 35000, null]]
);
assert.deepEqual(
  data.projects.map((p) => [p.id, p.startedDate, p.archivedDate]),
  [
    ["p1", "2026-11-19", undefined],
    ["p2", "2026-11-19", "2026-12-01"],
  ]
);
assert.deepEqual(
  data.parts.map((p) => [p.partId, p.projectId, p.cost]),
  [["a", "p1", 1000]]
);
assert.equal(data.bills[0].amount, 2963.5); // "2,963.5" typed as text
assert.equal(data.bills[0].active, true);
assert.deepEqual(
  data.entries.map((e) => e.id),
  ["e1"]
); // e2's date isn't YYYY-MM-DD

// Setup sync: settings rows in the template's order (UsualIncome stays on row 3), categories in K–L only.
const settings = { ...defaultBudget().settings, currency: "=1", usualIncome: 9500 };
const [settingsReq, categoriesReq] = setupUpdate(0, settings, [{ name: "Food", monthlyLimit: 300 }]) as {
  updateCells: { range: { startColumnIndex: number; endColumnIndex: number }; rows: { values: unknown[] }[] };
}[];
assert.deepEqual(
  [settingsReq.updateCells.range.startColumnIndex, settingsReq.updateCells.range.endColumnIndex],
  [0, 2]
);
assert.deepEqual(settingsReq.updateCells.rows[2].values, [
  { userEnteredValue: { stringValue: "usual_income" } },
  { userEnteredValue: { numberValue: 9500 } },
]);
assert.equal(settingsReq.updateCells.rows[2].values.length, 2);
assert.equal(usual.startRowIndex, 2); // the same row the template's UsualIncome range points at
assert.deepEqual(settingsReq.updateCells.rows[1].values[1], { userEnteredValue: { stringValue: "=1" } }); // never a formula
assert.deepEqual(
  [categoriesReq.updateCells.range.startColumnIndex, categoriesReq.updateCells.range.endColumnIndex],
  [CATEGORY_COLUMN, CATEGORY_COLUMN + 2]
);

// Reading settings back: broken values keep the app's; categories are exactly the sheet's (deduplicated).
const setup = parseSheet({
  orders: undefined,
  projects: undefined,
  bills: undefined,
  months: [],
  settings: [
    ["key", "value"],
    ["currency", "$"],
    ["usual_income", "12,000"],
    ["loan_rate", "lots"],
    ["start_month", "2026-09"],
    ["loan_term_months", 12.5],
  ],
  categories: [
    ["name", "monthly_limit"],
    ["Food", 300],
    ["Fun", ""],
    ["Food", 1],
    ["", 5],
  ],
});
assert.deepEqual(setup.settings, { currency: "$", usualIncome: 12000, startMonth: "2026-09" });
assert.deepEqual(setup.categories, [
  { name: "Food", monthlyLimit: 300 },
  { name: "Fun", monthlyLimit: 0 },
]);
assert.equal(parseSheet({ orders: undefined, projects: undefined, bills: undefined, months: [] }).categories, null);
// Personal: only known values; a missing row leaves that setting alone.
const personal = (rows: (string | boolean)[][]) =>
  parseSheet({
    orders: undefined,
    projects: undefined,
    bills: undefined,
    months: [],
    personal: [["key", "value"], ...rows],
  }).personal;
assert.deepEqual(
  personal([
    ["app_mode", "dark"],
    ["locale", "ru"],
    ["amounts_hidden", false],
  ]),
  { appMode: "dark", locale: "ru", amountsHidden: false }
);
assert.deepEqual(
  personal([
    ["app_mode", "neon"],
    ["locale", "fr"],
    ["amounts_hidden", "TRUE"],
  ]),
  { amountsHidden: true }
);
assert.deepEqual(personal([["app_mode", "light"]]), { appMode: "light" }); // older sheet: no amounts_hidden row

// Savings sync: own tab, names never formulas; reading back skips unknown currencies, no tab = keep the app's.
assert.equal(valueAt(SAVINGS, 0, SAVING_COLUMNS.length - 1), "currency");
const savingsRows = savingsUpdate(6, [{ id: "s", name: "=Cash", amount: 2000, currency: "USD" }])[0].updateCells.rows;
assert.deepEqual(savingsRows[1].values, [
  { userEnteredValue: { stringValue: "s" } },
  { userEnteredValue: { stringValue: "=Cash" } },
  { userEnteredValue: { numberValue: 2000 } },
  { userEnteredValue: { stringValue: "USD" } },
]);
const savingsBack = (rows: (string | number)[][]) =>
  parseSheet({
    orders: undefined,
    projects: undefined,
    bills: undefined,
    months: [],
    savings: [SAVING_COLUMNS, ...rows],
  }).savings;
assert.deepEqual(
  savingsBack([
    ["s", "Cash", 2000, "usd"],
    ["x", "Gold", 5, "XAU"],
    ["y", "Typo", "lots", "EUR"],
  ]),
  [{ id: "s", name: "Cash", amount: 2000, currency: "USD" }]
);
assert.equal(parseSheet({ orders: undefined, projects: undefined, bills: undefined, months: [] }).savings, null);

// Start over: data tabs keep only their header, other months are deleted, this month's ledger emptied.
const reset = resetRequests(
  [
    { title: "Setup", sheetId: 0 },
    { title: "Orders", sheetId: 1 },
    { title: "Projects", sheetId: 2 },
    { title: "_MonthTemplate", sheetId: 3 },
    { title: "2026-10", sheetId: 7 },
    { title: "2026-11", sheetId: 4 },
    { title: "Notes", sheetId: 9 }, // a person's own tab: untouched
  ],
  "2026-11",
  defaultBudget()
) as Record<string, { sheetId?: number; range?: { sheetId: number; startColumnIndex: number }; rows?: unknown[] }>[];
const resetKinds = reset.map((r) => {
  const [kind, body] = Object.entries(r)[0];
  return `${kind}:${body.sheetId ?? body.range?.sheetId}`;
});
assert.deepEqual(resetKinds, [
  "updateCells:1",
  "updateCells:2",
  "deleteSheet:7",
  "updateCells:4",
  "updateCells:0",
  "updateCells:0",
]);
assert.equal(reset[0].updateCells.rows?.length, 1); // Orders: header only
assert.equal(reset[3].updateCells.rows?.length, 1); // this month: ledger header only (A–H; the summary stays)
assert.ok(!resetKinds.some((k) => k.endsWith(":3") || k.endsWith(":9"))); // template and own tabs untouched

// Sheets before v4 (no Project parts tab: one Projects row per part, project fields repeated) still read the same.
const legacy = parseSheet({
  orders: undefined,
  bills: undefined,
  months: [],
  projects: [
    [
      "project_id",
      "project",
      "part_id",
      "part",
      "cost",
      "pay_month",
      "status",
      "paid_date",
      "installment",
      "project_started",
      "project_archived",
    ],
    ["p1", "Kitchen", "a", "Tiles", 1000, "2026-11", "Paid", "2026-11-19", "", "2026-11-19", ""],
    ["p1", "Kitchen", "b", "Loan 1/12", 5, "2026-12", "Planned", "", "bank", "2026-11-19", ""],
  ],
});
assert.deepEqual(legacy.projects, [{ id: "p1", name: "Kitchen", startedDate: "2026-11-19", archivedDate: undefined }]);
assert.deepEqual(
  legacy.parts.map((p) => [p.partId, p.installment ?? null]),
  [
    ["a", null],
    ["b", "bank"],
  ]
);

console.log("sheet template: all checks passed");
