import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MonthHeader } from "@/features/months/month-header";
import { MonthHud } from "@/features/months/month-hud";
import { IncomeList } from "@/features/income/income-list";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { BillTableWithFilter } from "@/features/bills/bill-table-with-filter";
import { getMonthWithData } from "@/features/months/actions";

export const dynamic = "force-dynamic";

export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  const data = await getMonthWithData(monthKey);
  if (!data) notFound();

  const { month, incomeEvents, billInstances, windows, metrics } = data;

  return (
    <AppShell>
      <MonthHeader monthKey={monthKey} label={month.label} />
      <div className="mt-3">
        <MonthHud metrics={metrics} />
      </div>
      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="terminal-glow text-base font-medium">Income</h2>
            <AddIncomeButton monthId={month.id} monthKey={monthKey} />
          </div>
          <IncomeList events={incomeEvents} monthKey={monthKey} />
        </div>
        <BillTableWithFilter
          windows={windows}
          bills={billInstances}
          monthId={month.id}
          monthKey={monthKey}
        />
      </div>
    </AppShell>
  );
}
