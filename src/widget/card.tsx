import type { ReactNode } from "react";
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle, Card as UiCard } from "./ui/card";

type Props = { title?: string; description?: ReactNode; action?: ReactNode; className?: string; children: ReactNode };

/** App card: shadcn Card with the header filled in from props. */
export function Card({ title, description, action, className, children }: Props) {
  return (
    <UiCard className={className}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </UiCard>
  );
}
