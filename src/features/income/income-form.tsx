"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { incomeEventSchema, type IncomeEventFormData } from "@/lib/validations/income";
import { Button } from "@/components/ui/button";
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
import { createIncome, updateIncome } from "./actions";
import { toast } from "sonner";

type Props = {
  monthId?: number;
  monthKey: string;
  initial?: Partial<IncomeEventFormData> & { id?: number };
  onSuccess?: () => void;
};

export function IncomeForm({ monthId, monthKey, initial, onSuccess }: Props) {
  const isEdit = !!initial?.id;
  const form = useForm<IncomeEventFormData>({
    resolver: zodResolver(incomeEventSchema),
    defaultValues: {
      name: initial?.name ?? "",
      expectedDate: initial?.expectedDate ?? "",
      expectedAmount: initial?.expectedAmount ?? null,
      actualAmount: initial?.actualAmount ?? null,
      status: initial?.status ?? "expected",
      notes: initial?.notes ?? null,
    },
  });

  async function onSubmit(data: IncomeEventFormData) {
    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("expectedDate", data.expectedDate);
    formData.set("expectedAmount", data.expectedAmount != null ? String(data.expectedAmount) : "");
    formData.set("actualAmount", data.actualAmount != null ? String(data.actualAmount) : "");
    formData.set("status", data.status);
    formData.set("notes", data.notes ?? "");

    if (isEdit && initial?.id) {
      const r = await updateIncome(initial.id, monthKey, formData);
      if (r?.error) {
        Object.entries(r.error).forEach(([, messages]) => {
          messages?.forEach((m) => toast.error(m));
        });
        return;
      }
      toast.success("Updated");
    } else if (monthId) {
      const r = await createIncome(monthId, monthKey, formData);
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} placeholder="Paycheck" />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="expectedDate">Expected date</Label>
        <Input id="expectedDate" type="date" {...form.register("expectedDate")} />
        {form.formState.errors.expectedDate && (
          <p className="text-sm text-destructive">{form.formState.errors.expectedDate.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="expectedAmount">Expected amount</Label>
        <Input id="expectedAmount" type="number" step="0.01" {...form.register("expectedAmount")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="actualAmount">Actual amount</Label>
        <Input id="actualAmount" type="number" step="0.01" {...form.register("actualAmount")} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.watch("status")}
          onValueChange={(v) => form.setValue("status", v as "expected" | "received")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expected">Expected</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Comment (optional)</Label>
        <Textarea id="notes" {...form.register("notes")} rows={2} />
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {isEdit ? "Update" : "Add"} income
      </Button>
    </form>
  );
}
