"use client";

import { setLocaleCookie } from "@helper";
import { LOCALE_NAMES, routing } from "@i18n";
import { budgetActions, useLoadedBudget, useSheetSyncFailed } from "@store";
import type { AppMode, Locale } from "@type";
import {
  Card,
  Field,
  FieldError,
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

/** Appearance and language. Both apply at once; the store syncs them with the sheet's "Personal" block. */
export function PersonalForm() {
  const t = useTranslations("personal");
  const tc = useTranslations("common");
  const b = useLoadedBudget();
  const locale = useLocale(); // what's on screen, from the cookie; may differ from the budget on a new device
  const syncFailed = useSheetSyncFailed("personal"); // the store writes changes to the sheet (Personal block)

  const changeLocale = (next: Locale) => {
    // Saved and marked unsynced before the reload; if the reload cuts the sheet write short, it's redone on load.
    budgetActions.updatePersonal({ locale: next });
    setLocaleCookie(next); // the proxy serves this locale's pages from the next request
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
        {syncFailed && <FieldError>{tc("syncFailed")}</FieldError>}
      </div>
    </Card>
  );
}
