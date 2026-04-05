import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMonthsList } from "@/features/months/actions";

export const dynamic = "force-dynamic";

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
          monthsList.map((month) => (
            <Card key={month.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="font-medium">{month.label}</span>
                <Badge variant={month.status === "open" ? "default" : "secondary"}>
                  {month.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <Link href={`/months/${month.monthKey}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Open
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
