"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BillForm, billEditorHeaderClassName, billEditorHeaderStyle, billEditorSheetClassName } from "./bill-form";
import { useRouter } from "next/navigation";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

export function AddBillButton({
  monthId,
  monthKey,
  windows,
}: {
  monthId: number;
  monthKey: string;
  windows: PaycheckWindow[];
}) {
  const [open, setOpen] = useState(false);
  const [recurring, setRecurring] = useState(true);
  const router = useRouter();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRecurring(true);
      }}
    >
      <SheetTrigger className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">
        Add
      </SheetTrigger>
      <SheetContent layout="drawer" className={billEditorSheetClassName}>
        <SheetHeader className={billEditorHeaderClassName} style={billEditorHeaderStyle}>
          <SheetTitle>{recurring ? "Add bill" : "Add expense"}</SheetTitle>
        </SheetHeader>
        <BillForm
          monthId={monthId}
          monthKey={monthKey}
          windows={windows}
          onKindChange={setRecurring}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
