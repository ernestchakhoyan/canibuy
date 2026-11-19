"use client";

import {
  baseCurrency,
  CURRENCIES,
  cushion,
  formatMoney,
  haptic,
  parseAmount,
  savingsAccounts,
  savingsBalance,
  usableSavings,
} from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { CurrencyCode, Saving } from "@type";
import {
  AmountsToggle,
  Button,
  Card,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  maskedMoney,
  NativeSelect,
  NativeSelectOption,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Stat,
} from "@widget";
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, PlusIcon, XIcon } from "lucide-react";
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

/** An amount in its own currency, written the locale's way ("$2,000", "2 000 €"…). */
const inCurrency = (amount: number, currency: CurrencyCode, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

/** Add or edit one saving kept in its own currency. */
function SavingForm({ saving, onDone }: { saving?: Saving; onDone: () => void }) {
  const t = useTranslations("savings.accounts");
  const id = useId();
  const b = useLoadedBudget();
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = parseAmount(String(form.get("amount")));
    if (amount === null || amount < 0) return setError(t("errorAmount"));
    const change = {
      name: String(form.get("name")).trim(),
      amount,
      currency: String(form.get("currency")) as CurrencyCode,
    };
    if (saving) budgetActions.updateSaving(saving.id, change);
    else budgetActions.addSaving(change);
    setError("");
    event.currentTarget.reset();
    onDone();
  };

  return (
    <form key={saving?.id ?? "new"} onSubmit={submit}>
      <FieldGroup className="grid grid-cols-2 gap-4">
        <Field className="col-span-2">
          <FieldLabel htmlFor={`${id}-name`}>{t("name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={200}
            defaultValue={saving?.name}
            placeholder={t("namePlaceholder")}
          />
        </Field>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor={`${id}-amount`}>{t("amount")}</FieldLabel>
          <Input
            id={`${id}-amount`}
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            defaultValue={saving?.amount}
            aria-invalid={!!error || undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>{t("currency")}</FieldLabel>
          <NativeSelect
            id={`${id}-currency`}
            name="currency"
            defaultValue={saving?.currency ?? baseCurrency(b) ?? "AMD"}
            className="w-full"
          >
            {CURRENCIES.map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code} · {t(`currencies.${code}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {error && <FieldError className="col-span-2">{error}</FieldError>}
        <Button type="submit" className="col-span-2">
          {saving ? t("save") : t("add")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/**
 * Savings kept per currency (cash, deposits…). Each is converted to the base currency at today's rate, and the
 * total counts in the savings balance, so affordability, projects and the cushion all use it.
 */
export function SavingsAccounts() {
  const t = useTranslations("savings.accounts");
  const locale = useLocale();
  const b = useLoadedBudget();
  const hidden = b.personal.amountsHidden ?? true; // the eye: shared with This month and Setup, synced to the sheet
  const money = (n: number) =>
    hidden ? maskedMoney(b.settings.currency) : formatMoney(Math.round(n), b.settings.currency, locale);
  const own = (amount: number, currency: CurrencyCode) =>
    hidden ? maskedMoney(currency) : inCurrency(amount, currency, locale);
  const base = baseCurrency(b);
  const { rows, total, unconverted } = savingsAccounts(b);
  // Open sheet: undefined = closed, null = adding, a saving = editing it.
  const [editing, setEditing] = useState<Saving | null | undefined>(undefined);
  const open = editing !== undefined;

  return (
    <Card
      title={t("title")}
      description={rows.length === 0 ? t("empty") : undefined}
      action={
        <div className="flex items-center gap-1">
          {rows.length > 0 && (
            <AmountsToggle hidden={hidden} onToggle={() => budgetActions.updatePersonal({ amountsHidden: !hidden })} />
          )}
          <Button size="icon" aria-label={t("add")} title={t("add")} onClick={() => setEditing(null)}>
            <PlusIcon />
          </Button>
        </div>
      }
    >
      {rows.length > 0 && (
        <ul className="divide-y">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => {
                  haptic();
                  setEditing(s);
                }}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{own(s.amount, s.currency)}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {s.currency === base ? (
                    money(s.amount)
                  ) : s.inBase === null ? (
                    <span className="text-xs font-normal text-warning">{t("noRate")}</span>
                  ) : (
                    t("approx", { amount: money(s.inBase) })
                  )}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("remove", { name: s.name })}
                onClick={() => budgetActions.removeSaving(s.id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3 text-sm">
          <p className="flex justify-between gap-2 font-semibold tabular-nums">
            <span>{t("total")}</span>
            <span>{money(total)}</span>
          </p>
          {b.rates && rows.some((s) => s.currency !== base) && (
            <p className="text-xs text-muted-foreground">{t("ratesFrom", { date: b.rates.date })}</p>
          )}
          {base === null ? (
            <p className="text-xs text-warning">{t("customBase")}</p>
          ) : (
            unconverted.length > 0 && (
              <p className="text-xs text-warning">{t("unconverted", { currencies: unconverted.join(", ") })}</p>
            )
          )}
        </div>
      )}

      <Sheet open={open} onOpenChange={(next) => !next && setEditing(undefined)}>
        <SheetContent
          open={open}
          side="bottom"
          className="mx-auto max-h-[90dvh] max-w-2xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="pr-14">
            <SheetTitle className="text-lg font-semibold">{editing ? t("editTitle") : t("addTitle")}</SheetTitle>
            <SheetDescription>{t("sheetHint")}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <SavingForm saving={editing ?? undefined} onDone={() => setEditing(undefined)} />
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
