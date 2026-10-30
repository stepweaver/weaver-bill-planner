"use client";

import { MonthAttentionStrip } from "./month-attention-strip";
import { PlanningSnapshot } from "./planning-snapshot";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { IncomeList } from "@/features/income/income-list";
import { PaydayAcknowledgment } from "@/features/notifications/payday-acknowledgment";
import type { CarryoverBill, PaydayEventRow, PlanningSnapshotPayload } from "@/features/months/actions";
import { mergeBillRecords, orderBillsForPlan } from "@/lib/bill-utils";
import type { MonthAttention, PaycheckWindowSummary } from "@/lib/month-funding";
import { nextFuturePayday, type PlanBill } from "@/lib/payment-plan";
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
  isRecurring?: boolean | null;
  updatedAt?: Date | string | null;
  floatTargetDate?: string | Date | null;
  floatedAt?: string | Date | null;
};

export type WorkspaceBill = BillInstance & {
  floatTargetDate: string | Date | null;
  floatedAt: string | Date | null;
  ownerMonthId: number;
  ownerMonthKey: string;
};

function asWorkspaceBill(
  bill: BillInstance,
  ownerMonthId: number,
  ownerMonthKey: string
): WorkspaceBill {
  return {
    ...bill,
    floatTargetDate: bill.floatTargetDate ?? null,
    floatedAt: bill.floatedAt ?? null,
    ownerMonthId,
    ownerMonthKey,
  };
}

export function MonthWorkspace({
  monthKey,
  monthId,
  incomeEvents,
  billInstances,
  carryoverBills,
  windows,
  attention,
  planningSnapshot,
  paydayEvents,
  todayIso,
  paydayAcknowledged,
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
  paydayEvents: PaydayEventRow[];
  todayIso: string;
  paydayAcknowledged: boolean;
}) {
  const unified = orderBillsForPlan(
    mergeBillRecords(
      billInstances.map((bill) => asWorkspaceBill(bill, monthId, monthKey)),
      carryoverBills.map((bill) =>
        asWorkspaceBill(
          {
            ...bill,
            displayWindowKey: null,
            displayIncomeEventId: null,
          },
          bill.ownerMonthId,
          bill.ownerMonthKey
        )
      )
    ),
    todayIso
  );
  const planBills: PlanBill[] = unified.map((bill) => ({
    id: bill.id,
    name: bill.name,
    dueDate: bill.dueDate,
    plannedAmount: bill.plannedAmount,
    invoiceAmount: bill.invoiceAmount,
    amountPaid: bill.amountPaid,
    status: bill.status,
    floatTargetDate: bill.floatTargetDate,
    ownerMonthKey: bill.ownerMonthKey,
  }));
  const nextPayday = nextFuturePayday(paydayEvents, todayIso);

  return (
    <div className="mt-4 space-y-5">
      <PlanningSnapshot
        monthKey={monthKey}
        operational={planningSnapshot.operational}
        liveMonth={planningSnapshot.liveMonth}
        availableBalance={planningSnapshot.availableBalance}
        availableBalanceUpdatedAt={planningSnapshot.availableBalanceUpdatedAt}
        bills={planBills}
        paydayEvents={paydayEvents}
        todayIso={todayIso}
      />

      {planningSnapshot.operational && paydayEvents.some((event) => event.expectedDate === todayIso) ? (
        <section className="space-y-2 rounded-md border p-3">
          <h2 className="text-base font-medium">Payday planning</h2>
          <PaydayAcknowledgment acknowledged={paydayAcknowledged} />
        </section>
      ) : null}

      <BillTableByWindow
        windows={windows}
        bills={unified}
        monthId={monthId}
        monthKey={monthKey}
        todayIso={todayIso}
        nextPaydayDate={nextPayday?.date ?? null}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Income</h2>
          <AddIncomeButton monthId={monthId} monthKey={monthKey} />
        </div>
        <IncomeList events={incomeEvents} monthKey={monthKey} windows={windows} />
      </section>

      <MonthAttentionStrip attention={attention} />
    </div>
  );
}
