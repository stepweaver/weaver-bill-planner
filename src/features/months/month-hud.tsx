import { Card, CardContent } from "@/components/ui/card";
import type { MonthMetrics } from "@/lib/month-metrics";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function MonthHud({ metrics }: { metrics: MonthMetrics }) {
  return (
    <Card className="py-2 px-3">
      <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-0 sm:divide-x sm:divide-border">
        <div className="min-w-0 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Income</span>
          <p className="text-sm tabular-nums">
            <span className="text-muted-foreground">Expected </span>
            <span className="font-semibold">{formatCurrency(metrics.expectedIncome)}</span>
            <span className="text-muted-foreground ml-2">Realized </span>
            <span className="font-semibold">{formatCurrency(metrics.receivedIncome)}</span>
          </p>
          <p className="text-sm tabular-nums">
            <span className="text-muted-foreground">Leftover </span>
            <span className="font-semibold">{formatCurrency(metrics.leftover)}</span>
            <span className="text-muted-foreground text-[10px] ml-1">after paid bills</span>
          </p>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5 sm:pl-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Expenses</span>
          <p className="text-sm tabular-nums">
            <span className="text-muted-foreground">Amount owed </span>
            <span className="font-semibold">{formatCurrency(metrics.remainingExpenses)}</span>
            <span className="text-muted-foreground text-[10px] ml-1">remaining to pay</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Overdue: {metrics.overdueCount} · Unassigned: {metrics.unassignedCount}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
