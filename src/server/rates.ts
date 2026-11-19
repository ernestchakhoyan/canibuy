import "server-only";
import type { CurrencyCode, Rates } from "@type";
import { cacheLife } from "next/cache";

// Exchange rates from the open-source fawazahmed0/exchange-api (no key; has AMD, which ECB-based APIs lack).
// Only the base currency's code is sent; the mirror is the project's own fallback host.
const SOURCES = [
  (base: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  (base: string) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];
const CODES: CurrencyCode[] = ["AMD", "USD", "EUR", "RUB", "GBP"];

/**
 * Today's rates for `base`: 1 base = `perBase[code]`. Cached on the server for hours (the source updates daily),
 * so every device and reload shares one fetch. Throws when no source answers with usable data.
 */
export async function fetchRates(base: CurrencyCode): Promise<Rates> {
  "use cache";
  cacheLife("hours");
  for (const url of SOURCES) {
    try {
      const res = await fetch(url(base.toLowerCase()), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { date?: unknown } & Record<string, unknown>;
      const table = data[base.toLowerCase()] as Record<string, unknown> | undefined;
      if (typeof data.date !== "string" || !table) continue;
      // Untrusted response: keep only positive, finite numbers for the currencies the app knows.
      const perBase: Rates["perBase"] = {};
      for (const code of CODES) {
        const rate = table[code.toLowerCase()];
        if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) perBase[code] = rate;
      }
      return { base, date: data.date.slice(0, 10), perBase };
    } catch {
      // try the next source
    }
  }
  throw new Error(`No exchange rates for ${base}`);
}
