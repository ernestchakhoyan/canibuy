import { Children, type ReactNode } from "react";
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle, Card as UiCard } from "./ui/card";

type Props = { title?: string; description?: ReactNode; action?: ReactNode; className?: string; children?: ReactNode };

/** App card: shadcn Card with the header filled in from props. */
export function Card({ title, description, action, className, children }: Props) {
  return (
    <UiCard className={className}>
      {(title || action) && (
        // Flex-wrap, not shadcn's grid: the title keeps one line and the action drops under it only when both
        // don't fit (phones); the description always spans the full width below.
        <CardHeader className="flex flex-wrap justify-between gap-x-3">
          {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
          {action && <CardAction>{action}</CardAction>}
          {description && <CardDescription className="basis-full">{description}</CardDescription>}
        </CardHeader>
      )}
      {/* No body (e.g. a dropped order: just title + badge) → no empty padded strip under the header. */}
      {Children.toArray(children).length > 0 && <CardContent className="flex flex-col gap-4">{children}</CardContent>}
    </UiCard>
  );
}
