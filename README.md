# Bill Planner

A paycheck-to-bills scheduler: plan which bills get paid by which check each month.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Neon Postgres, Drizzle ORM
- Auth.js (credentials only), Zod, React Hook Form, date-fns

## Setup

1. **Environment**

   Copy `.env.example` to `.env.local` and set:

   - `DATABASE_URL` – Neon Postgres connection string
   - `AUTH_SECRET` – e.g. `openssl rand -base64 32`
   - `ADMIN_USER` – login username (default `admin`)
   - `ADMIN_PASSWORD` – login password (default `changeme`)

2. **Database**

   ```bash
   npm run db:push    # or db:migrate if you use migrations
   npm run db:seed    # seeds default "Household" ledger
   ```

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with `ADMIN_USER` / `ADMIN_PASSWORD`.

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run db:generate` – generate Drizzle migrations
- `npm run db:push` – push schema to DB
- `npm run db:seed` – seed default ledger
- `npm run db:studio` – Drizzle Studio

## Features

- **Months** – Create and open months; create next month from a previous one (propagation with review).
- **Income** – Add income events per month; they define paycheck windows.
- **Bills** – Add bills with due date, amounts, status, payment link; auto-grouped by paycheck window; manual override supported.
- **HUD** – Expected/received income, planned/paid/remaining expenses, leftover, overdue and unassigned counts.
- **Templates** – Recurring bill templates for propagation.
- **Settings** – Placeholder for ledger and password (MVP single-household).
