import type messages from "@/i18n/messages/en.json";
import type { Locale } from "./budget.type";

// Typed keys: `t("missing.key")` and wrong namespaces fail `tsc`. en.json is the source; hy/ru mirror it.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
