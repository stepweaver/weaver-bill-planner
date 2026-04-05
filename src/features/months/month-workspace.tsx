"use client";

import { useMemo, useState } from "react";
import { MonthAttentionStrip } from "./month-attention-strip";
import { PaycheckRail } from "./paycheck-rail";
import {
  BillLedger,
  BILL_FILTER_UNASSIGNED,
  filterBillsByWindowKey,
} from "@/features/bills/bill-ledger";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { IncomeList } from "@/features/income/income-list";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { MonthHud } from "./month-hud";
import { Button } from "@/components/ui/button";
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
  paycheckSummaries,
  attention,
}: {
  monthKey: string;
  monthId: number;
  incomeEvents: IncomeEvent[];
  billInstances: BillInstance[];
  windows: PaycheckWindow[];
  metrics: MonthMetrics;
  paycheckSummaries: PaycheckWindowSummary[];
  attention: MonthAttention;
}) {
  const [windowFilter, setWindowFilter] = useState<string | null>(null);
  const [groupByPaycheck, setGroupByPaycheck] = useState(false);

  const groupedBills = useMemo(
    () => filterBillsByWindowKey(billInstances, windowFilter),
    [billInstances, windowFilter]
  );

  const paycheckSelectKey =
    windowFilter === BILL_FILTER_UNASSIGNED ? null : windowFilter;

  return (
    <div className="mt-3 space-y-4">
      <MonthAttentionStrip attention={attention} />
      <MonthHud metrics={metrics} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={groupByPaycheck ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setGroupByPaycheck((v) => !v)}
        >
          {groupByPaycheck ? "Due-date view" : "Group by paycheck"}
        </Button>
        {attention.unassignedIds.length > 0 && (
          <Button
            type="button"
            variant={windowFilter === BILL_FILTER_UNASSIGNED ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              setWindowFilter((f) =>
                f === BILL_FILTER_UNASSIGNED ? null : BILL_FILTER_UNASSIGNED
              )
            }
          >
            Unassigned ({attention.unassignedIds.length})
          </Button>
        )}
      </div>
      <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
        <div className="lg:col-span-3 order-2 lg:order-1 space-y-4 min-w-0">
          {groupByPaycheck ? (
            <BillTableByWindow
              windows={windows}
              bills={groupedBills}
              monthId={monthId}
              monthKey={monthKey}
            />
          ) : (
            <BillLedger
              bills={billInstances}
              monthId={monthId}
              monthKey={monthKey}
              windows={windows}
              windowFilterKey={windowFilter}
            />
          )}
        </div>
        <aside className="lg:col-span-2 order-1 lg:order-2 space-y-5 min-w-0">
          <PaycheckRail
            windows={windows}
            summaries={paycheckSummaries}
            selectedWindowKey={paycheckSelectKey}
            onSelectWindow={(key) => setWindowFilter(key)}
            hasActiveFilter={windowFilter != null}
            onClearFilter={() => setWindowFilter(null)}
          />
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-medium">Income</h2>
              <AddIncomeButton monthId={monthId} monthKey={monthKey} />
            </div>
            <IncomeList events={incomeEvents} monthKey={monthKey} />
          </div>
        </aside>
      </div>
    </div>
  );
}
