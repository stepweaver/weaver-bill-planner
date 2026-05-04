"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MoreVertical } from "lucide-react";
import { billInstanceSchema, type BillInstanceFormData } from "@/lib/validations/bill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createBill, updateBill, deleteBill } from "./actions";
import { toast } from "sonner";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { cn } from "@/lib/utils";

type Props = {
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
  initial?: Partial<BillInstanceFormData> & { id?: number };
  onSuccess?: () => void;
};

export function BillForm({ monthId, monthKey, windows, initial, onSuccess }: Props) {
  const [deleting, setDeleting] = useState(false);
  const isEdit = !!initial?.id;
  const form = useForm<BillInstanceFormData>({
    resolver: zodResolver(billInstanceSchema),
    defaultValues: {
      name: initial?.name ?? "",
      dueDate: initial?.dueDate ?? "",
      plannedAmount: initial?.plannedAmount ?? null,
      invoiceAmount: initial?.invoiceAmount ?? null,
      amountPaid: initial?.amountPaid ?? null,
      status: initial?.status ?? "scheduled",
      notes: initial?.notes ?? null,
      paymentUrl: initial?.paymentUrl ?? null,
      assignedIncomeEventId: initial?.assignedIncomeEventId ?? null,
      assignedGroupKey: initial?.assignedGroupKey ?? null,
      manualAssignment: initial?.manualAssignment ?? false,
      templateId: initial?.templateId ?? null,
      isRecurring: initial?.isRecurring ?? true,
    },
  });

  async function onSubmit(data: BillInstanceFormData) {
    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("dueDate", data.dueDate ?? "");
    formData.set("plannedAmount", data.plannedAmount != null ? String(data.plannedAmount) : "");
    formData.set("invoiceAmount", ""); // not recorded; use amount due and paid only
    formData.set("amountPaid", data.amountPaid != null ? String(data.amountPaid) : "");
    formData.set("status", data.status);
    formData.set("notes", data.notes ?? "");
    formData.set("paymentUrl", data.paymentUrl ?? "");
    formData.set("assignedIncomeEventId", data.assignedIncomeEventId != null ? String(data.assignedIncomeEventId) : "");
    formData.set("assignedGroupKey", data.assignedGroupKey ?? "");
    formData.set("manualAssignment", data.manualAssignment ? "on" : "");
    formData.set("templateId", data.templateId != null ? String(data.templateId) : "");
    formData.set("isRecurring", data.isRecurring ? "on" : "");

    if (isEdit && initial?.id) {
      const r = await updateBill(initial.id, monthId, monthKey, formData);
      if (r?.error) {
        Object.entries(r.error).forEach(([, messages]) => {
          messages?.forEach((m) => toast.error(m));
        });
        return;
      }
      toast.success("Updated");
    } else {
      const r = await createBill(monthId, monthKey, formData);
      if (r?.error) {
        Object.entries(r.error).forEach(([, messages]) => {
          messages?.forEach((m) => toast.error(m));
        });
        return;
      }
      toast.success("Added");
    }
    form.reset();
    onSuccess?.();
  }

  async function handleDelete() {
    if (!initial?.id) return;
    if (!confirm("Delete this bill?")) return;
    setDeleting(true);
    try {
      const r = await deleteBill(initial.id, monthKey);
      if (r?.success) {
        toast.success("Deleted");
        onSuccess?.();
      } else {
        toast.error("Failed to delete");
      }
    } finally {
      setDeleting(false);
    }
  }

  const busy = form.formState.isSubmitting || deleting;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} placeholder="Rent" />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" type="date" {...form.register("dueDate")} />
      </div>

      <div
        className={cn(
          "rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-3",
          "ring-1 ring-foreground/5"
        )}
      >
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Payment
        </p>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as "scheduled" | "pending" | "paid" | "skipped")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Due (not yet sent)</SelectItem>
                <SelectItem value="pending">Pending (sent, not cleared)</SelectItem>
                <SelectItem value="paid">Paid (cleared bank)</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plannedAmount">Amount due</Label>
            <Input
              id="plannedAmount"
              type="number"
              step="0.01"
              {...form.register("plannedAmount")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amountPaid">Amount paid</Label>
            <Input
              id="amountPaid"
              type="number"
              step="0.01"
              {...form.register("amountPaid")}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Pending = payment sent. Paid = cleared your bank. Set amounts to match how you track each
          bill.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentUrl">Payment URL</Label>
        <Input id="paymentUrl" type="url" {...form.register("paymentUrl")} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label>Assign to paycheck</Label>
        <Select
          value={form.watch("manualAssignment") ? form.watch("assignedGroupKey") ?? "" : "auto"}
          onValueChange={(v) => {
            if (v === "auto") {
              form.setValue("manualAssignment", false);
              form.setValue("assignedGroupKey", null);
              form.setValue("assignedIncomeEventId", null);
            } else {
              const w = windows.find((x) => x.key === v);
              form.setValue("manualAssignment", true);
              form.setValue("assignedGroupKey", v);
              form.setValue("assignedIncomeEventId", w?.incomeEventId ?? null);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Auto-assign" />
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...form.register("notes")} rows={2} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy}>
          {isEdit ? "Update" : "Add"} bill
        </Button>
        {isEdit && initial?.id ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={busy}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
              aria-label="More bill actions"
            >
              <MoreVertical className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem variant="destructive" disabled={deleting} onClick={handleDelete}>
                Delete bill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </form>
  );
}
