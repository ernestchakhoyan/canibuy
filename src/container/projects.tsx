"use client";

import {
  addMonths,
  cn,
  type Funding,
  formatMoney,
  haptic,
  type Lender,
  monthLabel,
  monthOf,
  monthSummary,
  type ProjectStatus,
  parseAmount,
  paymentSplit,
  projectFrom,
  projectFunding,
  projectPlan,
  projectPrice,
  projectRank,
  projectStart,
  projectStarted,
  projectSummary,
  projectsOf,
  projectTiming,
  todayISO,
} from "@helper";
import { Link, useRouter } from "@i18n";
import { budgetActions, useLoadedBudget, useSheetSyncFailed } from "@store";
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
  Progress,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@widget";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  HammerIcon,
  LandmarkIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  ReceiptIcon,
  TelescopeIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { PlanTiming } from "./plan-timing";
import { PayChoiceSheet } from "./project-picker";

const MONTHS_AHEAD = 24;
const monthOptions = () => {
  const current = monthOf(todayISO());
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(current, i));
};

type PartDefaults = Pick<ProjectPart, "part" | "cost" | "payMonth">;

/** Part fields shared by the new-project, add-part and edit-part forms; `defaults` pre-fills them for editing. */
function PartFields({ defaults }: { defaults?: PartDefaults }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const id = useId(); // rendered once per project card, so ids must be unique
  const months = monthOptions();
  return (
    <>
      <Field className="col-span-2">
        <FieldLabel htmlFor={`${id}-part`}>{t("part.name")}</FieldLabel>
        <Input
          id={`${id}-part`}
          name="part"
          required
          defaultValue={defaults?.part}
          placeholder={t("part.namePlaceholder")}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-cost`}>{t("part.cost")}</FieldLabel>
        <Input
          id={`${id}-cost`}
          name="cost"
          inputMode="decimal"
          required
          autoComplete="off"
          defaultValue={defaults?.cost}
          placeholder="20,000"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-month`}>{t("part.payIn")}</FieldLabel>
        <NativeSelect id={`${id}-month`} name="payMonth" className="w-full" defaultValue={defaults?.payMonth}>
          {(!defaults || months.includes(defaults.payMonth) ? months : [defaults.payMonth, ...months]).map((m) => (
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

/** New project (a plan until started); shown in the "Create project" sheet. `onDone` gets the new project's id. */
function ProjectForm({ onDone }: { onDone: (projectId: string) => void }) {
  const t = useTranslations("projects");
  const id = useId();
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const part = readPart(form);
    if (!part) return setError(t("form.costError"));
    const projectId = budgetActions.addProject(String(form.get("project")).trim(), [part]);
    setError("");
    event.currentTarget.reset(); // Cache Components keeps this mounted: reset by hand
    onDone(projectId);
  };

  return (
    <form onSubmit={submit}>
      <FieldGroup className="grid grid-cols-2 gap-4">
        <Field className="col-span-2">
          <FieldLabel htmlFor={`${id}-name`}>{t("form.project")}</FieldLabel>
          <Input id={`${id}-name`} name="project" required placeholder={t("form.projectPlaceholder")} />
        </Field>
        <PartFields />
        {error && <FieldError className="col-span-2">{error}</FieldError>}
        <Button type="submit" className="col-span-2">
          <PlusIcon data-icon="inline-start" />
          {t("form.submit")}
        </Button>
      </FieldGroup>
    </form>
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

/** Inline editor for one unpaid part: name, cost and month. */
function EditPart({ part, onDone }: { part: ProjectPart; onDone: () => void }) {
  const t = useTranslations("projects");
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const change = readPart(new FormData(event.currentTarget));
    if (!change) return setError(t("form.costError"));
    budgetActions.updatePart(part.partId, change);
    onDone();
  };
  return (
    <form onSubmit={submit} className="w-full basis-full">
      <FieldGroup className="grid grid-cols-2 gap-4">
        <PartFields defaults={part} />
        {error && <FieldError className="col-span-2">{error}</FieldError>}
        <Button type="submit">{t("part.save")}</Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("pay.cancel")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/**
 * A plan savings and salary don't cover (after the projects ahead of it): save up, a bank loan or a friend's
 * loan, the best one pre-selected. Applying it rewrites the parts into that payment plan.
 */
function ProjectFunding({ projectId }: { projectId: string }) {
  const t = useTranslations("projects.funding");
  const tp = useTranslations("orders.toProject");
  const ta = useTranslations("orders.afford");
  const locale = useLocale();
  const id = useId();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const months = (count: number) => ta("months", { count });
  const [choice, setChoice] = useState<Funding | undefined>(undefined);
  const f = projectFunding(b, projectId, todayISO());
  if (!f) return null;
  const selected = choice ?? f.best;
  const borrowed = { amount: money(f.borrow), month: monthLabel(f.month, locale), months: months(f.term) };

  const options: { value: Funding; label: string; detail: string; fits: boolean; total: number }[] = [
    {
      value: "save",
      label: t("save.label"),
      detail: f.save.month
        ? t("save.detail", { months: months(f.save.wait), month: monthLabel(f.save.month, locale) })
        : t("save.never"),
      fits: f.save.month !== null,
      total: 0,
    },
    {
      value: "bank",
      label: t("bank.label"),
      detail: t("bank.detail", {
        ...borrowed,
        payment: money(f.bank.payment),
        rate: f.rate,
        interest: money(f.bank.interest),
      }),
      fits: f.bank.fits,
      total: f.bank.interest,
    },
    {
      value: "friend",
      label: t("friend.label"),
      detail: t("friend.detail", { ...borrowed, payment: money(f.friend.payment), saved: money(f.bank.interest) }),
      fits: f.friend.fits,
      total: 0,
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-warning/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-warning">
        <LandmarkIcon className="size-4 shrink-0" aria-hidden="true" />
        {t("intro", { amount: money(f.borrow), month: monthLabel(f.month, locale) })}
      </p>
      <RadioGroup
        value={selected}
        onValueChange={(v) => setChoice(v as Funding)}
        aria-label={t("title")}
        className="gap-2"
      >
        {options.map((o) => (
          <label
            key={o.value}
            htmlFor={`${id}-${o.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors",
              selected === o.value ? "border-primary bg-primary/5" : "hover:bg-muted"
            )}
          >
            <RadioGroupItem
              value={o.value}
              id={`${id}-${o.value}`}
              className="mt-0.5"
              disabled={!f.save.month && o.value === "save"}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{o.label}</span>
                {f.best === o.value && <Badge>{t("best")}</Badge>}
              </span>
              <span className="text-muted-foreground">{o.detail}</span>
              {o.value !== "save" && !o.fits && <span className="text-xs text-negative">{tp("tooMuch")}</span>}
            </span>
          </label>
        ))}
      </RadioGroup>
      <Button
        onClick={() => {
          haptic();
          budgetActions.fundProject(projectId, selected, (i, n) =>
            tp(selected === "friend" ? "parts.friend" : "parts.loan", { i, n })
          );
        }}
      >
        <CheckCircle2Icon data-icon="inline-start" />
        {t("apply")}
      </Button>
    </div>
  );
}

/** A plan's place in the priority order; the plans ahead of it (and every started project) are paid first. */
function ProjectPriority({ projectId }: { projectId: string }) {
  const t = useTranslations("projects.priority");
  const b = useLoadedBudget();
  const rank = projectRank(b);
  const at = rank.findIndex((p) => p.id === projectId);
  const plans = rank.filter((p) => !projectStarted(b, p.id));
  const planAt = plans.findIndex((p) => p.id === projectId);
  if (at < 0 || planAt < 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        {t("label", { n: at + 1, count: rank.length })}
        {at > 0 && <span className="block text-xs">{t("ahead", { count: at })}</span>}
      </span>
      <span className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label={t("up")}
          disabled={planAt === 0}
          onClick={() => budgetActions.moveProject(projectId, -1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("down")}
          disabled={planAt === plans.length - 1}
          onClick={() => budgetActions.moveProject(projectId, 1)}
        >
          <ArrowDownIcon />
        </Button>
      </span>
    </div>
  );
}

/**
 * Every project starts as a draft; "Plan it" makes it a plan (it then holds money and can start); Start marks it started (then its parts can be paid) and turns loan / friend
 * instalments into a recurring bill. Once started, shows when, and that bill.
 */
function ProjectStart({ projectId, project }: { projectId: string; project: string }) {
  const t = useTranslations("projects.start");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const range = (from?: string, to?: string) =>
    t("range", { from: monthLabel(from ?? "", locale), to: monthLabel(to ?? "", locale) });
  const billName = (lender: Lender, part: string) => t(`billName.${lender}`, { project: part || project });
  const [choosing, setChoosing] = useState(false);
  // Monthly payments begin this month, or next month when starting in the second half of this one.
  const today = todayISO();
  const current = monthOf(today);
  const [first, setFirst] = useState(Number(today.slice(8, 10)) > 15 ? addMonths(current, 1) : current);

  if (projectStarted(b, projectId)) {
    const bills = b.bills.filter((bill) => bill.projectId === projectId);
    const date =
      projectsOf(b).find((p) => p.id === projectId)?.startedDate ??
      b.parts.find((p) => p.projectId === projectId && p.startedDate)?.startedDate;
    return (
      <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
        {date && <p className="text-muted-foreground">{t("startedOn", { date })}</p>}
        {bills.map((bill) => (
          <p key={bill.id} className="flex items-center gap-2">
            <ReceiptIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("bill", { name: bill.name, amount: money(bill.amount), range: range(bill.startMonth, bill.endMonth) })}
          </p>
        ))}
      </div>
    );
  }

  if (projectsOf(b).find((p) => p.id === projectId)?.draft) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
        <p className="text-muted-foreground">{t("explainDraft")}</p>
        <Button
          variant="secondary"
          onClick={() => {
            haptic();
            budgetActions.planProject(projectId, true);
          }}
        >
          <CalendarCheckIcon data-icon="inline-start" />
          {t("plan")}
        </Button>
      </div>
    );
  }

  const { bills } = projectStart(b, projectId, today, billName, first);
  // A plan with no loan yet asks how to pay it first; "Pay now" keeps its parts as planned.
  const price = projectPrice(b, projectId);
  // The choice only matters when later parts get split into monthly payments (or a way to pay may create some).
  const splits = price !== null || projectStart(b, projectId, today, billName).split.length > 0;
  const start = () => {
    haptic();
    if (price === null) budgetActions.startProject(projectId, billName, undefined, first);
    else setChoosing(true);
  };
  const action = (
    <>
      <PlayIcon data-icon="inline-start" />
      {t("action")}
    </>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
      <p className="text-muted-foreground">
        {bills.length > 0
          ? t("explainLoan", {
              bills: bills
                .map((bill) =>
                  t("billShort", { amount: money(bill.amount), range: range(bill.startMonth, bill.endMonth) })
                )
                .join("; "),
            })
          : t("explain")}
      </p>
      {splits && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={`${projectId}-first`} className="text-muted-foreground">
            {t("first")}
          </span>
          <ToggleGroup
            aria-labelledby={`${projectId}-first`}
            variant="outline"
            size="sm"
            value={[first]}
            onValueChange={(v) => v[0] && setFirst(v[0])}
          >
            {[current, addMonths(current, 1)].map((m) => (
              <ToggleGroupItem key={m} value={m}>
                {monthLabel(m, locale)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      <Button onClick={start}>{action}</Button>
      <Button variant="ghost" onClick={() => budgetActions.planProject(projectId, false)}>
        {t("unplan")}
      </Button>
      {price !== null && (
        <PayChoiceSheet
          item={project}
          price={price}
          open={choosing}
          onOpenChange={setChoosing}
          title={t("action")}
          action={action}
          onConfirm={(choice, parts) =>
            budgetActions.startProject(projectId, billName, choice === "now" ? undefined : parts, first)
          }
        />
      )}
    </div>
  );
}

/** Pay button → where the money comes from: savings (rest from this month if they fall short) or this month. */
function PayPart({ part }: { part: ProjectPart }) {
  const t = useTranslations("projects.pay");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const [choosing, setChoosing] = useState(false);
  const fromSavings = paymentSplit(b, part.cost, part.partId, "savings");
  const left = monthSummary(b, todayISO()).left;
  const pay = (source: "savings" | "month") => {
    haptic();
    budgetActions.payPart(part.partId, source);
  };

  if (!choosing) {
    return (
      <Button variant="secondary" aria-expanded={false} onClick={() => setChoosing(true)}>
        {t("action")}
      </Button>
    );
  }
  return (
    <fieldset className="flex w-full basis-full flex-col gap-2 rounded-lg border p-2">
      <legend className="px-1 text-xs text-muted-foreground">{t("question", { amount: money(part.cost) })}</legend>
      <Button
        variant="outline"
        className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left whitespace-normal"
        disabled={fromSavings.savings === 0}
        onClick={() => pay("savings")}
      >
        <span className="font-semibold">{t("savings")}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {fromSavings.savings === 0
            ? t("noSavings")
            : fromSavings.month > 0
              ? t("savingsSplit", { savings: money(fromSavings.savings), month: money(fromSavings.month) })
              : t("savingsAll")}
        </span>
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left whitespace-normal"
        onClick={() => pay("month")}
      >
        <span className="font-semibold">{t("month")}</span>
        <span className={cn("text-xs font-normal", left - part.cost < 0 ? "text-negative" : "text-muted-foreground")}>
          {t("monthLeft", { left: money(left), after: money(left - part.cost) })}
        </span>
      </Button>
      <Button variant="ghost" onClick={() => setChoosing(false)}>
        {t("cancel")}
      </Button>
    </fieldset>
  );
}

const STATUS_BADGE: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  planned: "outline",
  active: "default",
  completed: "secondary",
  archived: "outline",
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("projects.status");
  return <Badge variant={STATUS_BADGE[status]}>{t(status)}</Badge>;
}

/** Paid so far vs everything the project costs (parts + its bill's payments). */
function PaymentProgress({ paid, total, progress }: { paid: number; total: number; progress: number }) {
  const t = useTranslations("projects.progress");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{t("paid", { paid: money(paid), total: money(total) })}</span>
        <span>{t("percent", { progress })}</span>
      </div>
      <Progress value={Math.round(progress * 100)} aria-label={t("label")} />
    </div>
  );
}

/** List card: tapping it opens the project page. */
function ProjectSummaryCard({ summary }: { summary: ReturnType<typeof projectSummary> }) {
  const t = useTranslations("projects.list");
  const locale = useLocale();
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const { project, status, paid, left, total, progress, next, bills } = summary;

  return (
    <Link
      href={`/projects/${project.id}`}
      onClick={haptic}
      className="flex flex-col gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-base font-semibold">{project.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          <StatusBadge status={status} />
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
      {total > 0 && <PaymentProgress paid={paid} total={total} progress={progress} />}
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">{t("left", { amount: money(left) })}</span>
        {next && (
          <span className="tabular-nums">
            {t("next", { amount: money(next.amount), month: monthLabel(next.month, locale) })}
          </span>
        )}
      </div>
      {bills.map((bill) => (
        <span key={bill.id} className="flex items-center gap-1.5 text-xs">
          <ReceiptIcon className="size-3.5 text-primary" aria-hidden="true" />
          {t("bill", { amount: money(bill.amount), month: monthLabel(bill.endMonth ?? "", locale) })}
        </span>
      ))}
    </Link>
  );
}

const TABS = ["all", "draft", "planned", "active", "completed", "archived"] as const;

/** Projects page: a Create button next to the tabs, and the projects as cards per status. */
export function ProjectList() {
  const t = useTranslations("projects");
  const b = useLoadedBudget();
  const router = useRouter();
  const tc = useTranslations("common");
  const syncFailed = useSheetSyncFailed("projects");
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  // Priority order (started first, then plans as ordered), archived ones last.
  const ranked = projectRank(b);
  const summaries = [...ranked, ...projectsOf(b).filter((p) => !ranked.includes(p))].map((p) =>
    projectSummary(b, p, today)
  );
  const inTab = (tab: (typeof TABS)[number]) => (tab === "all" ? summaries : summaries.filter((s) => s.status === tab));

  return (
    <>
      <Tabs defaultValue="all" className="gap-4">
        <div className="flex items-center gap-2">
          <TabsList className="min-w-0 flex-1 justify-start overflow-x-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex-none">
                {t(`tabs.${tab}`)}
                <span className="text-xs tabular-nums text-muted-foreground">{inTab(tab).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            size="icon-lg"
            aria-label={t("list.create")}
            title={t("list.create")}
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </Button>
        </div>
        {syncFailed && <p className="text-sm text-destructive">{tc("syncFailed")}</p>}
        {TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="flex flex-col gap-3">
            {inTab(tab).length > 0 ? (
              inTab(tab).map((summary) => <ProjectSummaryCard key={summary.project.id} summary={summary} />)
            ) : summaries.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HammerIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("empty.description")}</EmptyDescription>
                </EmptyHeader>
                <Button onClick={() => setCreating(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t("list.create")}
                </Button>
              </Empty>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t(`list.empty.${tab}`)}</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent
          open={creating}
          side="bottom"
          className="mx-auto max-h-[90dvh] max-w-2xl rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="pr-14">
            <SheetTitle className="text-lg font-semibold">{t("form.title")}</SheetTitle>
            <SheetDescription>{t("list.createHint")}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <ProjectForm
              onDone={(projectId) => {
                setCreating(false);
                router.push(`/projects/${projectId}`);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Archive / restore, and delete: before it starts, or once archived (then its bills go too, payments made stay). */
function ProjectActions({ projectId, archived, started }: { projectId: string; archived: boolean; started: boolean }) {
  const t = useTranslations("projects.actions");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3 text-sm">
        <p>{t(started ? "deleteConfirmStarted" : "deleteConfirm")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              budgetActions.deleteProject(projectId);
              router.push("/projects");
            }}
          >
            {t("deleteYes")}
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => budgetActions.archiveProject(projectId, !archived)}>
        {archived ? <ArchiveRestoreIcon data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
        {archived ? t("restore") : t("archive")}
      </Button>
      {(!started || archived) && (
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2Icon data-icon="inline-start" />
          {t("delete")}
        </Button>
      )}
    </div>
  );
}

/** Project page (/projects/[id]): progress, start, parts with payments, the month-by-month plan, actions. */
export function ProjectDetails() {
  const t = useTranslations("projects");
  const locale = useLocale();
  const b = useLoadedBudget();
  const { id } = useParams<{ id: string }>();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency, locale);
  const today = todayISO();
  const [editing, setEditing] = useState<string | null>(null);
  const record = projectsOf(b).find((p) => p.id === id);
  const back = (
    <Link href="/projects" className="flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground">
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      {t("details.back")}
    </Link>
  );

  if (!record) {
    return (
      <>
        {back}
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("details.notFound")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const summary = projectSummary(b, record, today);
  const { parts, started, status } = summary;
  const plan = projectPlan(b, id, today);
  const funding = projectFunding(b, id, today) !== null;
  const months = monthOptions();

  return (
    <>
      {back}
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{record.name}</h1>
        <span className="pt-1.5">
          <StatusBadge status={status} />
        </span>
      </div>

      <Card>
        {summary.total > 0 && <PaymentProgress paid={summary.paid} total={summary.total} progress={summary.progress} />}
        {!started && status !== "archived" && <ProjectPriority projectId={id} />}
        <ProjectStart projectId={id} project={record.name} />
        {status !== "archived" && status !== "completed" && projectFrom(b, id, today) && (
          <PlanTiming
            label={t(started ? "timing.next" : "timing.start")}
            value={projectFrom(b, id, today)}
            timing={projectTiming(b, id, today)}
            onChange={(month) => budgetActions.rescheduleProject(id, month)}
          />
        )}
        {plan.total > 0 &&
          (plan.covered ? (
            <p className="flex items-center gap-2 rounded-lg bg-positive/10 px-3 py-2 text-sm font-semibold text-positive">
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
              {t("card.covered")}
            </p>
          ) : funding ? (
            <ProjectFunding projectId={id} />
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
      </Card>

      <Card title={t("details.parts")}>
        {parts.length > 0 && (
          <ul className="divide-y">
            {parts.map((p) => (
              <li key={p.partId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                {editing === p.partId ? (
                  <EditPart part={p} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.part}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{money(p.cost)}</span>
                    </div>
                    {p.status === "Paid" ? (
                      <Badge variant="outline">{t("card.paidOn", { date: p.paidDate })}</Badge>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2">
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
                        {!(started && p.installment) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("card.edit", { name: p.part })}
                            onClick={() => setEditing(p.partId)}
                          >
                            <PencilIcon />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("card.remove", { name: p.part })}
                          onClick={() => budgetActions.removePart(p.partId)}
                        >
                          <XIcon />
                        </Button>
                        {started && <PayPart part={p} />}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <AddPartForm projectId={id} />
      </Card>

      {plan.total > 0 && status !== "archived" && status !== "completed" && (
        <Link
          href={`/outlook?with=${id}`}
          className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-4 py-2 text-sm hover:bg-muted"
        >
          <TelescopeIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1">{t("details.outlook")}</span>
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      )}

      <ProjectActions projectId={id} archived={status === "archived"} started={started} />
    </>
  );
}
