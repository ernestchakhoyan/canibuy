"use client";

import {
  cn,
  formatMoney,
  haptic,
  monthLabel,
  type ProjectStatus,
  projectRank,
  projectSummary,
  projectsOf,
  todayISO,
  withPlans,
} from "@helper";
import { Link } from "@i18n";
import { useLoadedBudget } from "@store";
import { Button, Card, maskedMoney } from "@widget";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { SavingsForecast } from "./savings-forecast";

/** Shown first, in this order; completed and archived projects have nothing ahead and aren't offered. */
const OFFERED: ProjectStatus[] = ["active", "planned", "draft"];

/**
 * "What if" savings forecast: the same chart as the month page, with the projects to count picked by hand, next to
 * a dashed line of the budget without any project. Starts with what the plans count (active + planned), plus a
 * project named in `?with=` (the project page links here with its own id, so a draft can be tried out).
 */
export function Outlook() {
  const t = useTranslations("outlook");
  const ts = useTranslations("projects.status");
  const locale = useLocale();
  const b = useLoadedBudget();
  const today = todayISO();
  const extra = useSearchParams().get("with");
  const hidden = b.personal.amountsHidden ?? true;
  const money = (n: number) =>
    hidden ? maskedMoney(b.settings.currency) : formatMoney(Math.round(n), b.settings.currency, locale);

  // Priority order first (active, then plans as ranked), then drafts.
  const rank = projectRank(b).map((p) => p.id);
  const projects = projectsOf(b)
    .map((p) => projectSummary(b, p, today))
    .filter((s) => OFFERED.includes(s.status))
    .sort(
      (a, z) =>
        OFFERED.indexOf(a.status) - OFFERED.indexOf(z.status) || rank.indexOf(a.project.id) - rank.indexOf(z.project.id)
    );
  // One chip per project, then per open order with a buy month (they count in that month).
  const to = useTranslations("orders.status");
  const chips = [
    ...projects.map((s) => ({
      id: s.project.id,
      name: s.project.name,
      status: ts(s.status),
      left: s.left,
      month: s.next?.month,
      on: s.status !== "draft",
    })),
    ...b.orders
      .filter((o) => (o.status === "Planned" || o.status === "Saving") && o.buyMonth)
      .map((o) => ({ id: o.id, name: o.item, status: to(o.status), left: o.price, month: o.buyMonth, on: true })),
  ];
  const counted = chips.filter((c) => c.on).map((c) => c.id);
  const [picked, setPicked] = useState<string[] | null>(null);
  const ids = picked ?? [...counted, ...(extra && chips.some((c) => c.id === extra) ? [extra] : [])];
  const toggle = (id: string) => {
    haptic();
    setPicked(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };
  const left = chips.filter((c) => ids.includes(c.id)).reduce((t, c) => t + c.left, 0);

  return (
    <>
      <Card
        title={t("filter.title")}
        description={t("filter.description")}
        action={
          chips.length > 1 && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPicked(chips.map((c) => c.id))}>
                {t("filter.all")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
                {t("filter.none")}
              </Button>
            </div>
          )
        }
      >
        {chips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("filter.empty")}{" "}
            <Link href="/projects" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("filter.create")}
            </Link>
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = ids.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-sm transition-colors",
                        on ? "border-primary bg-primary/8" : "border-dashed text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"
                        )}
                      >
                        {on && <CheckIcon className="size-3" />}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className={cn("font-medium break-words", on && "text-foreground")}>{c.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {c.status} · {money(c.left)}
                          {c.month && ` · ${monthLabel(c.month, locale)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t("filter.summary", { count: ids.length, amount: money(left) })}
            </p>
          </>
        )}
      </Card>
      <SavingsForecast budget={withPlans(b, ids)} baseline={withPlans(b, [])} />
      {projects.length > 0 && (
        <Link
          href="/projects"
          className="flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm hover:bg-muted"
        >
          {t("toProjects")}
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Link>
      )}
    </>
  );
}
