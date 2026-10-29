import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { getMonthsList } from "@/features/months/actions";

/**
 * Only used for unknown /months/[monthKey] routes. Keep this separate from
 * error.tsx: a missing month is a navigational dead end, not a database error.
 */
export default async function MonthNotFound() {
  const existingMonths = await getMonthsList();
  const openMonth = existingMonths.find((month) => month.status === "open");

  return (
    <AppShell>
      <section className="mx-auto max-w-xl space-y-6 py-8 sm:py-14" aria-labelledby="missing-month-title">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Month not found
          </p>
          <h1 id="missing-month-title" className="terminal-glow text-2xl font-semibold tracking-tight">
            That month isn&apos;t in your ledger.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            It may not have been created yet, or the link may be outdated.
            Nothing in your ledger has been changed.
          </p>
        </div>

        <nav aria-label="Return to Ledger" className="flex flex-wrap gap-3">
          <Link
            href={openMonth ? `/months/${openMonth.monthKey}` : "/months"}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {openMonth ? "Open current ledger" : "Back to months"}
          </Link>
          <Link
            href="/months"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            All months
          </Link>
        </nav>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Choose an existing month</h2>
          {existingMonths.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              You haven&apos;t created a month yet.
            </p>
          ) : (
            <ul className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {existingMonths.map((month) => (
                <li key={month.id}>
                  <Link
                    href={`/months/${month.monthKey}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{month.label}</span>
                    <span className="text-xs capitalize text-muted-foreground">{month.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/months/new" className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Create a new month
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
