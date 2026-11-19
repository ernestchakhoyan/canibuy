import type { AppMode } from "@type";

/**
 * Puts `.dark` on <html> (Tailwind's `dark:` variant and the dark tokens key off it).
 * Self-contained on purpose: it's also stringified into the inline <head> script (`APP_MODE_SCRIPT`).
 */
export function applyAppMode(mode: AppMode) {
  const dark = mode === "dark" || (mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** localStorage key of the budget (`@store`); here so the server-rendered <head> script can read it too. */
export const BUDGET_STORAGE_KEY = "smart-money:v1";

/** Inline <head> script: applies the saved appearance before first paint, so dark mode doesn't flash light. */
export const APP_MODE_SCRIPT = `try{(${applyAppMode})(JSON.parse(localStorage.getItem(${JSON.stringify(BUDGET_STORAGE_KEY)})).personal.appMode)}catch(e){(${applyAppMode})("system")}`;
