import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { MonthHeader } from "@/features/months/month-header";
import { MonthWorkspace } from "@/features/months/month-workspace";
import { getMonthWithData } from "@/features/months/actions";
import { isPaydayAcknowledged } from "@/features/notifications/payday-actions";

export const dynamic = "force-dynamic";

export default async function MonthDetailPage({
  params,
}: {
  params: Promise<{ monthKey: string }>;
}) {
  const { monthKey } = await params;
  const [data, paydayAcknowledged] = await Promise.all([
    getMonthWithData(monthKey),
    isPaydayAcknowledged(),
  ]);
  if (!data) notFound();

  const {
    month,
    todayIso,
    paydayEvents,
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
      <MonthHeader monthKey={monthKey} label={month.label} status={month.status} />
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
        paydayEvents={paydayEvents}
        todayIso={todayIso}
        paydayAcknowledged={paydayAcknowledged}
      />
    </AppShell>
  );
}
