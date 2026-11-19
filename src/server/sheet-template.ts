import type {
  AppMode,
  Bill,
  Budget,
  Category,
  CurrencyCode,
  Entry,
  EntryType,
  Locale,
  Order,
  OrderStatus,
  Personal,
  Project,
  ProjectPart,
  Saving,
  Settings,
} from "@type";

// Builds the Sheets API `spreadsheets.create` body for the template in PRD section 6, in a single request:
// tabs, headers, frozen + warning-protected row 1, named ranges, a hidden month template and the current month.
// Pure (no "server-only") so `bun run test` can check it outside Next.

export const TEMPLATE_VERSION = 3; // 2: bills got their own tab; 3: Savings tab (savings per currency)
export const SPREADSHEET_TITLE = "canibuy";

/** The "Personal" key/value block on the Setup tab, N–O (`buildSpreadsheet` places it, `personalUpdate` rewrites it). */
export const PERSONAL_COLUMN = 13; // N
export const personalRows = (p: Personal): [string, string | boolean][] => [
  ["key", "value"],
  ["app_mode", p.appMode],
  ["locale", p.locale],
  ["amounts_hidden", p.amountsHidden ?? true],
];

export const SHEET_ID = {
  setup: 0,
  orders: 1,
  projects: 2,
  monthTemplate: 3,
  currentMonth: 4,
  bills: 5,
  savings: 6,
} as const;

/** Orders tab header (row 1). `ordersUpdate` writes rows in this column order. */
export const ORDER_COLUMNS = [
  "id",
  "item",
  "price",
  "deadline_months",
  "status",
  "created",
  "bought_date",
  "note",
  "loan_rate", // empty = Setup's loan_rate
  "loan_term_months", // empty = Setup's loan_term_months
];

// Synced tabs: text is always a string value, never parsed (a name like "=IMPORTXML(…)" must not become a formula).
type CellData = { userEnteredValue?: { stringValue: string } | { numberValue: number } | { boolValue: boolean } };
const text = (v: string): CellData => ({ userEnteredValue: { stringValue: v } });
const optText = (v: string | undefined): CellData => (v ? text(v) : {});
const number = (v: number | null): CellData => (v === null ? {} : { userEnteredValue: { numberValue: v } });

/**
 * One `spreadsheets.batchUpdate` request that makes a tab exactly header + `rows`: updateCells with an open-ended
 * range clears every cell it isn't given, so a removed row disappears in the same request. The header is written
 * too, so sheets made before a column existed get its name.
 */
const tabUpdate = (sheetId: number, columns: string[], rows: CellData[][], startColumnIndex = 0) => ({
  requests: [
    {
      updateCells: {
        range: { sheetId, startRowIndex: 0, startColumnIndex, endColumnIndex: startColumnIndex + columns.length },
        fields: "userEnteredValue",
        rows: [{ values: columns.map(text) }, ...rows.map((values) => ({ values }))],
      },
    },
  ],
});

/** Makes the Orders tab exactly header + `orders`. */
export const ordersUpdate = (orders: Order[]) =>
  tabUpdate(
    SHEET_ID.orders,
    ORDER_COLUMNS,
    orders.map((o) => [
      text(o.id),
      text(o.item),
      number(o.price),
      number(o.deadlineMonths),
      text(o.status),
      text(o.created),
      text(o.boughtDate),
      text(o.note),
      number(o.loanRate ?? null),
      number(o.loanTermMonths ?? null),
    ])
  );

/** Projects tab header (row 1): one row per part; the last three columns repeat the project's own fields. */
export const PROJECT_COLUMNS = [
  "project_id",
  "project",
  "part_id",
  "part",
  "cost",
  "pay_month",
  "status",
  "paid_date",
  "installment", // bank / friend: a loan repayment (they become a bill when the project starts)
  "project_started",
  "project_archived",
];

/**
 * Makes the Projects tab exactly header + every part, grouped by project. A project with no parts left (all its
 * payments became a bill) still gets one row, with the part columns empty, so it doesn't vanish from the sheet.
 */
export const projectsUpdate = (projects: Project[], parts: ProjectPart[]) =>
  tabUpdate(
    SHEET_ID.projects,
    PROJECT_COLUMNS,
    projects.flatMap((project) => {
      const own = parts.filter((p) => p.projectId === project.id);
      const meta = [optText(project.startedDate), optText(project.archivedDate)];
      if (own.length === 0) return [[text(project.id), text(project.name), {}, {}, {}, {}, {}, {}, {}, ...meta]];
      return own.map((p) => [
        text(project.id),
        text(project.name),
        text(p.partId),
        text(p.part),
        number(p.cost),
        text(p.payMonth),
        text(p.status),
        optText(p.paidDate),
        optText(p.installment),
        ...meta,
      ]);
    })
  );

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

