"use client";

import { MonthAttentionStrip } from "./month-attention-strip";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { IncomeList } from "@/features/income/income-list";
import { MonthHud } from "./month-hud";
import type { MonthAttention, PaycheckWindowSummary } from "@/lib/month-funding";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import type { MonthMetrics } from "@/lib/month-metrics";

type IncomeEvent = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

type BillInstance = {
  id: number;
  name: string;
  dueDate: string | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  status: string;
  notes: string | null;
  paymentUrl: string | null;
  displayWindowKey: string | null;
  displayIncomeEventId: number | null;
  assignedIncomeEventId: number | null;
  assignedGroupKey: string | null;
  manualAssignment: boolean | null;
  templateId: number | null;
  updatedAt?: Date | string | null;
};

export function MonthWorkspace({
  monthKey,
  monthId,
  incomeEvents,
  billInstances,
  windows,
  metrics,
  attention,
}: {
  monthKey: string;
  monthId: number;
  incomeEvents: IncomeEvent[];
  billInstances: BillInstance[];
  windows: PaycheckWindow[];
  metrics: MonthMetrics;
  /** Kept so the month page can keep passing summaries. The paycheck rail is not mounted. */
  paycheckSummaries: PaycheckWindowSummary[];
  attention: MonthAttention;
}) {
  return (
    <div className="mt-4 space-y-5">
      <MonthAttentionStrip attention={attention} />
      <MonthHud metrics={metrics} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">Income</h2>
          <AddIncomeButton monthId={monthId} monthKey={monthKey} />
        </div>
        <IncomeList events={incomeEvents} monthKey={monthKey} />
      </section>

      <BillTableByWindow
        windows={windows}
        bills={billInstances}
        monthId={monthId}
        monthKey={monthKey}
      />
    </div>
  );
}
