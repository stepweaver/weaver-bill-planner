"use client";

import { useMemo, useState } from "react";
import { BillRow } from "./bill-row";
import { AddBillButton } from "./add-bill-button";
import { getEffectivePlannedAmount, isBillPaid } from "@/lib/bill-utils";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { Button } from "@/components/ui/button";

export const BILL_FILTER_UNASSIGNED = "__unassigned__";

export function filterBillsByWindowKey<T extends { displayWindowKey: string | null }>(
  bills: T[],
  windowFilterKey: string | null
): T[] {
  if (windowFilterKey == null) return bills;
  if (windowFilterKey === BILL_FILTER_UNASSIGNED) {
    return bills.filter((b) => b.displayWindowKey == null);
  }
  return bills.filter((b) => b.displayWindowKey === windowFilterKey);
}

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

function statusSortOrder(status: string): number {
  if (status === "paid") return 2;
  if (status === "pending") return 1;
  return 0;
}

function sortBillsByDueDateThenStatus(bills: BillInstance[]): BillInstance[] {
  return [...bills].sort((a, b) => {
    const dateA = a.dueDate ?? "";
    const dateB = b.dueDate ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return statusSortOrder(a.status) - statusSortOrder(b.status);
  });
}

export function BillLedger({
  bills,
  monthId,
  monthKey,
  windows,
  windowFilterKey,
}: {
  bills: BillInstance[];
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
  windowFilterKey: string | null;
}) {
  const [paidOpen, setPaidOpen] = useState(false);

  const filtered = useMemo(
    () => filterBillsByWindowKey(bills, windowFilterKey),
    [bills, windowFilterKey]
  );

  const sorted = useMemo(() => sortBillsByDueDateThenStatus(filtered), [filtered]);

  const { active, paid } = useMemo(() => {
    const a: BillInstance[] = [];
    const p: BillInstance[] = [];
    for (const bill of sorted) {
      const eff = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
      if (isBillPaid(bill.status, bill.amountPaid, eff)) p.push(bill);
      else a.push(bill);
    }
    return { active: a, paid: p };
  }, [sorted]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Bills</h2>
        <AddBillButton monthId={monthId} monthKey={monthKey} windows={windows} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sorted by due date. Each row shows which paycheck funds the bill. Use quick fields for
        status, paid amount, notes, and paycheck; Edit for everything else.
      </p>
      <div className="space-y-2">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-md px-3 py-6 text-center">
            No open bills in this view.
          </p>
        ) : (
          active.map((b) => (
            <BillRow
              key={b.id}
              bill={b}
              monthId={monthId}
              monthKey={monthKey}
              windows={windows}
              highlightWindowKey={windowFilterKey === BILL_FILTER_UNASSIGNED ? null : windowFilterKey}
            />
          ))
        )}
      </div>
      {paid.length > 0 && (
        <div className="pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => setPaidOpen((v) => !v)}
          >
            {paidOpen ? "Hide" : "Show"} paid ({paid.length})
          </Button>
          {paidOpen && (
            <div className="mt-2 space-y-2 opacity-90">
              {paid.map((b) => (
                <BillRow
                  key={`${b.id}-${String(b.updatedAt ?? "")}`}
                  bill={b}
                  monthId={monthId}
                  monthKey={monthKey}
                  windows={windows}
                  highlightWindowKey={
                    windowFilterKey === BILL_FILTER_UNASSIGNED ? null : windowFilterKey
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
