"use client";

import { formatMoney, monthOf, spendingByCategory, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import { Card, EntryRow } from "@widget";

export function MonthExpenses() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency);
  const month = monthOf(todayISO());
  const expenses = b.entries
    .filter((e) => e.type === "expense" && monthOf(e.date) === month)
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));
  const byCategory = spendingByCategory(expenses);
  const total = expenses.reduce((t, e) => t + e.amount, 0);

  return (
    <>
      {byCategory.length > 0 && (
        <Card title="Spending by category">
          <ul className="flex flex-col gap-2">
            {byCategory.map(({ category, amount }) => (
              <li key={category} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{category}</span>
                  <span className="tabular-nums">{money(amount)}</span>
                </div>
                <progress value={amount} max={total} aria-label={`${category} share of spending`} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="This month's expenses">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted">No expenses yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {expenses.map((e) => (
              <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
