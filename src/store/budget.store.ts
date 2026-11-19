import { defaultBudget, fromSavings, newId, todayISO } from "@helper";
import type { Bill, Budget, Entry, Order, OrderStatus, ProjectPart, Settings } from "@type";
import { useSyncExternalStore } from "react";

// ponytail: browser-only store (localStorage). Entries move to the Google Sheet in M2;
// the local copy stays as the offline queue the PRD asks for.

const STORAGE_KEY = "smart-money:v1";

let state: Budget | null = null;
const listeners = new Set<() => void>();

const load = (): Budget => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as Budget;
  } catch {}
  return defaultBudget();
};

const getBudget = () => {
  state ??= load();
  return state;
};

const update = (change: (b: Budget) => Budget) => {
  state = change(getBudget());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** `null` during server render and hydration; the loaded budget on the client after that. */
export const useBudget = () => useSyncExternalStore(subscribe, getBudget, () => null);

type NewEntry = Pick<Entry, "type" | "amount"> & Partial<Omit<Entry, "id" | "createdAt">>;

const entry = (e: NewEntry): Entry => ({
  id: newId(),
  date: todayISO(),
  category: "",
  note: "",
  linkId: "",
  createdAt: new Date().toISOString().slice(0, 16),
  ...e,
});

/** Pays `price` linked to `linkId`: from savings as far as allowed, the rest from this month. */
const payEntries = (b: Budget, price: number, linkId: string, category: string, note: string) => {
  const savings = fromSavings(b, price, linkId);
  return [
    ...(savings > 0 ? [entry({ type: "withdrawal", amount: savings, category, note, linkId })] : []),
    entry({ type: "expense", amount: price, category, note, linkId }),
  ];
};

export const budgetActions = {
  updateSettings: (settings: Partial<Settings>) => update((b) => ({ ...b, settings: { ...b.settings, ...settings } })),

  addBill: (bill: Omit<Bill, "id">) => update((b) => ({ ...b, bills: [...b.bills, { ...bill, id: newId() }] })),
  updateBill: (id: string, change: Partial<Bill>) =>
    update((b) => ({ ...b, bills: b.bills.map((bill) => (bill.id === id ? { ...bill, ...change } : bill)) })),
  removeBill: (id: string) => update((b) => ({ ...b, bills: b.bills.filter((bill) => bill.id !== id) })),

  addCategory: (name: string) =>
    update((b) =>
      b.categories.some((c) => c.name === name) ? b : { ...b, categories: [...b.categories, { name, monthlyLimit: 0 }] }
    ),
  removeCategory: (name: string) => update((b) => ({ ...b, categories: b.categories.filter((c) => c.name !== name) })),

  addEntry: (e: NewEntry) =>
    update((b) => {
      const added = entry(e);
      // Saving toward a planned order moves it to Saving (ORD-3).
      const orders = b.orders.map((o) =>
        added.type === "saving" && o.id === added.linkId && o.status === "Planned"
          ? { ...o, status: "Saving" as const }
          : o
      );
      return { ...b, orders, entries: [...b.entries, added] };
    }),
  removeEntry: (id: string) => update((b) => ({ ...b, entries: b.entries.filter((e) => e.id !== id) })),

  addOrder: (order: Pick<Order, "item" | "price" | "deadlineMonths" | "note">) =>
    update((b) => ({
      ...b,
      orders: [...b.orders, { ...order, id: newId(), status: "Planned", created: todayISO(), boughtDate: "" }],
    })),
  setOrderStatus: (id: string, status: OrderStatus) =>
    update((b) => ({ ...b, orders: b.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
  buyOrder: (id: string) =>
    update((b) => {
      const order = b.orders.find((o) => o.id === id);
      if (!order || order.status === "Bought") return b;
      return {
        ...b,
        entries: [...b.entries, ...payEntries(b, order.price, id, "Other", order.item)],
        orders: b.orders.map((o) => (o.id === id ? { ...o, status: "Bought", boughtDate: todayISO() } : o)),
      };
    }),

  addProject: (project: string, parts: Pick<ProjectPart, "part" | "cost" | "payMonth">[]) => {
    const projectId = newId();
    update((b) => ({
      ...b,
      parts: [
        ...b.parts,
        ...parts.map((p) => ({ ...p, projectId, project, partId: newId(), status: "Planned" as const, paidDate: "" })),
      ],
    }));
  },
  addPart: (projectId: string, part: Pick<ProjectPart, "part" | "cost" | "payMonth">) =>
    update((b) => {
      const project = b.parts.find((p) => p.projectId === projectId)?.project ?? "";
      return {
        ...b,
        parts: [...b.parts, { ...part, projectId, project, partId: newId(), status: "Planned", paidDate: "" }],
      };
    }),
  movePart: (partId: string, payMonth: string) =>
    update((b) => ({ ...b, parts: b.parts.map((p) => (p.partId === partId ? { ...p, payMonth } : p)) })),
  removePart: (partId: string) => update((b) => ({ ...b, parts: b.parts.filter((p) => p.partId !== partId) })),
  payPart: (partId: string) =>
    update((b) => {
      const part = b.parts.find((p) => p.partId === partId);
      if (!part || part.status === "Paid") return b;
      return {
        ...b,
        entries: [...b.entries, ...payEntries(b, part.cost, partId, "Home", `${part.project}: ${part.part}`)],
        parts: b.parts.map((p) => (p.partId === partId ? { ...p, status: "Paid", paidDate: todayISO() } : p)),
      };
    }),
};

/** For components rendered inside `BudgetGate`, which only renders children once the budget is loaded. */
export const useLoadedBudget = () => {
  const budget = useBudget();
  if (!budget) throw new Error("useLoadedBudget used outside BudgetGate");
  return budget;
};
