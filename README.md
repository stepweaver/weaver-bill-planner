# Bill Planner

A paycheck-to-bills scheduler for a single household: plan which bills get paid by which paycheck each month, track what is due, what is in-flight, and what has cleared.

## What it does

Bill Planner helps you build a month-by-month cash-flow plan. You define income events (paychecks), add your bills, and the app groups those bills into paycheck windows so you can see which check covers which expenses. As you actually schedule and pay bills, you move them through statuses so the month view always reflects reality.

## Core workflow

1. **Open or create a month**
   - When you sign in, the home page redirects to the currently open month if one exists; otherwise you land on the months list and can create a new month.
   - Each month belongs to the default household ledger and has an `open`/`closed` status.

2. **Add income events**
   - For the current month, add your expected paychecks with dates and amounts.
   - These income events define **paycheck windows** that the app uses to group bills.

3. **Add and review bills**
   - Add bills with due dates, planned amounts, optional payment links, and notes.
   - Bills are automatically grouped into paycheck windows based on when income arrives.

4. **Assign bills to paychecks**
   - Review each paycheck window and confirm which bills will be paid by that check.
   - If the default grouping is not what you want, you can manually move a bill to a different paycheck window.

5. **Move bills through statuses as you pay them**
   - As you schedule and pay bills in your bank, update their status in Bill Planner so the dashboard stays in sync with your real-world cash flow.

6. **Close the month and seed the next one**
   - When a month is complete, you can close it and create the next month using your templates as defaults.

## Bill statuses

Bills move through a simple lifecycle:

- `scheduled` — due, but not yet submitted to the bank or payment provider
- `pending` — payment has been initiated, but has not cleared the bank yet
- `paid` — payment has cleared

In the UI:

- **Due** = `scheduled`
- **Pending** = `pending` (sent, not cleared)
- **Paid** = `paid` (cleared)

This distinction is important for cash-flow planning. A bill should not be marked `pending` until withdrawal has actually been scheduled with your bank or provider.

## Paycheck windows and color coding

On the month view, each paycheck window is represented by a color band:

- Each **income event** (paycheck) defines the start of a paycheck window.
- Bills are grouped into these windows based on their due dates and the timing of income.
- The color associated with a window is used consistently across the calendar and bill list so you can see at a glance which paycheck is funding which bills.
- If needed, you can manually assign a bill to a different paycheck window to reflect how you actually want to pay it.

The **Settings** page includes a color legend explaining which colors correspond to which paycheck windows.

## Features

- **Months** – Create and open months; propagate a new month from a previous one so you can review and adjust instead of starting from scratch.
- **Income** – Add income events per month; these define paycheck windows and drive the color-coded grouping of bills.
- **Bills** – Track bills with due dates, amounts, status, payment links, and notes; auto-grouped by paycheck window with manual override when needed.
- **HUD** – See expected vs actual income, planned vs paid expenses, remaining totals, leftover cash, and counts of overdue and unassigned bills.
- **Templates** – Define recurring bill templates that act as defaults when creating a new month, including support for bills that occur on multiple weekdays in a month.
- **Settings** – Informational page that shows the default ledger, the paycheck-window color legend, and how to change credentials via environment variables.

## MVP limitations

Bill Planner is currently an MVP focused on a single household ledger.

- The app uses a single default ledger: **Household**.
- The Settings page is informational only; there is no in-app UI for changing ledgers or credentials yet.
- To change login credentials, you update environment variables and restart the app.
- Multi-ledger support and in-app credential management can be added in future versions.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Neon Postgres, Drizzle ORM
- Auth.js (credentials), Zod, React Hook Form, date-fns

## Setup

### 1. Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL` – Neon Postgres connection string
- `AUTH_SECRET` – e.g. `openssl rand -base64 32`
- `AUTHORIZED_USERS` – comma-separated `username:password` pairs (e.g. `stephen:mypass,jane:herpass`). Passwords must not contain `,` or `:`.

**Secrets:** Do not prefix these with `NEXT_PUBLIC_`; that inlines values into the client bundle. Keep DB URLs, auth secrets, and API keys in server-only env (e.g. Vercel project env in production).

### 2. Database

Run the schema commands against your Neon database:

```bash
npm run db:push    # or npm run db:migrate if you manage schema via migrations
npm run db:seed    # seeds the default "Household" ledger
```

### 3. Run locally

```bash
npm run dev
```

Then open `http://localhost:3000` and sign in with any username/password from `AUTHORIZED_USERS`.

## Environment variables

- `DATABASE_URL` – Neon Postgres connection string (with `sslmode=require`).
- `AUTH_SECRET` – secret used by Auth.js; generate with `openssl rand -base64 32` or similar.
- `AUTHORIZED_USERS` – comma-separated `username:password` pairs for basic credential auth.

Set these in `.env.local` for local development and in your deployment environment (e.g. Vercel project settings) for production and preview.

## Scripts

From `package.json`:

- `npm run dev` – start the development server.
- `npm run build` – create a production build.
- `npm run start` – run the production build.
- `npm run lint` – run ESLint.
- `npm run db:generate` – generate Drizzle migrations from the current schema.
- `npm run db:migrate` – apply pending Drizzle migrations.
- `npm run db:studio` – open Drizzle Studio.
- `npm run db:push` – push the current schema to the database.
- `npm run db:seed` – seed the default `Household` ledger and sample data.

## Deployment

### Vercel

1. Push your code to GitHub (or another Git provider supported by Vercel).
2. In Vercel, **import** the repository.
3. Configure environment variables in the project settings:
   - `DATABASE_URL` – your Neon Postgres connection string (Production, Preview, Development).
   - `AUTH_SECRET` – secret value generated locally.
   - `AUTHORIZED_USERS` – comma-separated `username:password` list.
4. Deploy. Vercel will build and deploy the app.

**Database:** Ensure your Neon database exists and schema changes have been applied. You can:

- Run `npm run db:push` (or `npm run db:migrate`) locally against the same `DATABASE_URL`.
- Or use Neon's SQL editor to run the migration files under `drizzle/`.

### Row-Level Security (RLS)

An optional migration enables RLS on user-facing tables as a defense-in-depth measure. To enable it:

- Apply the SQL in `drizzle/0004_enable_rls.sql` (for example via the Neon SQL editor).
- This restricts table access to rows belonging to the default ledger.

### Rate limiting

- **Login:** An in-memory rate limit (10 attempts per minute per IP) protects the credentials-based login.
- For production at scale, consider a more durable store (e.g. Redis) or Vercel's firewall options.

## Security notes

### Repository (GitHub)

For public hosting, maintainers should enable:

- **Dependabot** – alerts and security updates for dependencies.
- **Secret scanning** and **push protection** – prevent committed secrets.
- **Code scanning** (e.g. CodeQL) – optional automated analysis.

### Application self-check

- **Replay without session:** In DevTools → Network, while logged out, replay a request that triggers a server action. You should get no private data (expect a redirect to login or an error).
- **IDOR:** While logged in, capture a request that fetches or updates a bill, month, or template by id; change only the resource id. The response must not return or modify another ledger's data (expect 403 or "not found").
- **Secrets scan:** Search the built client bundle and repo for `service_role`, `DATABASE_URL`, `JWT_SECRET`, `AUTH_SECRET`, `sk_`, `pk_`, and any private vendor keys. None should appear in the client bundle or committed files.
- **Table-by-table review:** For each table that holds user/ledger data, make sure reads and writes are always gated by session and default-ledger ownership (and optionally RLS).
