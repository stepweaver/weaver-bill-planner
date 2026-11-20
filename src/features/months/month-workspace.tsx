"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MonthAttentionStrip } from "./month-attention-strip";
import { PaydayAcknowledgment } from "@/features/notifications/payday-acknowledgment";
import { NowDashboard } from "@/features/dashboard/now-dashboard";
import { PlanDashboard } from "@/features/dashboard/plan-dashboard";
import { HistoryDashboard } from "@/features/dashboard/history-dashboard";
import { ViewSwitcher } from "@/features/dashboard/view-switcher";
import type { DashboardBill, DashboardIncome } from "@/features/dashboard/types";
import type { CarryoverBill, PaydayEventRow, PlanningSnapshotPayload } from "./actions";
import { mergeBillRecords, orderBillsForPlan } from "@/lib/bill-utils";
import { resolveLedgerView } from "@/lib/dashboard-bills";
import type { MonthAttention, PaycheckWindowSummary } from "@/lib/month-funding";
import { nextFuturePayday } from "@/lib/payment-plan";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

type BillInstance = Omit<DashboardBill, "ownerMonthId" | "ownerMonthKey" | "floatTargetDate" | "floatedAt"> & {
  floatTargetDate?: string | Date | null;
  floatedAt?: string | Date | null;
};

type Props = {
  monthKey: string;
  monthId: number;
  incomeEvents: DashboardIncome[];
  billInstances: BillInstance[];
  carryoverBills: CarryoverBill[];
  windows: PaycheckWindow[];
  paycheckSummaries: PaycheckWindowSummary[];
  attention: MonthAttention;
  planningSnapshot: PlanningSnapshotPayload;
  paydayEvents: PaydayEventRow[];
  todayIso: string;
  paydayAcknowledged: boolean;
};

function withOwner(
  bill: BillInstance,
  ownerMonthId: number,
  ownerMonthKey: string
): DashboardBill {
  return {
    ...bill,
    floatTargetDate: bill.floatTargetDate ?? null,
    floatedAt: bill.floatedAt ?? null,
    ownerMonthId,
    ownerMonthKey,
  };
}

export function MonthWorkspace(props: Props) {
  return (
    <Suspense fallback={<p className="mt-3 text-sm text-muted-foreground">Opening λledger…</p>}>
      <MonthWorkspaceContent {...props} />
    </Suspense>
  );
}

function MonthWorkspaceContent({
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
}: Props) {
  const params = useSearchParams();
  const view = resolveLedgerView(params.get("view"), planningSnapshot.operational);
  const unified = orderBillsForPlan(
    mergeBillRecords(
      billInstances.map((bill) => withOwner(bill, monthId, monthKey)),
      carryoverBills.map((bill) => withOwner(
        { ...bill, displayWindowKey: null, displayIncomeEventId: null },
        bill.ownerMonthId,
        bill.ownerMonthKey
      ))
    ),
    todayIso
  );
  const nextPaydayDate = nextFuturePayday(paydayEvents, todayIso)?.date ?? null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <ViewSwitcher operational={planningSnapshot.operational} />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {view === "now" ? "Handle what's due" :
            view === "plan" ? "Plan by payday" : "See what's done"}
        </span>
      </div>

      {view === "now" ? (
        <>
          <NowDashboard
            monthKey={monthKey}
            monthId={monthId}
            operational={planningSnapshot.operational}
            liveMonth={planningSnapshot.liveMonth}
            availableBalance={planningSnapshot.availableBalance}
            availableBalanceUpdatedAt={planningSnapshot.availableBalanceUpdatedAt}
            bills={unified}
            income={incomeEvents}
            windows={windows}
            paydayEvents={paydayEvents}
            todayIso={todayIso}
          />
          {planningSnapshot.operational && paydayEvents.some((event) => event.expectedDate === todayIso) ? (
            <section className="rounded-md border p-3">
              <p className="mb-1 text-sm font-semibold">Payday check</p>
              <PaydayAcknowledgment acknowledged={paydayAcknowledged} />
            </section>
          ) : null}
          <MonthAttentionStrip attention={attention} />
        </>
      ) : view === "plan" ? (
        <PlanDashboard
          monthKey={monthKey}
          monthId={monthId}
          bills={unified}
          income={incomeEvents}
          windows={windows}
          todayIso={todayIso}
          nextPaydayDate={nextPaydayDate}
          paydayEvents={paydayEvents}
        />
      ) : (
        <HistoryDashboard
          monthKey={monthKey}
          bills={unified}
          income={incomeEvents}
          windows={windows}
          todayIso={todayIso}
        />
      )}
    </div>
  );
}
