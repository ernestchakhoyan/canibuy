import { cn } from "@helper";
import { LogoMark } from "./logo-mark";

const MARK_PX = { sm: 24, md: 32, lg: 48 } as const;

type Props = { variant?: "full" | "mark"; size?: keyof typeof MARK_PX; className?: string };

/** Mark + "canibuy" wordmark. The wordmark scales with the mark: 0.75× its height, gap 0.3×. */
export function Logo({ variant = "full", size = "md", className }: Props) {
  const px = MARK_PX[size];
  if (variant === "mark") return <LogoMark size={px} className={className} />;
  return (
    <span
      role="img"
      aria-label="Canibuy"
      className={cn("inline-flex items-center", className)}
      style={{ gap: px * 0.3 }}
    >
      <LogoMark size={px} aria-hidden="true" />
      <span
        className="font-heading leading-none font-bold tracking-[-0.055em] lowercase"
        style={{ fontSize: px * 0.75 }}
      >
        <span className="text-foreground">cani</span>
        <span className="text-primary">buy</span>
      </span>
    </span>
  );
}
