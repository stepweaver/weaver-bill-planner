"use client";

import { useMemo, useState } from "react";
import { MonthAttentionStrip } from "./month-attention-strip";
import { PaycheckRail } from "./paycheck-rail";
import {
  BILL_FILTER_UNASSIGNED,
  filterBillsByWindowKey,
  filterBillsByStatus,
  type BillStatusFilter,
} from "@/features/bills/bill-ledger";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { IncomeList } from "@/features/income/income-list";
import { AddIncomeButton } from "@/features/income/add-income-button";
import { MonthHud } from "./month-hud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>("all");

  const groupedBills = useMemo(() => {
    const byWindow = filterBillsByWindowKey(billInstances, windowFilter);
    return filterBillsByStatus(byWindow, statusFilter);
  }, [billInstances, windowFilter, statusFilter]);

  const paycheckSelectKey =
    windowFilter === BILL_FILTER_UNASSIGNED ? null : windowFilter;

  return (
    <div className="mt-4 space-y-5">
      <MonthAttentionStrip attention={attention} />
      <MonthHud metrics={metrics} />

      <Card className="hud-panel border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm tracking-wide uppercase text-muted-foreground">Control deck</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Bill status</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as BillStatusFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bills</SelectItem>
                <SelectItem value="scheduled">Due</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setWindowFilter(null);
              setStatusFilter("all");
            }}
          >
            Reset filters
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)] xl:items-start">
        <section className="space-y-4 min-w-0">
          <BillTableByWindow
            windows={windows}
            bills={groupedBills}
            monthId={monthId}
            monthKey={monthKey}
          />
        </section>

        <aside className="space-y-5 min-w-0">
          <Card className="hud-panel border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Paycheck windows</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PaycheckRail
                windows={windows}
                summaries={paycheckSummaries}
                selectedWindowKey={paycheckSelectKey}
                onSelectWindow={(key) => setWindowFilter(key)}
                hasActiveFilter={windowFilter != null || statusFilter !== "all"}
                onClearFilter={() => {
                  setWindowFilter(null);
                  setStatusFilter("all");
                }}
              />
            </CardContent>
          </Card>

          <Card className="hud-panel border-border/70">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Income timeline</CardTitle>
                <AddIncomeButton monthId={monthId} monthKey={monthKey} />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <IncomeList events={incomeEvents} monthKey={monthKey} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
