"use client";

import {
  formatMoney,
  type Period,
  parseISODate,
  periodRange,
  shiftPeriod,
  spendingByCategory,
  todayISO,
} from "@helper";
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
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

const PERIODS: Period[] = ["day", "week", "month", "year"];
const FILTERS = {
  all: () => true,
  income: (e: Entry) => e.type === "income_salary" || e.type === "income_extra",
  outcomes: (e: Entry) => e.type === "expense" || e.type === "bill_paid",
  savings: (e: Entry) => e.type === "saving" || e.type === "withdrawal",
};
type Filter = keyof typeof FILTERS;

const total = (entries: Entry[]) => entries.reduce((t, e) => t + e.amount, 0);

export function History() {
  const t = useTranslations("history");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const day = (iso: string) => parseISODate(iso).toLocaleDateString(locale, { dateStyle: "medium" });
  const [period, setPeriod] = useState<Period>("month");
  const [date, setDate] = useState(todayISO);
  const [filter, setFilter] = useState<Filter>("all");

  const [from, to] = periodRange(period, date);
  const entries = b.entries
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));
  const income = total(entries.filter(FILTERS.income));
  const outcomes = total(entries.filter(FILTERS.outcomes));
  const saved = total(entries.filter((e) => e.type === "saving"));
  const taken = total(entries.filter((e) => e.type === "withdrawal"));
  const byCategory = spendingByCategory(entries);

  return (
    <>
      <Card>
        <ToggleGroup
          aria-label={t("period")}
          variant="outline"
          className="grid w-full grid-cols-4"
          value={[period]}
          onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p} value={p}>
              {t(`periods.${p}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("previous")}
            onClick={() => setDate(shiftPeriod(period, date, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Input
            type="date"
            aria-label={t("date")}
            className="flex-1"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={t("next")}
            onClick={() => setDate(shiftPeriod(period, date, 1))}
          >
            <ChevronRightIcon />
          </Button>
          <Button variant="secondary" onClick={() => setDate(todayISO())}>
            {t("today")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{from === to ? day(from) : `${day(from)} – ${day(to)}`}</p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <Stat label={t("income")} value={money(income)} tone="positive" />
        </Card>
        <Card>
          <Stat label={t("outcomes")} value={money(outcomes)} tone="negative" />
        </Card>
      </div>
      <Card>
        <div className="grid grid-cols-3 gap-4">
          <Stat label={t("saved")} value={money(saved)} />
          <Stat label={t("taken")} value={money(taken)} />
          <Stat label={t("left")} value={money(income - outcomes - saved + taken)} />
        </div>
      </Card>

      {byCategory.length > 0 && (
        <Card title={t("byCategory")}>
          <ul className="flex flex-col gap-3 text-sm">
            {byCategory.map(({ category, amount }) => (
              <li key={category} className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span>{category || t("uncategorized")}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(amount)} · {Math.round((amount / outcomes) * 100)}%
                  </span>
                </div>
                <Progress
                  value={amount}
                  max={outcomes}
                  aria-label={t("share", { category: category || t("uncategorized") })}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t("entries")}>
        <ToggleGroup
          aria-label={t("filter")}
          className="flex-wrap"
          value={[filter]}
          onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
        >
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <ToggleGroupItem key={f} value={f}>
              {t(`filters.${f}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {entries.filter(FILTERS[filter]).length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
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
