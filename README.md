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
   - `ADMIN_USER` / `ADMIN_PASSWORD` – optional; set for production or keep defaults.
4. **Deploy.** Vercel will build and deploy. Your app will be at `https://your-project.vercel.app`.

**Database:** Ensure your Neon database exists and migrations have been applied (e.g. run `npm run db:push` or `db:migrate` locally against the same `DATABASE_URL`, or use Neon’s SQL editor to run the migration files in `drizzle/`).

## Features

- **Months** – Create and open months; create next month from a previous one (propagation with review).
- **Income** – Add income events per month; they define paycheck windows.
- **Bills** – Add bills with due date, amounts, status, payment link; auto-grouped by paycheck window; manual override supported.
- **HUD** – Expected/received income, planned/paid/remaining expenses, leftover, overdue and unassigned counts.
- **Templates** – Recurring bill templates for propagation.
- **Settings** – Placeholder for ledger and password (MVP single-household).
