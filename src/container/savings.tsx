"use client";

import { cushion, formatMoney, parseAmount, savingsBalance, usableSavings } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import {
  Button,
  Card,
  EntryRow,
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
import { type FormEvent, useId, useState } from "react";

export function SavingsOverview() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);

  return (
    <Card>
      <Stat big label="Savings balance" value={money(savingsBalance(b))} />
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Safety cushion" value={money(cushion(b))} hint={`${b.settings.cushionMonths} months of bills`} />
        <Stat label="Available for orders and projects" value={money(usableSavings(b))} tone="positive" />
      </div>
    </Card>
  );
}

/** `onDone` runs after a successful save (the quick-add sheet closes itself with it). */
export function SavingsForm({ onDone }: { onDone?: () => void }) {
  const id = useId(); // also rendered in the quick-add sheet, so ids must be unique
  const b = useLoadedBudget();
  const [error, setError] = useState("");
  const openOrders = b.orders.filter((o) => o.status === "Planned" || o.status === "Saving");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError("Enter an amount above 0");
    if (action === "take" && amount > savingsBalance(b)) return setError("You can't take more than your balance");
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
    <Card title="Move money">
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
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
            <FieldLabel htmlFor={`${id}-order`}>For order</FieldLabel>
            <NativeSelect id={`${id}-order`} name="order" className="w-full" disabled={openOrders.length === 0}>
              <NativeSelectOption value="">None</NativeSelectOption>
              {openOrders.map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor={`${id}-note`}>Note</FieldLabel>
            <Input id={`${id}-note`} name="note" placeholder="Optional" />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" name="action" value="add">
            <ArrowDownToLineIcon data-icon="inline-start" />
            Add to savings
          </Button>
          <Button type="submit" name="action" value="take" variant="outline">
            <ArrowUpFromLineIcon data-icon="inline-start" />
            Take out
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function SavingsHistory() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency);
  const moves = b.entries
    .filter((e) => e.type === "saving" || e.type === "withdrawal")
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));

  return (
    <Card title="Savings history" description={`Opening savings: ${money(b.settings.openingSavings)}`}>
      {moves.length > 0 && (
        <ul className="divide-y">
          {moves.map((e) => (
            <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
