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
   - `AUTHORIZED_USERS` – comma-separated `username:password` (e.g. `stephen:mypass,jane:herpass`). Passwords must not contain `,` or `:`.

   **Secrets:** Do not prefix these with `NEXT_PUBLIC_`; that inlines values into the client bundle. Keep DB URLs, auth secrets, and API keys in server-only env (e.g. Vercel project env in production).

2. **Database**

   ```bash
   npm run db:push    # or db:migrate if you use migrations
   npm run db:seed    # seeds default "Household" ledger
   ```

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with any username/password from `AUTHORIZED_USERS`.

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run db:generate` – generate Drizzle migrations
- `npm run db:push` – push schema to DB
- `npm run db:seed` – seed default ledger
- `npm run db:studio` – Drizzle Studio

## GitHub & deployment

### Push to GitHub

1. **Create a new repository** on [GitHub](https://github.com/new):
   - Name it `weaver-bill-planner` (or any name).
   - Do **not** initialize with a README (you already have one).

2. **Add the remote and push** (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub user and repo name):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

### Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Import** your `weaver-bill-planner` repo.
3. **Environment variables** (in Vercel project → Settings → Environment Variables):
   - `DATABASE_URL` – your Neon Postgres connection string (Production, Preview, Development).
   - `AUTH_SECRET` – e.g. run `openssl rand -base64 32` and paste the result.
   - `AUTHORIZED_USERS` – comma-separated `username:password`; set for production.
4. **Deploy.** Vercel will build and deploy. Your app will be at `https://your-project.vercel.app`.

**Database:** Ensure your Neon database exists and migrations have been applied (e.g. run `npm run db:push` or `db:migrate` locally against the same `DATABASE_URL`, or use Neon’s SQL editor to run the migration files in `drizzle/`).

### Row-Level Security (RLS)

An optional migration enables RLS on user-facing tables as a backstop. Apply it manually if desired (e.g. via Neon SQL editor): run the SQL in `drizzle/0004_enable_rls.sql`. This restricts table access to rows belonging to the default ledger.

### Rate limiting

- **Login:** In-memory rate limit (10 attempts per minute per IP). For production at scale, consider Vercel's options (e.g. `@vercel/firewall`) or a store like Redis.

## Security

### Repository (GitHub)

Maintainers should enable:

- **Dependabot** – alerts and security updates for dependencies
- **Secret scanning** and **push protection** – prevent committed secrets
- **Code scanning** (e.g. CodeQL) – optional, for automated code analysis

### Security self-check

- **Replay without session:** In DevTools → Network, while logged out, replay a request that triggers a server action. You should get no private data (redirect to login or error).
- **IDOR:** Log in, capture a request that fetches or updates a bill/month/template by id; change only the resource id. The response must not return or modify another ledger's data (expect 403 or "not found").
- **Secrets scan:** Search the built client bundle and repo for `service_role`, `DATABASE_URL`, `JWT_SECRET`, `AUTH_SECRET`, `sk_`, `pk_`, and any private vendor keys. None should appear in the client bundle or committed files.
- **Table-by-table:** For each table that holds user/ledger data, ask: "If the client sent a forged id, could this query return or change rows for another user/ledger?" All reads/writes are gated by session and default-ledger ownership (and optionally RLS).

## Features

- **Months** – Create and open months; create next month from a previous one (propagation with review).
- **Income** – Add income events per month; they define paycheck windows.
- **Bills** – Add bills with due date, amounts, status, payment link; auto-grouped by paycheck window; manual override supported.
- **HUD** – Expected/received income, planned/paid/remaining expenses, leftover, overdue and unassigned counts.
- **Templates** – Recurring bill templates for propagation.
- **Settings** – Placeholder for ledger and password (MVP single-household).
