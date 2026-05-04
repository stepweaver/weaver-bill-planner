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
import { IncomeForm } from "./income-form";
import { deleteIncome } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Event = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

/** Format difference vs expected: +$X.XX or -$X.XX; null if no difference to show */
function formatDifference(expected: number | null, actual: number | null): string | null {
  if (expected == null || actual == null) return null;
  const diff = actual - expected;
  if (diff === 0) return null;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${formatMoney(diff)}`;
}

/** Date as MM/DD: "2026-03-05" → "03/05" */
function formatMMDD(iso: string): string {
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const m = parts[1]!.padStart(2, "0");
  const d = parts[2]!.padStart(2, "0");
  return `${m}/${d}`;
}

export function IncomeRow({
  event,
  monthKey,
  as = "table",
}: {
  event: Event;
  monthKey: string;
  as?: "table" | "list";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this income event?")) return;
    const r = await deleteIncome(event.id, monthKey);
    if (r?.success) {
      toast.success("Deleted");
      router.refresh();
    } else toast.error("Failed to delete");
  }

  const actions = (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex h-6 shrink-0 items-center justify-center rounded px-2 text-[11px] font-medium hover:bg-muted">
          Edit
        </SheetTrigger>
        <SheetContent className="flex h-full w-full max-w-none flex-col overflow-y-auto px-6 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Edit income</SheetTitle>
          </SheetHeader>
          <IncomeForm
            monthKey={monthKey}
            initial={{
              id: event.id,
              name: event.name,
              expectedDate: event.expectedDate,
              expectedAmount: event.expectedAmount,
              actualAmount: event.actualAmount,
              status: event.status as "expected" | "received",
              notes: event.notes,
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

  const receivedAmount = event.status === "received" ? event.actualAmount : null;
  const displayAmount = receivedAmount != null ? formatMoney(receivedAmount) : "—";
  const diff = formatDifference(event.expectedAmount, event.actualAmount);
  const hasComment = event.notes?.trim();

  if (as === "list") {
    return (
      <li className="border-b border-border last:border-b-0">
        <div className="py-2.5 px-2 space-y-1.5">
          <div className="min-w-0 overflow-hidden">
            <span className="block min-w-0 truncate font-medium">{event.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="tabular-nums text-muted-foreground shrink-0">{formatMMDD(event.expectedDate)}</span>
            <span className="tabular-nums shrink-0">{displayAmount}</span>
            {diff != null && (
              <span
                className={cn(
                  "tabular-nums shrink-0 text-xs",
                  diff.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {diff}
              </span>
            )}
            <span className="shrink-0">{event.status}</span>
            <span className="flex items-center gap-1 shrink-0 ml-auto">{actions}</span>
          </div>
          {hasComment && (
            <p className="text-xs text-muted-foreground min-w-0">{event.notes!.trim()}</p>
          )}
        </div>
      </li>
    );
  }

  return (
    <tr className="border-b">
      <td className="px-2 py-1 truncate max-w-[90px]">{event.name}</td>
      <td className="px-2 py-1 w-24 tabular-nums">{formatMMDD(event.expectedDate)}</td>
      <td className="px-2 py-1 text-right w-20 tabular-nums">{displayAmount}</td>
      <td className="px-2 py-1 text-right w-20">
        {diff != null ? (
          <span
            className={cn(
              "tabular-nums text-xs",
              diff.startsWith("+") ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"
            )}
          >
            {diff}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-1 w-20">{event.status}</td>
      <td className="px-2 py-1 text-xs text-muted-foreground max-w-[120px] truncate" title={event.notes ?? undefined}>
        {hasComment ? event.notes!.trim() : "—"}
      </td>
      <td className="px-2 py-1 text-right">{actions}</td>
    </tr>
  );
}
