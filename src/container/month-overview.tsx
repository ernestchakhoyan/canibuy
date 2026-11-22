"use client";

import { cn, cushion, formatMoney, monthSummary, savingsBalance, todayISO } from "@helper";
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
import { ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, HammerIcon, SparklesIcon } from "lucide-react";
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
  // Salary goes into savings and payments come out of them: what savings come to once this month's due project
  // payments are paid, against the safety cushion.
  const savings = savingsBalance(b);
  const afterPayments = savings - s.projectsDue;
  const safety = cushion(b);
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
          <Stat
            label={t("savingsBalance")}
            value={money(savings)}
            tone={tone("positive")}
            hint={s.projectsDue > 0 ? t("afterPayments", { amount: money(afterPayments) }) : undefined}
          />
        </div>
        {(s.projectsDue > 0 || s.projectsPaid > 0) && (
          <>
            <Separator />
            <Link href="/projects" className="-m-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
              <HammerIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-muted-foreground">{t("projects.label")}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {t("projects.due", { amount: money(s.projectsDue) })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.projectsPaid > 0 && `${t("projects.paid", { amount: money(s.projectsPaid) })} · `}
                  {t("projects.hint")}
                </span>
                {s.projectsDue > 0 && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      !hidden && (afterPayments < safety ? "text-warning" : "text-positive")
                    )}
                  >
                    {afterPayments < safety ? (
                      <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <CircleCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {t(afterPayments < safety ? "projects.belowCushion" : "projects.aboveCushion", {
                      amount: money(afterPayments),
                      cushion: money(safety),
                    })}
                  </span>
                )}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </>
        )}
      </Card>
    </>
  );
}
