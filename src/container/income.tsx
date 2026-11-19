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
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

const MONTHS_AHEAD = 24;

/** `onDone` runs after a successful save (the quick-add sheet closes itself with it). */
export function IncomeForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("income");
  const locale = useLocale();
  const id = useId(); // also rendered in the quick-add sheet, so ids must be unique
  const [error, setError] = useState("");
  const today = todayISO();
  const current = monthOf(today);
  const months = Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(current, i));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError(t("errorAmount"));
    const month = String(form.get("month"));
    budgetActions.addEntry({
      type: form.get("type") === "salary" ? "income_salary" : "income_extra",
      amount,
      date: month === current ? today : `${month}-01`,
      note: String(form.get("note")).trim(),
    });
    setError("");
    event.currentTarget.reset();
    onDone?.();
  };

  return (
    <Card title={t("addTitle")}>
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
            <FieldLabel htmlFor={`${id}-month`}>{t("month")}</FieldLabel>
            <NativeSelect id={`${id}-month`} name="month" className="w-full">
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {monthLabel(m, locale)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <FieldSet className="col-span-2">
            <RadioGroup name="type" defaultValue="salary" aria-label={t("type")} className="flex flex-wrap gap-x-6">
              <Field orientation="horizontal" className="min-h-11 w-auto">
                <RadioGroupItem value="salary" id={`${id}-salary`} />
                <Label htmlFor={`${id}-salary`} className="font-normal">
                  {t("salary")}
                </Label>
              </Field>
              <Field orientation="horizontal" className="min-h-11 w-auto">
                <RadioGroupItem value="extra" id={`${id}-extra`} />
                <Label htmlFor={`${id}-extra`} className="font-normal">
                  {t("extra")}
                </Label>
              </Field>
            </RadioGroup>
          </FieldSet>
          <Field className="col-span-2">
            <FieldLabel htmlFor={`${id}-note`}>{t("note")}</FieldLabel>
            <Input id={`${id}-note`} name="note" placeholder={t("optional")} />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            {t("add")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function IncomeList() {
  const t = useTranslations("income");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency, locale);
  const current = monthOf(todayISO());
  const income = b.entries
    .filter((e) => (e.type === "income_salary" || e.type === "income_extra") && monthOf(e.date) >= current)
    .sort((a, z) => a.date.localeCompare(z.date));

  return (
    <Card
      title={t("listTitle")}
      description={t("expected", { month: monthLabel(current, locale), amount: money(monthIncome(b, current)) })}
    >
      {income.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
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
