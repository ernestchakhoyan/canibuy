import { cn } from "@helper";

/** Logo mark + wordmark. The mark is a coin with a check: "yes, you can buy it". */
export function Brand({ className, size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={size === "lg" ? "size-10" : "size-7"}>
        <rect width="32" height="32" rx="9" className="fill-primary" />
        <circle cx="16" cy="16" r="9" className="fill-brand-gold" />
        <path
          d="m11.5 16.2 3 3 6-6.4"
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-brand-gold-foreground"
        />
      </svg>
      <span className={size === "lg" ? "text-2xl" : "text-base"}>
        can<span className="text-primary">i</span>buy
      </span>
    </span>
  );
}
