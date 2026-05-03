import { getEffectivePlannedAmount, isBillPaid } from "@/lib/bill-utils";

export const BILL_FILTER_UNASSIGNED = "__unassigned__";

export type BillStatusFilter = "all" | "scheduled" | "pending" | "paid" | "skipped";

type BillInstanceBase = {
  status: string;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
};

export function filterBillsByStatus<T extends BillInstanceBase>(
  bills: T[],
  filter: BillStatusFilter
): T[] {
  if (filter === "all") return bills;
  if (filter === "paid") {
    return bills.filter((b) => {
      const eff = getEffectivePlannedAmount(b.plannedAmount, b.invoiceAmount);
      return isBillPaid(b.status, b.amountPaid, eff);
    });
  }
  return bills.filter((b) => b.status === filter);
}

export function filterBillsByWindowKey<T extends { displayWindowKey: string | null }>(
  bills: T[],
  windowFilterKey: string | null
): T[] {
  if (windowFilterKey == null) return bills;
  if (windowFilterKey === BILL_FILTER_UNASSIGNED) {
    return bills.filter((b) => b.displayWindowKey == null);
  }
  return bills.filter((b) => b.displayWindowKey === windowFilterKey);
}
