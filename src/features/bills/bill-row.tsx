"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BillForm } from "./bill-form";
import { useRouter } from "next/navigation";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "@/lib/bill-utils";
import { cn } from "@/lib/utils";
import { paycheckBadgeClass, paycheckRowBorderClass } from "@/lib/paycheck-window-styles";
import { ExternalLink } from "lucide-react";

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

export function BillRow({
  bill,
  monthId,
  monthKey,
  windows,
  as = "ledger",
  highlightWindowKey = null,
}: {
  bill: Bill;
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
  as?: "ledger" | "list" | "table";
  /** When parent filters by paycheck, highlight matching rows */
  highlightWindowKey?: string | null;
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

  const manualPaycheckLabel =
    bill.manualAssignment && bill.assignedGroupKey
      ? (windows.find((w) => w.key === bill.assignedGroupKey)?.label ?? bill.assignedGroupKey)
      : null;

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

  const fullEdit = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-muted">
        Edit
      </SheetTrigger>
      <SheetContent className="top-0 right-0 bottom-auto left-0 flex h-svh max-h-svh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:inset-y-0 sm:bottom-0 sm:left-auto sm:h-full sm:max-h-none">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
          <SheetTitle>Edit bill</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );

  const noteText = bill.notes?.trim() ?? "";
  const readOnlyDetails = (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          Status:{" "}
          <span
            className={cn(
              "font-medium",
              pendingVisual && "text-amber-700 dark:text-amber-300",
              settledPaid && "text-emerald-700 dark:text-emerald-400",
              !pendingVisual && !settledPaid && "text-foreground"
            )}
          >
            {statusLabel(bill.status)}
          </span>
        </span>
        <span>
          Paid:{" "}
          <span className="tabular-nums font-medium text-foreground">
            {formatMoney(bill.amountPaid)}
          </span>
        </span>
        {manualPaycheckLabel ? (
          <span>
            Paycheck:{" "}
            <span className="font-medium text-foreground">{manualPaycheckLabel}</span>
          </span>
        ) : null}
      </div>
      {noteText ? (
        <p
          className="text-[11px] text-muted-foreground truncate"
          title={noteText}
        >
          Note: <span className="text-foreground">{noteText}</span>
        </p>
      ) : null}
      {fullEdit}
    </div>
  );

  if (as === "list") {
    return (
      <li
        id={`bill-row-${bill.id}`}
        className={cn("border-b last:border-b-0 scroll-mt-24", borderClass, rowTint, filteredHighlight)}
      >
        <div className="py-2.5 px-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="tabular-nums text-xs text-muted-foreground shrink-0">
              {formatShortDate(bill.dueDate)}
            </span>
            <div className="min-w-0 flex-1">{nameCell}</div>
            {fundingBadge}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              Due: <span className="tabular-nums text-foreground">{formatMoney(effective)}</span>
            </span>
          </div>
          {readOnlyDetails}
        </div>
      </li>
    );
  }

  if (as === "table") {
    return (
      <tr
        id={`bill-row-${bill.id}`}
        className={cn("border-b scroll-mt-24", borderClass, rowTint, filteredHighlight)}
      >
        <td className="px-2 py-1.5 align-top tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {formatShortDate(bill.dueDate)}
        </td>
        <td className="px-2 py-1.5 align-top min-w-0">{nameCell}</td>
        <td className="px-2 py-1.5 align-top">{fundingBadge}</td>
        <td className="px-2 py-1.5 align-top text-xs tabular-nums">{formatMoney(effective)}</td>
        <td className="px-2 py-1.5 align-top" colSpan={2}>
          {readOnlyDetails}
        </td>
      </tr>
    );
  }

  return (
    <div
      id={`bill-row-${bill.id}`}
      className={cn(
        "rounded-md border border-border/80 scroll-mt-24 pl-2 pr-2 py-2 space-y-2",
        borderClass,
        rowTint,
        filteredHighlight
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="tabular-nums text-xs font-medium text-muted-foreground">
            {formatShortDate(bill.dueDate)}
          </span>
          <div className="min-w-0 max-w-[200px] sm:max-w-none">{nameCell}</div>
        </div>
        {fundingBadge}
      </div>
      <div className="text-xs text-muted-foreground">
        Amount due:{" "}
        <span className="tabular-nums font-medium text-foreground">{formatMoney(effective)}</span>
      </div>
      {readOnlyDetails}
    </div>
  );
}
