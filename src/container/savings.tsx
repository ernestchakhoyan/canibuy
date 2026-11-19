"use client";

import { cushion, formatMoney, parseAmount, savingsBalance, usableSavings } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import {
  Button,
  Card,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Stat,
} from "@widget";
import { ArrowDownToLineIcon, ArrowUpFromLineIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

export function SavingsOverview() {
  const t = useTranslations("savings");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);

  return (
    <Card>
      <Stat big label={t("balance")} value={money(savingsBalance(b))} />
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <Stat
          label={t("cushion")}
          value={money(cushion(b))}
          hint={t("cushionHint", { count: b.settings.cushionMonths })}
        />
        <Stat label={t("available")} value={money(usableSavings(b))} tone="positive" />
      </div>
    </Card>
  );
}

/** `onDone` runs after a successful save (the quick-add sheet closes itself with it). */
export function SavingsForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("savings");
  const id = useId(); // also rendered in the quick-add sheet, so ids must be unique
  const b = useLoadedBudget();
  const [error, setError] = useState("");
  const openOrders = b.orders.filter((o) => o.status === "Planned" || o.status === "Saving");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError(t("errorAmount"));
    if (action === "take" && amount > savingsBalance(b)) return setError(t("errorBalance"));
    budgetActions.addEntry({
      type: action === "take" ? "withdrawal" : "saving",
      amount,
      note: String(form.get("note")).trim(),
      linkId: action === "take" ? "" : String(form.get("order") ?? ""),
    });
    setError("");
    event.currentTarget.reset();
    onDone?.();
  };

  return (
    <Card title={t("moveTitle")}>
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor={`${id}-amount`}>{t("amount")}</FieldLabel>
            <Input
              id={`${id}-amount`}
              name="amount"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field data-disabled={openOrders.length === 0 || undefined}>
            <FieldLabel htmlFor={`${id}-order`}>{t("forOrder")}</FieldLabel>
            <NativeSelect id={`${id}-order`} name="order" className="w-full" disabled={openOrders.length === 0}>
              <NativeSelectOption value="">{t("none")}</NativeSelectOption>
              {openOrders.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor={`${id}-note`}>{t("note")}</FieldLabel>
            <Input id={`${id}-note`} name="note" placeholder={t("optional")} />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" name="action" value="add">
            <ArrowDownToLineIcon data-icon="inline-start" />
            {t("add")}
          </Button>
          <Button type="submit" name="action" value="take" variant="outline">
            <ArrowUpFromLineIcon data-icon="inline-start" />
            {t("take")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
