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
    windows,
    metrics,
    paycheckSummaries,
    attention,
  } = data;

  return (
    <AppShell>
      <MonthHeader monthKey={monthKey} label={month.label} />
      <MonthWorkspace
        monthKey={monthKey}
        monthId={month.id}
        incomeEvents={incomeEvents}
        billInstances={billInstances}
        windows={windows}
        metrics={metrics}
        paycheckSummaries={paycheckSummaries}
        attention={attention}
      />
    </AppShell>
  );
}
