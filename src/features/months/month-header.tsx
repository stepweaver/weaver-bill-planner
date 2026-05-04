import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { addMonths, subMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { getMonthByKey } from "./actions";

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
}: {
  monthKey: string;
  label: string;
}) {
  const prevKey = prevNextMonth(monthKey, -1);
  const nextKey = prevNextMonth(monthKey, 1);

  return (
    <header className="border-b border-border pb-4">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
          <h1 className="terminal-glow min-w-0 flex-1 text-center text-2xl font-semibold tracking-tight sm:text-left sm:text-3xl">
            {label}
          </h1>
          <Link href={`/months/${nextKey}`} className="shrink-0">
            <Button type="button" variant="outline" size="icon-sm" aria-label="Next month">
              <ChevronRightIcon />
            </Button>
          </Link>
        </div>

        <nav
          className="flex flex-wrap items-center gap-2"
          aria-label="Month planning"
        >
          <Link href={`/months/new?from=${monthKey}`}>
            <Button variant="secondary" size="sm" className="whitespace-nowrap">
              Roll forward
            </Button>
          </Link>
          <CloseMonthButton monthKey={monthKey} />
        </nav>
      </div>
    </header>
  );
}

async function CloseMonthButton({ monthKey }: { monthKey: string }) {
  const month = await getMonthByKey(monthKey);
  if (!month || month.status === "closed") return null;
  const { closeMonthFormAction } = await import("./actions");
  return (
    <form action={closeMonthFormAction} className="inline min-w-0">
      <input type="hidden" name="monthKey" value={monthKey} />
      <Button type="submit" variant="outline" size="sm" className="whitespace-nowrap">
        Close month
      </Button>
    </form>
  );
}
