"use client";

import {
  cn,
  cushion,
  type ForecastMonth,
  formatMoney,
  monthLabel,
  savingsBalance,
  savingsForecast,
  todayISO,
} from "@helper";
import { useLoadedBudget } from "@store";
import {
  Button,
  Card,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  maskedMoney,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
} from "@widget";
import { ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

const RANGES = [12, 24] as const;
type Range = (typeof RANGES)[number];

const config = { balance: { label: "balance", color: "var(--primary)" } } satisfies ChartConfig;

/**
 * Savings balance month by month for the next 1 or 2 years, with recurring bills as they start and end. Pick a
 * month (the select, a tap on the chart or a table row) to see its balance and how much it changes that month.
 */
export function SavingsForecast() {
  const t = useTranslations("forecast");
  const locale = useLocale();
  const b = useLoadedBudget();
  const selectId = useId();
  const [range, setRange] = useState<Range>(12);
  /** Months ahead of this one; `null` = the end of the range. */
  const [picked, setPicked] = useState<number | null>(null);
  const hidden = b.personal.amountsHidden ?? true;
  const money = (n: number) =>
    hidden ? maskedMoney(b.settings.currency) : formatMoney(Math.round(n), b.settings.currency, locale);
  const signed = (n: number) => (hidden ? money(n) : `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`);
  const changeTone = (n: number) => (hidden ? "" : n < 0 ? "text-negative" : "text-positive");
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const short = (month: string) =>
    new Date(`${month}-01T00:00`).toLocaleDateString(locale, {
      month: "short",
      ...(month.endsWith("-01") && { year: "2-digit" }),
    });
  const ahead = (i: number) => (i === 0 ? t("thisMonth") : t("inMonths", { count: i }));

  // This month + `range` months ahead.
  const data = savingsForecast(b, todayISO(), range + 1);
  const index = Math.min(picked ?? range, range);
  const selected = data[index];
  const safety = cushion(b);
  const runsOut = data.find((f) => f.balance < 0);
  const belowCushion = data.find((f) => f.balance < safety);
  const status = runsOut
    ? {
        icon: TriangleAlertIcon,
        tone: "text-negative",
        text: t("runsOut", { month: monthLabel(runsOut.month, locale) }),
      }
    : belowCushion
      ? {
          icon: CircleAlertIcon,
          tone: "text-warning",
          text: t("belowCushion", { month: monthLabel(belowCushion.month, locale) }),
        }
      : { icon: CircleCheckIcon, tone: "text-positive", text: t("onTrack") };
  const StatusIcon = status.icon;
  const sinceNow = selected.balance - savingsBalance(b);

  return (
    <Card
      title={t("title")}
      description={t("description")}
      action={
        <ToggleGroup
          aria-label={t("range")}
          variant="outline"
          size="sm"
          value={[String(range)]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setRange(Number(v[0]) as Range);
            setPicked(null);
          }}
        >
          {RANGES.map((r) => (
            <ToggleGroupItem key={r} value={String(r)}>
              {t("years", { count: r / 12 })}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={selectId} className="text-sm text-muted-foreground">
          {t("pick")}
        </label>
        <NativeSelect id={selectId} value={index} onChange={(e) => setPicked(Number(e.target.value))}>
          {data.map((f, i) => (
            <NativeSelectOption key={f.month} value={i}>
              {`${ahead(i)} · ${monthLabel(f.month, locale)}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{money(selected.balance)}</span>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("monthChange")}</dt>
            <dd className={cn("font-medium tabular-nums", changeTone(selected.change))}>{signed(selected.change)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("sinceNow")}</dt>
            <dd className={cn("font-medium tabular-nums", changeTone(sinceNow))}>{signed(sinceNow)}</dd>
          </div>
        </dl>
        <p className={cn("mt-1 flex items-center gap-1.5 text-sm", !hidden && status.tone)}>
          <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
          {status.text}
        </p>
      </div>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          accessibilityLayer
          onClick={(state) => typeof state.activeIndex === "number" && setPicked(state.activeIndex)}
        >
          <defs>
            <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-balance)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-balance)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={short}
          />
          <YAxis
            hide={hidden}
            width={44}
            tickLine={false}
            axisLine={false}
            tickFormatter={(n: number) => compact.format(n)}
          />
          {safety > 0 && (
            <ReferenceLine y={safety} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} />
          )}
          {runsOut && <ReferenceLine y={0} stroke="var(--negative)" strokeWidth={1} />}
          <ReferenceLine x={selected.month} stroke="var(--color-balance)" strokeOpacity={0.5} strokeWidth={1} />
          <ChartTooltip
            cursor
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) => monthLabel(String(payload[0]?.payload.month ?? ""), locale)}
                formatter={(value, _name, item) => (
                  <span className="flex w-full flex-col gap-0.5">
                    <span className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t("balance")}</span>
                      <span className="font-medium tabular-nums">{money(Number(value))}</span>
                    </span>
                    <span className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{t("monthChange")}</span>
                      <span className="font-medium tabular-nums">{signed(Number(item.payload.change))}</span>
                    </span>
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="balance"
            type="monotone"
            stroke="var(--color-balance)"
            strokeWidth={2}
            fill="url(#forecast-fill)"
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ChartContainer>
      {safety > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden="true" className="w-4 border-t border-dashed border-muted-foreground" />
          {t("cushion", { amount: money(safety) })}
        </p>
      )}
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="outline" className="group w-full" />}>
          {t("byMonth")}
          <ChevronDownIcon data-icon="inline-end" className="transition-transform group-data-panel-open:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("month")}</TableHead>
                <TableHead className="text-right">{t("monthChange")}</TableHead>
                <TableHead className="text-right">{t("balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((f, i) => (
                <Fragment key={f.month}>
                  <TableRow
                    data-state={i === index ? "selected" : undefined}
                    aria-expanded={i === index}
                    className="cursor-pointer"
                    onClick={() => setPicked(i)}
                  >
                    <TableCell>{monthLabel(f.month, locale)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", changeTone(f.change))}>
                      {signed(f.change)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(f.balance)}</TableCell>
                  </TableRow>
                  {i === index && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="whitespace-normal">
                        <Breakdown month={f} signed={signed} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/** How a month's change adds up: each part with its sign, zero parts left out, the change last. */
function Breakdown({ month: f, signed }: { month: ForecastMonth; signed: (n: number) => string }) {
  const t = useTranslations("forecast.breakdown");
  const rows = [
    { key: "income", value: f.income },
    { key: "bills", value: -f.bills },
    { key: "toSavings", value: f.toSavings },
    { key: "spending", value: -f.spending },
    { key: "projects", value: -f.projects },
  ] as const;
  return (
    <dl className="flex flex-col gap-1 py-1 text-sm">
      {rows
        .filter((r) => Math.round(r.value) !== 0)
        .map((r) => (
          <div key={r.key} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t(r.key)}</dt>
            <dd className="tabular-nums">{signed(r.value)}</dd>
          </div>
        ))}
      <div className="flex justify-between gap-4 border-t pt-1 font-medium">
        <dt>{t("total")}</dt>
        <dd className="tabular-nums">{signed(f.change)}</dd>
      </div>
    </dl>
  );
}
