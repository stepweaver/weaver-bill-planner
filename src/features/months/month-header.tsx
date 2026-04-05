import Link from "next/link";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Month
          </p>
          <h1 className="terminal-glow text-2xl sm:text-3xl font-semibold tracking-tight">
            {label}
          </h1>
        </div>
        <nav
          className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0"
          aria-label="Month actions"
        >
          <Link href={`/months/${prevKey}`}>
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              Previous
            </Button>
          </Link>
          <Link href={`/months/${nextKey}`}>
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              Next
            </Button>
          </Link>
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
