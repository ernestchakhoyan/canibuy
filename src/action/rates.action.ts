"use server";

import { fetchRates } from "@server";
import type { CurrencyCode } from "@type";

const CODES: CurrencyCode[] = ["AMD", "USD", "EUR", "RUB", "GBP"];

/** Exchange rates for the base currency (cached on the server); `null` when the rate sources are unreachable. */
export async function loadRates(base: CurrencyCode) {
  if (!CODES.includes(base)) throw new Error("Unknown currency");
  return fetchRates(base).catch(() => null);
}
