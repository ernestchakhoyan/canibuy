"use client";

import { formatMoney, monthOf, spendingByCategory, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import { Card, Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, EntryRow, Progress } from "@widget";
import { ReceiptIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export function MonthExpenses() {
  const t = useTranslations("month");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency, locale);
  const month = monthOf(todayISO());
  const expenses = b.entries
    .filter((e) => e.type === "expense" && monthOf(e.date) === month)
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));
  const byCategory = spendingByCategory(expenses);
  const total = expenses.reduce((t, e) => t + e.amount, 0);

  return (
    <>
      {byCategory.length > 0 && (
        <Card title={t("byCategory")}>
          <ul className="flex flex-col gap-3">
            {byCategory.map(({ category, amount }) => (
              <li key={category} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>{category}</span>
                  <span className="tabular-nums text-muted-foreground">{money(amount)}</span>
                </div>
                <Progress value={amount} max={total} aria-label={t("categoryShare", { category })} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={t("expenses")}>
        {expenses.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptIcon />
              </EmptyMedia>
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{t("empty.description")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {expenses.map((e) => (
              <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
