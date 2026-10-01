"use client";

import { useEffect, useState } from "react";
import { BillRow } from "./bill-row";
import { AddBillButton } from "./add-bill-button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

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
};

/** Due date ascending, then stable id tie-break (order does not change when status updates). */
function sortBillsByDueDateThenId(bills: BillInstance[]): BillInstance[] {
  return [...bills].sort((a, b) => {
    const dateA = a.dueDate ?? "";
    const dateB = b.dueDate ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.id - b.id;
  });
}

/** null until the client knows the viewport, so the first paint can render both layouts. */
function useMdUp(): boolean | null {
  const [mdUp, setMdUp] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setMdUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mdUp;
}

export function BillTableByWindow({
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
  const mdUp = useMdUp();
  const showList = mdUp !== true;
  const showTable = mdUp !== false;
  const sorted = sortBillsByDueDateThenId(bills);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Bills and expenses</h2>
        <AddBillButton monthId={monthId} monthKey={monthKey} windows={windows} />
      </div>
      {sorted.length === 0 ? (
        <p className="rounded border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No bills or expenses.
        </p>
      ) : (
        <>
          {showList ? (
            <ul className="rounded border text-sm md:hidden">
              {sorted.map((b) => (
                <BillRow
                  key={b.id}
                  bill={b}
                  monthId={monthId}
                  monthKey={monthKey}
                  windows={windows}
                  as="list"
                  anchor={mdUp === false}
                />
              ))}
            </ul>
          ) : null}
          {showTable ? (
            <div className="hidden overflow-hidden rounded border md:block">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 text-sm text-muted-foreground">Due</TableHead>
                    <TableHead className="text-sm text-muted-foreground">Name</TableHead>
                    <TableHead className="w-28 text-sm text-muted-foreground">Amount</TableHead>
                    <TableHead className="w-40 text-sm text-muted-foreground">Paycheck</TableHead>
                    <TableHead className="w-44 text-sm text-muted-foreground">Status</TableHead>
                    <TableHead className="w-20 text-sm text-muted-foreground">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((b) => (
                    <BillRow
                      key={b.id}
                      bill={b}
                      monthId={monthId}
                      monthKey={monthKey}
                      windows={windows}
                      as="table"
                      anchor
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
