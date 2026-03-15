"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { billTemplateSchema, type BillTemplateFormData } from "@/lib/validations/template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplate, updateTemplate } from "./actions";
import { toast } from "sonner";

type Props = {
  initial?: Partial<BillTemplateFormData> & { id?: number };
  onSuccess?: () => void;
};

export function TemplateForm({ initial, onSuccess }: Props) {
  const isEdit = !!initial?.id;
  const form = useForm<BillTemplateFormData>({
    resolver: zodResolver(billTemplateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      defaultDueDay: initial?.defaultDueDay ?? null,
      dueWeekdays: initial?.dueWeekdays ?? null,
      defaultPlannedAmount: initial?.defaultPlannedAmount ?? null,
      defaultPaymentUrl: initial?.defaultPaymentUrl ?? null,
      active: initial?.active ?? true,
    },
  });

  async function onSubmit(data: BillTemplateFormData) {
    const formData = new FormData();
    formData.set("name", data.name);
    formData.set("defaultDueDay", data.defaultDueDay != null ? String(data.defaultDueDay) : "");
    formData.set("dueWeekdays", data.dueWeekdays ?? "");
    formData.set("defaultPlannedAmount", data.defaultPlannedAmount != null ? String(data.defaultPlannedAmount) : "");
    formData.set("defaultPaymentUrl", data.defaultPaymentUrl ?? "");
    formData.set("active", data.active ? "on" : "");

    if (isEdit && initial?.id) {
      const r = await updateTemplate(initial.id, formData);
      if (r?.error) {
        if (typeof r.error === "string") toast.error(r.error);
        else Object.entries(r.error).forEach(([, messages]) => messages?.forEach((m) => toast.error(m)));
        return;
      }
      toast.success("Updated");
    } else {
      const r = await createTemplate(formData);
      if (r?.error) {
        if (typeof r.error === "string") toast.error(r.error);
        else Object.entries(r.error).forEach(([, messages]) => messages?.forEach((m) => toast.error(m)));
        return;
      }
      toast.success("Created");
    }
    form.reset();
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pr-6 pb-6 pt-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} placeholder="Rent" />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultDueDay">Due day (optional)</Label>
        <Input
          id="defaultDueDay"
          type="number"
          min={1}
          max={31}
          placeholder="e.g. 1 or 15 — leave blank for variable schedules"
          {...form.register("defaultDueDay")}
        />
        <p className="text-xs text-muted-foreground">
          Day of month (1–31). Leave blank for bills with variable due dates. When set, new months get one bill on that day.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Due weekdays (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Or pick days of the week (e.g. every Wed & Fri). Creating a month will add one bill per occurrence—e.g. 4 Wednesdays in March → 4 items.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {[
            { d: 0, label: "Sun" },
            { d: 1, label: "Mon" },
            { d: 2, label: "Tue" },
            { d: 3, label: "Wed" },
            { d: 4, label: "Thu" },
            { d: 5, label: "Fri" },
            { d: 6, label: "Sat" },
          ].map(({ d, label }) => {
            const dueWeekdays = (form.watch("dueWeekdays") ?? "").split(",").filter(Boolean).map(Number);
            const checked = dueWeekdays.includes(d);
            return (
              <label key={d} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? dueWeekdays.filter((x) => x !== d).sort((a, b) => a - b)
                      : [...dueWeekdays, d].sort((a, b) => a - b);
                    form.setValue("dueWeekdays", next.length ? next.join(",") : "");
                  }}
                  className="rounded"
                />
                <span className="text-sm">{label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultPlannedAmount">Default planned amount</Label>
        <Input id="defaultPlannedAmount" type="number" step="0.01" {...form.register("defaultPlannedAmount")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultPaymentUrl">Default payment URL</Label>
        <Input id="defaultPaymentUrl" type="url" {...form.register("defaultPaymentUrl")} placeholder="https://..." />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={form.watch("active")}
          onChange={(e) => form.setValue("active", e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="active">Active</Label>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {isEdit ? "Update" : "Create"} template
      </Button>
    </form>
  );
}
