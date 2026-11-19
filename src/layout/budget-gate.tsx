"use client";

import { useBudget } from "@store";
import type { ReactNode } from "react";

/** Renders children only once the browser-stored budget is loaded, so containers can use `useLoadedBudget`. */
export function BudgetGate({ children }: { children: ReactNode }) {
  return useBudget() ? children : <p className="text-sm text-muted-foreground">Loading your budget…</p>;
}
