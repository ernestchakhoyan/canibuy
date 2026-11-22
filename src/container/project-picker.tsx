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
import { type ReactNode, useId, useState } from "react";

type SheetProps = {
  item: string;
  price: number;
  /** An order's own deadline and bank terms; Setup's when missing. */
  terms?: Pick<Order, "deadlineMonths" | "loanRate" | "loanTermMonths">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  action: ReactNode;
  /** Pre-selected way, when it applies; else the first save-then-borrow row that fits; else the first way. */
  suggested?: PayChoice;
  onConfirm: (choice: PayChoice, parts: ReturnType<typeof projectPartsFor>) => void;
};

/** "How will you pay for {item}?": every way that applies to `price`, each with the payments it makes. */
export function PayChoiceSheet({
  item,
  price,
  terms,
  open,
  onOpenChange,
  title,
  action,
  suggested,
  onConfirm,
}: SheetProps) {
  const t = useTranslations("orders.toProject");
  const ta = useTranslations("orders.afford");
  const locale = useLocale();
  const id = useId();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const months = (count: number) => ta("months", { count });
  const today = todayISO();
  const o = affordOptions(b, { deadlineMonths: null, ...terms, price }, today);
  const choices = payChoices(o);
  const fallback = o.combos.filter((c) => c.fits).map((c) => `combo-${c.wait}` as const)[0];
  const [choice, setChoice] = useState<PayChoice | undefined>(undefined);
  const selected =
    choice ??
    (suggested && choices.includes(suggested)
      ? suggested
      : fallback && choices.includes(fallback)
        ? fallback
        : choices[0]);

  const partsFor = (c: PayChoice) =>
    projectPartsFor(o, price, c, today, {
      purchase: item,
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
        ? t("now.detail", { price: money(price) })
        : c === "save"
          ? t("save.detail", {
              price: money(price),
              month: monthLabel(o.save.readyMonth ?? "", locale),
              months: months(o.save.months),
            })
          : c === "bank"
            ? t("bank.detail", {
                ...financed,
                down: money(price - o.borrow),
                hasDown: price - o.borrow > 0 ? "yes" : "no",
                payment: money(bank?.payment ?? 0),
              })
            : c === "friend"
              ? t("friend.detail", {
                  ...financed,
                  down: money(price - o.borrow),
                  hasDown: price - o.borrow > 0 ? "yes" : "no",
                  payment: money(o.friend.perMonth),
                })
              : t("combo.detail", {
                  ...financed,
                  down: money(price - (combo?.borrow ?? 0)),
                  month: monthLabel(combo?.buyMonth ?? "", locale),
                  payment: money(combo?.payment ?? 0),
                });
    const fits = c === "bank" ? bank?.fits : combo ? combo.fits : undefined;
    return { label, detail, total, fits };
  };

  const confirm = () => {
    if (!selected) return;
    haptic();
    onConfirm(selected, partsFor(selected));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        open={open}
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
          <SheetDescription>{t("description", { item })}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4">
          <RadioGroup
            value={selected}
            onValueChange={(v) => setChoice(v as PayChoice)}
            aria-label={t("description", { item })}
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
          <Button onClick={confirm} disabled={!selected}>
            {action}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

type Props = { order: Order; open: boolean; onOpenChange: (open: boolean) => void };

/** "Make it a project": pick how the order is paid; the project gets the matching payments as parts. */
export function ProjectPicker({ order, open, onOpenChange }: Props) {
  const t = useTranslations("orders.toProject");
  const router = useRouter();
  const b = useLoadedBudget();
  const { verdict } = orderVerdict(b, order, todayISO());
  const suggested: PayChoice | undefined =
    (verdict === "pay_now" && "now") ||
    (verdict === "save_up" && "save") ||
    (verdict === "loan" && "bank") ||
    undefined;
  return (
    <PayChoiceSheet
      item={order.item}
      price={order.price}
      terms={order}
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      suggested={suggested}
      action={
        <>
          <HammerIcon data-icon="inline-start" />
          {t("create")}
        </>
      }
      onConfirm={(_, parts) => router.push(`/projects/${budgetActions.orderToProject(order.id, parts)}`)}
    />
  );
}
