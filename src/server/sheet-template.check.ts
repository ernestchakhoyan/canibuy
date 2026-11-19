// Self-check for the Google Sheet template. Run: bun run test
import assert from "node:assert/strict";
import { defaultBudget } from "@helper";
import { buildSpreadsheet, ORDER_COLUMNS, ordersUpdate, PERSONAL_RANGE, TEMPLATE_VERSION } from "./sheet-template";

const body = buildSpreadsheet(defaultBudget(), "2026-11");
const titles = body.sheets.map((s) => s.properties.title);
assert.deepEqual(titles, ["Setup", "Orders", "Projects", "_MonthTemplate", "2026-11"]);
assert.equal(body.sheets[3].properties.hidden, true);
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
assert.equal(valueAt(0, 0, range("Bills_amount").startColumnIndex), "amount");
assert.equal(valueAt(0, 0, range("Bills_active").startColumnIndex), "active");
assert.equal(valueAt(0, 0, range("Categories").startColumnIndex), "name");
assert.equal(valueAt(0, 8, 1), TEMPLATE_VERSION);
assert.equal(valueAt(0, 1, 10), "Food"); // default categories written
assert.equal(range("Personal").startColumnIndex, 13);
assert.equal(valueAt(0, 1, 13), "app_mode");
assert.equal(valueAt(0, 1, 14), "system");
assert.equal(valueAt(0, 2, 13), "locale");
// writePersonal updates the same cells the template creates: N = column 13, rows 1–3.
assert.equal(PERSONAL_RANGE, "Setup!N1:O3");
assert.equal(String.fromCharCode(65 + range("Personal").startColumnIndex), "N");

// Month tab: ledger header in A–H, summary in J–K with "Left" on row 7 referencing K2–K6.
assert.equal(valueAt(4, 0, 0), "id");
assert.equal(valueAt(4, 0, 7), "created_at");
assert.equal(valueAt(4, 1, 9), "Income");
assert.equal(valueAt(4, 6, 9), "Left");
assert.equal(valueAt(4, 6, 10), "=K2-K3-K4-K5+K6");
// start_month is text, so Sheets doesn't turn "2026-11" into a date.
assert.deepEqual(body.sheets[0].data[0].rowData[7].values[1], {
  userEnteredValue: { stringValue: defaultBudget().settings.startMonth },
});

// Orders sync: same columns as the template header, rows from row 2, user text never parsed as a formula.
assert.equal(valueAt(1, 0, 0), "id");
assert.equal(valueAt(1, 0, ORDER_COLUMNS.length - 1), "loan_term_months");
const sync = ordersUpdate([
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
assert.equal(ordersUpdate([]).requests[0].updateCells.rows.length, 1); // header only // removing the last order clears all rows

console.log("sheet template: all checks passed");
