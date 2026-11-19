import {
  loadRates,
  loadSheet,
  saveBills,
  saveEntries,
  saveOrders,
  savePersonal,
  saveProjects,
  saveSavings,
  saveSetup,
  startOverSheet,
} from "@action";
import {
  applyProjectStart,
  baseCurrency,
  convertBudget,
  currencyOfSymbol,
  defaultBudget,
  fromSavings,
  INITIAL_SYNC_META,
  type Lender,
  mergeFromSheet,
  newId,
  type PaySource,
  paymentSplit,
  projectStarted,
  projectsOf,
  repairProjects,
  SHEET_TABS,
  type SheetTab,
  BUDGET_STORAGE_KEY as STORAGE_KEY,
  type SyncMeta,
  setLocaleCookie,
  tabsToWrite,
  todayISO,
} from "@helper";
import type { Bill, Budget, Entry, Order, OrderStatus, Personal, Project, ProjectPart, Saving, Settings } from "@type";
import { useSyncExternalStore } from "react";

// ponytail: browser-only store (localStorage). Entries move to the Google Sheet in M2;
// the local copy stays as the offline queue the PRD asks for.

let state: Budget | null = null;
const listeners = new Set<() => void>();

const load = (): Budget => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Spread over the defaults so budgets saved before a field existed (e.g. `personal`) still load.
    // repairProjects: older started projects get the monthly payments Start creates now.
    if (saved) return repairProjects({ ...defaultBudget(), ...(JSON.parse(saved) as Budget) }, todayISO());
  } catch {}
  return defaultBudget();
};

const getBudget = () => {
  if (!state) {
    state = load();
    queueMicrotask(startSession); // first read in the browser
  }
  return state;
};

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  for (const listener of listeners) listener();
};

// ── Google Sheet sync ────────────────────────────────────────────────────────────────────────────────────────
// The sheet is the source of truth. Every change is written to its tab (one write at a time per tab, each sending
// the data as it is when it starts, so the last write always matches the app). A changed tab stays "dirty", even
// across reloads, until a write of that exact version succeeds. Once per session the dirty tabs are written, then
// the sheet is read back and replaces every tab that's still clean: rows deleted in the sheet disappear here too,
// and changes the sheet doesn't have yet are never overwritten.

const TABS = SHEET_TABS;

const changed: Record<SheetTab, (a: Budget, z: Budget) => boolean> = {
  orders: (a, z) => a.orders !== z.orders,
  projects: (a, z) => a.parts !== z.parts || a.projects !== z.projects,
  bills: (a, z) => a.bills !== z.bills,
  entries: (a, z) => a.entries !== z.entries,
  setup: (a, z) => a.settings !== z.settings || a.categories !== z.categories,
  personal: (a, z) => a.personal !== z.personal,
  savings: (a, z) => a.savings !== z.savings,
};
/** Resolves `true` once written, `false` when no sheet is connected (then it stays dirty). */
const send: Record<SheetTab, () => Promise<boolean>> = {
  orders: () => saveOrders(getBudget().orders),
  projects: () => {
    const b = getBudget();
    return saveProjects(projectsOf(b), b.parts);
  },
  bills: () => saveBills(getBudget().bills),
  entries: () => saveEntries(getBudget().entries),
  setup: () => saveSetup(getBudget().settings, getBudget().categories),
  personal: () => savePersonal(getBudget().personal),
  savings: () => saveSavings(getBudget().savings ?? []),
};

const SYNC_KEY = `${STORAGE_KEY}:sync`;
const readMeta = (): SyncMeta => {
  try {
    const saved = localStorage.getItem(SYNC_KEY);
    if (saved) return { ...INITIAL_SYNC_META, ...(JSON.parse(saved) as Partial<SyncMeta>) };
  } catch {}
  return INITIAL_SYNC_META;
};
const writeMeta = (change: (m: SyncMeta) => SyncMeta) => {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(change(readMeta())));
  } catch {}
};
const setDirty = (tab: SheetTab, dirty: boolean) =>
  writeMeta((m) => ({ ...m, dirty: dirty ? [...new Set([...m.dirty, tab])] : m.dirty.filter((t) => t !== tab) }));

const sheetSync = Object.fromEntries(
  TABS.map((tab) => [tab, { queue: Promise.resolve(), failed: false, version: 0 }])
) as Record<SheetTab, { queue: Promise<void>; failed: boolean; version: number }>;

const setSyncFailed = (tab: SheetTab, failed: boolean) => {
  if (sheetSync[tab].failed === failed) return;
  sheetSync[tab].failed = failed;
  for (const listener of listeners) listener();
};

/** Set while starting over: no new sheet writes, so nothing old lands after the sheet was emptied. */
let resetting = false;

/** Queues a write of `tab`; it's clean again only if no newer change came in meanwhile. */
const syncTab = (tab: SheetTab) => {
  if (resetting) return Promise.resolve();
  const sync = sheetSync[tab];
  const version = ++sync.version;
  setDirty(tab, true);
  sync.queue = sync.queue.then(() =>
    send[tab]().then(
      (written) => {
        if (written && sync.version === version) setDirty(tab, false);
        setSyncFailed(tab, false);
      },
      () => setSyncFailed(tab, true)
    )
  );
  return sync.queue;
};

