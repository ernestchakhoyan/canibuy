import { saveOrders } from "@action";
import {
  defaultBudget,
  fromSavings,
  newId,
  type PaySource,
  paymentSplit,
  projectStart,
  projectStarted,
  projectsOf,
  BUDGET_STORAGE_KEY as STORAGE_KEY,
  todayISO,
} from "@helper";
import type { Bill, Budget, Entry, Order, OrderStatus, Personal, Project, ProjectPart, Settings } from "@type";
import { useSyncExternalStore } from "react";

// ponytail: browser-only store (localStorage). Entries move to the Google Sheet in M2;
// the local copy stays as the offline queue the PRD asks for.

let state: Budget | null = null;
const listeners = new Set<() => void>();

const load = (): Budget => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Spread over the defaults so budgets saved before a field existed (e.g. `personal`) still load.
    if (saved) return { ...defaultBudget(), ...(JSON.parse(saved) as Budget) };
  } catch {}
  return defaultBudget();
};

const getBudget = () => {
  state ??= load();
  return state;
};

/**
 * Orders mirror into the sheet's Orders tab after every change. One write at a time, each sending the orders as they
 * are when it starts, so quick changes can't land out of order and the last write always matches the app.
 */
let ordersSyncFailed = false;
let ordersSync: Promise<void> = Promise.resolve();
const syncOrders = () => {
  ordersSync = ordersSync.then(() =>
    saveOrders(getBudget().orders).then(
      () => setOrdersSyncFailed(false),
      () => setOrdersSyncFailed(true)
    )
  );
};
const setOrdersSyncFailed = (failed: boolean) => {
  if (ordersSyncFailed === failed) return;
  ordersSyncFailed = failed;
  for (const listener of listeners) listener();
};

const update = (change: (b: Budget) => Budget) => {
  const before = getBudget();
  state = change(before);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  for (const listener of listeners) listener();
  if (state.orders !== before.orders) syncOrders();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True when the last attempt to mirror orders into the sheet failed (they're still saved on this device). */
export const useOrdersSyncFailed = () =>
  useSyncExternalStore(
    subscribe,
    () => ordersSyncFailed,
    () => false
  );

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

/** Writes a project record, creating it first when older data only knew the project from its parts or bill. */
const upsertProject = (b: Budget, projectId: string, change: Partial<Project>): Budget => ({
  ...b,
  projects: projectsOf(b).map((p) => (p.id === projectId ? { ...p, ...change } : p)),
});

export const budgetActions = {
  updateSettings: (settings: Partial<Settings>) => update((b) => ({ ...b, settings: { ...b.settings, ...settings } })),
  updatePersonal: (personal: Partial<Personal>) => update((b) => ({ ...b, personal: { ...b.personal, ...personal } })),

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
  /** Bank terms for one order; `null` goes back to Setup's. */
  setOrderLoan: (id: string, terms: Pick<Order, "loanRate" | "loanTermMonths">) =>
    update((b) => ({ ...b, orders: b.orders.map((o) => (o.id === id ? { ...o, ...terms } : o)) })),
  removeOrder: (id: string) => update((b) => ({ ...b, orders: b.orders.filter((o) => o.id !== id) })),
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

  /**
   * Turns an open order into a project made of `parts` (see `projectPartsFor`). Savings put aside toward the order
   * move to the first part, so paying it can still draw on them. Returns the new project's id.
   */
  orderToProject: (id: string, parts: Pick<ProjectPart, "part" | "cost" | "payMonth" | "installment">[]) => {
    const projectId = newId();
    update((b) => {
      const order = b.orders.find((o) => o.id === id);
      if (!order || order.status === "Bought" || order.status === "Dropped" || parts.length === 0) return b;
      const added = parts.map((p) => ({
        ...p,
        projectId,
        project: order.item,
        partId: newId(),
        status: "Planned" as const,
        paidDate: "",
      }));
      return {
        ...b,
        orders: b.orders.filter((o) => o.id !== id),
        entries: b.entries.map((e) => (e.linkId === id ? { ...e, linkId: added[0].partId } : e)),
        parts: [...b.parts, ...added],
        projects: [...projectsOf(b), { id: projectId, name: order.item }],
      };
    });
    return projectId;
  },

  /** Creates a project (not started yet) and returns its id. */
  addProject: (project: string, parts: Pick<ProjectPart, "part" | "cost" | "payMonth">[]) => {
    const projectId = newId();
    update((b) => ({
      ...b,
      parts: [
        ...b.parts,
        ...parts.map((p) => ({ ...p, projectId, project, partId: newId(), status: "Planned" as const, paidDate: "" })),
      ],
      projects: [...projectsOf(b), { id: projectId, name: project }],
    }));
    return projectId;
  },
  addPart: (projectId: string, part: Pick<ProjectPart, "part" | "cost" | "payMonth">) =>
    update((b) => ({
      ...b,
      parts: [
        ...b.parts,
        {
          ...part,
          projectId,
          project: projectsOf(b).find((p) => p.id === projectId)?.name ?? "",
          partId: newId(),
          status: "Planned",
          paidDate: "",
        },
      ],
    })),
  movePart: (partId: string, payMonth: string) =>
    update((b) => ({ ...b, parts: b.parts.map((p) => (p.partId === partId ? { ...p, payMonth } : p)) })),
  removePart: (partId: string) => update((b) => ({ ...b, parts: b.parts.filter((p) => p.partId !== partId) })),

  /**
   * Starts a project: records today as its start and replaces its instalments with a recurring bill per lender
   * (see `projectStart`). Nothing is paid; `billName` names the bill in the user's language.
   */
  startProject: (projectId: string, billName: (lender: "bank" | "friend") => string) =>
    update((b) => {
      const today = todayISO();
      const plan = projectStart(b, projectId, today, billName);
      return {
        ...upsertProject(b, projectId, { startedDate: today }),
        parts: b.parts.filter((p) => !plan.remove.includes(p.partId)),
        bills: [...b.bills, ...plan.bills.map((bill) => ({ ...bill, id: newId() }))],
      };
    }),
  /** Archives (hides from the active tabs) or restores a project; nothing about its money changes. */
  archiveProject: (projectId: string, archived: boolean) =>
    update((b) => upsertProject(b, projectId, { archivedDate: archived ? todayISO() : undefined })),
  /** Deletes a project that hasn't started (a started one has payments and a bill tied to it: archive it instead). */
  deleteProject: (projectId: string) =>
    update((b) =>
      projectStarted(b, projectId)
        ? b
        : {
            ...b,
            parts: b.parts.filter((p) => p.projectId !== projectId),
            projects: projectsOf(b).filter((p) => p.id !== projectId),
          }
    ),

  /** Pays a part, its money coming from `source` (see `paymentSplit`). */
  payPart: (partId: string, source: PaySource) =>
    update((b) => {
      const part = b.parts.find((p) => p.partId === partId);
      if (!part || part.status === "Paid") return b;
      const { savings } = paymentSplit(b, part.cost, partId, source);
      const note = `${part.project}: ${part.part}`;
      return {
        ...b,
        entries: [
          ...b.entries,
          ...(savings > 0
            ? [entry({ type: "withdrawal", amount: savings, category: "Home", note, linkId: partId })]
            : []),
          entry({ type: "expense", amount: part.cost, category: "Home", note, linkId: partId }),
        ],
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
