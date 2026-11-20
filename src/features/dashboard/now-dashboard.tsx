"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddBillButton } from "@/features/bills/add-bill-button";
import { undoFloatBill } from "@/features/bills/actions";
import { buildPaymentPlan, nextFuturePayday, type PlanBill } from "@/lib/payment-plan";
import { splitBillsForViews, nextPaydayCard } from "@/lib/dashboard-bills";
import { isPriorityCarryover, orderNowBills } from "@/lib/bill-priority";
import type { PaydayEventRow } from "@/features/months/actions";
import { cn } from "@/lib/utils";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { ActionableBillRow } from "./actionable-bill-row";
import { AvailableBalanceEditor, formatBankBalance } from "./available-balance";
import { formatCents, formatShortDate } from "./format";
import type { DashboardBill, DashboardIncome } from "./types";

export function NowDashboard({
  monthKey,
  monthId,
  operational,
  liveMonth,
  availableBalance,
  availableBalanceUpdatedAt,
  bills,
  income,
  windows,
  paydayEvents,
  todayIso,
}: {
  monthKey: string;
  monthId: number;
  operational: boolean;
  liveMonth: { href: string; label: string } | null;
  availableBalance: number | null;
  availableBalanceUpdatedAt: string | null;
  bills: DashboardBill[];
  income: DashboardIncome[];
  windows: PaycheckWindow[];
  paydayEvents: PaydayEventRow[];
  todayIso: string;
}) {
  const router = useRouter();
  const [editingBalance, setEditingBalance] = useState(false);
  const signature = JSON.stringify(
    bills.map((bill) => [bill.id, bill.status, bill.plannedAmount, bill.invoiceAmount, bill.amountPaid, bill.floatTargetDate])
  ) + JSON.stringify(paydayEvents);
  const [selection, setSelection] = useState<{ signature: string; ids: number[] | null }>({
    signature,
    ids: null,
  });
  const selectedIds = selection.signature === signature ? selection.ids : null;
  const planBills: PlanBill[] = bills.map((bill) => ({
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
  const plan = buildPaymentPlan({
    bills: planBills,
    paydayEvents,
    availableBalance,
    todayIso,
    ...(selectedIds === null ? {} : { selectedIds }),
  });
  const selected = new Set(plan.selectedIds);
  const buckets = splitBillsForViews(bills, todayIso);
  const priorityBills = buckets.now.filter((bill) => isPriorityCarryover(bill, todayIso, monthKey));
  const actionBills = orderNowBills(buckets.now, todayIso, monthKey);
  const nextPayday = nextFuturePayday(paydayEvents, todayIso);
  const nextInMonth = nextPaydayCard(income, todayIso);
  const nextAmount = nextPayday?.date === nextInMonth?.date ? nextInMonth?.scheduledCents : null;
  const left = plan.leftAfterSelectedCents;
  const short = left != null && left < 0;

  function toggleBill(id: number, checked: boolean) {
    const updated = checked
      ? [...plan.selectedIds, id]
      : plan.selectedIds.filter((picked) => picked !== id);
    setSelection({ signature, ids: updated });
  }

  async function unfloat(bill: DashboardBill) {
    try {
      const result = await undoFloatBill(bill.id, bill.ownerMonthId, bill.ownerMonthKey);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Float removed. Original due date unchanged.");
        router.refresh();
      }
    } catch {
      toast.error("Could not undo the float.");
    }
  }

  if (!operational) {
    return (
      <section className="rounded-lg border p-4 text-sm">
        <h2 className="font-semibold">This is not the current month</h2>
        <p className="mt-1 text-muted-foreground">
          Live bank balances and payment decisions belong on the current month. Use Plan or History to review this month.
        </p>
        {liveMonth ? (
          <Link href={liveMonth.href} className="mt-3 inline-block text-primary underline">
            Open {liveMonth.label}
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section
        aria-label="Current financial snapshot"
        className="sticky top-12 z-20 rounded-lg border border-border bg-background/95 p-3 shadow-sm backdrop-blur md:static md:shadow-none"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bank balance
              </h2>
              <button
                type="button"
                onClick={() => setEditingBalance((value) => !value)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {editingBalance ? "Cancel" : "Update"}
              </button>
            </div>
            <p className="truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
              {formatBankBalance(availableBalance)}
            </p>
          </div>
          <div className="min-w-0 border-l border-border pl-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              After this plan
            </h2>
            <p
              className={cn(
                "truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl",
                short ? "text-rose-500" : "text-primary"
              )}
            >
              {left == null ? "—" : formatCents(left)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2 text-xs text-muted-foreground">
          <span>Sent, not cleared: <strong className="font-medium text-foreground">{formatCents(plan.pendingCents)}</strong></span>
          <span>Selected to pay: <strong className="font-medium text-foreground">{formatCents(plan.selectedCents)}</strong></span>
        </div>
        {editingBalance || availableBalance == null ? (
          <div className="mt-3">
            <AvailableBalanceEditor
              monthKey={monthKey}
              balance={availableBalance}
              updatedAt={availableBalanceUpdatedAt}
              onClose={() => setEditingBalance(false)}
            />
          </div>
        ) : null}
        {short ? (
          <p className="mt-2 text-xs text-rose-500">
            Short {formatCents(Math.abs(left ?? 0))}. Deselect or float a bill to adjust the plan.
          </p>
        ) : left == null ? (
          <p className="mt-2 text-xs text-muted-foreground">Enter what your bank currently shows to calculate the remainder.</p>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,0.9fr)]">
        <section className="min-w-0 space-y-2" aria-label="Bills needing attention">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Bills to handle</h2>
              <p className="text-[11px] text-muted-foreground">
                Choose what to pay. Sent payments are already reserved.
              </p>
            </div>
            <AddBillButton monthId={monthId} monthKey={monthKey} windows={windows} />
          </div>
          <ul className="max-h-[min(62vh,580px)] divide-y-0 overflow-y-auto rounded-md border bg-card/30 lg:max-h-[min(56vh,490px)]">
            {priorityBills.length > 0 ? (
              <li className="flex items-center justify-between gap-2 border-b border-border/70 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-300">
                <span>Overdue from earlier months</span>
                <span className="tabular-nums">{priorityBills.length}</span>
              </li>
            ) : null}
            {actionBills.length ? actionBills.map((bill, index) => (
              <Fragment key={bill.id}>
                {priorityBills.length > 0 && index === priorityBills.length ? (
                  <li className="border-y border-border/70 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    Other bills
                  </li>
                ) : null}
                <ActionableBillRow
                  bill={bill}
                  selected={selected.has(bill.id)}
                  onSelect={(checked) => toggleBill(bill.id, checked)}
                  windows={bill.ownerMonthKey === monthKey ? windows : []}
                  nextPaydayDate={nextPayday?.date ?? null}
                  viewingMonthKey={monthKey}
                  todayIso={todayIso}
                />
              </Fragment>
            )) : (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                You're caught up. No bills need a decision.
              </li>
            )}
          </ul>
        </section>

        <aside className="min-w-0 space-y-3">
          <section className="rounded-md border p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next payday
            </p>
            {nextPayday ? (
              <>
                <p className="mt-1 text-lg font-semibold">{formatShortDate(nextPayday.date)}</p>
                <p className="text-xs text-muted-foreground">
                  {nextPayday.name}
                  {nextAmount != null ? " · Scheduled " + formatCents(nextAmount) : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Future income is not included in today's bank balance.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No future paycheck recorded. Add income in Plan.
              </p>
            )}
          </section>
          <section className="rounded-md border p-3">
            <h3 className="text-sm font-semibold">Floated to later</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Original due dates are unchanged.
            </p>
            {buckets.floated.length ? (
              <ul className="mt-2 divide-y divide-border/70">
                {buckets.floated.map((bill) => (
                  <li key={bill.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{bill.name}</p>
                      <p className="text-muted-foreground">
                        Due {formatShortDate(bill.dueDate)} · Planned {formatShortDate(bill.floatTargetDate)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 shrink-0 text-xs" onClick={() => void unfloat(bill)}>
                      Undo
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Nothing floated.</p>
            )}
          </section>
          <p className="px-1 text-xs text-muted-foreground">
            The amount after this plan is a projection, not a guarantee of money available to spend.
          </p>
        </aside>
      </div>
    </div>
  );
}
