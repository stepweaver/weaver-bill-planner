import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMonthsList } from "@/features/months/actions";

export const dynamic = "force-dynamic";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export default async function MonthsPage() {
  const monthsList = await getMonthsList();

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="terminal-glow text-2xl font-semibold tracking-tight">Months</h1>
        <Link href="/months/new">
          <Button>Roll forward month</Button>
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monthsList.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">
                No months yet. Create your first month to get started.
              </p>
              <Link href="/months/new" className="mt-4">
                <Button>Start first month</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          monthsList.map((month) => {
            const s = month.cardSummary;
            return (
              <Card key={month.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <span className="font-medium">{month.label}</span>
                  <Badge variant={month.status === "open" ? "default" : "secondary"}>
                    {month.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2 text-sm tabular-nums">
                    {(s.overdueCount > 0 || s.dueSoonCount > 0) && (
                      <p
                        className={
                          s.overdueCount > 0
                            ? "text-rose-400 dark:text-rose-300"
                            : "text-amber-600 dark:text-amber-200"
                        }
                      >
                        {s.overdueCount > 0 && (
                          <>
                            Overdue: <span className="font-semibold">{s.overdueCount}</span>
                          </>
                        )}
                        {s.overdueCount > 0 && s.dueSoonCount > 0 && (
                          <span className="text-muted-foreground font-normal"> · </span>
                        )}
                        {s.dueSoonCount > 0 && (
                          <>
                            Due in next 7 days: <span className="font-semibold">{s.dueSoonCount}</span>
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      Pending bills: <span className="font-medium text-foreground">{s.pendingBillCount}</span>
                    </p>
                    <p className="text-xs leading-relaxed">
                      <span className="text-muted-foreground">Income </span>
                      <span className="font-medium text-foreground">{formatCurrency(s.expectedIncome)}</span>
                      <span className="text-muted-foreground"> · Leftover </span>
                      <span className="font-medium text-foreground">{formatCurrency(s.leftover)}</span>
                      <span className="text-muted-foreground"> (after paid)</span>
                    </p>
                  </div>
                  <Link href={`/months/${month.monthKey}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Open
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
