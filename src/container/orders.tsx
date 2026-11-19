"use client";

import { cn, formatMoney, orderVerdict, parseAmount, savedToward, todayISO, type Verdict } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Order } from "@type";
import {
  Badge,
  Button,
  Card,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Progress,
} from "@widget";
import {
  CheckCircle2Icon,
  CircleSlashIcon,
  LandmarkIcon,
  PiggyBankIcon,
  SearchCheckIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";

const verdictText: Record<Verdict, { label: string; tone: string; icon: typeof PiggyBankIcon }> = {
  pay_now: { label: "You can pay now", tone: "bg-positive/10 text-positive", icon: CheckCircle2Icon },
  save_up: { label: "Save up first", tone: "bg-brand-gold/15 text-brand-gold-ink", icon: PiggyBankIcon },
  loan: { label: "A loan is an option", tone: "bg-warning/10 text-warning", icon: LandmarkIcon },
  not_affordable: { label: "Not affordable now", tone: "bg-negative/10 text-negative", icon: CircleSlashIcon },
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
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <FieldLabel htmlFor="order-item">Item</FieldLabel>
            <Input id="order-item" name="item" required placeholder="TV, sofa, laptop…" />
          </Field>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor="order-price">Price</FieldLabel>
            <Input
              id="order-price"
              name="price"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="20,000"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="order-deadline">Deadline (months)</FieldLabel>
            <Input id="order-deadline" name="deadline" inputMode="numeric" autoComplete="off" placeholder="Optional" />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <SearchCheckIcon data-icon="inline-start" />
            Check order
          </Button>
        </FieldGroup>
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
  const Verdict = verdictText[verdict].icon;

  return (
    <Card
      title={`${order.item} · ${money(order.price)}`}
      action={<Badge variant={open ? "secondary" : "outline"}>{order.status}</Badge>}
    >
      {open && (
        <>
          <p
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
              verdictText[verdict].tone
            )}
          >
            <Verdict className="size-4" aria-hidden="true" />
            {verdictText[verdict].label}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Pay now</dt>
              <dd className="font-medium">{verdict === "pay_now" ? "Yes" : "Not yet"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Save up</dt>
              <dd className="font-medium">{Number.isFinite(saveMonths) ? `${saveMonths} mo` : "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Loan</dt>
              <dd className="font-medium tabular-nums">
                {money(loan.payment)}/mo
                <span className="block text-xs font-normal text-muted-foreground">
                  +{money(loan.totalInterest)} interest
                </span>
              </dd>
            </div>
          </dl>
          {saved > 0 && (
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span>
                Saved {money(saved)} of {money(order.price)}
              </span>
              <Progress value={Math.min(saved, order.price)} max={order.price} aria-label="Saved toward order" />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => budgetActions.buyOrder(order.id)}>
              <ShoppingBagIcon data-icon="inline-start" />
              Mark bought
            </Button>
            <Button variant="outline" onClick={() => budgetActions.setOrderStatus(order.id, "Dropped")}>
              Drop
            </Button>
          </div>
        </>
      )}
      {order.status === "Bought" && <p className="text-sm text-muted-foreground">Bought on {order.boughtDate}</p>}
    </Card>
  );
}

export function OrderList() {
  const b = useLoadedBudget();
  const rank = { Saving: 0, Planned: 1, Bought: 2, Dropped: 3 };
  const orders = [...b.orders].sort((a, z) => rank[a.status] - rank[z.status] || z.created.localeCompare(a.created));

  return orders.length === 0 ? (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBagIcon />
        </EmptyMedia>
        <EmptyTitle>No orders yet</EmptyTitle>
        <EmptyDescription>Add one above to see if you can afford it.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    orders.map((o) => <OrderCard key={o.id} order={o} />)
  );
}
