import type { Entry } from "@type";

const typeLabel: Record<Entry["type"], string> = {
  expense: "Expense",
  income_salary: "Salary",
  income_extra: "Extra income",
  saving: "Saved",
  withdrawal: "From savings",
  bill_paid: "Bill paid",
};

const isIncoming = (e: Entry) => e.type === "income_salary" || e.type === "income_extra" || e.type === "withdrawal";

type Props = { entry: Entry; money: (n: number) => string; onDelete?: () => void };

export function EntryRow({ entry, money, onDelete }: Props) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{entry.note || entry.category || typeLabel[entry.type]}</span>
        <span className="text-xs text-muted">
          {entry.date} · {typeLabel[entry.type]}
          {entry.category && entry.note ? ` · ${entry.category}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`tabular-nums text-sm font-medium ${isIncoming(entry) ? "text-positive" : ""}`}>
          {isIncoming(entry) ? "+" : "−"}
          {money(entry.amount)}
        </span>
        {onDelete && (
          <button
            type="button"
            className="btn btn-small"
            onClick={onDelete}
            aria-label={`Delete ${entry.note || typeLabel[entry.type]}`}
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}
