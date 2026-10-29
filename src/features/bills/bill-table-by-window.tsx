"use client";

import { Fragment, useEffect, useState } from "react";
import { BillRow } from "./bill-row";
import { AddBillButton } from "./add-bill-button";
import { BILL_GROUP_LABEL, billDisplayGroup, orderBillsForPlan, type BillDisplayGroup } from "@/lib/bill-utils";
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
  floatTargetDate: string | Date | null;
  floatedAt: string | Date | null;
  ownerMonthId: number;
  ownerMonthKey: string;
};

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

function GroupHeading({ group }: { group: BillDisplayGroup }) {
  return (
    <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {BILL_GROUP_LABEL[group]}
    </div>
  );
}

export function BillTableByWindow({
  windows,
  bills,
  monthId,
  monthKey,
  todayIso,
  nextPaydayDate,
}: {
  windows: PaycheckWindow[];
  bills: BillInstance[];
  monthId: number;
  monthKey: string;
  todayIso: string;
  nextPaydayDate: string | null;
}) {
  const mdUp = useMdUp();
  const showList = mdUp !== true;
  const showTable = mdUp !== false;
  const sorted = orderBillsForPlan(bills, todayIso);

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
              {sorted.map((b, index) => {
                const group = billDisplayGroup(b, todayIso);
                const previous = index > 0 ? billDisplayGroup(sorted[index - 1]!, todayIso) : null;
                const fromAnotherMonth = b.ownerMonthKey !== monthKey;
                return (
                  <Fragment key={b.id}>
                    {group !== previous ? (
                      <li className="list-none border-b bg-muted/40">
                        <GroupHeading group={group} />
                      </li>
                    ) : null}
                    <BillRow
                      bill={b}
                      monthId={b.ownerMonthId}
                      monthKey={b.ownerMonthKey}
                      windows={fromAnotherMonth ? [] : windows}
                      as="list"
                      anchor={mdUp === false}
                      dueDateStyle={fromAnotherMonth ? "prior-month" : "compact"}
                      labelMonthKey={monthKey}
                      showAssignment={!fromAnotherMonth}
                      todayIso={todayIso}
                      nextPaydayDate={nextPaydayDate}
                    />
                  </Fragment>
                );
              })}
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
                    <TableHead className="w-64 text-sm text-muted-foreground">Status</TableHead>
                    <TableHead className="w-20 text-sm text-muted-foreground">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((b, index) => {
                    const group = billDisplayGroup(b, todayIso);
                    const previous = index > 0 ? billDisplayGroup(sorted[index - 1]!, todayIso) : null;
                    const fromAnotherMonth = b.ownerMonthKey !== monthKey;
                    return (
                      <Fragment key={b.id}>
                        {group !== previous ? (
                          <TableRow className="hover:bg-transparent">
                            <td colSpan={6} className="p-0">
                              <GroupHeading group={group} />
                            </td>
                          </TableRow>
                        ) : null}
                        <BillRow
                          bill={b}
                          monthId={b.ownerMonthId}
                          monthKey={b.ownerMonthKey}
                          windows={fromAnotherMonth ? [] : windows}
                          as="table"
                          anchor
                          dueDateStyle={fromAnotherMonth ? "prior-month" : "compact"}
                          labelMonthKey={monthKey}
                          showAssignment={!fromAnotherMonth}
                          todayIso={todayIso}
                          nextPaydayDate={nextPaydayDate}
                        />
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
