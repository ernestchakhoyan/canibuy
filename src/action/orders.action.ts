"use server";

import { auth, googleAccessToken, writeOrders } from "@server";
import type { Order, OrderStatus } from "@type";

const STATUSES: OrderStatus[] = ["Planned", "Saving", "Bought", "Dropped"];
const DATE = /^(\d{4}-\d{2}-\d{2})?$/; // "" when not bought yet
const MAX_ORDERS = 1000;

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

/** Orders come from the browser: only well-formed ones may be written into the user's sheet. */
const validOrder = (o: Order) =>
  text(o.id, 32) &&
  text(o.item, 200) &&
  text(o.note, 1000) &&
  Number.isFinite(o.price) &&
  o.price >= 0 &&
  (o.deadlineMonths === null || (Number.isInteger(o.deadlineMonths) && o.deadlineMonths >= 0)) &&
  STATUSES.includes(o.status) &&
  text(o.created, 10) &&
  DATE.test(o.created) &&
  text(o.boughtDate, 10) &&
  DATE.test(o.boughtDate) &&
  (o.loanRate == null || (Number.isFinite(o.loanRate) && o.loanRate >= 0 && o.loanRate <= 100)) &&
  (o.loanTermMonths == null ||
    (Number.isInteger(o.loanTermMonths) && o.loanTermMonths >= 1 && o.loanTermMonths <= 600));

/** Mirrors the app's orders into the sheet's Orders tab. No sheet connected → nothing to do. */
/** Returns `true` once written, `false` when no sheet is connected. */
export async function saveOrders(orders: Order[]) {
  if (!Array.isArray(orders) || orders.length > MAX_ORDERS || !orders.every(validOrder)) {
    throw new Error("Invalid orders");
  }
  const spreadsheetId = (await auth())?.sheet?.id;
  const accessToken = spreadsheetId && (await googleAccessToken());
  if (!spreadsheetId || !accessToken) return false; // nothing written: the caller must not count it as synced
  // Rebuild each order from known fields only, so nothing extra rides along into the sheet.
  await writeOrders(
    accessToken,
    spreadsheetId,
    orders.map(({ id, item, price, deadlineMonths, status, created, boughtDate, note, loanRate, loanTermMonths }) => ({
      id,
      item,
      price,
      deadlineMonths,
      status,
      created,
      boughtDate,
      note,
      loanRate: loanRate ?? null,
      loanTermMonths: loanTermMonths ?? null,
    }))
  );
  return true;
}
