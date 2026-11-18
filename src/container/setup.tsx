"use client";

import { formatMoney, parseAmount } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Settings } from "@type";
import { Card } from "@widget";
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
      <form onSubmit={submit} onChange={() => setSaved(false)} className="grid grid-cols-2 gap-3">
        <label className="field">
          Currency symbol
          <input name="currency" defaultValue={b.settings.currency} maxLength={3} className="input" />
        </label>
        {NUMBER_FIELDS.map(({ name, label }) => (
          <label key={name} className="field">
            {label}
            <input name={name} inputMode="decimal" defaultValue={b.settings[name]} className="input" />
          </label>
        ))}
        <button type="submit" className="btn btn-primary col-span-2">
          {saved ? "Saved" : "Save"}
        </button>
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
        <ul className="divide-y divide-border">
          {b.bills.map((bill) => (
            <li key={bill.id} className="flex items-center justify-between gap-2 py-2">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bill.active}
                  onChange={(e) => budgetActions.updateBill(bill.id, { active: e.target.checked })}
                />
                <span className={bill.active ? "" : "text-muted line-through"}>
                  {bill.name} · day {bill.dueDay}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums">{money(bill.amount)}</span>
                <button
                  type="button"
                  className="btn btn-small"
                  aria-label={`Remove ${bill.name}`}
                  onClick={() => budgetActions.removeBill(bill.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field col-span-2">
          Name
          <input name="name" required className="input" placeholder="Rent" />
        </label>
        <label className="field">
          Amount
          <input name="amount" inputMode="decimal" required autoComplete="off" className="input" />
        </label>
        <label className="field">
          Due day
          <input name="dueDay" type="number" min={1} max={31} defaultValue={1} className="input" />
        </label>
        <label className="field col-span-2">
          Category
          <select name="category" className="input">
            {b.categories.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary col-span-2">
          Add bill
        </button>
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
          <li key={c.name} className="flex items-center gap-1 rounded-full border border-border pl-3 text-sm">
            {c.name}
            <button
              type="button"
              className="flex size-11 items-center justify-center text-muted"
              aria-label={`Remove ${c.name}`}
              onClick={() => budgetActions.removeCategory(c.name)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="new-category">
          New category
        </label>
        <input id="new-category" name="name" required className="input" placeholder="New category" />
        <button type="submit" className="btn">
          Add
        </button>
      </form>
    </Card>
  );
}