/** Month tab ledger, A–H: one row per entry dated in that month. */
export const ENTRY_COLUMNS = ["id", "date", "type", "category", "amount", "note", "link_id", "created_at"];
const LEDGER = ENTRY_COLUMNS;

/** Bills tab header. start / end / project are set on a started project's loan bill. */
export const BILL_COLUMNS = [
  "id",
  "name",
  "amount",
  "due_day",
  "category",
  "active",
  "start_month",
  "end_month",
  "project_id",
  "project",
];

/** K8 on a month tab holds the tab's month (YYYY-MM): the Bills formula counts only bills due in it. */
export const MONTH_CELL = { row: 7, column: 10 };

/** Summary block J–K. Row numbers matter: "Left" references K2–K6. */
const SUMMARY: Value[][] = [
  ["label", "value"],
  [
    "Income",
    '=IF(COUNTIF(C:C,"income_salary")>0, SUMIFS(E:E,C:C,"income_salary"), UsualIncome) + SUMIFS(E:E,C:C,"income_extra")',
  ],
  // Active bills due this month (K8): empty start / end = no limit.
  [
    "Bills",
    '=SUMPRODUCT(Bills_amount*(Bills_active=TRUE)*(((Bills_start="")+(Bills_start<=K8))>0)*(((Bills_end="")+(Bills_end>=K8))>0))',
  ],
  ["Expenses", '=SUMIFS(E:E,C:C,"expense")'],
  ["Saved", '=SUMIFS(E:E,C:C,"saving")'],
  ["Taken from savings", '=SUMIFS(E:E,C:C,"withdrawal")'],
  ["Left", "=K2-K3-K4-K5+K6"],
];

const monthTables = (month: string) => [
  { column: 0, rows: [LEDGER] },
  { column: 9, rows: [...SUMMARY, ["month", month]] }, // J8:K8 = MONTH_CELL
];

/** Setup A–B key / value rows (below the header). The order matters: the UsualIncome named range is row 3. */
const settingsRows = (s: Settings): [string, string | number][] => [
  ["currency", s.currency],
  ["usual_income", s.usualIncome],
  ["opening_savings", s.openingSavings],
  ["cushion_months", s.cushionMonths],
  ["loan_rate", s.loanRate],
  ["loan_term_months", s.loanTermMonths],
  ["start_month", s.startMonth],
  ["template_version", TEMPLATE_VERSION],
];

export const buildSpreadsheet = (budget: Budget, month: string) => {
  const settings: Value[][] = [["key", "value"], ...settingsRows(budget.settings)];
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
  const usualIncomeRow = settings.findIndex((r) => r[0] === "usual_income");

  return {
    properties: { title: SPREADSHEET_TITLE },
    sheets: [
      sheet(setup, "Setup", [
        { column: 0, rows: settings }, // A–B
        { column: 10, rows: categoryRows }, // K–L
        { column: PERSONAL_COLUMN, rows: personalRows(budget.personal) }, // N–O
      ]),
      sheet(SHEET_ID.orders, "Orders", [
        {
          column: 0,
          rows: [ORDER_COLUMNS],
        },
      ]),
      sheet(SHEET_ID.projects, "Projects", [
        {
          column: 0,
          rows: [PROJECT_COLUMNS],
        },
      ]),
      sheet(SHEET_ID.bills, "Bills", [{ column: 0, rows: [BILL_COLUMNS] }]),
      sheet(SHEET_ID.savings, "Savings", [{ column: 0, rows: [SAVING_COLUMNS] }]),
      sheet(SHEET_ID.monthTemplate, "_MonthTemplate", monthTables(""), true),
      sheet(SHEET_ID.currentMonth, month, monthTables(month)),
    ],
    namedRanges: [
      { name: "Settings", range: range(0, 2) },
      { name: "Categories", range: range(10, 12) },
      { name: "Personal", range: range(13, 15) },
      { name: "UsualIncome", range: range(1, 2, usualIncomeRow, usualIncomeRow + 1) },
      ...billRanges(SHEET_ID.bills),
    ],
  };
};

