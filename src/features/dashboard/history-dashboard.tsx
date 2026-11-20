"use client";

import { BillRow } from "@/features/bills/bill-row";
import { IncomeList } from "@/features/income/income-list";
import { splitBillsForViews } from "@/lib/dashboard-bills";
import type { DashboardBill, DashboardIncome } from "./types";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

export function HistoryDashboard({
  monthKey,
  bills,
  income,
  windows,
  todayIso,
}: {
  monthKey: string;
  bills: DashboardBill[];
  income: DashboardIncome[];
  windows: PaycheckWindow[];
  todayIso: string;
}) {
  const completed = splitBillsForViews(bills, todayIso).history;
  const received = income.filter((event) => event.status === "received" || event.actualAmount != null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="min-w-0 space-y-2">
        <div>
          <h2 className="text-base font-semibold">Completed bills</h2>
          <p className="text-xs text-muted-foreground">Paid, covered, or skipped. Edit to fix an entry.</p>
        </div>
        {completed.length ? (
          <ul className="rounded-md border text-sm">
            {completed.map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                monthId={bill.ownerMonthId}
                monthKey={bill.ownerMonthKey}
                windows={bill.ownerMonthKey === monthKey ? windows : []}
                as="list"
                todayIso={todayIso}
                labelMonthKey={monthKey}
                dueDateStyle={bill.ownerMonthKey === monthKey ? "compact" : "prior-month"}
                showAssignment={bill.ownerMonthKey === monthKey}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nothing handled yet.</p>
        )}
      </section>
      <section className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold">Income received</h2>
        {received.length ? (
          <IncomeList events={received} monthKey={monthKey} windows={windows} />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No income recorded this month.</p>
        )}
      </section>
    </div>
  );
}
