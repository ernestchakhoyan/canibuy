"use client";

import { cn, formatMoney, orderTiming, orderVerdict, parseAmount, savedToward, todayISO, type Verdict } from "@helper";
import { budgetActions, useLoadedBudget, useSheetSyncFailed } from "@store";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@widget";
import {
  CheckCircle2Icon,
  CircleSlashIcon,
  HammerIcon,
  LandmarkIcon,
  PiggyBankIcon,
  SearchCheckIcon,
  ShoppingBagIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { AffordOptions } from "./afford-options";
import { PlanTiming } from "./plan-timing";
import { ProjectPicker } from "./project-picker";

const verdictText: Record<Verdict, { tone: string; icon: typeof PiggyBankIcon }> = {
  pay_now: { tone: "bg-positive/10 text-positive", icon: CheckCircle2Icon },
  save_up: { tone: "bg-brand-gold/15 text-brand-gold-ink", icon: PiggyBankIcon },
  loan: { tone: "bg-warning/10 text-warning", icon: LandmarkIcon },
  not_affordable: { tone: "bg-negative/10 text-negative", icon: CircleSlashIcon },
};

/** `onDone` runs after a successful save (the quick-add sheet closes itself with it). */
export function OrderForm({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("orders");
  const id = useId(); // also rendered in the quick-add sheet, so ids must be unique
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = parseAmount(String(form.get("price")));
    const deadline = parseAmount(String(form.get("deadline")));
    if (!price || price <= 0) return setError(t("form.priceError"));
    budgetActions.addOrder({
      item: String(form.get("item")).trim(),
      price,
      deadlineMonths: deadline && deadline > 0 ? Math.round(deadline) : null,
      note: "",
    });
    setError("");
    event.currentTarget.reset();
    onDone?.();
  };

  return (
    <Card title={t("form.title")}>
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <FieldLabel htmlFor={`${id}-item`}>{t("form.item")}</FieldLabel>
            <Input id={`${id}-item`} name="item" required placeholder={t("form.itemPlaceholder")} />
          </Field>
          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor={`${id}-price`}>{t("form.price")}</FieldLabel>
            <Input
              id={`${id}-price`}
              name="price"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="20,000"
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-deadline`}>{t("form.deadline")}</FieldLabel>
            <Input
              id={`${id}-deadline`}
              name="deadline"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("form.optional")}
            />
          </Field>
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <SearchCheckIcon data-icon="inline-start" />
            {t("form.submit")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

function OrderCard({ order }: { order: Order }) {
  const t = useTranslations("orders");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const open = order.status === "Planned" || order.status === "Saving";
  const saved = savedToward(b, order.id);
  const { verdict, saveMonths, loan } = orderVerdict(b, order, todayISO());
  const Verdict = verdictText[verdict].icon;
  const [choosingProject, setChoosingProject] = useState(false);

  return (
    <Card
      title={`${order.item} · ${money(order.price)}`}
      action={
        <div className="flex items-center gap-1">
          <Badge variant={open ? "secondary" : "outline"}>{t(`status.${order.status}`)}</Badge>
          {/* Active orders are dropped first, so removing one always takes two deliberate taps. */}
          {!open && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("card.remove", { item: order.item })}
              onClick={() => budgetActions.removeOrder(order.id)}
            >
              <XIcon />
            </Button>
          )}
        </div>
      }
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
            {t(`verdict.${verdict}`)}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("card.payNow")}</dt>
              <dd className="font-medium">{verdict === "pay_now" ? t("card.yes") : t("card.notYet")}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("card.saveUp")}</dt>
              <dd className="font-medium">
                {Number.isFinite(saveMonths) ? t("card.months", { count: saveMonths }) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("card.loan")}</dt>
              <dd className="font-medium tabular-nums">
                {t("card.perMonth", { amount: money(loan.payment) })}
                <span className="block text-xs font-normal text-muted-foreground">
                  {t("card.interest", { amount: money(loan.totalInterest) })}
                </span>
              </dd>
            </div>
          </dl>
          <PlanTiming
            label={t("card.buyMonth")}
            value={order.buyMonth ?? null}
            timing={orderTiming(b, order.id, todayISO())}
            onChange={(month) => budgetActions.setOrderBuyMonth(order.id, month)}
            onClear={() => budgetActions.setOrderBuyMonth(order.id, null)}
          />
          <AffordOptions order={order} />
          {saved > 0 && (
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span>{t("card.saved", { saved: money(saved), price: money(order.price) })}</span>
              <Progress value={Math.min(saved, order.price)} max={order.price} aria-label={t("card.savedLabel")} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="col-span-2" onClick={() => budgetActions.buyOrder(order.id)}>
              <ShoppingBagIcon data-icon="inline-start" />
              {t("card.markBought")}
            </Button>
            <Button variant="outline" onClick={() => setChoosingProject(true)}>
              <HammerIcon data-icon="inline-start" />
              {t("card.toProject")}
            </Button>
            <Button variant="outline" onClick={() => budgetActions.setOrderStatus(order.id, "Dropped")}>
              {t("card.drop")}
            </Button>
          </div>
          <ProjectPicker order={order} open={choosingProject} onOpenChange={setChoosingProject} />
        </>
      )}
      {order.status === "Bought" && (
        <p className="text-sm text-muted-foreground">{t("card.boughtOn", { date: order.boughtDate })}</p>
      )}
    </Card>
  );
}

export function OrderList() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const b = useLoadedBudget();
  const syncFailed = useSheetSyncFailed("orders");
  const newestFirst = (a: Order, z: Order) => z.created.localeCompare(a.created);
  const tabs = [
    // Saving before Planned: money is already going toward those.
    {
      key: "active",
      orders: b.orders
        .filter((o) => o.status === "Saving")
        .sort(newestFirst)
        .concat(b.orders.filter((o) => o.status === "Planned").sort(newestFirst)),
    },
    { key: "bought", orders: b.orders.filter((o) => o.status === "Bought").sort(newestFirst) },
    { key: "dropped", orders: b.orders.filter((o) => o.status === "Dropped").sort(newestFirst) },
  ] as const;

  if (b.orders.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBagIcon />
          </EmptyMedia>
          <EmptyTitle>{t("empty.title")}</EmptyTitle>
          <EmptyDescription>{t("empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Tabs defaultValue="active" className="gap-4">
      <TabsList className="w-full">
        {tabs.map(({ key, orders }) => (
          <TabsTrigger key={key} value={key}>
            {t(`tabs.${key}`)}
            <span className="text-xs tabular-nums text-muted-foreground">{orders.length}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {syncFailed && <p className="text-sm text-destructive">{tc("syncFailed")}</p>}
      {tabs.map(({ key, orders }) => (
        <TabsContent key={key} value={key} className="flex flex-col gap-4">
          {orders.length > 0 ? (
            orders.map((o) => <OrderCard key={o.id} order={o} />)
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t(`tabs.empty.${key}`)}</p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
