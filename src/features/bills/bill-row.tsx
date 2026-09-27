"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BillForm,
  billEditorHeaderClassName,
  billEditorHeaderStyle,
  billEditorSheetClassName,
} from "./bill-form";
import { updateBillDueDate, updateBillPaymentState } from "./actions";
import { useRouter } from "next/navigation";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "@/lib/bill-utils";
import { parseLocalIsoDate } from "@/lib/month-dates";
import { cn } from "@/lib/utils";
import { paycheckBadgeClass, paycheckRowBorderClass } from "@/lib/paycheck-window-styles";
import { Calendar, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Bill = {
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

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function statusLabel(status: string): string {
  if (status === "scheduled") return "Due";
  if (status === "pending") return "Pending";
  if (status === "paid") return "Paid";
  if (status === "skipped") return "Skipped";
  return status;
}

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Month view already implies the year, so in-month dates stay MM/DD. */
function formatCompactDueDate(iso: string, monthKey: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  if (`${year}-${month}` === monthKey) return `${month}/${day}`;
  return `${month}/${day}/${year.slice(2)}`;
}

/** Prior-month rows need the month name. Add the year when it is not the viewed year. */
function formatPriorMonthDueDate(iso: string, viewMonthKey: string): string {
  const date = parseLocalIsoDate(iso.slice(0, 10));
  if (Number.isNaN(date.getTime())) return iso;
  const viewYear = Number(viewMonthKey.slice(0, 4));
  if (date.getFullYear() === viewYear) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

const rowActionClassName =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-2.5 text-sm font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function DueDateControl({
  billId,
  billName,
  dueDate,
  monthId,
  monthKey,
  labelMonthKey,
  dueDateStyle = "compact",
}: {
  billId: number;
  billName: string;
  dueDate: string | null;
  monthId: number;
  monthKey: string;
  labelMonthKey?: string;
  dueDateStyle?: "compact" | "prior-month";
}) {
  const router = useRouter();
  const requestId = useRef(0);
  const [value, setValue] = useState(dateInputValue(dueDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(dateInputValue(dueDate));
  }, [dueDate]);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const current = dateInputValue(dueDate);
    if (next === current) return;
    const id = ++requestId.current;
    setValue(next);
    setSaving(true);
    try {
      const result = await updateBillDueDate(billId, monthId, monthKey, next || null);
      if (id !== requestId.current) return;
      if ("error" in result) {
        toast.error(result.error);
        setValue(current);
        return;
      }
      router.refresh();
    } catch {
      if (id !== requestId.current) return;
      toast.error("Couldn't update the due date.");
      setValue(current);
    } finally {
      if (id === requestId.current) setSaving(false);
    }
  }

  const labelKey = labelMonthKey ?? monthKey;
  const label = value
    ? dueDateStyle === "prior-month"
      ? formatPriorMonthDueDate(value, labelKey)
      : formatCompactDueDate(value, labelKey)
    : "Set";

  return (
    <div
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm tabular-nums text-muted-foreground",
        "hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        saving && "opacity-50"
      )}
    >
      <span aria-hidden>{label}</span>
      <Calendar aria-hidden className="size-3.5 shrink-0" />
      <input
        type="date"
        value={value}
        aria-label={dueDate ? `Due date for ${billName}` : `Set due date for ${billName}`}
        aria-busy={saving}
        disabled={saving}
        onChange={onChange}
        className={cn(
          "absolute inset-0 z-10 cursor-pointer opacity-0",
          "touch-manipulation disabled:cursor-wait",
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
          // Chromium only opens the popup from the calendar glyph, and the date
          // text sits above that glyph. Let clicks fall through to the glyph.
          "pointer-fine:[&::-webkit-datetime-edit]:pointer-events-none",
          "pointer-fine:[&::-webkit-datetime-edit-fields-wrapper]:pointer-events-none",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:absolute",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:inset-0",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:m-0",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:h-full",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:w-full",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:cursor-pointer",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:bg-transparent",
          "pointer-fine:[&::-webkit-calendar-picker-indicator]:opacity-0"
        )}
      />
    </div>
  );
}

