import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { addMonths, subMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonthManageActions } from "./month-manage-actions";
import { closeMonthFormAction } from "./actions";

function prevNextMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d =
    delta === 1
      ? addMonths(new Date(y, m - 1, 1), 1)
      : subMonths(new Date(y, m - 1, 1), 1);
  return format(d, "yyyy-MM");
}

export async function MonthHeader({
  monthKey,
  label,
  status,
}: {
  monthKey: string;
  label: string;
  status: string;
}) {
  const prevKey = prevNextMonth(monthKey, -1);
  const nextKey = prevNextMonth(monthKey, 1);

  return (
    <header className="border-b border-border pb-2">
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Month
        </p>

        <div
          className="flex min-w-0 items-center gap-2 sm:gap-3"
          role="group"
          aria-label="Adjacent months"
        >
          <Link href={`/months/${prevKey}`} className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Previous month"
            >
              <ChevronLeftIcon />
            </Button>
          </Link>
          <h1 className="terminal-glow min-w-0 flex-1 text-center text-xl font-semibold tracking-tight sm:text-left sm:text-2xl">
            {label}
          </h1>
          <Link href={`/months/${nextKey}`} className="shrink-0">
            <Button type="button" variant="outline" size="icon-sm" aria-label="Next month">
              <ChevronRightIcon />
            </Button>
          </Link>
        </div>

        <nav
          className={cn(
            "mx-auto grid w-full max-w-md gap-2",
            status === "closed" ? "grid-cols-2" : "grid-cols-3"
          )}
          aria-label="Month planning"
        >
          <Link
            href={`/months/new?from=${monthKey}`}
            aria-label="Set up next month"
            className="inline-flex h-10 min-w-0 w-full items-center justify-center rounded-lg bg-secondary px-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          >
            <span className="sm:hidden">Next month</span>
            <span className="hidden sm:inline">Set up next month</span>
          </Link>
          {status !== "closed" ? <CloseMonthButton monthKey={monthKey} /> : null}
          <div className="min-w-0 w-full">
            <MonthManageActions monthKey={monthKey} label={label} variant="header" />
          </div>
        </nav>
      </div>
    </header>
  );
}

function CloseMonthButton({ monthKey }: { monthKey: string }) {
  return (
    <form action={closeMonthFormAction} className="min-w-0 w-full">
      <input type="hidden" name="monthKey" value={monthKey} />
      <Button type="submit" variant="outline" size="sm" className="h-10 w-full min-w-0 justify-center px-1.5 text-xs sm:text-sm">
        Close month
      </Button>
    </form>
  );
}