// ── Bills tab ────────────────────────────────────────────────────────────────────────────────────────────────

/** The named ranges month-tab formulas use, all on the Bills tab (rows 2+ of a column). */
const BILL_RANGES: [name: string, column: string | null][] = [
  ["Bills", null],
  ["Bills_amount", "amount"],
  ["Bills_active", "active"],
  ["Bills_start", "start_month"],
  ["Bills_end", "end_month"],
];

/** The bill named ranges on the Bills tab `sheetId`: the whole table, and rows 2+ of the columns formulas use. */
const billRanges = (sheetId: number) =>
  BILL_RANGES.map(([name, column]) => {
    const index = column ? BILL_COLUMNS.indexOf(column) : 0;
    const range = column
      ? { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 }
      : { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: BILL_COLUMNS.length };
    return { name, range };
  });

/**
 * Requests that point the bill named ranges at the Bills tab `sheetId`: update the ones that exist (sheets made
 * before the Bills tab pointed them at Setup D–I), add the rest.
 */
export const billNamedRanges = (sheetId: number, existing: { name: string; namedRangeId: string }[]) =>
  billRanges(sheetId).map(({ name, range }) => {
    const found = existing.find((r) => r.name === name);
    return found
      ? { updateNamedRange: { namedRange: { namedRangeId: found.namedRangeId, name, range }, fields: "range" } }
      : { addNamedRange: { namedRange: { name, range } } };
  });

/** Makes the Bills tab exactly header + `bills`. */
export const billsUpdate = (sheetId: number, bills: Bill[]) =>
  tabUpdate(
    sheetId,
    BILL_COLUMNS,
    bills.map((b) => [
      text(b.id),
      text(b.name),
      number(b.amount),
      number(b.dueDay),
      text(b.category),
      { userEnteredValue: { boolValue: b.active } },
      optText(b.startMonth),
      optText(b.endMonth),
      optText(b.projectId),
      optText(b.project),
    ])
  ).requests;

// ── Savings tab ─────────────────────────────────────────────────────────────────────────────────────────────

/** Savings tab header: savings kept per currency (the app converts them to the base currency). */
export const SAVING_COLUMNS = ["id", "name", "amount", "currency"];

/** Makes the Savings tab exactly header + `savings`. */
export const savingsUpdate = (sheetId: number, savings: Saving[]) =>
  tabUpdate(
    sheetId,
    SAVING_COLUMNS,
    savings.map((s) => [text(s.id), text(s.name), number(s.amount), text(s.currency)])
  ).requests;

// ── Month tabs (entries) ─────────────────────────────────────────────────────────────────────────────────────

const MONTH_TITLE = /^\d{4}-\d{2}$/;

/**
 * Requests that make every month tab's ledger (A–H, header + rows) exactly the entries dated in it: tabs for new
 * months are copied from the hidden _MonthTemplate (unhidden, K8 = their month), month tabs with no entries left
 * are emptied. The summary block J–K is never touched.
 */
export const entriesUpdate = (
  entries: Entry[],
  tabs: { title: string; sheetId: number }[],
  templateSheetId: number,
  newSheetId: () => number
) => {
  const byMonth = Map.groupBy(entries, (e) => e.date.slice(0, 7));
  const existing = new Map(tabs.filter((t) => MONTH_TITLE.test(t.title)).map((t) => [t.title, t.sheetId]));
  const months = [...new Set([...existing.keys(), ...byMonth.keys()])].sort();
  const requests: object[] = [];
  for (const month of months) {
    let sheetId = existing.get(month);
    if (sheetId === undefined) {
      sheetId = newSheetId();
      requests.push(
        { duplicateSheet: { sourceSheetId: templateSheetId, newSheetId: sheetId, newSheetName: month } },
        { updateSheetProperties: { properties: { sheetId, hidden: false }, fields: "hidden" } },
        {
          updateCells: {
            start: { sheetId, rowIndex: MONTH_CELL.row, columnIndex: MONTH_CELL.column },
            fields: "userEnteredValue",
            rows: [{ values: [text(month)] }],
          },
        }
      );
    }
    const rows = (byMonth.get(month) ?? []).map((e) => [
      text(e.id),
      text(e.date),
      text(e.type),
      text(e.category),
      number(e.amount),
      text(e.note),
      text(e.linkId),
      text(e.createdAt),
    ]);
    requests.push(...tabUpdate(sheetId, ENTRY_COLUMNS, rows).requests);
  }
  return requests;
};

