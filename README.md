# Smart Money Calculator

A phone-friendly personal finance app that answers two questions every month: **how much can I save**, and **can I
afford this purchase or project?** You sign in with Google, the app creates a Google Sheet in your Drive, and every
entry (income, expense, saving) is stored there. You own the data and can edit the sheet by hand.

Full requirements: [PRD](https://claude.ai/artifact/L2o4khqW7BYZqYMszvw91E#335028cc-46cf). It is the source of truth.
This README summarizes it.

> **Status:** M1 in progress. "Connect Google Sheet" (one Google consent, no separate login) and sheet creation are
> built. All P0 screens and
> the calculation engine work, but entries are still kept in the browser (`localStorage`); writing them to the sheet is
> M2.

## Features (v1)

| Area       | What it does                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Setup      | Usual income, starting savings, currency, recurring bills, categories with optional limits, safety cushion, loan rate and term |
| This month | Can still save, left this month, daily allowance, projected spend, savings balance; add an expense in 3 taps or fewer |
| Income     | Salary (replaces usual income) or extra income for this month or up to 24 months ahead                        |
| Savings    | Balance, cushion, usable amount; add to or take from savings                                                  |
| Orders     | One purchase with a verdict: pay now, save up (months), or bank loan (monthly payment, total interest)        |
| Projects   | Multi-month spending (e.g. a renovation) split into parts, simulated month by month to find the loan needed, if any |
| History    | Day, week, month or year; income vs outcomes, chart, category breakdown, filterable entries                   |

Out of scope for v1: AI features, bank connections or CSV import, storage other than Google Sheets, multi-currency,
shared budgets.

## How it works

1. **Connect Google Sheet.** One Google consent asks for name, email and the `drive.file` scope, so the app sees only
   the sheet it creates. There is no separate login and no server database: the refresh token lives in an encrypted,
   httpOnly cookie that page scripts can't read.
2. **The app builds the spreadsheet** with these tabs: `Setup` (named ranges `Settings`, `Bills`, `Categories`),
   `Orders`, `Projects`, a hidden `_MonthTemplate`, and one `YYYY-MM` tab per month.
3. **Every change is recalculated** from the raw rows by a shared TypeScript engine. Nothing calculated is stored. Sheet
   formulas exist only for people reading the sheet.

Sheet rules: row 1 holds the column names, and the app finds columns by name, never by position. Every row has a short
random id, so writes are idempotent. Dates are `YYYY-MM-DD` and months are `YYYY-MM`.

Entries can be added offline. They sync when the connection returns.

## Calculation rules

| Value                     | Rule                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| Income for a month        | Salary entries if any, otherwise usual income; plus extra income           |
| Savings balance           | Opening savings + all savings − all withdrawals                            |
| Left this month           | Income − bills − expenses − saved this month                               |
| Projected spend           | Spent so far + (spent so far ÷ days passed) × days left                    |
| Can still save this month | Income − bills − projected spend − saved this month (min 0)                |
| Daily allowance           | Left this month ÷ days left, counting today                                |
| Usual free money / month  | Usual income − bills − average everyday spending of the last 3 months       |
| Safety cushion            | Cushion months × monthly bills                                             |
| Usable savings            | Savings balance − cushion (min 0)                                          |

**Order verdict** for price P:

1. **Pay now** if usable savings, or usable savings plus what can still be saved this month, cover P.
2. Otherwise **save up** if saving the rest at usual free money fits the deadline (6 months if none is set).
3. Otherwise the **loan is an option** if the monthly loan payment is no more than 35% of usual free money.
4. Otherwise **not affordable now**.

**Project plan:** start from usable savings plus what can still be saved this month, then add each later month's
free money and subtract each part in its planned month. The lowest running balance decides the verdict. If it goes
negative, that amount is the loan needed.

Loan payment for amount `A`, monthly rate `i` (yearly ÷ 12) and `n` months: `A × i / (1 − (1 + i)^−n)`.

## Tech stack

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router, Cache Components, React Compiler) as a PWA          |
| UI         | React 19, Tailwind CSS v4                                                  |
| Backend    | Next.js route handlers / server actions: hold tokens, call Google          |
| Auth       | Auth.js with the Google provider (Keycloak is an open alternative)         |
| Engine     | Shared TypeScript module, unit-tested                                      |
| Storage    | Google Sheets API v4. The server keeps only user id, email, spreadsheet ID, encrypted refresh token and template version |
| Tooling    | bun, Biome, TypeScript strict                                              |
| Later      | Expo native app for reminders and widgets                                  |

## Development

Requires [bun](https://bun.sh) 1.2+ and a Google OAuth client (below).

```bash
bun install
cp .env.example .env.local   # then fill it in
bun dev            # http://localhost:3000
bun run lint       # biome check
bun run format     # biome format --write
bun run test       # calculation engine self-check
bun run build
```

Code conventions (folder layout, path aliases, imports, commits, branches) are in [CLAUDE.md](CLAUDE.md).

### Google OAuth client setup (once, by the developer)

Users never do this: every Google API app needs one registered OAuth client, and each user then connects their own
sheet to it on the consent screen.


1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Sheets API**
   and **Google Drive API**.
2. **OAuth consent screen:** External, add the scopes `openid`, `email`, `profile` and `.../auth/drive.file`, and add
   yourself as a test user. `drive.file` is a non-sensitive scope, so personal use needs no Google verification.
3. **Credentials → Create OAuth client ID → Web application.** Authorized redirect URI:
   `http://localhost:3000/api/auth/callback/google` (add your production URL the same way).
4. Put the client ID and secret in `.env.local` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, and set `AUTH_SECRET`
   (`openssl rand -base64 32`).

## Milestones

| Milestone              | Scope                                                       | Done when                                                       |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| M1 Connect and sheet   | One-step Google connect, create the sheet                   | A new user connects and sees the sheet in Drive with all tabs   |
| M2 Core month          | Setup, This month, Income, Savings, reading and writing the sheet | App entries appear in the month tab and match the sheet summary |
| M3 Planning            | Orders and Projects with verdicts                           | The furniture project shows a correct plan from real data       |
| M4 History and polish  | History, offline queue, sheet repair                        | All P0 requirements pass; the app works offline                 |
| M5 Personal beta       | Daily use for a month                                       | Three months of entries in a row with no data issues            |

Open questions (Auth.js vs Keycloak, web vs Expo first, default cushion, and others) are tracked in the PRD.
