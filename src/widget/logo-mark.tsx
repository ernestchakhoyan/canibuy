import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"svg">, "width" | "height"> & { size?: number };

/**
 * Brand mark: four calculator keys, plus / minus / equals on emerald and a gold key with a check
 * ("yes, you can buy it"). Colors are theme classes, so dark mode needs nothing extra.
 */
export function LogoMark({ size = 32, className, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label="Canibuy"
      className={className}
      {...props}
    >
      <rect x="6" y="6" width="50" height="50" rx="14" className="fill-primary" />
      <rect x="64" y="6" width="50" height="50" rx="14" className="fill-primary" />
      <rect x="6" y="64" width="50" height="50" rx="14" className="fill-primary" />
      <rect x="64" y="64" width="50" height="50" rx="14" className="fill-brand-gold" />
      <path
        d="M31 19V43M19 31H43M77 31H101M19 83H43M19 95H43"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <path
        d="M77 89L85 97L101 80"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-brand-gold-foreground"
      />
    </svg>
  );
}