// ── Setup tab: settings (A–B) and categories (K–L) ───────────────────────────────────────────────────────────

/** Setup tab columns the sync owns: A–B key / value settings, K–L categories. */
export const SETTINGS_COLUMNS = ["key", "value"];
export const CATEGORY_COLUMNS = ["name", "monthly_limit"];
export const CATEGORY_COLUMN = 10; // K

/** Requests that make Setup A–B the settings and Setup K–L exactly the categories (other columns untouched). */
export const setupUpdate = (sheetId: number, settings: Settings, categories: Category[]) => [
  ...tabUpdate(
    sheetId,
    SETTINGS_COLUMNS,
    settingsRows(settings).map(([key, value]) => [text(key), typeof value === "number" ? number(value) : text(value)])
  ).requests,
  ...tabUpdate(
    sheetId,
    CATEGORY_COLUMNS,
    categories.map((c) => [text(c.name), number(c.monthlyLimit)]),
    CATEGORY_COLUMN
  ).requests,
];

/** Requests that make Setup N–O exactly the Personal block (other columns untouched). */
export const personalUpdate = (sheetId: number, personal: Personal) =>
  tabUpdate(
    sheetId,
    SETTINGS_COLUMNS,
    personalRows(personal)
      .slice(1)
      .map(([key, value]): CellData[] => [
        text(key),
        typeof value === "boolean" ? { userEnteredValue: { boolValue: value } } : text(value),
      ]),
    PERSONAL_COLUMN
  ).requests;

// ── Reading the sheet back ───────────────────────────────────────────────────────────────────────────────────

type Raw = string | number | boolean | undefined | null;
type Table = Raw[][] | undefined;

/** Rows as objects keyed by the header row's names (the app finds columns by name, not position). */
const records = (table: Table) => {
  if (!table || table.length === 0) return [];
  const header = table[0].map((h) => String(h ?? "").trim());
  return table.slice(1).map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])) as Record<string, Raw>);
};

const str = (v: Raw) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: Raw) => {
  if (typeof v === "number") return v;
  const n = Number(str(v).replace(/[\s,]/g, ""));
  return str(v) !== "" && Number.isFinite(n) ? n : null;
};
const bool = (v: Raw) => v === true || str(v).toUpperCase() === "TRUE";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const ORDER_STATUSES: OrderStatus[] = ["Planned", "Saving", "Bought", "Dropped"];
const ENTRY_TYPES: EntryType[] = ["expense", "income_salary", "income_extra", "saving", "withdrawal", "bill_paid"];
const opt = (v: string) => v || undefined;
const APP_MODES: AppMode[] = ["system", "light", "dark"];
const LOCALES: Locale[] = ["en", "hy", "ru"];
const CURRENCY_CODES: CurrencyCode[] = ["AMD", "USD", "EUR", "RUB", "GBP"];

/**
 * Parses what `readSheet` fetched into budget data. Rows a person broke while editing the sheet (no id, a price
 * that isn't a number, an unknown status…) are skipped, never guessed at.
 */