function PaymentStateButton({
  billId,
  billName,
  status,
  monthId,
  monthKey,
}: {
  billId: number;
  billName: string;
  status: string;
  monthId: number;
  monthKey: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const next = status === "scheduled" ? "pending" : status === "pending" ? "paid" : null;
  if (!next) return null;
  const label = next === "pending" ? "Pending" : "Paid";

  async function onClick() {
    if (!next || saving) return;
    setSaving(true);
    try {
      const result = await updateBillPaymentState(billId, monthId, monthKey, next);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    } catch {
      toast.error("Couldn't update the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={next === "pending" ? `Mark ${billName} pending` : `Mark ${billName} paid`}
      aria-busy={saving}
      disabled={saving}
      onClick={onClick}
      className={cn(
        rowActionClassName,
        next === "pending"
          ? "border-amber-600/50 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
          : "border-emerald-600/50 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
      )}
    >
      {label}
    </button>
  );
}

export function BillRow({
  bill,
  monthId,
  monthKey,
  windows,
  as = "ledger",
  highlightWindowKey = null,
  anchor = true,
  dueDateStyle = "compact",
  labelMonthKey,
  showAssignment = true,
}: {
  bill: Bill;
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
  as?: "ledger" | "list" | "table";
  /** When parent filters by paycheck, highlight matching rows */
  highlightWindowKey?: string | null;
  /** False when a second layout of the same bill is also mounted, so the anchor id stays unique. */
  anchor?: boolean;
  /** Prior-month carryover shows "Aug 18" instead of an in-month MM/DD. */
  dueDateStyle?: "compact" | "prior-month";
  /** Year used when formatting a prior-month date. Mutations still use monthKey. */
  labelMonthKey?: string;
  /** Carryover rows are not assigned to this month's paychecks. */
  showAssignment?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  /** In-flight payment (sent, not cleared) — keep separate from settled paid for visuals. */
  const pendingVisual = bill.status === "pending";
  const settledPaid = isBillPaid(bill.status, bill.amountPaid, effective) && !pendingVisual;
  const overdue = isBillOverdue(bill.dueDate, bill.status, bill.amountPaid, effective);

  const win = bill.displayWindowKey
    ? windows.find((w) => w.key === bill.displayWindowKey)
    : null;
  const unassigned = bill.displayWindowKey == null;
  const borderClass = unassigned
    ? "border-l-[3px] border-dashed border-l-muted-foreground/50"
    : paycheckRowBorderClass(win?.colorKey);

  const fundingBadge = (
    <span
      className={cn(
        "inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-xs font-medium",
        unassigned
          ? "bg-muted text-muted-foreground"
          : paycheckBadgeClass(win?.colorKey)
      )}
    >
      {unassigned ? "Unassigned" : (win?.label ?? "Unknown")}
    </span>
  );

  const rowTint = pendingVisual
    ? "bg-amber-500/[0.09]"
    : settledPaid
      ? "bg-green-500/[0.06]"
      : overdue
        ? "bg-rose-500/[0.06]"
        : "";
  const filteredHighlight =
    highlightWindowKey != null && bill.displayWindowKey === highlightWindowKey
      ? "ring-1 ring-primary/40"
      : "";

  const nameClass = pendingVisual
    ? "text-amber-700 dark:text-amber-300"
    : settledPaid
      ? "text-emerald-600 dark:text-emerald-400"
      : "";

  const nameCell = bill.paymentUrl ? (
    <a
      href={bill.paymentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-w-0 items-center gap-1 truncate underline hover:no-underline font-medium",
        pendingVisual || settledPaid ? nameClass : "text-primary",
        settledPaid && "hover:text-emerald-500 dark:hover:text-emerald-300",
        pendingVisual && "hover:text-amber-600 dark:hover:text-amber-200"
      )}
    >
      <span className="truncate">{bill.name}</span>
      <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
    </a>
  ) : (
    <span className={cn("block min-w-0 truncate font-medium", nameClass || undefined)}>
      {bill.name}
    </span>
  );

  const statusEl = (
    <span
      className={cn(
        "text-sm font-medium",
        pendingVisual && "text-amber-700 dark:text-amber-300",
        settledPaid && "text-emerald-700 dark:text-emerald-400",
        !pendingVisual && !settledPaid && "text-foreground"
      )}
    >
      {statusLabel(bill.status)}
    </span>
  );

  const quickPay = (
    <PaymentStateButton
      billId={bill.id}
      billName={bill.name}
      status={bill.status}
      monthId={monthId}
      monthKey={monthKey}
    />
  );
  const dueDateControl = (
    <DueDateControl
      billId={bill.id}
      billName={bill.name}
      dueDate={bill.dueDate}
      monthId={monthId}
      monthKey={monthKey}
      labelMonthKey={labelMonthKey}
      dueDateStyle={dueDateStyle}
    />
  );

  const fullEdit = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={`Edit ${bill.name}`}
        className={cn(rowActionClassName, "border-input bg-background hover:bg-muted")}
      >
        Edit
      </SheetTrigger>
      <SheetContent layout="drawer" className={billEditorSheetClassName}>
        <SheetHeader className={billEditorHeaderClassName} style={billEditorHeaderStyle}>
          <SheetTitle>Edit bill</SheetTitle>
        </SheetHeader>
        <BillForm
          monthId={monthId}
          monthKey={monthKey}
          windows={windows}
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
            setOpen(false);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );

  const rowId = anchor ? `bill-row-${bill.id}` : undefined;

  if (as === "table") {
    return (
      <tr
        id={rowId}
        className={cn("border-b scroll-mt-24", rowTint, filteredHighlight)}
      >
        <td
          className={cn(
            "px-3 py-2.5 align-middle whitespace-nowrap text-muted-foreground",
            borderClass
          )}
        >
          {dueDateControl}
        </td>
        <td className="overflow-hidden px-3 py-2.5 align-middle text-base">{nameCell}</td>
        <td className="px-3 py-2.5 align-middle whitespace-nowrap text-base font-medium tabular-nums">
          {formatMoney(effective)}
        </td>
        <td className="overflow-hidden px-3 py-2.5 align-middle">
          {showAssignment ? fundingBadge : null}
        </td>
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <div className="flex items-center gap-2">
            {statusEl}
            {quickPay}
          </div>
        </td>
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">{fullEdit}</td>
      </tr>
    );
  }

  return (
    <li
      id={rowId}
      className={cn(
        "border-b last:border-b-0 scroll-mt-24",
        borderClass,
        rowTint,
        filteredHighlight
      )}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="pt-0.5">{dueDateControl}</div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0 text-base">{nameCell}</div>
            <span className="shrink-0 text-base font-medium tabular-nums">
              {formatMoney(effective)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {showAssignment ? fundingBadge : null}
              {statusEl}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {quickPay}
              {fullEdit}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
