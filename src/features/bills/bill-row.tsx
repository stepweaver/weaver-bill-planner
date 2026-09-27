"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
import { cn } from "@/lib/utils";
import { paycheckBadgeClass, paycheckRowBorderClass } from "@/lib/paycheck-window-styles";
import { ExternalLink } from "lucide-react";
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

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const m = parts[1]!.padStart(2, "0");
  const d = parts[2]!.padStart(2, "0");
  return `${m}/${d}`;
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

function DueDateControl({
  billId,
  billName,
  dueDate,
  monthId,
  monthKey,
  touch,
}: {
  billId: number;
  billName: string;
  dueDate: string | null;
  monthId: number;
  monthKey: string;
  touch: boolean;
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

  return (
    <label
      className={cn(
        "relative flex w-full items-center rounded-sm focus-within:ring-2 focus-within:ring-ring",
        touch ? "min-h-11 min-w-11" : "min-h-8 min-w-10"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none tabular-nums text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/70 underline-offset-2",
          saving && "opacity-50"
        )}
      >
        {formatShortDate(value || null)}
      </span>
      <input
        type="date"
        value={value}
        aria-label={dueDate ? `Due date for ${billName}` : `Set due date for ${billName}`}
        disabled={saving}
        onChange={onChange}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0 disabled:cursor-wait"
      />
    </label>
  );
}

function PaymentStateButton({
  billId,
  billName,
  status,
  monthId,
  monthKey,
  touch,
}: {
  billId: number;
  billName: string;
  status: string;
  monthId: number;
  monthKey: string;
  touch: boolean;
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
        "inline-flex shrink-0 items-center justify-center rounded-md border font-medium touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50",
        touch ? "h-11 px-3 text-xs" : "h-7 px-2 text-[11px]",
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
        "inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
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
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  ) : (
    <span className={cn("block min-w-0 truncate font-medium", nameClass || undefined)}>
      {bill.name}
    </span>
  );

  const statusEl = (
    <span
      className={cn(
        "text-[11px] font-medium",
        pendingVisual && "text-amber-700 dark:text-amber-300",
        settledPaid && "text-emerald-700 dark:text-emerald-400",
        !pendingVisual && !settledPaid && "text-foreground"
      )}
    >
      {statusLabel(bill.status)}
    </span>
  );

  const touch = as !== "table";
  const quickPay = (
    <PaymentStateButton
      billId={bill.id}
      billName={bill.name}
      status={bill.status}
      monthId={monthId}
      monthKey={monthKey}
      touch={touch}
    />
  );
  const dueDateControl = (
    <DueDateControl
      billId={bill.id}
      billName={bill.name}
      dueDate={bill.dueDate}
      monthId={monthId}
      monthKey={monthKey}
      touch={touch}
    />
  );

  const fullEdit = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={`Edit ${bill.name}`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-background font-medium hover:bg-muted touch-manipulation",
          touch ? "h-11 px-3 text-xs" : "h-7 px-2 text-[11px]"
        )}
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
            isRecurring: true,
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
            "px-2 py-1.5 align-middle whitespace-nowrap text-xs text-muted-foreground",
            borderClass
          )}
        >
          {dueDateControl}
        </td>
        <td className="overflow-hidden px-2 py-1.5 align-middle">{nameCell}</td>
        <td className="px-2 py-1.5 align-middle whitespace-nowrap text-xs tabular-nums">
          {formatMoney(effective)}
        </td>
        <td className="overflow-hidden px-2 py-1.5 align-middle">{fundingBadge}</td>
        <td className="px-2 py-1.5 align-middle whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {statusEl}
            {quickPay}
          </div>
        </td>
        <td className="px-2 py-1.5 align-middle whitespace-nowrap">{fullEdit}</td>
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
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 px-2 py-2">
        {dueDateControl}
        <div className="min-w-0">{nameCell}</div>
        <span className="text-right text-xs font-medium tabular-nums">
          {formatMoney(effective)}
        </span>
        <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {fundingBadge}
          {statusEl}
          {quickPay}
        </div>
        <div className="col-start-3 row-start-2 justify-self-end">{fullEdit}</div>
      </div>
    </li>
  );
}
