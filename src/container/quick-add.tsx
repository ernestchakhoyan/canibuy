"use client";

import { haptic } from "@helper";
import { BudgetGate } from "@layout";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@widget";
import { ArrowLeftIcon, PiggyBankIcon, PlusIcon, ReceiptIcon, ShoppingBagIcon, WalletIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ExpenseForm } from "./expense-form";
import { IncomeForm } from "./income";
import { OrderForm } from "./orders";
import { SavingsForm } from "./savings";

const ACTIONS = {
  expense: { icon: ReceiptIcon, Form: ExpenseForm },
  income: { icon: WalletIcon, Form: IncomeForm },
  savings: { icon: PiggyBankIcon, Form: SavingsForm },
  order: { icon: ShoppingBagIcon, Form: OrderForm },
};
type Action = keyof typeof ACTIONS;

/** Center "+" of the bottom bar: a sheet that picks an action, then shows that action's form in place. */
export function QuickAdd() {
  const t = useTranslations("quickAdd");
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const current = action && ACTIONS[action];

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAction(null);
      }}
    >
      <SheetTrigger
        onClick={haptic}
        render={
          <Button
            size="icon-lg"
            aria-label={t("title")}
            className="size-14 -translate-y-3 rounded-full shadow-lg shadow-primary/30 ring-4 ring-background"
          />
        }
      >
        <PlusIcon className="size-6" />
      </SheetTrigger>
      <SheetContent
        open={open}
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-2xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="flex-row items-center gap-2 pr-14">
          {current && (
            <Button variant="ghost" size="icon-sm" aria-label={t("back")} onClick={() => setAction(null)}>
              <ArrowLeftIcon />
            </Button>
          )}
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="text-lg font-semibold">
              {action ? t(`actions.${action}.label`) : t("title")}
            </SheetTitle>
            <SheetDescription>{action ? t(`actions.${action}.hint`) : t("prompt")}</SheetDescription>
          </div>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          {current ? (
            // The sheet header already names the form: drop the form card's own frame and title.
            <div className="[&_[data-slot=card]]:overflow-visible [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:py-0 [&_[data-slot=card]]:ring-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-header]]:hidden">
              {/* overflow-visible: with its padding gone, the card's clipping cut the edge buttons' borders and rings. */}
              <BudgetGate>
                <current.Form onDone={() => setOpen(false)} />
              </BudgetGate>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {(Object.keys(ACTIONS) as Action[]).map((key) => {
                const { icon: Icon } = ACTIONS[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setAction(key)}
                      className="flex h-full w-full flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{t(`actions.${key}.label`)}</span>
                        <span className="text-xs text-muted-foreground">{t(`actions.${key}.hint`)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
