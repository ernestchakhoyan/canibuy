import { defineRouting } from "next-intl/routing";

/**
 * Locale lives in a cookie, never in the URL: the proxy rewrites `/orders` to the hidden `/[locale]/orders`.
 * First visit picks from Accept-Language; the Setup page's language picker overwrites the cookie.
 */
export const routing = defineRouting({
  locales: ["en", "hy", "ru"],
  defaultLocale: "en",
  localePrefix: "never",
  localeCookie: { name: "NEXT_LOCALE", maxAge: 60 * 60 * 24 * 365 },
});

export const LOCALE_NAMES = { en: "English", hy: "Հայերեն", ru: "Русский" } as const;
