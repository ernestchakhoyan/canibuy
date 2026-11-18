"use client";

import { formatMoney, monthSummary, savingsBalance, todayISO } from "@helper";
import { useLoadedBudget } from "@store";
import { Card, Stat } from "@widget";
import Link from "next/link";

export function MonthOverview() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);
  const s = monthSummary(b, todayISO());
  const needsSetup = b.settings.usualIncome === 0 && b.bills.length === 0;

  return (
    <>
      {needsSetup && (
        <Card>
          <p className="text-sm">
            Start by entering your usual income, savings and bills.{" "}
            <Link href="/setup" className="font-medium text-accent underline">
              Go to Setup
            </Link>
          </p>
        </Card>
      )}
      <Card>
        <Stat
          big
          label="Can still save this month"
          value={money(s.canStillSave)}
          tone={s.canStillSave > 0 ? "positive" : "default"}
        />
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Left this month" value={money(s.left)} tone={s.left < 0 ? "negative" : "default"} />
          <Stat label="Daily allowance" value={money(s.dailyAllowance)} hint={`${s.daysLeft} days left`} />
          <Stat label="Projected spend" value={money(s.projectedSpend)} hint={`${money(s.spent)} so far`} />
          <Stat label="Savings balance" value={money(savingsBalance(b))} />
        </div>
      </Card>
    </>
  );
}
