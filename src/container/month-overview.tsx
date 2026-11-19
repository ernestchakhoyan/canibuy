"use client";

import { formatMoney, monthSummary, savingsBalance, todayISO } from "@helper";
import { useLoadedBudget } from "@store";
import { Alert, AlertDescription, AlertTitle, Button, Card, Separator, Stat } from "@widget";
import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

export function MonthOverview() {
  const t = useTranslations("month");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
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
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium opacity-80">{t("canStillSave")}</span>
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{money(s.canStillSave)}</span>
        </div>
      </Card>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Stat label={t("left")} value={money(s.left)} tone={s.left < 0 ? "negative" : "default"} />
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
          <Stat label={t("savingsBalance")} value={money(savingsBalance(b))} tone="positive" />
        </div>
      </Card>
    </>
  );
}
