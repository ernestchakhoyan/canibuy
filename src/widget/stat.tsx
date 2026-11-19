import { cn } from "@helper";

type Props = { label: string; value: string; hint?: string; tone?: "positive" | "negative" | "default"; big?: boolean };

const toneClass = { positive: "text-positive", negative: "text-negative", default: "" };

export function Stat({ label, value, hint, tone = "default", big }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tracking-tight tabular-nums", big ? "text-4xl" : "text-xl", toneClass[tone])}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
