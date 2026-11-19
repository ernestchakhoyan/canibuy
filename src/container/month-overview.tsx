"use client";

import { formatMoney, monthSummary, savingsBalance, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AmountsToggle,
  Button,
  Card,
  maskedMoney,
  Separator,
  Stat,
} from "@widget";
import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export function MonthOverview() {
  const t = useTranslations("month");
  const locale = useLocale();
  const b = useLoadedBudget();
  const hidden = b.personal.amountsHidden ?? true; // the eye: a Personal setting, synced with the sheet
  const money = (n: number) =>
    hidden ? maskedMoney(b.settings.currency) : formatMoney(Math.round(n), b.settings.currency, locale);
  // Red / green would give away the sign of a hidden amount.
  const tone = (shown: "positive" | "negative" | "default") => (hidden ? "default" : shown);
  const s = monthSummary(b, todayISO());
  const needsSetup = b.settings.usualIncome === 0 && b.bills.length === 0;

  return (
    <>
      {needsSetup && (
        <Alert>
          <SparklesIcon />
          <AlertTitle>{t("setup.title")}</AlertTitle>
          <AlertDescription>
            <p>{t("setup.description")}</p>
            <Button size="sm" nativeButton={false} render={<Link href="/setup" />}>
              {t("setup.action")}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="relative bg-linear-to-br from-primary to-primary/80 text-primary-foreground ring-0">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-brand-gold/30 blur-2xl"
        />
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium opacity-80">{t("canStillSave")}</span>
            <span className="text-5xl font-semibold tracking-tight tabular-nums">{money(s.canStillSave)}</span>
          </div>
          <AmountsToggle
            hidden={hidden}
            onToggle={() => budgetActions.updatePersonal({ amountsHidden: !hidden })}
            className="-mt-1 -mr-2 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          />
        </div>
      </Card>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label={t("left")} value={money(s.left)} tone={tone(s.left < 0 ? "negative" : "default")} />
          <Stat
            label={t("dailyAllowance")}
            value={money(s.dailyAllowance)}
            hint={t("daysLeft", { count: s.daysLeft })}
          />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <Stat
            label={t("projectedSpend")}
            value={money(s.projectedSpend)}
            hint={t("spentSoFar", { amount: money(s.spent) })}
          />
          <Stat label={t("savingsBalance")} value={money(savingsBalance(b))} tone={tone("positive")} />
        </div>
      </Card>
    </>
  );
}
