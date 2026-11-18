"use client";

import { parseAmount, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import { Card } from "@widget";
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
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field">
          Amount
          <input name="amount" inputMode="decimal" required autoComplete="off" className="input" placeholder="0" />
        </label>
        <label className="field">
          Category
          <select name="category" className="input">
            {b.categories.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <input name="date" type="date" defaultValue={todayISO()} className="input" />
        </label>
        <label className="field">
          Note
          <input name="note" className="input" placeholder="Optional" />
        </label>
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary col-span-2">
          Add expense
        </button>
      </form>
    </Card>
  );
}
