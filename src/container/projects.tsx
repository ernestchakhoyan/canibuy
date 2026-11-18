"use client";

import { addMonths, formatMoney, monthLabel, monthOf, parseAmount, projectPlan, todayISO } from "@helper";
import { budgetActions, useLoadedBudget } from "@store";
import type { ProjectPart } from "@type";
import { Card } from "@widget";
import { type FormEvent, useState } from "react";

const MONTHS_AHEAD = 24;
const monthOptions = () => {
  const current = monthOf(todayISO());
  return Array.from({ length: MONTHS_AHEAD + 1 }, (_, i) => addMonths(current, i));
};

/** Part fields shared by the new-project form and the add-part form. */
function PartFields() {
  return (
    <>
      <label className="field col-span-2">
        Part
        <input name="part" required className="input" placeholder="Furniture" />
      </label>
      <label className="field">
        Cost
        <input name="cost" inputMode="decimal" required autoComplete="off" className="input" placeholder="20,000" />
      </label>
      <label className="field">
        Pay in
        <select name="payMonth" className="input">
          {monthOptions().map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const readPart = (form: FormData) => {
  const cost = parseAmount(String(form.get("cost")));
  if (!cost || cost <= 0) return null;
  return { part: String(form.get("part")).trim(), cost, payMonth: String(form.get("payMonth")) };
};

export function ProjectForm() {
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const part = readPart(form);
    if (!part) return setError("Enter a cost above 0");
    budgetActions.addProject(String(form.get("project")).trim(), [part]);
    setError("");
    event.currentTarget.reset();
  };

  return (
    <Card title="New project">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <label className="field col-span-2">
          Project
          <input name="project" required className="input" placeholder="Home renovation" />
        </label>
        <PartFields />
        {error && (
          <p role="alert" className="col-span-2 text-sm text-negative">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary col-span-2">
          Create project
        </button>
      </form>
    </Card>
  );
}

function AddPartForm({ projectId }: { projectId: string }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const part = readPart(new FormData(event.currentTarget));
    if (!part) return;
    budgetActions.addPart(projectId, part);
    event.currentTarget.reset();
  };

  return (
    <details>
      <summary className="btn cursor-pointer">Add part</summary>
      <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-3">
        <PartFields />
        <button type="submit" className="btn btn-primary col-span-2">
          Add part
        </button>
      </form>
    </details>
  );
}

function ProjectCard({ projectId, parts }: { projectId: string; parts: ProjectPart[] }) {
  const b = useLoadedBudget();
  const money = (n: number) => formatMoney(Math.round(n), b.settings.currency);
  const plan = projectPlan(b, projectId, todayISO());
  const months = monthOptions();

  return (
    <Card title={parts[0].project} action={<span className="text-sm tabular-nums">{money(plan.total)} left</span>}>
      {plan.total > 0 &&
        (plan.covered ? (
          <p className="text-sm font-medium text-positive">Covered by savings and salary.</p>
        ) : (
          <div className="text-sm">
            <p className="font-medium text-warning">
              Needs a loan of {money(plan.loan?.amount ?? 0)}: {money(plan.loan?.payment ?? 0)}/mo, +
              {money(plan.loan?.totalInterest ?? 0)} interest.
            </p>
            <p className="text-muted">
              {plan.affordableMonth
                ? `Without a loan, affordable from ${monthLabel(plan.affordableMonth)}.`
                : "Not affordable without a loan within 10 years."}
            </p>
          </div>
        ))}

      <ul className="divide-y divide-border">
        {parts.map((p) => (
          <li key={p.partId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex flex-col">
              <span className="text-sm">{p.part}</span>
              <span className="text-xs text-muted tabular-nums">{money(p.cost)}</span>
            </div>
            {p.status === "Paid" ? (
              <span className="text-xs text-muted">Paid {p.paidDate}</span>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Payment month for ${p.part}`}
                  className="input w-auto"
                  value={p.payMonth}
                  onChange={(e) => budgetActions.movePart(p.partId, e.target.value)}
                >
                  {(months.includes(p.payMonth) ? months : [p.payMonth, ...months]).map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-small" onClick={() => budgetActions.payPart(p.partId)}>
                  Pay
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  aria-label={`Remove ${p.part}`}
                  onClick={() => budgetActions.removePart(p.partId)}
                >
                  ✕
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {plan.total > 0 && (
        <table className="w-full text-sm tabular-nums">
          <caption className="text-left text-xs text-muted">Month by month</caption>
          <thead className="text-xs text-muted">
            <tr>
              <th className="text-left font-normal">Month</th>
              <th className="text-right font-normal">In</th>
              <th className="text-right font-normal">Paid</th>
              <th className="text-right font-normal">Balance</th>
            </tr>
          </thead>
          <tbody>
            {plan.months.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td className="text-right">{money(m.added)}</td>
                <td className="text-right">{m.paid ? money(m.paid) : ""}</td>
                <td className={`text-right ${m.balance < 0 ? "text-negative" : ""}`}>{money(m.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddPartForm projectId={projectId} />
    </Card>
  );
}

export function ProjectList() {
  const b = useLoadedBudget();
  const projects = Map.groupBy(b.parts, (p) => p.projectId);

  return projects.size === 0 ? (
    <p className="text-sm text-muted">No projects yet. Plan multi-month spending, like a renovation, above.</p>
  ) : (
    [...projects].map(([id, parts]) => <ProjectCard key={id} projectId={id} parts={parts} />)
  );
}
