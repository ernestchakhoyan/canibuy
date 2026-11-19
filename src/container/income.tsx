"use client";

import { addMonths, formatMoney, monthIncome, monthLabel, monthOf, parseAmount, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import {
  Button,
  Card,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  EntryRow,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  RadioGroup,
  RadioGroupItem,
} from "@widget";
import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

const MONTHS_AHEAD = 24;

export function IncomeForm() {
  const [error, setError] = useState("");
  const today = todayISO();
  const current = monthOf(today);
  const months = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(current, i));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError("Enter an amount above 0");
    const month = String(form.get("month"));
    budgetActions.addEntry({
      type: form.get("type") === "salary" ? "income_salary" : "income_extra",
      amount,
      date: month === current ? today : `${month}-01`,
      note: String(form.get("note")).trim(),
    });
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="Add income">
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="income-amount">Amount</FieldLabel>
            <Input
              id="income-amount"
              name="amount"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="income-month">Month</FieldLabel>
            <NativeSelect id="income-month" name="month" className="w-full">
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {monthLabel(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <FieldSet className="col-span-2">
            <RadioGroup name="type" defaultValue="salary" aria-label="Income type" className="flex flex-wrap gap-x-6">
              <Field orientation="horizontal" className="min-h-11 w-auto">
                <RadioGroupItem value="salary" id="income-salary" />
                <Label htmlFor="income-salary" className="font-normal">
                  Salary (replaces usual income)
                </Label>
              </Field>
              <Field orientation="horizontal" className="min-h-11 w-auto">
                <RadioGroupItem value="extra" id="income-extra" />
                <Label htmlFor="income-extra" className="font-normal">
                  Extra
                </Label>
              </Field>
            </RadioGroup>
          </FieldSet>
          <Field className="col-span-2">
            <FieldLabel htmlFor="income-note">Note</FieldLabel>
            <Input id="income-note" name="note" placeholder="Optional" />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            Add income
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function IncomeList() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency);
  const current = monthOf(todayISO());
  const income = b.entries
    .filter((e) => (e.type === "income_salary" || e.type === "income_extra") && monthOf(e.date) >= current)
    .sort((a, z) => a.date.localeCompare(z.date));

  return (
    <Card
      title="This month and upcoming"
      description={`${monthLabel(current)}: ${money(monthIncome(b, current))} expected`}
    >
      {income.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No income entries</EmptyTitle>
            <EmptyDescription>Months without a salary use your usual income.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y">
          {income.map((e) => (
            <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
