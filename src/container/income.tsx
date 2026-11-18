"use client";

import { addMonths, formatMoney, monthIncome, monthLabel, monthOf, parseAmount, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import { Card, EntryRow } from "@widget";
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
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field">
          Amount
          <input name="amount" inputMode="decimal" required autoComplete="off" className="input" placeholder="0" />
        </label>
        <label className="field">
          Month
          <select name="month" className="input">
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="col-span-2 flex gap-4 text-sm">
          <legend className="sr-only">Income type</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="type" value="salary" defaultChecked /> Salary (replaces usual income)
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" name="type" value="extra" /> Extra
          </label>
        </fieldset>
        <label className="field col-span-2">
          Note
          <input name="note" className="input" placeholder="Optional" />
        </label>
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary col-span-2">
          Add income
        </button>
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
    <Card title="This month and upcoming">
      <p className="text-sm text-muted">
        {monthLabel(current)}: {money(monthIncome(b, current))} expected
      </p>
      {income.length === 0 ? (
        <p className="text-sm text-muted">No income entries. Months without a salary use your usual income.</p>
      ) : (
        <ul className="divide-y divide-border">
          {income.map((e) => (
            <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
