import { cn } from "@helper";
import type { Entry } from "@type";
import { ArrowDownLeftIcon, ArrowUpRightIcon, PiggyBankIcon, ReceiptIcon, XIcon } from "lucide-react";
import { Button } from "./ui/button";

const typeLabel: Record<Entry["type"], string> = {
  expense: "Expense",
  income_salary: "Salary",
  income_extra: "Extra income",
  saving: "Saved",
  withdrawal: "From savings",
  bill_paid: "Bill paid",
};

const typeIcon: Record<Entry["type"], typeof ReceiptIcon> = {
  expense: ArrowUpRightIcon,
  income_salary: ArrowDownLeftIcon,
  income_extra: ArrowDownLeftIcon,
  saving: PiggyBankIcon,
  withdrawal: PiggyBankIcon,
  bill_paid: ReceiptIcon,
};

const isIncoming = (e: Entry) => e.type === "income_salary" || e.type === "income_extra" || e.type === "withdrawal";

type Props = { entry: Entry; money: (n: number) => string; onDelete?: () => void };

export function EntryRow({ entry, money, onDelete }: Props) {
  const Icon = typeIcon[entry.type];
  const incoming = isIncoming(entry);

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          incoming ? "bg-positive/10 text-positive" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{entry.note || entry.category || typeLabel[entry.type]}</span>
        <span className="truncate text-xs text-muted-foreground">
          {entry.date} · {typeLabel[entry.type]}
          {entry.category && entry.note ? ` · ${entry.category}` : ""}
        </span>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", incoming && "text-positive")}>
        {incoming ? "+" : "−"}
        {money(entry.amount)}
      </span>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${entry.note || typeLabel[entry.type]}`}
        >
          <XIcon />
        </Button>
      )}
    </li>
  );
}
