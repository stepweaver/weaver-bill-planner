"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { IncomeForm } from "./income-form";
import { useRouter } from "next/navigation";

export function AddIncomeButton({
  monthId,
  monthKey,
}: {
  monthId: number;
  monthKey: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80">
        Add income
      </SheetTrigger>
      <SheetContent className="overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>Add income</SheetTitle>
        </SheetHeader>
        <IncomeForm
          monthId={monthId}
          monthKey={monthKey}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
