"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BillTableByWindow } from "./bill-table-by-window";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "@/lib/bill-utils";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

export type BillFilter = "all" | "pending" | "paid" | "overdue" | "unassigned";

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
};

function filterBills(
  bills: BillInstance[],
  filter: BillFilter
): BillInstance[] {
  if (filter === "all") return bills;
  const today = new Date().toDateString();
  return bills.filter((b) => {
    const effective = getEffectivePlannedAmount(b.plannedAmount, b.invoiceAmount);
    const paid = isBillPaid(b.status, b.amountPaid, effective);
    const overdue = isBillOverdue(b.dueDate, b.status, b.amountPaid, effective);
    const unassigned = !b.displayWindowKey && !b.assignedGroupKey;
    switch (filter) {
      case "pending":
        return !paid && b.status !== "skipped";
      case "paid":
        return paid;
      case "overdue":
        return overdue;
      case "unassigned":
        return unassigned;
      default:
        return true;
    }
  });
}

export function BillTableWithFilter({
  windows,
  bills,
  monthId,
  monthKey,
}: {
  windows: PaycheckWindow[];
  bills: BillInstance[];
  monthId: number;
  monthKey: string;
}) {
  const [filter, setFilter] = useState<BillFilter>("all");
  const filtered = filterBills(bills, filter);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as BillFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <BillTableByWindow
        windows={windows}
        bills={filtered}
        monthId={monthId}
        monthKey={monthKey}
      />
    </div>
  );
}
