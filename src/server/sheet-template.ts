import type { Budget, Personal } from "@type";

// Builds the Sheets API `spreadsheets.create` body for the template in PRD section 6, in a single request:
// tabs, headers, frozen + warning-protected row 1, named ranges, a hidden month template and the current month.
// Pure (no "server-only") so `bun run test` can check it outside Next.

export const TEMPLATE_VERSION = 1;
export const SPREADSHEET_TITLE = "canibuy";

/** The "Personal" key/value block on the Setup tab (N–O); `buildSpreadsheet` places it, `writePersonal` updates it. */
export const PERSONAL_RANGE = "Setup!N1:O3";
export const personalRows = (p: Personal) => [
  ["key", "value"],
  ["app_mode", p.appMode],
  ["locale", p.locale],
];

const SHEET_ID = { setup: 0, orders: 1, projects: 2, monthTemplate: 3, currentMonth: 4 } as const;

type Value = string | number | boolean | null;

const cell = (v: Value) => {
  if (v === null) return {};
  if (typeof v === "number") return { userEnteredValue: { numberValue: v } };
  if (typeof v === "boolean") return { userEnteredValue: { boolValue: v } };
  if (v.startsWith("=")) return { userEnteredValue: { formulaValue: v } };
  return { userEnteredValue: { stringValue: v } };
};

/** Lays out tables side by side, each starting at its column index, as one grid from A1. */
const grid = (tables: { column: number; rows: Value[][] }[]) => {
  const height = Math.max(...tables.map((t) => t.rows.length));
  const rows = Array.from({ length: height }, (_, r) => {
    const row: Value[] = [];
    for (const { column, rows: tableRows } of tables) {
      tableRows[r]?.forEach((v, c) => {
        row[column + c] = v;
      });
    }
    return Array.from(row, (v) => cell(v ?? null));
  });
  return [{ startRow: 0, startColumn: 0, rowData: rows.map((values) => ({ values })) }];
};

const sheet = (sheetId: number, title: string, tables: { column: number; rows: Value[][] }[], hidden = false) => ({
  properties: { sheetId, title, hidden, gridProperties: { frozenRowCount: 1 } },
  data: grid(tables),
  protectedRanges: [
    {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      warningOnly: true,
      description: "Column names: the app finds columns by these names",
    },
  ],
});

const LEDGER = ["id", "date", "type", "category", "amount", "note", "link_id", "created_at"];

/** Summary block J–K. Row numbers matter: "Left" references K2–K6. */
const SUMMARY: Value[][] = [
  ["label", "value"],
  [
    "Income",
    '=IF(COUNTIF(C:C,"income_salary")>0, SUMIFS(E:E,C:C,"income_salary"), UsualIncome) + SUMIFS(E:E,C:C,"income_extra")',
  ],
  ["Bills", "=SUMIFS(Bills_amount, Bills_active, TRUE)"],
  ["Expenses", '=SUMIFS(E:E,C:C,"expense")'],
  ["Saved", '=SUMIFS(E:E,C:C,"saving")'],
  ["Taken from savings", '=SUMIFS(E:E,C:C,"withdrawal")'],
  ["Left", "=K2-K3-K4-K5+K6"],
];

const monthTables = [
  { column: 0, rows: [LEDGER] },
  { column: 9, rows: SUMMARY },
];

export const buildSpreadsheet = (budget: Budget, month: string) => {
  const s = budget.settings;
  const settingsRows: Value[][] = [
    ["key", "value"],
    ["currency", s.currency],
    ["usual_income", s.usualIncome],
    ["opening_savings", s.openingSavings],
    ["cushion_months", s.cushionMonths],
    ["loan_rate", s.loanRate],
    ["loan_term_months", s.loanTermMonths],
    ["start_month", s.startMonth],
    ["template_version", TEMPLATE_VERSION],
  ];
  const billRows: Value[][] = [
    ["id", "name", "amount", "due_day", "category", "active"],
    ...budget.bills.map((b) => [b.id, b.name, b.amount, b.dueDay, b.category, b.active]),
  ];
  const categoryRows: Value[][] = [
    ["name", "monthly_limit"],
    ...budget.categories.map((c) => [c.name, c.monthlyLimit]),
  ];

  const setup = SHEET_ID.setup;
  const range = (startColumnIndex: number, endColumnIndex: number, startRowIndex = 0, endRowIndex?: number) => ({
    sheetId: setup,
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
  });
  const usualIncomeRow = settingsRows.findIndex((r) => r[0] === "usual_income");

  return {
    properties: { title: SPREADSHEET_TITLE },
    sheets: [
      sheet(setup, "Setup", [
        { column: 0, rows: settingsRows }, // A–B
        { column: 3, rows: billRows }, // D–I
        { column: 10, rows: categoryRows }, // K–L
        { column: 13, rows: personalRows(budget.personal) }, // N–O = PERSONAL_RANGE
      ]),
      sheet(SHEET_ID.orders, "Orders", [
        {
          column: 0,
          rows: [["id", "item", "price", "deadline_months", "status", "created", "bought_date", "note"]],
        },
      ]),
      sheet(SHEET_ID.projects, "Projects", [
        {
          column: 0,
          rows: [["project_id", "project", "part_id", "part", "cost", "pay_month", "status", "paid_date"]],
        },
      ]),
      sheet(SHEET_ID.monthTemplate, "_MonthTemplate", monthTables, true),
      sheet(SHEET_ID.currentMonth, month, monthTables),
    ],
    namedRanges: [
      { name: "Settings", range: range(0, 2) },
      { name: "Bills", range: range(3, 9) },
      { name: "Categories", range: range(10, 12) },
      { name: "Personal", range: range(13, 15) },
      { name: "UsualIncome", range: range(1, 2, usualIncomeRow, usualIncomeRow + 1) },
      { name: "Bills_amount", range: range(5, 6, 1) },
      { name: "Bills_active", range: range(8, 9, 1) },
    ],
  };
};
