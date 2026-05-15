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
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80">
        Add bill
      </SheetTrigger>
      <SheetContent className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
          <SheetTitle>Add bill</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col px-6">
        <BillForm
          monthId={monthId}
          monthKey={monthKey}
          windows={windows}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
        </div>
      </SheetContent>
    </Sheet>
  );
}
