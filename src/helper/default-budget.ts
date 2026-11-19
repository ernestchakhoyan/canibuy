import type { Budget } from "@type";
import { monthOf, todayISO } from "./date";

/** Starting values for a new budget: the local store and the new Google Sheet both start from these. */
export const defaultBudget = (): Budget => {
  const month = monthOf(todayISO());
  return {
    settings: {
      currency: "֏",
      usualIncome: 0,
      openingSavings: 0,
      cushionMonths: 3,
      loanRate: 14,
      loanTermMonths: 12,
      startMonth: month,
    },
    personal: { appMode: "system", locale: "en", amountsHidden: true },
    bills: [],
    categories: ["Food", "Transport", "Home", "Utilities", "Health", "Fun", "Other"].map((name) => ({
      name,
      monthlyLimit: 0,
    })),
    entries: [],
    orders: [],
    parts: [],
    projects: [],
  };
};
