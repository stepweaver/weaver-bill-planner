"use client";

import { BillRow } from "./bill-row";
import type { CarryoverBill } from "@/features/months/actions";

export function CarryoverLedger({
  bills,
  viewMonthKey,
}: {
  bills: CarryoverBill[];
  viewMonthKey: string;
}) {
  if (bills.length === 0) return null;

  return (
    <section aria-label="Unresolved from prior months" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Unresolved from prior months</h2>
        <p className="text-sm text-muted-foreground">
          Still open from an earlier month. Updating one changes that original bill.
        </p>
      </div>
      <ul className="rounded border text-sm">
        {bills.map((bill) => (
          <BillRow
            key={bill.id}
            bill={bill}
            monthId={bill.ownerMonthId}
            monthKey={bill.ownerMonthKey}
            labelMonthKey={viewMonthKey}
            dueDateStyle="prior-month"
            showAssignment={false}
            windows={[]}
            as="list"
            anchor
          />
        ))}
      </ul>
    </section>
  );
}
