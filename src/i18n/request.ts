// Loaded by the next-intl plugin (next.config.ts); server-only, so it stays out of the `@i18n` barrel.

import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const param = await rootParams.locale();
    if (!hasLocale(routing.locales, param)) notFound();
    locale = param;
  }
  return { locale, messages: (await import(`./messages/${locale}.json`)).default };
});
