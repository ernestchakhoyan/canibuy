# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Product

canibuy (formerly Smart Money Calculator): a budgeting PWA whose database is the user's own Google Sheet. `README.md` summarizes it; the
[PRD](https://claude.ai/artifact/L2o4khqW7BYZqYMszvw91E#335028cc-46cf) is the source of truth for requirement IDs
(`SET-*`, `MON-*`, `AUTH-*`, `SHEET-*`…), the sheet template and the calculation rules — read it before building a
feature.

## Commands

Package manager is **bun** (`bun.lock`, `packageManager: bun@1.2.3`).

- `bun dev` — dev server on http://localhost:3000 (Turbopack)
- `bun run build` / `bun start` — production build / serve
- `bun run lint` — `biome check` (lint + format check + import sorting); `bunx biome check --write` to autofix
- `bun run format` — `biome format --write`

- `bun run test` — runs `src/helper/engine.check.ts` and `src/server/sheet-template.check.ts`, assert-based self-checks (no test
  framework; it uses `node:assert` so `next build`'s typecheck passes)

Biome replaces ESLint/Prettier — don't add either.

## Architecture

Data flows one way: `src/app/<route>/page.tsx` → builder (`@builder`) → containers (`@container`) → store (`@store`)
→ engine (`@helper`).

- **Pages** only render their builder. **Builders** (`src/builder/page.builder.tsx`) set the page title and wrap the
  containers in `BudgetGate`.
- **Store** (`src/store/budget.store.ts`): one `Budget` object in `localStorage`, read via `useSyncExternalStore`.
  `useBudget()` is `null` on the server and during hydration; `BudgetGate` renders children only after it loads, so
  containers use `useLoadedBudget()` and never handle `null`. All writes go through `budgetActions`. This is the
  stand-in for Google Sheets (M1/M2); the `Budget` shape in `src/@type/budget.type.ts` mirrors the sheet tabs.
- **Engine** (`src/helper/engine.ts`): pure functions implementing PRD section 7. Nothing calculated is stored —
  everything is derived from raw entries on each render.
- **Auth (M1):** Auth.js v5 in `src/server/auth.ts`, Google REST calls over `fetch` in `src/server/google.ts`, server
  actions in `src/action/auth.action.ts`, routing in `src/proxy.ts` (Next 16's renamed middleware): no connected sheet → `/connect`, the only public
  page. There is no separate login: one Google consent asks `openid email profile drive.file` (offline + consent) and
  the `jwt` callback finds-or-creates the sheet. Every user connects their own sheet with the app's one OAuth client. There is no database: tokens and
  the spreadsheet ID live in the encrypted session cookie, and the sheet is rediscovered via a Drive `appProperties`
  tag. `session` exposes only `user` and `sheet` — read Google tokens server-side with `googleToken()`.
- `src/server/sheet-template.ts` builds the whole sheet (PRD section 6) as one `spreadsheets.create` body; it stays
  free of `server-only` so `bun run test` can check it. Server components that call `auth()` need
  `await connection()` first (Auth.js touches `crypto` before cookies, which Cache Components rejects).
- `AppShell` (root layout) must always render `children`: hiding the page segment on the server breaks Partial
  Prefetching's instant-navigation validation. Put loading gates inside builders instead.
- Cache Components keeps visited pages mounted but hidden (`<Activity>`): forms reset in their submit handler, and
  e2e selectors must be visibility-aware (`getByRole`, not `getByLabel`).

## Stack and config notes

- Next.js 16.4 App Router, React 19.3, TypeScript strict, Tailwind v4.
- `next.config.ts` enables flags that change how code must be written — check the bundled docs
  (`node_modules/next/dist/docs/`) before relying on older patterns:
  - `cacheComponents: true` — Cache Components model (`"use cache"`, dynamic-by-default rendering, Suspense boundaries
    around uncached/dynamic data).
  - `reactCompiler: true` — React Compiler auto-memoizes; avoid manual `useMemo`/`useCallback`/`memo` unless needed.
  - `partialPrefetching: true`.
  - Tailwind is wired through a Turbopack CSS loader (`@tailwindcss/turbopack`), not PostCSS — there is no
    `postcss.config`.
- Tailwind v4 is CSS-first: theme tokens are defined in `src/app/globals.css` via `@theme inline`, no `tailwind.config`.
  Brand tokens ("Ledger green" primary, `brand-gold` / `brand-gold-ink`, money tones `positive`/`negative`/`warning`)
  live there too; dark mode follows `prefers-color-scheme` (the `dark:` variant is a media query, no theme toggle).
- UI is shadcn/ui (Base UI primitives, `base-nova` style, lucide icons). `components.json` puts components in
  `src/widget/ui` and re-exports them from the `@widget` barrel — import `Button`, `Field`, … from `@widget`. Add more
  with `bunx --bun shadcn@latest add <name>` and export them from `src/widget/index.ts`. `src/widget/ui` is vendored:
  Biome formats it but doesn't lint it. Control heights are bumped to 44px (`h-11`) for touch.
- Route props use Next's generated global types (e.g. `LayoutProps<"/">`, `PageProps<...>`) from `.next/types`, produced
  by `next dev`/`next build`.

## Conventions

Follows the FreedX frontend-platform conventions, adapted to this single Next.js app.

### Commit Messages

Conventional Commits (not enforced by tooling here):

```
<type>(<scope>): <description>
```

- **Types:** feat, fix, chore, docs, refactor, style, ci, perf, test
- **Scope:** the feature/folder touched (optional)
- Max subject length: 64 characters

### Branch Naming

```
<initials>/<type>/<name>
```

Example: `ech/feat/price-check`, `ech/fix/login-redirect`

### Code Style

Enforced by Biome (`biome.json`):

- **Semicolons:** required
- **Quotes:** double quotes
- **Print width:** 120 characters
- **Trailing commas:** ES5
- **Import sorting:** Biome `organizeImports`

### File Structure

`src/app/` is only Next routing (`page.tsx`, `layout.tsx`, route handlers) — keep it thin and compose from folders
alongside it. Create a folder only when the first file for it exists:

```
src/
├── app/          # Next App Router: routes, layouts
├── action/       # "use server" actions (callable from client code)
├── builder/      # Page/section builders
├── config/       # App configuration
├── container/    # Smart/connected components
├── decorator/    # HOCs and decorators
├── drawer/       # Drawer components
├── form/         # Form components
├── helper/       # Utility functions (client-safe)
├── hook/         # Custom React hooks
├── i18n/         # Translations
├── layout/       # Layout components
├── modal/        # Modal components
├── provider/     # React context providers
├── section/      # Page sections
├── server/       # Server-only code (starts with `import "server-only"`)
├── service/      # API services
├── store/        # State management
├── table/        # Table components
├── widget/       # Reusable widgets
└── @type/        # TypeScript type definitions
```

### TypeScript

- Prefer `Type[]` over `Array<Type>`
- Strict mode enabled
- Each folder gets a path alias in `tsconfig.json` when created (`"@container": ["./src/container"]`,
  `"@container/*": ["./src/container/*"]`). `@/*` → `src/*` exists from the scaffold.

### Import Rules

- **One import per barrel.** Each folder has an `index.ts` barrel; outside the folder, import from the alias root:
  `import { PriceContainer, ResponsiveSelect } from "@container"`. Dynamic `import()` for lazy chunks keeps a deep path.
- **Relative inside the same alias.** In `src/container/**`, import `../../responsive-select`, not `@container/...`.
- **Server-only code lives in `src/server` (`@server`).** `"use client"` files must not import `@server`. `"use server"`
  actions live in `src/action` (`@action`) and may be called from client code. `@helper` is client-safe.

### Tech Debt

Mark with: `TODO[techdebt]: <description and proposed solution>`
