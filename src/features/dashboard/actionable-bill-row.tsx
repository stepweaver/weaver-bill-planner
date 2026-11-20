"use client";

import { useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  BillForm,
  billEditorHeaderClassName,
  billEditorHeaderStyle,
  billEditorSheetClassName,
} from "@/features/bills/bill-form";
import { floatBill, updateBillPaymentState } from "@/features/bills/actions";
import { getEffectivePlannedAmount, isoDateOnly } from "@/lib/bill-utils";
import { isOverdueActionBill, isPriorityCarryover } from "@/lib/bill-priority";
import { daysUntilLedgerDate } from "@/lib/ledger-date-math";
import { cn } from "@/lib/utils";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { formatMoney, formatShortDate } from "./format";
import type { DashboardBill } from "./types";

export function ActionableBillRow({
  bill,
  selected,
  onSelect,
  windows,
  nextPaydayDate,
  viewingMonthKey,
  todayIso,
}: {
  bill: DashboardBill;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  windows: PaycheckWindow[];
  nextPaydayDate: string | null;
  viewingMonthKey: string;
  todayIso: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(bill.isRecurring !== false);
  const pending = bill.status === "pending";
  const overdue = isOverdueActionBill(bill, todayIso);
  const priority = isPriorityCarryover(bill, todayIso, viewingMonthKey);
  const daysLate = daysUntilLedgerDate(isoDateOnly(bill.dueDate) ?? "", todayIso);
  const scheduled = bill.status === "scheduled";
  const missingAmount = bill.plannedAmount == null && bill.invoiceAmount == null;
  const amount = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  const inOtherMonth = bill.ownerMonthKey !== viewingMonthKey;
  const safePaymentUrl = bill.paymentUrl && /^https?:\/\//i.test(bill.paymentUrl)
    ? bill.paymentUrl
    : null;

  async function changePayment(status: "pending" | "paid") {
    const question = status === "pending"
      ? "Confirm that you initiated payment for " + bill.name + "? This will reserve the payment until it clears."
      : "Confirm that payment for " + bill.name + " has cleared your bank?";
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      const result = await updateBillPaymentState(
        bill.id, bill.ownerMonthId, bill.ownerMonthKey, status
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(status === "pending" ? "Payment recorded as sent" : "Payment cleared");
        router.refresh();
      }
    } catch {
      toast.error("Could not update the payment.");
    } finally {
      setBusy(false);
    }
  }

  async function floatToPayday() {
    if (!nextPaydayDate) return;
    setBusy(true);
    try {
      const result = await floatBill(
        bill.id, bill.ownerMonthId, bill.ownerMonthKey, nextPaydayDate
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Planned for " + formatShortDate(nextPaydayDate) + ". Original due date unchanged.");
        router.refresh();
      }
    } catch {
      toast.error("Could not float the bill.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li id={"bill-row-" + bill.id} className={cn(
      "scroll-mt-24 border-b border-border/70 last:border-b-0",
      priority && "border-l-2 border-l-amber-500 bg-amber-500/5",
      overdue && !priority && "border-l-2 border-l-amber-500/60"
    )}>
      <div className="flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3">
        {scheduled ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.currentTarget.checked)}
            aria-label={"Include " + bill.name + " in payment plan"}
            className="size-5 shrink-0 accent-primary"
          />
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center text-amber-600" title="Payment awaiting clearance" aria-label="Payment awaiting clearance">●</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {safePaymentUrl ? (
                <a
                  href={safePaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-primary hover:underline"
                  title={"Open payment website for " + bill.name}
                >
                  <span className="truncate">{bill.name}</span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="block truncate text-sm font-medium">{bill.name}</span>
              )}
              <p className={cn("text-xs text-muted-foreground", overdue && "text-amber-200/80")}>
                {formatShortDate(bill.dueDate)}
                {overdue && daysLate != null ? " · " + Math.abs(daysLate) + (Math.abs(daysLate) === 1 ? " day past due" : " days past due") : ""}
                {pending ? " · Sent, awaiting clearance" : ""}
                {inOtherMonth ? " · Carryover" : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {missingAmount ? "Set amount" : formatMoney(amount)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1.5">
            {pending ? (
              <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy}
                onClick={() => void changePayment("paid")}>
                Mark cleared
              </Button>
            ) : (
              <>
                <Button size="sm" className="h-8 text-xs" disabled={busy}
                  onClick={() => void changePayment("pending")}>
                  Mark sent
                </Button>
                {nextPaydayDate ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy}
                    onClick={() => void floatToPayday()}>
                    Float
                  </Button>
                ) : null}
              </>
            )}
            <Sheet open={editing} onOpenChange={setEditing}>
              <SheetTrigger
                aria-label={"Edit " + bill.name}
                title={"Edit " + bill.name}
                className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted"
              >
                <Pencil aria-hidden className="size-3.5" />
              </SheetTrigger>
              <SheetContent layout="drawer" className={billEditorSheetClassName}>
                <SheetHeader className={billEditorHeaderClassName} style={billEditorHeaderStyle}>
                  <SheetTitle>Edit {editingRecurring ? "bill" : "expense"}</SheetTitle>
                </SheetHeader>
                {editing ? (
                  <BillForm
                    monthId={bill.ownerMonthId}
                    monthKey={bill.ownerMonthKey}
                    windows={inOtherMonth ? [] : windows}
                    onKindChange={setEditingRecurring}
                    initial={{
                      id: bill.id,
                      name: bill.name,
                      dueDate: bill.dueDate,
                      plannedAmount: bill.plannedAmount,
                      invoiceAmount: bill.invoiceAmount,
                      amountPaid: bill.amountPaid,
                      status: bill.status as "scheduled" | "pending" | "paid" | "skipped",
                      notes: bill.notes,
                      paymentUrl: bill.paymentUrl,
                      assignedIncomeEventId: bill.assignedIncomeEventId,
                      assignedGroupKey: bill.assignedGroupKey,
                      manualAssignment: bill.manualAssignment ?? false,
                      templateId: bill.templateId,
                      isRecurring: bill.isRecurring ?? true,
                    }}
                    onSuccess={() => {
                      setEditing(false);
                      router.refresh();
                    }}
                  />
                ) : null}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </li>
  );
}
