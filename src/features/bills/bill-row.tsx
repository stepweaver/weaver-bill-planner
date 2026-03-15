"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BillForm } from "./bill-form";
import { deleteBill } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "@/lib/bill-utils";
import { cn } from "@/lib/utils";

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
};

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

/** Date as MM/DD: "2026-03-01" → "03/01" */
function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const m = parts[1]!.padStart(2, "0");
  const d = parts[2]!.padStart(2, "0");
  return `${m}/${d}`;
}

export function BillRow({
  bill,
  monthId,
  monthKey,
  windows,
  as = "table",
}: {
  bill: Bill;
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
  as?: "table" | "list";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this bill?")) return;
    const r = await deleteBill(bill.id, monthKey);
    if (r?.success) {
      toast.success("Deleted");
      router.refresh();
    } else toast.error("Failed to delete");
  }

  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  const paid = isBillPaid(bill.status, bill.amountPaid, effective);
  const overdue = isBillOverdue(bill.dueDate, bill.status, bill.amountPaid, effective);
  const rowClass = paid
    ? "border-b bg-green-500/5 border-l-2 border-l-green-600/50"
    : overdue
      ? "border-b bg-rose-500/5 border-l-2 border-l-rose-500/70"
      : "border-b";

  const nameCell = bill.paymentUrl ? (
    <a
      href={bill.paymentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block min-w-0 truncate text-primary underline hover:no-underline font-medium"
    >
      {bill.name}
    </a>
  ) : (
    <span className="block min-w-0 truncate font-medium">{bill.name}</span>
  );

  const statusBadge =
    bill.status === "pending" || bill.status === "paid" ? (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0",
          paid && "bg-green-500/20 text-green-700 dark:text-green-400",
          !paid && overdue && "bg-rose-500/20 text-rose-700 dark:text-rose-400",
          !paid && !overdue && "bg-muted text-muted-foreground"
        )}
      >
        {bill.status}
      </span>
    ) : null;

  const actions = (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex h-6 shrink-0 items-center justify-center rounded px-2 text-[11px] font-medium hover:bg-muted">
          Edit
        </SheetTrigger>
        <SheetContent className="overflow-y-auto px-6">
          <SheetHeader>
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive h-6 px-1.5 text-[11px] shrink-0"
        onClick={handleDelete}
      >
        Del
      </Button>
    </>
  );

  if (as === "list") {
    return (
      <li className={cn("border-b last:border-b-0", rowClass)}>
        <div className="py-2.5 px-1 space-y-1.5">
          <div className="min-w-0 overflow-hidden">
            {nameCell}
          </div>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
            <div className="flex flex-col gap-0.5 shrink-0">
              <span className="text-[11px] text-muted-foreground">
                Due date: <span className="tabular-nums">{formatShortDate(bill.dueDate)}</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                Amount due: <span className="tabular-nums text-foreground">{formatMoney(bill.plannedAmount)}</span>
              </span>
            </div>
            {statusBadge}
            <span className="flex items-center gap-1 shrink-0 ml-auto">{actions}</span>
          </div>
        </div>
      </li>
    );
  }

  return (
    <tr className={cn(rowClass)}>
      <td className="px-1.5 py-0.5 min-w-0 overflow-hidden">{nameCell}</td>
      <td className="px-1.5 py-0.5 text-right align-top">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">
            Due date: <span className="tabular-nums">{formatShortDate(bill.dueDate)}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            Amount due: <span className="tabular-nums text-foreground">{formatMoney(bill.plannedAmount)}</span>
          </span>
        </div>
      </td>
      <td className="px-1.5 py-0.5 shrink-0">{statusBadge}</td>
      <td className="px-1.5 py-0.5 text-right shrink-0 whitespace-nowrap">{actions}</td>
    </tr>
  );
}
