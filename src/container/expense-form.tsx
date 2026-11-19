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
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

/** `onDone` runs after a successful save (the quick-add sheet closes itself with it). */
export function ExpenseForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("expense");
  const id = useId(); // also rendered in the quick-add sheet, so ids must be unique
  const b = useLoadedBudget();
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError(t("amountError"));
    budgetActions.addEntry({
      type: "expense",
      amount,
      category: String(form.get("category")),
      date: String(form.get("date")) || todayISO(),
      note: String(form.get("note")).trim(),
    });
    setError("");
    event.currentTarget.reset();
    onDone?.();
  };

  return (
    <Card title={t("title")}>
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
          <Field>
            <FieldLabel htmlFor={`${id}-category`}>{t("category")}</FieldLabel>
            <NativeSelect id={`${id}-category`} name="category" className="w-full">
              {b.categories.map((c) => (
                <NativeSelectOption key={c.name}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>{t("date")}</FieldLabel>
            <Input id={`${id}-date`} name="date" type="date" defaultValue={todayISO()} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-note`}>{t("note")}</FieldLabel>
            <Input id={`${id}-note`} name="note" placeholder={t("optional")} />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            {t("submit")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}
