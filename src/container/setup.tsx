"use client";

import { cn, formatMoney, monthLabel, parseAmount } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Settings } from "@type";
import {
  AmountsToggle,
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
  maskedMoney,
  NativeSelect,
  NativeSelectOption,
} from "@widget";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

/** Stored as the symbol: `formatMoney` and the sheet's `currency` row use it as is. */
const CURRENCIES = [
  { symbol: "֏", key: "amd" },
  { symbol: "$", key: "usd" },
  { symbol: "€", key: "eur" },
] as const;

const NUMBER_FIELDS = [
  "usualIncome",
  "openingSavings",
  "cushionMonths",
  "loanRate",
  "loanTermMonths",
] as const satisfies (keyof Settings)[];

/** Amounts of money, masked until the eye button shows them. The other fields are months and a rate. */
const MONEY_FIELDS: readonly (keyof Settings)[] = ["usualIncome", "openingSavings"];

export function SettingsForm() {
  const t = useTranslations("setup");
  const b = useLoadedBudget();
  const [saved, setSaved] = useState(false);
  const moneyHidden = b.personal.amountsHidden ?? true; // the eye: a Personal setting, synced with the sheet

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numbers = Object.fromEntries(
      NUMBER_FIELDS.map((name) => [name, Math.max(0, parseAmount(String(form.get(name))) ?? 0)])
    );
    budgetActions.updateSettings({ ...numbers, currency: String(form.get("currency")).trim() || "֏" });
    setSaved(true);
  };

  return (
    <Card
      title={t("settings.title")}
      action={
        <AmountsToggle
          hidden={moneyHidden}
          onToggle={() => budgetActions.updatePersonal({ amountsHidden: !moneyHidden })}
        />
      }
    >
      {/* key: the inputs are uncontrolled; re-mount when the settings change underneath (read back from the sheet). */}
      <form key={JSON.stringify(b.settings)} onSubmit={submit} onChange={() => setSaved(false)}>
        <FieldGroup className="grid grid-cols-2 items-end gap-4">
          <Field>
            <FieldLabel htmlFor="setup-currency">{t("settings.currency")}</FieldLabel>
            <NativeSelect id="setup-currency" name="currency" defaultValue={b.settings.currency} className="w-full">
              {CURRENCIES.map(({ symbol, key }) => (
                <NativeSelectOption key={key} value={symbol}>
                  {symbol} {t(`currencies.${key}`)}
                </NativeSelectOption>
              ))}
              {/* A symbol typed in before this became a dropdown: keep it selectable so saving doesn't change it. */}
              {!CURRENCIES.some((c) => c.symbol === b.settings.currency) && (
                <NativeSelectOption value={b.settings.currency}>{b.settings.currency}</NativeSelectOption>
              )}
            </NativeSelect>
          </Field>
          {NUMBER_FIELDS.map((name) => {
            const masked = moneyHidden && MONEY_FIELDS.includes(name);
            return (
              <Field key={name}>
                <FieldLabel htmlFor={`setup-${name}`}>{t(`settings.${name}`)}</FieldLabel>
                {/* The real input stays mounted while masked: unsaved edits survive, and the form still submits it. */}
                <Input
                  id={masked ? undefined : `setup-${name}`}
                  name={name}
                  inputMode="decimal"
                  defaultValue={b.settings[name]}
                  hidden={masked}
                />
                {masked && (
                  <Input
                    id={`setup-${name}`}
                    readOnly
                    value={maskedMoney(b.settings.currency)}
                    aria-description={t("settings.amountHidden")}
                    className="cursor-pointer text-muted-foreground"
                    onClick={() => budgetActions.updatePersonal({ amountsHidden: false })}
                  />
                )}
              </Field>
            );
          })}
          <Button type="submit" className="col-span-2">
            {saved && <CheckIcon data-icon="inline-start" />}
            {saved ? t("saved") : t("save")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function BillsEditor() {
  const t = useTranslations("setup");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency, locale);
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    const dueDay = Number(form.get("dueDay"));
    if (!amount || amount <= 0) return setError(t("bills.amountError"));
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
    <Card title={t("bills.title")}>
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
                  {t("bills.billLine", { name: bill.name, day: bill.dueDay })}
                  {bill.endMonth && (
                    <span className="block text-xs text-muted-foreground">
                      {t("bills.range", {
                        from: monthLabel(bill.startMonth ?? bill.endMonth, locale),
                        to: monthLabel(bill.endMonth, locale),
                      })}
                    </span>
                  )}
                </Label>
              </Field>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium tabular-nums">{money(bill.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove", { name: bill.name })}
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
            <FieldLabel htmlFor="bill-name">{t("bills.name")}</FieldLabel>
            <Input id="bill-name" name="name" required placeholder={t("bills.namePlaceholder")} />
          </Field>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="bill-amount">{t("bills.amount")}</FieldLabel>
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
            <FieldLabel htmlFor="bill-due">{t("bills.dueDay")}</FieldLabel>
            <Input id="bill-due" name="dueDay" type="number" min={1} max={31} defaultValue={1} />
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor="bill-category">{t("bills.category")}</FieldLabel>
            <NativeSelect id="bill-category" name="category" className="w-full">
              {b.categories.map((c) => (
                <NativeSelectOption key={c.name}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            {t("bills.add")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

export function CategoriesEditor() {
  const t = useTranslations("setup");
  const b = useLoadedBudget();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (name) budgetActions.addCategory(name);
    event.currentTarget.reset();
  };

  return (
    <Card title={t("categories.title")}>
      <ul className="flex flex-wrap gap-2">
        {b.categories.map((c) => (
          <li key={c.name}>
            <Badge variant="secondary" className="h-9 gap-0 pr-0 pl-3 text-sm">
              {c.name}
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label={t("remove", { name: c.name })}
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
          {t("categories.new")}
        </Label>
        <Input id="new-category" name="name" required placeholder={t("categories.new")} />
        <Button type="submit" variant="secondary">
          <PlusIcon data-icon="inline-start" />
          {t("categories.add")}
        </Button>
      </form>
    </Card>
  );
}
