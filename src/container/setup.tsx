"use client";

import { cn, formatMoney, parseAmount } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Settings } from "@type";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@widget";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

const NUMBER_FIELDS: { name: keyof Settings; label: string }[] = [
  { name: "usualIncome", label: "Usual monthly income" },
  { name: "openingSavings", label: "Current savings" },
  { name: "cushionMonths", label: "Safety cushion (months of bills)" },
  { name: "loanRate", label: "Loan interest (% per year)" },
  { name: "loanTermMonths", label: "Loan term (months)" },
];

export function SettingsForm() {
  const b = useLoadedBudget();
  const [saved, setSaved] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numbers = Object.fromEntries(
      NUMBER_FIELDS.map(({ name }) => [name, Math.max(0, parseAmount(String(form.get(name))) ?? 0)])
    );
    budgetActions.updateSettings({ ...numbers, currency: String(form.get("currency")).trim() || "$" });
    setSaved(true);
  };

  return (
    <Card title="Money basics">
      <form onSubmit={submit} onChange={() => setSaved(false)}>
        <FieldGroup className="grid grid-cols-2 items-end gap-4">
          <Field>
            <FieldLabel htmlFor="setup-currency">Currency symbol</FieldLabel>
            <Input id="setup-currency" name="currency" defaultValue={b.settings.currency} maxLength={3} />
          </Field>
          {NUMBER_FIELDS.map(({ name, label }) => (
            <Field key={name}>
              <FieldLabel htmlFor={`setup-${name}`}>{label}</FieldLabel>
              <Input id={`setup-${name}`} name={name} inputMode="decimal" defaultValue={b.settings[name]} />
            </Field>
          ))}
          <Button type="submit" className="col-span-2">
            {saved && <CheckIcon data-icon="inline-start" />}
            {saved ? "Saved" : "Save"}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function BillsEditor() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency);
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    const dueDay = Number(form.get("dueDay"));
    if (!amount || amount <= 0) return setError("Enter an amount above 0");
    budgetActions.addBill({
      name: String(form.get("name")).trim(),
      amount,
      dueDay: dueDay >= 1 && dueDay <= 31 ? dueDay : 1,
      category: String(form.get("category")),
      active: true,
    });
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="Recurring bills">
      {b.bills.length > 0 && (
        <ul className="divide-y">
          {b.bills.map((bill) => (
            <li key={bill.id} className="flex items-center justify-between gap-2 py-1">
              <Field orientation="horizontal" className="min-h-11 w-auto">
                <Checkbox
                  id={`bill-${bill.id}`}
                  checked={bill.active}
                  onCheckedChange={(active) => budgetActions.updateBill(bill.id, { active })}
                />
                <Label
                  htmlFor={`bill-${bill.id}`}
                  className={cn("font-normal", !bill.active && "text-muted-foreground line-through")}
                >
                  {bill.name} · day {bill.dueDay}
                </Label>
              </Field>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium tabular-nums">{money(bill.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${bill.name}`}
                  onClick={() => budgetActions.removeBill(bill.id)}
                >
                  <XIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <FieldLabel htmlFor="bill-name">Name</FieldLabel>
            <Input id="bill-name" name="name" required placeholder="Rent" />
          </Field>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="bill-amount">Amount</FieldLabel>
            <Input
              id="bill-amount"
              name="amount"
              inputMode="decimal"
              required
              autoComplete="off"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bill-due">Due day</FieldLabel>
            <Input id="bill-due" name="dueDay" type="number" min={1} max={31} defaultValue={1} />
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor="bill-category">Category</FieldLabel>
            <NativeSelect id="bill-category" name="category" className="w-full">
              {b.categories.map((c) => (
                <NativeSelectOption key={c.name}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            Add bill
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function CategoriesEditor() {
  const b = useLoadedBudget();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (name) budgetActions.addCategory(name);
    event.currentTarget.reset();
  };

  return (
    <Card title="Categories">
      <ul className="flex flex-wrap gap-2">
        {b.categories.map((c) => (
          <li key={c.name}>
            <Badge variant="secondary" className="h-9 gap-0 pr-0 pl-3 text-sm">
              {c.name}
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={`Remove ${c.name}`}
                onClick={() => budgetActions.removeCategory(c.name)}
              >
                <XIcon />
              </Button>
            </Badge>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <Label className="sr-only" htmlFor="new-category">
          New category
        </Label>
        <Input id="new-category" name="name" required placeholder="New category" />
        <Button type="submit" variant="secondary">
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>
    </Card>
  );
}
