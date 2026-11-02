"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { IncomeForm } from "./income-form";
import { deleteIncome } from "./actions";
import { cn } from "@/lib/utils";
import { paycheckRowBorderClass } from "@/lib/paycheck-window-styles";
import type { ColorKey } from "@/lib/paycheck-windows";

type IncomeEvent = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const shortDate = (date: string) => date.slice(5).replace("-", "/");

export function IncomeRow({ event, monthKey, as = "table", colorKey }: {
  event: IncomeEvent;
  monthKey: string;
  as?: "table" | "list";
  colorKey?: ColorKey | null;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const scheduled = event.status !== "received";
  const amount = scheduled ? "Scheduled" : event.actualAmount == null ? "—" : money(event.actualAmount);

  async function handleDelete() {
    if (deleting || !window.confirm(`Delete ${event.name} income on ${shortDate(event.expectedDate)}? Bills will remain and be reassigned to other pay periods where possible.`)) return;
    setDeleting(true);
    try {
      const result = await deleteIncome(event.id, monthKey);
      if (result.success) {
        toast.success("Income deleted");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete income.");
      }
    } catch {
      toast.error("Couldn't delete income. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-2.5 text-sm font-medium hover:bg-muted">
          Edit
        </SheetTrigger>
        <SheetContent className="flex h-full w-full max-w-none flex-col overflow-y-auto px-6 sm:max-w-none">
          <SheetHeader><SheetTitle>Edit income</SheetTitle></SheetHeader>
          <IncomeForm monthKey={monthKey} initial={event} onSuccess={() => { setOpen(false); router.refresh(); }} />
        </SheetContent>
      </Sheet>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
  const border = colorKey ? paycheckRowBorderClass(colorKey) : undefined;
  if (as === "list") {
    return (
      <li className={cn("border-b border-border last:border-b-0", border)}>
        <div className="space-y-2 px-3 py-3">
          <span className="block truncate font-medium">{event.name}</span>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="tabular-nums text-muted-foreground">{shortDate(event.expectedDate)}</span>
            <span className="tabular-nums">{amount}</span>
            <span className="ml-auto">{actions}</span>
          </div>
          {event.notes?.trim() && <p className="text-xs text-muted-foreground">{event.notes.trim()}</p>}
        </div>
      </li>
    );
  }
  return (
    <tr className="border-b">
      <td className={cn("px-2 py-1", border)}>{event.name}</td>
      <td className="px-2 py-1 tabular-nums">{shortDate(event.expectedDate)}</td>
      <td className="px-2 py-1 tabular-nums">{amount}</td>
      <td className="px-2 py-1">{event.notes?.trim() || "—"}</td>
      <td className="px-2 py-1 text-right">{actions}</td>
    </tr>
  );
}
