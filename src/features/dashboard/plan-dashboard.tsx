"use client";

import { AddIncomeButton } from "@/features/income/add-income-button";
import { IncomeList } from "@/features/income/income-list";
import { BillTableByWindow } from "@/features/bills/bill-table-by-window";
import { groupPlanBills, paycheckGroupMoney, paycheckPeriodDefs, projectGroupRemainder, sumObligationCents } from "@/lib/dashboard-bills";
import { formatCents, formatShortDate } from "./format";
import type { DashboardBill, DashboardIncome } from "./types";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import type { FloatPaydayEvent } from "@/lib/float-pay-period";

export function PlanDashboard({
  monthKey,
  monthId,
  bills,
  income,
  windows,
  todayIso,
  nextPaydayDate,
  paydayEvents,
}: {
  monthKey: string;
  monthId: number;
  bills: DashboardBill[];
  income: DashboardIncome[];
  windows: PaycheckWindow[];
  todayIso: string;
  nextPaydayDate: string | null;
  paydayEvents: FloatPaydayEvent[];
}) {
  const grouped = groupPlanBills(bills, paycheckPeriodDefs(windows), todayIso);
  const open = bills.filter((bill) => bill.status !== "paid" && bill.status !== "skipped");
  const unassignedCents = sumObligationCents(grouped.unassigned);
  const floatedCents = sumObligationCents(grouped.floated);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Paycheck plan</h2>
          <p className="text-xs text-muted-foreground">
            Future plan only. Not your bank balance.
          </p>
        </div>
        <AddIncomeButton monthId={monthId} monthKey={monthKey} />
      </div>
      {grouped.periods.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {grouped.periods.map((period) => {
            const money = paycheckGroupMoney(income, period.incomeEventId);
            const remainder = projectGroupRemainder(money, period.commitmentCents);
            const date = income.find((item) => item.id === period.incomeEventId)?.expectedDate;
            return (
              <section key={period.incomeEventId} className="rounded-md border bg-card/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold">{period.label}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {date ? formatShortDate(date) : ""}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  {money.receivedCents != null ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Received</span>
                      <span className="tabular-nums">{formatCents(money.receivedCents)}</span>
                    </div>
                  ) : null}
                  {money.stillScheduledCents > 0 ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Still scheduled</span>
                      <span className="tabular-nums">{formatCents(money.stillScheduledCents)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Bills planned</span>
                    <span className="tabular-nums">{formatCents(period.commitmentCents)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1 text-sm font-semibold">
                    <span>Estimated left</span>
                    <span className="tabular-nums">
                      {remainder.remainderCents == null ? "—" : formatCents(remainder.remainderCents)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {remainder.basis === "scheduled" ? "Counts pay that hasn't arrived." :
                      remainder.basis === "received" ? "Based on recorded pay, not your bank balance." :
                      "Add income to see what's left."}
                  </p>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Add a payday to start the plan.
        </p>
      )}
      {(grouped.unassigned.length > 0 || grouped.floated.length > 0) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {grouped.unassigned.length > 0 ? (
            <div className="rounded-md border p-3 text-sm">
              <strong>Unassigned: {formatCents(unassignedCents)}</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {grouped.unassigned.length} {grouped.unassigned.length === 1 ? "bill" : "bills"} not assigned to a payday. Left out of estimates.
              </p>
            </div>
          ) : null}
          {grouped.floated.length > 0 ? (
            <div className="rounded-md border p-3 text-sm">
              <strong>Floated: {formatCents(floatedCents)}</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                {grouped.floated.length} {grouped.floated.length === 1 ? "bill" : "bills"} on hold. Due dates unchanged. Left out of estimates.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Paydays</h3>
        <IncomeList events={income} monthKey={monthKey} windows={windows} />
      </section>
      <BillTableByWindow
        windows={windows}
        bills={open}
        monthId={monthId}
        monthKey={monthKey}
        todayIso={todayIso}
        nextPaydayDate={nextPaydayDate}
        paydayEvents={paydayEvents}
      />
    </div>
  );
}
