"use client";

import { addMonths, cn, formatMoney, monthLabel, monthOf, parseAmount, projectPlan, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { ProjectPart } from "@type";
import {
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
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
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@widget";
import { CheckCircle2Icon, HammerIcon, LandmarkIcon, PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

const MONTHS_AHEAD = 24;
const monthOptions = () => {
  const current = monthOf(todayISO());
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(current, i));
};

/** Part fields shared by the new-project form and the add-part form. */
function PartFields() {
  const t = useTranslations("projects");
  const locale = useLocale();
  const id = useId(); // rendered once per project card, so ids must be unique
  return (
    <>
      <Field className="col-span-2">
        <FieldLabel htmlFor={`${id}-part`}>{t("part.name")}</FieldLabel>
        <Input id={`${id}-part`} name="part" required placeholder={t("part.namePlaceholder")} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-cost`}>{t("part.cost")}</FieldLabel>
        <Input id={`${id}-cost`} name="cost" inputMode="decimal" required autoComplete="off" placeholder="20,000" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-month`}>{t("part.payIn")}</FieldLabel>
        <NativeSelect id={`${id}-month`} name="payMonth" className="w-full">
          {monthOptions().map((m) => (
            <NativeSelectOption key={m} value={m}>
              {monthLabel(m, locale)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}

const readPart = (form: FormData) => {
  const cost = parseAmount(String(form.get("cost")));
  if (!cost || cost <= 0) return null;
  return { part: String(form.get("part")).trim(), cost, payMonth: String(form.get("payMonth")) };
};

export function ProjectForm() {
  const t = useTranslations("projects");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const part = readPart(form);
    if (!part) return setError(t("form.costError"));
    budgetActions.addProject(String(form.get("project")).trim(), [part]);
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title={t("form.title")}>
      <form onSubmit={submit}>
        <FieldGroup className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <FieldLabel htmlFor="project-name">{t("form.project")}</FieldLabel>
            <Input id="project-name" name="project" required placeholder={t("form.projectPlaceholder")} />
          </Field>
          <PartFields />
          {error && <FieldError className="col-span-2">{error}</FieldError>}
          <Button type="submit" className="col-span-2">
            <PlusIcon data-icon="inline-start" />
            {t("form.submit")}
          </Button>
        </FieldGroup>
      </form>
    </Card>
  );
}

function AddPartForm({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const part = readPart(new FormData(event.currentTarget));
    if (!part) return;
    budgetActions.addPart(projectId, part);
    event.currentTarget.reset();
  };

  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="outline" className="w-full" />}>
        <PlusIcon data-icon="inline-start" />
        {t("part.add")}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form onSubmit={submit} className="pt-4">
          <FieldGroup className="grid grid-cols-2 gap-4">
            <PartFields />
            <Button type="submit" className="col-span-2">
              {t("part.add")}
            </Button>
          </FieldGroup>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProjectCard({ projectId, parts }: { projectId: string; parts: ProjectPart[] }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const plan = projectPlan(b, projectId, todayISO());
  const months = monthOptions();

  return (
    <Card
      title={parts[0].project}
      action={
        <Badge variant="secondary" className="tabular-nums">
          {t("card.left", { amount: money(plan.total) })}
        </Badge>
      }
    >
      {plan.total > 0 &&
        (plan.covered ? (
          <p className="flex items-center gap-2 rounded-lg bg-positive/10 px-3 py-2 text-sm font-semibold text-positive">
            <CheckCircle2Icon className="size-4" aria-hidden="true" />
            {t("card.covered")}
          </p>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            <p className="flex items-center gap-2 font-semibold text-warning">
              <LandmarkIcon className="size-4 shrink-0" aria-hidden="true" />
              {t("card.needsLoan", {
                amount: money(plan.loan?.amount ?? 0),
                payment: money(plan.loan?.payment ?? 0),
                interest: money(plan.loan?.totalInterest ?? 0),
              })}
            </p>
            <p className="text-muted-foreground">
              {plan.affordableMonth
                ? t("card.affordableFrom", { month: monthLabel(plan.affordableMonth, locale) })
                : t("card.notAffordable")}
            </p>
          </div>
        ))}

      <ul className="divide-y">
        {parts.map((p) => (
          <li key={p.partId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{p.part}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{money(p.cost)}</span>
            </div>
            {p.status === "Paid" ? (
              <Badge variant="outline">{t("card.paidOn", { date: p.paidDate })}</Badge>
            ) : (
              <div className="flex items-center gap-2">
                <NativeSelect
                  aria-label={t("card.paymentMonth", { name: p.part })}
                  value={p.payMonth}
                  onChange={(e) => budgetActions.movePart(p.partId, e.target.value)}
                >
                  {(months.includes(p.payMonth) ? months : [p.payMonth, ...months]).map((m) => (
                    <NativeSelectOption key={m} value={m}>
                      {monthLabel(m, locale)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button variant="secondary" onClick={() => budgetActions.payPart(p.partId)}>
                  {t("card.pay")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("card.remove", { name: p.part })}
                  onClick={() => budgetActions.removePart(p.partId)}
                >
                  <XIcon />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {plan.total > 0 && (
        <Table className="tabular-nums">
          <TableCaption className="caption-top text-left text-xs">{t("table.caption")}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.month")}</TableHead>
              <TableHead className="text-right">{t("table.in")}</TableHead>
              <TableHead className="text-right">{t("table.paid")}</TableHead>
              <TableHead className="text-right">{t("table.balance")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell>{m.month}</TableCell>
                <TableCell className="text-right">{money(m.added)}</TableCell>
                <TableCell className="text-right">{m.paid ? money(m.paid) : ""}</TableCell>
                <TableCell className={cn("text-right", m.balance < 0 && "text-negative")}>{money(m.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddPartForm projectId={projectId} />
    </Card>
  );
}

export function ProjectList() {
  const t = useTranslations("projects");
  const b = useLoadedBudget();
  const projects = Map.groupBy(b.parts, (p) => p.projectId);

  return projects.size === 0 ? (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HammerIcon />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    [...projects].map(([id, parts]) => <ProjectCard key={id} projectId={id} parts={parts} />)
  );
}
