type Props = { label: string; value: string; hint?: string; tone?: "positive" | "negative" | "default"; big?: boolean };

const toneClass = { positive: "text-positive", negative: "text-negative", default: "" };

export function Stat({ label, value, hint, tone = "default", big }: Props) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`${big ? "text-3xl" : "text-lg"} font-semibold tabular-nums ${toneClass[tone]}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
