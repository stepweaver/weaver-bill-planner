"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BillForm } from "./bill-form";
import {
  deleteBill,
  quickAssignBillToWindow,
  quickUpdateBillAmountPaid,
  quickUpdateBillNotes,
  quickUpdateBillStatus,
} from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [notesDraft, setNotesDraft] = useState(() => bill.notes ?? "");
  const [paidDraft, setPaidDraft] = useState(() =>
    bill.amountPaid != null ? String(bill.amountPaid) : ""
  );
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  const paid = isBillPaid(bill.status, bill.amountPaid, effective);
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

  const rowTint = paid
    ? "bg-green-500/[0.06]"
    : overdue
      ? "bg-rose-500/[0.06]"
      : "";
  const filteredHighlight =
    highlightWindowKey != null && bill.displayWindowKey === highlightWindowKey
      ? "ring-1 ring-primary/40"
      : "";

  async function handleDelete() {
    if (!confirm("Delete this bill?")) return;
    const r = await deleteBill(bill.id, monthKey);
    if (r?.success) {
      toast.success("Deleted");
      router.refresh();
    } else toast.error("Failed to delete");
  }

  function runQuick(
    action: () => Promise<{ success?: true; error?: string } | undefined>
  ) {
    startTransition(async () => {
      const r = await action();
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  const nameCell = bill.paymentUrl ? (
    <a
      href={bill.paymentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 items-center gap-1 truncate text-primary underline hover:no-underline font-medium"
    >
      <span className="truncate">{bill.name}</span>
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  ) : (
    <span className="block min-w-0 truncate font-medium">{bill.name}</span>
  );

  const fullEdit = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-muted">
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
  );

  const assignValue =
    bill.manualAssignment && bill.assignedGroupKey ? bill.assignedGroupKey : "auto";

  const inlineControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        disabled={pending}
        value={bill.status}
        onValueChange={(v) => {
          if (!v) return;
          runQuick(() => quickUpdateBillStatus(bill.id, monthId, monthKey, v));
        }}
      >
        <SelectTrigger className="h-7 w-[130px] text-[11px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="scheduled">Due</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="skipped">Skipped</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Paid</span>
        <Input
          disabled={pending}
          className="h-7 w-20 text-[11px] tabular-nums px-1.5"
          inputMode="decimal"
          value={paidDraft}
          onChange={(e) => setPaidDraft(e.target.value)}
          onBlur={() => {
            const t = paidDraft.trim();
            const n = t === "" ? null : Number(t);
            if (t !== "" && Number.isNaN(n!)) {
              setPaidDraft(bill.amountPaid != null ? String(bill.amountPaid) : "");
              return;
            }
            if ((bill.amountPaid ?? null) === n) return;
            runQuick(() => quickUpdateBillAmountPaid(bill.id, monthId, monthKey, n));
          }}
        />
      </div>
      <Select
        disabled={pending}
        value={assignValue}
        onValueChange={(v) => {
          if (!v) return;
          runQuick(() =>
            quickAssignBillToWindow(
              bill.id,
              monthId,
              monthKey,
              v === "auto" ? null : v
            )
          );
        }}
      >
        <SelectTrigger className="h-7 min-w-[120px] max-w-[160px] text-[11px]">
          <SelectValue placeholder="Paycheck" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto-assign</SelectItem>
          {windows.map((w) => (
            <SelectItem key={w.key} value={w.key}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        disabled={pending}
        placeholder="Note"
        className="h-7 min-w-[6rem] flex-1 max-w-[200px] text-[11px]"
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onBlur={() => {
          const next = notesDraft.trim() || null;
          const prev = bill.notes?.trim() || null;
          if (next === prev) return;
          runQuick(() => quickUpdateBillNotes(bill.id, monthId, monthKey, next));
        }}
      />
      {fullEdit}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive h-7 px-2 text-[11px] shrink-0"
        onClick={handleDelete}
      >
        Del
      </Button>
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
          {inlineControls}
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
          {inlineControls}
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
      {inlineControls}
    </div>
  );
}
