"use client";

import { formatMoney, orderVerdict, parseAmount, savedToward, todayISO, type Verdict } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Order } from "@type";
import { Card } from "@widget";
import { type FormEvent, useState } from "react";

const verdictText: Record<Verdict, { label: string; tone: string }> = {
  pay_now: { label: "You can pay now", tone: "text-positive" },
  save_up: { label: "Save up first", tone: "text-accent" },
  loan: { label: "A loan is an option", tone: "text-warning" },
  not_affordable: { label: "Not affordable now", tone: "text-negative" },
};

export function OrderForm() {
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = parseAmount(String(form.get("price")));
    const deadline = parseAmount(String(form.get("deadline")));
    if (!price || price <= 0) return setError("Enter a price above 0");
    budgetActions.addOrder({
      item: String(form.get("item")).trim(),
      price,
      deadlineMonths: deadline && deadline > 0 ? Math.round(deadline) : null,
      note: "",
    });
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="Can I afford it?">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field col-span-2">
          Item
          <input name="item" required className="input" placeholder="TV, sofa, laptop…" />
        </label>
        <label className="field">
          Price
          <input name="price" inputMode="decimal" required autoComplete="off" className="input" placeholder="20,000" />
        </label>
        <label className="field">
          Deadline (months)
          <input name="deadline" inputMode="numeric" autoComplete="off" className="input" placeholder="Optional" />
        </label>
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary col-span-2">
          Check order
        </button>
      </form>
    </Card>
  );
}

function OrderCard({ order }: { order: Order }) {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);
  const open = order.status === "Planned" || order.status === "Saving";
  const saved = savedToward(b, order.id);
  const { verdict, saveMonths, loan } = orderVerdict(b, order, todayISO());

  return (
    <Card
      title={`${order.item} · ${money(order.price)}`}
      action={<span className="text-xs text-muted">{order.status}</span>}
    >
      {open && (
        <>
          <p className={`text-sm font-medium ${verdictText[verdict].tone}`}>{verdictText[verdict].label}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Pay now</dt>
              <dd>{verdict === "pay_now" ? "Yes" : "Not yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Save up</dt>
              <dd>{Number.isFinite(saveMonths) ? `${saveMonths} mo` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Loan</dt>
              <dd>
                {money(loan.payment)}/mo
                <span className="block text-xs text-muted">+{money(loan.totalInterest)} interest</span>
              </dd>
            </div>
          </dl>
          {saved > 0 && (
            <div className="flex flex-col gap-1 text-xs text-muted">
              <span>
                Saved {money(saved)} of {money(order.price)}
              </span>
              <progress value={Math.min(saved, order.price)} max={order.price} aria-label="Saved toward order" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" onClick={() => budgetActions.buyOrder(order.id)}>
              Mark bought
            </button>
            <button type="button" className="btn" onClick={() => budgetActions.setOrderStatus(order.id, "Dropped")}>
              Drop
            </button>
          </div>
        </>
      )}
      {order.status === "Bought" && <p className="text-sm text-muted">Bought on {order.boughtDate}</p>}
    </Card>
  );
}

export function OrderList() {
  const b = useLoadedBudget();
  const rank = { Saving: 0, Planned: 1, Bought: 2, Dropped: 3 };
  const orders = [...b.orders].sort((a, z) => rank[a.status] - rank[z.status] || z.created.localeCompare(a.created));

  return orders.length === 0 ? (
    <p className="text-sm text-muted">No orders yet. Add one above to see if you can afford it.</p>
  ) : (
    orders.map((o) => <OrderCard key={o.id} order={o} />)
  );
}
