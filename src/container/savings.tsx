"use client";

import { cushion, formatMoney, parseAmount, savingsBalance, usableSavings } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import { Card, EntryRow, Stat } from "@widget";
import { type FormEvent, useState } from "react";

export function SavingsOverview() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);

  return (
    <Card>
      <Stat big label="Savings balance" value={money(savingsBalance(b))} />
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Safety cushion" value={money(cushion(b))} hint={`${b.settings.cushionMonths} months of bills`} />
        <Stat label="Available for orders and projects" value={money(usableSavings(b))} tone="positive" />
      </div>
    </Card>
  );
}

export function SavingsForm() {
  const b = useLoadedBudget();
  const [error, setError] = useState("");
  const openOrders = b.orders.filter((o) => o.status === "Planned" || o.status === "Saving");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const amount = parseAmount(String(form.get("amount")));
    if (!amount || amount <= 0) return setError("Enter an amount above 0");
    if (action === "take" && amount > savingsBalance(b)) return setError("You can't take more than your balance");
    budgetActions.addEntry({
      type: action === "take" ? "withdrawal" : "saving",
      amount,
      note: String(form.get("note")).trim(),
      linkId: action === "take" ? "" : String(form.get("order") ?? ""),
    });
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="Move money">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field">
          Amount
          <input name="amount" inputMode="decimal" required autoComplete="off" className="input" placeholder="0" />
        </label>
        <label className="field">
          For order
          <select name="order" className="input" disabled={openOrders.length === 0}>
            <option value="">None</option>
            {openOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.item}
              </option>
            ))}
          </select>
        </label>
        <label className="field col-span-2">
          Note
          <input name="note" className="input" placeholder="Optional" />
        </label>
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" name="action" value="add" className="btn btn-primary">
          Add to savings
        </button>
        <button type="submit" name="action" value="take" className="btn">
          Take from savings
        </button>
      </form>
    </Card>
  );
}

export function SavingsHistory() {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(n, b.settings.currency);
  const moves = b.entries
    .filter((e) => e.type === "saving" || e.type === "withdrawal")
    .sort((a, z) => z.date.localeCompare(a.date) || z.createdAt.localeCompare(a.createdAt));

  return (
    <Card title="Savings history">
      <p className="text-sm text-muted">Opening savings: {money(b.settings.openingSavings)}</p>
      {moves.length > 0 && (
        <ul className="divide-y divide-border">
          {moves.map((e) => (
            <EntryRow key={e.id} entry={e} money={money} onDelete={() => budgetActions.removeEntry(e.id)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
