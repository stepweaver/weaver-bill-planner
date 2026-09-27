import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MonthHeader } from "@/features/months/month-header";
import { MonthWorkspace } from "@/features/months/month-workspace";
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

  const {
    month,
    incomeEvents,
    billInstances,
    carryoverBills,
    windows,
    paycheckSummaries,
    attention,
    planningSnapshot,
  } = data;

  return (
    <AppShell>
      <MonthHeader monthKey={monthKey} label={month.label} />
      <MonthWorkspace
        monthKey={monthKey}
        monthId={month.id}
        incomeEvents={incomeEvents}
        billInstances={billInstances}
        carryoverBills={carryoverBills}
        windows={windows}
        paycheckSummaries={paycheckSummaries}
        attention={attention}
        planningSnapshot={planningSnapshot}
      />
    </AppShell>
  );
}
