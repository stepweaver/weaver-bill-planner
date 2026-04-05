import Link from "next/link";
import { addMonths, subMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { getMonthByKey } from "./actions";

function prevNextMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = delta === 1 ? addMonths(new Date(y, m - 1, 1), 1) : subMonths(new Date(y, m - 1, 1), 1);
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
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
      <div className="grid grid-cols-2 gap-2 order-1 w-full sm:w-auto sm:max-w-xs">
        <Link href={`/months/${prevKey}`}>
          <Button variant="outline" className="w-full whitespace-nowrap">
            Previous
          </Button>
        </Link>
        <Link href={`/months/${nextKey}`}>
          <Button variant="outline" className="w-full whitespace-nowrap">
            Next
          </Button>
        </Link>
      </div>
      <h1 className="terminal-glow w-full text-2xl sm:text-3xl font-semibold tracking-tight text-center order-2">
        {label}
      </h1>
      <div className="grid grid-cols-2 gap-2 order-3 min-w-0 w-full sm:w-auto sm:max-w-xs">
        <Link href={`/months/new?from=${monthKey}`}>
          <Button variant="secondary" className="w-full whitespace-nowrap">
            Roll forward
          </Button>
        </Link>
        <CloseMonthButton monthKey={monthKey} />
      </div>
    </div>
  );
}

async function CloseMonthButton({ monthKey }: { monthKey: string }) {
  const month = await getMonthByKey(monthKey);
  if (!month || month.status === "closed") return null;
  const { closeMonthFormAction } = await import("./actions");
  return (
    <form action={closeMonthFormAction} className="min-w-0">
      <input type="hidden" name="monthKey" value={monthKey} />
      <Button type="submit" variant="outline" className="w-full whitespace-nowrap">
        Close month
      </Button>
    </form>
  );
}
