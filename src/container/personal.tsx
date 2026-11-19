"use client";

import { LOCALE_NAMES, routing } from "@i18n";
import { budgetActions, useLoadedBudget } from "@store";
import type { AppMode, Locale } from "@type";
import {
  Card,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@widget";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

/** Flag + native name; the flag is decorative, the name says which language it is. */
const LocaleLabel = ({ locale }: { locale: Locale }) => (
  <>
    <Image src={`/icons/${locale}.svg`} alt="" width={20} height={20} className="size-5 rounded-full" />
    <span lang={locale}>{LOCALE_NAMES[locale]}</span>
  </>
);

const MODES = [
  { value: "system", icon: MonitorIcon },
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
] as const;

/** Appearance and language. Both apply at once; they're saved with the budget ("Personal" block of the sheet). */
export function PersonalForm() {
  const t = useTranslations("personal");
  const b = useLoadedBudget();
  const locale = useLocale(); // what's on screen, from the cookie; may differ from the budget on a new device

  const changeLocale = (next: Locale) => {
    budgetActions.updatePersonal({ locale: next });
    // The proxy reads this cookie on the next request and serves that locale's pages.
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is missing on older iOS Safari
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    location.reload();
  };

  return (
    <Card title={t("title")}>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel id="personal-mode">{t("appearance")}</FieldLabel>
          <ToggleGroup
            aria-labelledby="personal-mode"
            variant="outline"
            className="grid w-full grid-cols-3"
            value={[b.personal.appMode]}
            onValueChange={(v) => v[0] && budgetActions.updatePersonal({ appMode: v[0] as AppMode })}
          >
            {MODES.map(({ value, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value}>
                <Icon data-icon="inline-start" />
                {t(`mode.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="personal-locale">{t("language")}</FieldLabel>
          <Select value={locale} onValueChange={(next) => next && next !== locale && changeLocale(next as Locale)}>
            <SelectTrigger id="personal-locale" className="w-full">
              <SelectValue>{(value: Locale) => <LocaleLabel locale={value} />}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((l) => (
                <SelectItem key={l} value={l}>
                  <LocaleLabel locale={l} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Card>
  );
}