export const parseSheet = (tables: {
  orders: Table;
  projects: Table;
  bills: Table;
  months: Table[];
  settings?: Table;
  categories?: Table;
  personal?: Table;
  savings?: Table;
}) => {
  const orders: Order[] = [];
  for (const r of records(tables.orders)) {
    const price = num(r.price);
    const status = str(r.status) as OrderStatus;
    if (!str(r.id) || price === null || !ORDER_STATUSES.includes(status)) continue;
    orders.push({
      id: str(r.id),
      item: str(r.item),
      price,
      deadlineMonths: num(r.deadline_months),
      status,
      created: str(r.created),
      boughtDate: str(r.bought_date),
      note: str(r.note),
      loanRate: num(r.loan_rate),
      loanTermMonths: num(r.loan_term_months),
    });
  }

  const projects = new Map<string, Project>();
  const parts: ProjectPart[] = [];
  for (const r of records(tables.projects)) {
    const projectId = str(r.project_id);
    if (!projectId) continue;
    if (!projects.has(projectId)) {
      projects.set(projectId, {
        id: projectId,
        name: str(r.project),
        startedDate: opt(str(r.project_started)),
        archivedDate: opt(str(r.project_archived)),
      });
    }
    const cost = num(r.cost);
    const status = str(r.status);
    const installment = str(r.installment);
    if (!str(r.part_id) || cost === null || !MONTH.test(str(r.pay_month))) continue;
    if (status !== "Planned" && status !== "Paid") continue;
    parts.push({
      projectId,
      project: projects.get(projectId)?.name ?? "",
      partId: str(r.part_id),
      part: str(r.part),
      cost,
      payMonth: str(r.pay_month),
      status,
      paidDate: str(r.paid_date),
      ...(installment === "bank" || installment === "friend" ? { installment } : {}),
    });
  }

  const bills: Bill[] = [];
  for (const r of records(tables.bills)) {
    const amount = num(r.amount);
    if (!str(r.id) || amount === null) continue;
    bills.push({
      id: str(r.id),
      name: str(r.name),
      amount,
      dueDay: Math.min(31, Math.max(1, num(r.due_day) ?? 1)),
      category: str(r.category),
      active: bool(r.active),
      startMonth: opt(str(r.start_month)),
      endMonth: opt(str(r.end_month)),
      projectId: opt(str(r.project_id)),
      project: opt(str(r.project)),
    });
  }

  const entries: Entry[] = [];
  for (const table of tables.months) {
    for (const r of records(table)) {
      const amount = num(r.amount);
      const type = str(r.type) as EntryType;
      if (!str(r.id) || amount === null || !DATE.test(str(r.date)) || !ENTRY_TYPES.includes(type)) continue;
      entries.push({
        id: str(r.id),
        date: str(r.date),
        type,
        category: str(r.category),
        amount,
        note: str(r.note),
        linkId: str(r.link_id),
        createdAt: str(r.created_at),
      });
    }
  }

  // Settings: only well-formed values; anything missing or broken keeps the app's own (null = no settings block).
  let settings: Partial<Settings> | null = null;
  if (tables.settings && tables.settings.length > 0) {
    const values = new Map(records(tables.settings).map((r) => [str(r.key), r.value]));
    const amount = (key: string) => {
      const n = num(values.get(key));
      return n !== null && n >= 0 ? n : undefined;
    };
    const currency = str(values.get("currency"));
    const startMonth = str(values.get("start_month"));
    const termMonths = amount("loan_term_months");
    settings = Object.fromEntries(
      Object.entries({
        currency: currency && currency.length <= 5 ? currency : undefined,
        usualIncome: amount("usual_income"),
        openingSavings: amount("opening_savings"),
        cushionMonths: amount("cushion_months"),
        loanRate: amount("loan_rate"),
        loanTermMonths: termMonths && Number.isInteger(termMonths) ? termMonths : undefined,
        startMonth: MONTH.test(startMonth) ? startMonth : undefined,
      }).filter(([, v]) => v !== undefined)
    );
  }

  // Categories: null when the block has no header (nothing to go by), else exactly the named rows.
  let categories: Category[] | null = null;
  if (tables.categories && tables.categories.length > 0) {
    categories = [];
    const seen = new Set<string>();
    for (const r of records(tables.categories)) {
      const name = str(r.name);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      categories.push({ name, monthlyLimit: Math.max(0, num(r.monthly_limit) ?? 0) });
    }
  }

  // Personal: key by key, only known values (null = no Personal block).
  let personal: Partial<Personal> | null = null;
  if (tables.personal && tables.personal.length > 0) {
    const values = new Map(records(tables.personal).map((r) => [str(r.key), r.value]));
    const appMode = str(values.get("app_mode"));
    const locale = str(values.get("locale"));
    const hidden = values.get("amounts_hidden");
    personal = {
      ...(APP_MODES.includes(appMode as AppMode) && { appMode: appMode as AppMode }),
      ...(LOCALES.includes(locale as Locale) && { locale: locale as Locale }),
      ...(str(hidden) !== "" && { amountsHidden: bool(hidden) }),
    };
  }

  // Savings: null when the sheet has no Savings tab yet (keep the app's), else exactly its valid rows.
  let savings: Saving[] | null = null;
  if (tables.savings && tables.savings.length > 0) {
    savings = [];
    for (const r of records(tables.savings)) {
      const amount = num(r.amount);
      const currency = str(r.currency).toUpperCase() as CurrencyCode;
      if (!str(r.id) || amount === null || !CURRENCY_CODES.includes(currency)) continue;
      savings.push({ id: str(r.id), name: str(r.name), amount, currency });
    }
  }

  return { orders, projects: [...projects.values()], parts, bills, entries, settings, categories, personal, savings };
};

export type SheetData = ReturnType<typeof parseSheet>;
