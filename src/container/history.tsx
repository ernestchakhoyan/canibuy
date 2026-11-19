"use client";

import { formatMoney, type Period, periodRange, shiftPeriod, spendingByCategory, todayISO } from "@helper";
import { useLoadedBudget } from "@store";
import type { Entry } from "@type";
import {
  Button,
  Card,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  EntryRow,
  Input,
  Progress,
  Stat,
  ToggleGroup,
  ToggleGroupItem,
} from "@widget";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
        <ToggleGroup
          aria-label="Period"
          variant="outline"
          className="grid w-full grid-cols-4"
          value={[period]}
          onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p} value={p} className="capitalize">
              {p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous period"
            onClick={() => setDate(shiftPeriod(period, date, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Input
            type="date"
            aria-label="Date"
            className="flex-1"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next period"
            onClick={() => setDate(shiftPeriod(period, date, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Button variant="secondary" onClick={() => setDate(todayISO())}>
            Today
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{from === to ? from : `${from} – ${to}`}</p>
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
          <ul className="flex flex-col gap-3 text-sm">
            {byCategory.map(({ category, amount }) => (
              <li key={category} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>{category || "Uncategorized"}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(amount)} · {Math.round((amount / outcomes) * 100)}%
                  </span>
                </div>
                <Progress value={amount} max={outcomes} aria-label={`${category || "Uncategorized"} share`} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Entries">
        <ToggleGroup
          aria-label="Filter entries"
          className="flex-wrap"
          value={[filter]}
          onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
        >
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {f}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {entries.filter(FILTERS[filter]).length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Nothing here yet</EmptyTitle>
              <EmptyDescription>No entries in this period.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {entries.filter(FILTERS[filter]).map((e) => (
              <EntryRow key={e.id} entry={e} money={money} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
