"use client";

import { cn, cushion, formatMoney, monthLabel, monthOf, type Timing, todayISO } from "@helper";
import { useLoadedBudget } from "@store";
import { Button, NativeSelect, NativeSelectOption } from "@widget";
import { CalendarClockIcon, CircleAlertIcon, CircleCheckIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

type Props = {
  label: string;
  /** The chosen month (YYYY-MM); `null` = none yet (only when `onClear` is given). */
  value: string | null;
  timing: Timing;
  onChange: (month: string) => void;
  /** Offers "No date" in the list. */
  onClear?: () => void;
};

/**
 * When to pay for an order or a project, from the 2-year savings forecast: every month marked by what it does to
 * savings (✓ stays above the safety cushion, ⚠ dips below it, ✕ runs out), the chosen month's lowest point, and
 * the earliest good month with a button to use it.
 */
export function PlanTiming({ label, value, timing, onChange, onClear }: Props) {
  const t = useTranslations("timing");
  const locale = useLocale();
  const id = useId();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const safety = cushion(b);
  const current = monthOf(todayISO());
  const ahead = (month: string) => {
    const n = timing.months.findIndex((m) => m.month === month);
    return n <= 0 ? t("thisMonth") : t("inMonths", { count: n });
  };
  const mark = (lowest: number) => (lowest >= safety ? "✓" : lowest >= 0 ? "⚠" : "✕");
  // An overdue date counts as this month, like the forecast does.
  const shown = value && value < current ? current : value;
  const chosen = timing.months.find((m) => m.month === shown);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <label htmlFor={id} className="flex items-center gap-2 font-medium">
        <CalendarClockIcon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </label>
      <NativeSelect
        id={id}
        className="w-full"
        value={shown ?? ""}
        onChange={(e) => (e.target.value ? onChange(e.target.value) : onClear?.())}
      >
        {onClear && <NativeSelectOption value="">{t("notSet")}</NativeSelectOption>}
        {timing.months.map((m) => (
          <NativeSelectOption key={m.month} value={m.month}>
            {`${mark(m.lowest)} ${monthLabel(m.month, locale)} · ${ahead(m.month)}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      {chosen && (
        <p
          className={cn(
            "flex items-start gap-1.5",
            chosen.lowest < 0 ? "text-negative" : chosen.lowest < safety ? "text-warning" : "text-positive"
          )}
        >
          {chosen.lowest >= safety ? (
            <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : chosen.lowest >= 0 ? (
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          {t(chosen.lowest >= safety ? "safe" : chosen.lowest >= 0 ? "belowCushion" : "runsOut", {
            amount: money(chosen.lowest),
            month: monthLabel(chosen.lowestMonth, locale),
          })}
        </p>
      )}

      {timing.best ? (
        timing.best !== shown && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/8 px-3 py-2">
            <p className="flex min-w-0 flex-1 basis-60 items-start gap-1.5">
              <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {t(timing.tight ? "suggestTight" : "suggest", {
                  month: monthLabel(timing.best, locale),
                  ahead: ahead(timing.best),
                })}
              </span>
            </p>
            <Button size="sm" variant="secondary" onClick={() => timing.best && onChange(timing.best)}>
              {t("use")}
            </Button>
          </div>
        )
      ) : (
        <p className="text-muted-foreground">{t("never")}</p>
      )}
    </div>
  );
}
