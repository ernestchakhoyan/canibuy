"use client";

import { useBudget } from "@store";
import { Card, Skeleton } from "@widget";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Renders children only once the browser-stored budget is loaded, so containers can use `useLoadedBudget`.
 * Until then (server HTML, hydration, and after the reload a language change does) it shows card-shaped
 * skeletons, so the page keeps its frame instead of flashing a loading line.
 */
export function BudgetGate({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  if (useBudget()) return children;
  return (
    <output aria-label={t("loading")} className="flex flex-col gap-4">
      {[0, 1].map((card) => (
        <Card key={card}>
          <Skeleton className="h-5 w-1/3 motion-reduce:animate-none" />
          <Skeleton className="h-11 w-full motion-reduce:animate-none" />
          <Skeleton className="h-11 w-2/3 motion-reduce:animate-none" />
        </Card>
      ))}
    </output>
  );
}