/**
 * Exchange rates for converting savings kept in other currencies: fetched (server-cached) at most once a day per
 * base currency, and only when some saving needs it. Device-only: never synced.
 */
const refreshRates = async () => {
  const b = getBudget();
  const base = baseCurrency(b);
  if (!base || !(b.savings ?? []).some((s) => s.currency !== base)) return;
  if (b.rates?.base === base && b.rates.date >= todayISO()) return;
  const rates = await loadRates(base).catch(() => null);
  if (!rates) return; // offline / source down: keep the last rates
  state = { ...getBudget(), rates };
  persist();
};

/** Once per session: write what the sheet is missing, then read the sheet back into every clean tab. */
const startSession = async () => {
  refreshRates();
  await Promise.all(tabsToWrite(getBudget(), readMeta()).map(syncTab));
  const data = await loadSheet().catch(() => null);
  if (!data) return; // not connected, or Google failed: keep what this device has
  // Re-read `dirty`: anything changed while the sheet was being read stays as it is here.
  state = mergeFromSheet(getBudget(), data, readMeta().dirty);
  persist();
  // Older started projects get their monthly payments, written to the sheet so every device has the same parts.
  const repaired = repairProjects(getBudget(), todayISO());
  if (repaired !== getBudget()) update(() => repaired);
  refreshRates(); // the sheet may have brought savings in other currencies
  writeMeta((m) => ({ ...m, uploaded: SHEET_TABS })); // from now on the sheet leads for every tab
  // The language from the sheet differs from the one on screen: switch (the server renders pages per locale).
  if (state.personal.locale !== document.documentElement.lang) {
    setLocaleCookie(state.personal.locale);
    location.reload();
  }
};

const update = (change: (b: Budget) => Budget) => {
  const before = getBudget();
  state = change(before);
  persist();
  for (const tab of TABS) if (changed[tab](before, state)) syncTab(tab);
  if (state.savings !== before.savings || state.settings.currency !== before.settings.currency) refreshRates();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** True when the last attempt to mirror `tab` into the sheet failed (the data is still saved on this device). */
export const useSheetSyncFailed = (tab: SheetTab) =>
  useSyncExternalStore(
    subscribe,
    () => sheetSync[tab].failed,
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
  /**
   * Start over: empties the sheet, then this device (everything but appearance and language), and reloads.
   * Queued writes finish first and new ones stop, so no old data lands in the emptied sheet. Resolves `false`,
   * changing nothing, when the sheet couldn't be emptied (no connection, Google failed).
   */
  startOver: async () => {
    resetting = true;
    await Promise.all(SHEET_TABS.map((tab) => sheetSync[tab].queue));
    const ok = await startOverSheet().catch(() => false);
    if (!ok) {
      resetting = false;
      return false;
    }
    const personal = getBudget().personal;
    state = { ...defaultBudget(), personal };
    persist();
    writeMeta(() => ({ uploaded: SHEET_TABS, dirty: [] })); // the device now matches the (empty) sheet
    location.reload();
    return true;
  },
  /**
   * Switches the base currency to `symbol`, converting every base amount at today's rate (see `convertBudget`).
   * Resolves `false`, changing nothing, when there's no rate between the two (offline / source down). A custom
   * symbol on either side can't be converted: then only the symbol changes.
   */
  changeCurrency: async (symbol: string) => {
    const from = baseCurrency(getBudget());
    const to = currencyOfSymbol(symbol);
    if (!from || !to || from === to) {
      update((b) => ({ ...b, settings: { ...b.settings, currency: symbol } }));
      return true;
    }
    const rates = await loadRates(from).catch(() => null);
    const stored = getBudget().rates;
    const factor = rates?.perBase[to] ?? (stored?.base === from ? stored.perBase[to] : undefined);
    if (!factor) return false;
    update((b) => convertBudget(b, factor, symbol));
    return true;
  },
  addSaving: (saving: Omit<Saving, "id">) =>
    update((b) => ({ ...b, savings: [...(b.savings ?? []), { ...saving, id: newId() }] })),
  updateSaving: (id: string, change: Partial<Omit<Saving, "id">>) =>
    update((b) => ({ ...b, savings: (b.savings ?? []).map((s) => (s.id === id ? { ...s, ...change } : s)) })),
  removeSaving: (id: string) => update((b) => ({ ...b, savings: (b.savings ?? []).filter((s) => s.id !== id) })),

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
  startProject: (projectId: string, billName: (lender: Lender, part: string) => string) =>
    update((b) => {
      const today = todayISO();
      // Monthly payments (loan instalments, later parts split by month) stay parts to pay one by one; their
      // recurring bills put them in every month's budget.
      return applyProjectStart(upsertProject(b, projectId, { startedDate: today }), projectId, today, billName, newId);
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
      // A started loan's monthly payment is already in the month's bills: record it as that bill being paid, not
      // as a new expense, so it isn't counted twice.
      const billed = part.installment && b.bills.some((bill) => bill.projectId === part.projectId && bill.active);
      return {
        ...b,
        entries: [
          ...b.entries,
          ...(savings > 0
            ? [entry({ type: "withdrawal", amount: savings, category: "Home", note, linkId: partId })]
            : []),
          entry({ type: billed ? "bill_paid" : "expense", amount: part.cost, category: "Home", note, linkId: partId }),
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
