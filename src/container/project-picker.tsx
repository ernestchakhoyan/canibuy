"use client";

import {
  affordOptions,
  cn,
  formatMoney,
  haptic,
  monthLabel,
  orderVerdict,
  type PayChoice,
  payChoices,
  projectPartsFor,
  todayISO,
} from "@helper";
import { useRouter } from "@i18n";
import { budgetActions, useLoadedBudget } from "@store";
import type { Order } from "@type";
import {
  Button,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@widget";
import { HammerIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

type Props = { order: Order; open: boolean; onOpenChange: (open: boolean) => void };

/** "Make it a project": pick how the order is paid; the project gets the matching payments as parts. */
export function ProjectPicker({ order, open, onOpenChange }: Props) {
  const t = useTranslations("orders.toProject");
  const ta = useTranslations("orders.afford");
  const locale = useLocale();
  const id = useId();
  const router = useRouter();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const months = (count: number) => ta("months", { count });
  const today = todayISO();
  const o = affordOptions(b, order, today);
  const choices = payChoices(o);

  // Start on the way the verdict suggests; else the first save-then-borrow row that fits; else the first way.
  const { verdict } = orderVerdict(b, order, today);
  const suggested: PayChoice | undefined =
    (verdict === "pay_now" && "now") ||
    (verdict === "save_up" && "save") ||
    (verdict === "loan" && "bank") ||
    o.combos.filter((c) => c.fits).map((c) => `combo-${c.wait}` as const)[0];
  const [choice, setChoice] = useState<PayChoice | undefined>(undefined);
  const selected = choice ?? (suggested && choices.includes(suggested) ? suggested : choices[0]);

  const partsFor = (c: PayChoice) =>
    projectPartsFor(o, order.price, c, today, {
      purchase: order.item,
      fromSavings: t("parts.fromSavings"),
      loan: (i, n) => t("parts.loan", { i, n }),
      friend: (i, n) => t("parts.friend", { i, n }),
    });

  const describe = (c: PayChoice) => {
    const parts = partsFor(c);
    const total = parts.reduce((sum, p) => sum + p.cost, 0);
    const bank = o.bank.find((l) => l.months === o.term);
    const combo = o.combos.find((x) => `combo-${x.wait}` === c);
    const financed = { rate: o.rate, months: months(o.term) };
    const label =
      c === "now"
        ? t("now.label")
        : c === "save"
          ? t("save.label")
          : c === "bank"
            ? t("bank.label")
            : c === "friend"
              ? t("friend.label")
              : t("combo.label", { months: months(combo?.wait ?? 0) });
    const detail =
      c === "now"
        ? t("now.detail", { price: money(order.price) })
        : c === "save"
          ? t("save.detail", {
              price: money(order.price),
              month: monthLabel(o.save.readyMonth ?? "", locale),
              months: months(o.save.months),
            })
          : c === "bank"
            ? t("bank.detail", {
                ...financed,
                down: money(order.price - o.borrow),
                hasDown: order.price - o.borrow > 0 ? "yes" : "no",
                payment: money(bank?.payment ?? 0),
              })
            : c === "friend"
              ? t("friend.detail", {
                  ...financed,
                  down: money(order.price - o.borrow),
                  hasDown: order.price - o.borrow > 0 ? "yes" : "no",
                  payment: money(o.friend.perMonth),
                })
              : t("combo.detail", {
                  ...financed,
                  down: money(order.price - (combo?.borrow ?? 0)),
                  month: monthLabel(combo?.buyMonth ?? "", locale),
                  payment: money(combo?.payment ?? 0),
                });
    const fits = c === "bank" ? bank?.fits : combo ? combo.fits : undefined;
    return { label, detail, total, fits };
  };

  const create = () => {
    if (!selected) return;
    haptic();
    const projectId = budgetActions.orderToProject(order.id, partsFor(selected));
    onOpenChange(false);
    router.push(`/projects/${projectId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open}
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold">{t("title")}</SheetTitle>
          <SheetDescription>{t("description", { item: order.item })}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4">
          <RadioGroup
            value={selected}
            onValueChange={(v) => setChoice(v as PayChoice)}
            aria-label={t("description", { item: order.item })}
            className="gap-2"
          >
            {choices.map((c) => {
              const { label, detail, total, fits } = describe(c);
              return (
                <label
                  key={c}
                  htmlFor={`${id}-${c}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                    selected === c ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <RadioGroupItem value={c} id={`${id}-${c}`} className="mt-0.5" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {t("total", { amount: money(total) })}
                      </span>
                    </span>
                    <span className="text-muted-foreground">{detail}</span>
                    {fits === false && <span className="text-xs text-negative">{t("tooMuch")}</span>}
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
        <SheetFooter>
          <Button onClick={create} disabled={!selected}>
            <HammerIcon data-icon="inline-start" />
            {t("create")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
