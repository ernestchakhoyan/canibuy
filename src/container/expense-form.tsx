"use client";

import { parseAmount, todayISO } from "@helper";
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
} from "@widget";
import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

export function ExpenseForm() {
  const b = useLoadedBudget();
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError("Enter an amount above 0");
    budgetActions.addEntry({
      type: "expense",
      amount,
      category: String(form.get("category")),
      date: String(form.get("date")) || todayISO(),
      note: String(form.get("note")).trim(),
    });
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="Add expense">
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
            <Input
              id="expense-amount"
              name="amount"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="expense-category">Category</FieldLabel>
            <NativeSelect id="expense-category" name="category" className="w-full">
              {b.categories.map((c) => (
                <NativeSelectOption key={c.name}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="expense-date">Date</FieldLabel>
            <Input id="expense-date" name="date" type="date" defaultValue={todayISO()} />
          </Field>
          <Field>
            <FieldLabel htmlFor="expense-note">Note</FieldLabel>
            <Input id="expense-note" name="note" placeholder="Optional" />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            Add expense
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
