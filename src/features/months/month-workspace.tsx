"use client";

import { MonthAttentionStrip } from "./month-attention-strip";
import { PlanningSnapshot } from "./planning-snapshot";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { CarryoverLedger } from "@/features/bills/carryover-ledger";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { IncomeList } from "@/features/income/income-list";
import type { CarryoverBill, PlanningSnapshotPayload } from "@/features/months/actions";
import type { MonthAttention, PaycheckWindowSummary } from "@/lib/month-funding";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

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
  carryoverBills,
  windows,
  attention,
  planningSnapshot,
}: {
  monthKey: string;
  monthId: number;
  incomeEvents: IncomeEvent[];
  billInstances: BillInstance[];
  carryoverBills: CarryoverBill[];
  windows: PaycheckWindow[];
  /** Kept so the month page can keep passing summaries. The paycheck rail is not mounted. */
  paycheckSummaries: PaycheckWindowSummary[];
  attention: MonthAttention;
  planningSnapshot: PlanningSnapshotPayload;
}) {
  return (
    <div className="mt-4 space-y-5">
      <PlanningSnapshot
        monthKey={monthKey}
        operational={planningSnapshot.operational}
        liveMonth={planningSnapshot.liveMonth}
        availableBalance={planningSnapshot.availableBalance}
        availableBalanceUpdatedAt={planningSnapshot.availableBalanceUpdatedAt}
        planning={planningSnapshot.planning}
      />
      <MonthAttentionStrip attention={attention} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Income</h2>
          <AddIncomeButton monthId={monthId} monthKey={monthKey} />
        </div>
        <IncomeList events={incomeEvents} monthKey={monthKey} windows={windows} />
      </section>

      <CarryoverLedger bills={carryoverBills} viewMonthKey={monthKey} />

      <BillTableByWindow
        windows={windows}
        bills={billInstances}
        monthId={monthId}
        monthKey={monthKey}
      />
    </div>
  );
}
