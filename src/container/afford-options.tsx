"use client";

import { affordOptions, cn, formatMoney, monthLabel, parseAmount, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { Order } from "@type";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@widget";
import { ChevronDownIcon, HandshakeIcon, LandmarkIcon, PiggyBankIcon, SplitIcon, WalletIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useId, useState } from "react";

function Option({ icon: Icon, title, children }: { icon: typeof WalletIcon; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {title}
      </h4>
      <div className="flex flex-col gap-1.5 text-sm">{children}</div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "font-semibold")}>
      <dt className={cn(!strong && "text-muted-foreground")}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Bank rate and term for one order. Pre-filled with what applies now; "Use Setup values" drops the override. */
function LoanTerms({ order, rate, term }: { order: Order; rate: number; term: number }) {
  const t = useTranslations("orders.afford.terms");
  const id = useId();
  const [error, setError] = useState("");
  const custom = order.loanRate != null || order.loanTermMonths != null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const loanRate = parseAmount(String(form.get("rate")));
    const loanTermMonths = Number(form.get("term"));
    // Same limits as the server action that writes the order into the sheet.
    if (loanRate === null || loanRate < 0 || loanRate > 100) return setError(t("rateError"));
    if (!Number.isInteger(loanTermMonths) || loanTermMonths < 1 || loanTermMonths > 600)
      return setError(t("termError"));
    setError("");
    budgetActions.setOrderLoan(order.id, { loanRate, loanTermMonths });
  };

  return (
    // key: re-mount with fresh defaults after "Use Setup values" (inputs are uncontrolled)
    <form key={`${rate}-${term}`} onSubmit={submit} className="grid grid-cols-2 items-end gap-2">
      <Field>
        <FieldLabel htmlFor={`${id}-rate`}>{t("rate")}</FieldLabel>
        <Input id={`${id}-rate`} name="rate" inputMode="decimal" defaultValue={rate} autoComplete="off" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-term`}>{t("term")}</FieldLabel>
        <Input id={`${id}-term`} name="term" inputMode="numeric" defaultValue={term} autoComplete="off" />
      </Field>
      {error && <FieldError className="col-span-2">{error}</FieldError>}
      <Button type="submit" variant="secondary">
        {t("apply")}
      </Button>
      {custom ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => budgetActions.setOrderLoan(order.id, { loanRate: null, loanTermMonths: null })}
        >
          {t("reset")}
        </Button>
      ) : (
        <span className="self-center text-xs text-muted-foreground">{t("fromSetup")}</span>
      )}
    </form>
  );
}

/** The numbers behind an order's verdict, and every way to cover it, so the user can decide what to do. */
export function AffordOptions({ order }: { order: Order }) {
  const t = useTranslations("orders.afford");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const o = affordOptions(b, order, todayISO());
  const months = (count: number) => t("months", { count });

  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="outline" className="group w-full" />}>
        {t("toggle")}
        <ChevronDownIcon data-icon="inline-end" className="transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-3">
        <Option icon={WalletIcon} title={t("now.title")}>
          <dl className="flex flex-col gap-1.5">
            <Row label={t("now.savings")} value={money(o.now.savings)} />
            {o.now.cushion > 0 && <Row label={t("now.cushion")} value={`−${money(o.now.cushion)}`} />}
            <Row label={t("now.canSave")} value={money(o.now.canSave)} />
            <Row
              label={o.now.shortfall > 0 ? t("now.missing") : t("now.enough")}
              value={money(o.now.shortfall)}
              strong
            />
          </dl>
          <p className="text-muted-foreground">
            {t("monthly", {
              income: money(o.monthly.income),
              bills: money(o.monthly.bills),
              spending: money(o.monthly.spending),
              free: money(o.monthly.free),
            })}
          </p>
        </Option>

        <Option icon={PiggyBankIcon} title={t("save.title")}>
          {o.now.shortfall === 0 && <p>{t("save.now")}</p>}
          {o.save.months === 0 ? null : o.save.readyMonth ? (
            <p>
              {t(o.keepSavings ? "save.keep" : "save.plan", {
                amount: money(o.save.perMonth),
                months: months(o.save.months),
                month: monthLabel(o.save.readyMonth, locale),
              })}
            </p>
          ) : (
            <p className="text-negative">{t("save.never")}</p>
          )}
          {o.save.deadline && o.save.months > 0 && (
            <p className={cn(!o.save.deadline.fits && "text-negative")}>
              {t(o.save.deadline.fits ? "save.deadlineFits" : "save.deadlineTooMuch", {
                months: months(o.save.deadline.months),
                amount: money(o.save.deadline.perMonth),
              })}
            </p>
          )}
        </Option>

        {o.combos.length > 0 && (
          <Option icon={SplitIcon} title={t("combo.title")}>
            <p className="text-muted-foreground">{t("combo.intro", { amount: money(o.monthly.free) })}</p>
            <div className="overflow-x-auto">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("combo.wait")}</TableHead>
                    <TableHead className="text-right">{t("combo.borrow")}</TableHead>
                    <TableHead className="text-right">{t("bank.payment")}</TableHead>
                    <TableHead className="text-right">{t("bank.share")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.combos.map((c) => (
                    <TableRow key={c.wait} className={cn(!c.fits && "text-muted-foreground")}>
                      <TableCell className="whitespace-normal">
                        {t("monthsShort", { count: c.wait })}
                        <span className="block text-xs">{monthLabel(c.buyMonth, locale)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.borrow)}</TableCell>
                      <TableCell className="text-right whitespace-normal tabular-nums">
                        <span className={cn(c.fits && "font-semibold")}>{money(c.payment)}</span>
                        <span className="block text-xs">{t("combo.interest", { amount: money(c.interest) })}</span>
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", c.fits && "text-positive")}>
                        {Number.isFinite(c.share) ? t("bank.percent", { share: c.share }) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">{t("combo.hint", { months: months(o.term), rate: o.rate })}</p>
          </Option>
        )}

        {o.borrow > 0 && (
          <>
            <Option icon={LandmarkIcon} title={t("bank.title", { rate: o.rate })}>
              <LoanTerms order={order} rate={o.rate} term={o.term} />
              <p className="text-muted-foreground">
                {o.keepSavings
                  ? t("bank.amountKeep", { borrow: money(o.borrow) })
                  : t("bank.amount", { borrow: money(o.borrow), usable: money(o.now.usable) })}
              </p>
              <div className="overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("bank.term")}</TableHead>
                      <TableHead className="text-right">{t("bank.payment")}</TableHead>
                      <TableHead className="text-right">{t("bank.interest")}</TableHead>
                      <TableHead className="text-right">{t("bank.share")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {o.bank.map((loan) => (
                      <TableRow key={loan.months} className={cn(!loan.fits && "text-muted-foreground")}>
                        <TableCell>
                          {t("monthsShort", { count: loan.months })}
                          {loan.months === o.term && <span className="block text-xs">{t("bank.yours")}</span>}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", loan.fits && "font-semibold")}>
                          {money(loan.payment)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(loan.interest)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", loan.fits && "text-positive")}>
                          {Number.isFinite(loan.share) ? t("bank.percent", { share: loan.share }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">{t("bank.fitsHint")}</p>
            </Option>

            <Option icon={HandshakeIcon} title={t("friend.title")}>
              <p>
                {t("friend.plan", {
                  borrow: money(o.borrow),
                  amount: money(o.friend.perMonth),
                  months: months(o.friend.months),
                })}
              </p>
              {Number.isFinite(o.friend.fastestMonths) && (
                <p className="text-muted-foreground">
                  {t("friend.fastest", { months: months(o.friend.fastestMonths), amount: money(o.monthly.free) })}
                </p>
              )}
              {o.friend.interestSaved >= 1 && (
                <p className="text-positive">
                  {t("friend.saved", { amount: money(o.friend.interestSaved), months: months(o.term) })}
                </p>
              )}
            </Option>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
