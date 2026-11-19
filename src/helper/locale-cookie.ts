import type { Locale } from "@type";

/** Picks the locale the proxy serves from the next request on (next-intl's NEXT_LOCALE cookie, kept a year). */
export function setLocaleCookie(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is missing on older iOS Safari
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
