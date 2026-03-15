"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TemplateForm } from "./template-form";
import { deleteTemplate } from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDueWeekdays(csv: string | null): string {
  if (!csv?.trim()) return "";
  const nums = csv.split(",").map((x) => Number(x.trim())).filter((n) => n >= 0 && n <= 6);
  return nums.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

type Template = {
  id: number;
  name: string;
  defaultDueDay: number | null;
  dueWeekdays: string | null;
  defaultPlannedAmount: number | null;
  defaultPaymentUrl: string | null;
  active: boolean | null;
};

export function TemplateList({ templates }: { templates: Template[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  function formatMoney(n: number | null) {
    if (n == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
  }

  return (
    <div className="space-y-3">
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetTrigger className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
          Add template
        </SheetTrigger>
        <SheetContent className="overflow-y-auto px-6">
          <SheetHeader>
            <SheetTitle>Add bill template</SheetTitle>
          </SheetHeader>
          <TemplateForm
            onSuccess={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
        </SheetContent>
      </Sheet>
      <div className="min-w-0 rounded border border-border">
        {templates.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No templates yet. Add one to pre-fill bills when creating a new month.
          </p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {templates.map((t) => (
              <li key={t.id} className="py-2.5 px-3">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <Badge variant={t.active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {t.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                  {t.dueWeekdays?.trim() ? (
                    <span>Due weekdays: {formatDueWeekdays(t.dueWeekdays)}</span>
                  ) : (
                    <span>Due day: {t.defaultDueDay != null ? t.defaultDueDay : "—"}</span>
                  )}
                  <span className="tabular-nums">Default: {formatMoney(t.defaultPlannedAmount)}</span>
                  <span className="flex items-center gap-1.5 ml-auto">
                    <TemplateEditSheet template={t} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[11px] text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (!confirm("Delete this template?")) return;
                        const r = await deleteTemplate(t.id);
                        if (r?.success) {
                          toast.success("Deleted");
                          router.refresh();
                        } else toast.error("Failed to delete");
                      }}
                    >
                      Del
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TemplateEditSheet({ template }: { template: Template }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-6 shrink-0 items-center justify-center rounded px-2 text-[11px] font-medium hover:bg-muted">
        Edit
      </SheetTrigger>
      <SheetContent className="overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>Edit template</SheetTitle>
        </SheetHeader>
        <TemplateForm
          initial={{
            id: template.id,
            name: template.name,
            defaultDueDay: template.defaultDueDay,
            dueWeekdays: template.dueWeekdays,
            defaultPlannedAmount: template.defaultPlannedAmount,
            defaultPaymentUrl: template.defaultPaymentUrl,
            active: template.active ?? true,
          }}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
