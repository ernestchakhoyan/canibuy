"use client";

import { formatMoney, type Period, periodRange, shiftPeriod, spendingByCategory, todayISO } from "@helper";
import { useLoadedBudget } from "@store";
import type { Entry } from "@type";
import { Card, EntryRow, Stat } from "@widget";
import { useState } from "react";

const PERIODS: Period[] = ["day", "week", "month", "year"];
const FILTERS = {
  All: () => true,
  Income: (e: Entry) => e.type === "income_salary" || e.type === "income_extra",
  Outcomes: (e: Entry) => e.type === "expense" || e.type === "bill_paid",
  Savings: (e: Entry) => e.type === "saving" || e.type === "withdrawal",
};
type Filter = keyof typeof FILTERS;

const total = (entries: Entry[]) => entries.reduce((t, e) => t + e.amount, 0);

export function History() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(todayISO);
  const [filter, setFilter] = useState<Filter>("All");

  const [from, to] = periodRange(period, date);
  const entries = b.entries
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));
  const income = total(entries.filter(FILTERS.Income));
  const outcomes = total(entries.filter(FILTERS.Outcomes));
  const saved = total(entries.filter((e) => e.type === "saving"));
  const taken = total(entries.filter((e) => e.type === "withdrawal"));
  const byCategory = spendingByCategory(entries);

  return (
    <>
      <Card>
        <fieldset className="grid grid-cols-4 gap-1">
          <legend className="sr-only">Period</legend>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === period}
              className={`btn btn-small capitalize ${p === period ? "btn-primary" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-small"
            aria-label="Previous period"
            onClick={() => setDate(shiftPeriod(period, date, -1))}
          >
            ‹
          </button>
          <input
            type="date"
            aria-label="Date"
            className="input flex-1"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-small"
            aria-label="Next period"
            onClick={() => setDate(shiftPeriod(period, date, 1))}
          >
            ›
          </button>
          <button type="button" className="btn btn-small" onClick={() => setDate(todayISO())}>
            Today
          </button>
        </div>
        <p className="text-xs text-muted">{from === to ? from : `${from} – ${to}`}</p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Stat label="Income" value={money(income)} tone="positive" />
        </Card>
        <Card>
          <Stat label="Outcomes" value={money(outcomes)} tone="negative" />
        </Card>
      </div>
      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Saved" value={money(saved)} />
          <Stat label="Taken out" value={money(taken)} />
          <Stat label="Left" value={money(income - outcomes - saved + taken)} />
        </div>
      </Card>

      {byCategory.length > 0 && (
        <Card title="By category">
          <ul className="flex flex-col gap-1 text-sm">
            {byCategory.map(({ category, amount }) => (
              <li key={category} className="flex justify-between">
                <span>{category || "Uncategorized"}</span>
                <span className="tabular-nums">
                  {money(amount)} · {Math.round((amount / outcomes) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Entries">
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Filter entries</legend>
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={f === filter}
              className={`btn btn-small ${f === filter ? "btn-primary" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </fieldset>
        {entries.filter(FILTERS[filter]).length === 0 ? (
          <p className="text-sm text-muted">Nothing in this period.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.filter(FILTERS[filter]).map((e) => (
              <EntryRow key={e.id} entry={e} money={money} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
