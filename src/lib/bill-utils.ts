import { ledgerTodayIso } from "@/lib/ledger-time";

export function getEffectivePlannedAmount(
  plannedAmount: number | null,
  invoiceAmount: number | null
): number {
  if (invoiceAmount != null && invoiceAmount > 0) return invoiceAmount;
  return plannedAmount ?? 0;
}

export function coerceAmount(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pending and paid bills with no amount paid yet take the effective amount due.
 * A non-null amountPaid is kept, including zero. Other statuses are unchanged.
 */
export function resolveAmountPaidForStatus(
  status: string,
  amountPaid: number | null,
  plannedAmount: number | null,
  invoiceAmount: number | null
): number | null {
  if (status !== "pending" && status !== "paid") return amountPaid;
  if (amountPaid != null) return amountPaid;
  return getEffectivePlannedAmount(plannedAmount, invoiceAmount);
}

/**
 * Cleared only. Pending stays pending even when amountPaid already matches the invoice:
 * that amount was sent, not settled. Skipped is not paid.
 * A scheduled bill can still count as covered when a recorded payment meets the amount.
 */
export function isBillPaid(
  status: string,
  amountPaid: number | null,
  effectivePlanned: number
): boolean {
  if (status === "paid") return true;
  if (status === "pending" || status === "skipped") return false;
  if (amountPaid != null && amountPaid >= effectivePlanned) return true;
  return false;
}

export function isoDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 10);
}

export interface FloatState {
  status: string;
  floatTargetDate?: string | Date | null;
}

/**
 * Scheduled bill waiting for a future target date.
 * The target day itself is no longer floated: the bill is back in the plan.
 * Pending, paid, and skipped are never floated, even if a target date is still stored.
 */
export function isActivelyFloated(bill: FloatState, todayIso: string): boolean {
  if (bill.status !== "scheduled") return false;
  const target = isoDateOnly(bill.floatTargetDate);
  if (!target) return false;
  return target > todayIso;
}

/** Pending and paid end an active float. The original due date is not part of this change. */
export function clearsActiveFloat(status: string): boolean {
  return status === "pending" || status === "paid";
}

export function isBillOverdue(
  dueDate: string | null,
  status: string,
  amountPaid: number | null,
  effectivePlanned: number,
  todayIso: string = ledgerTodayIso()
): boolean {
  if (!dueDate) return false;
  if (status === "pending" || status === "paid" || status === "skipped") return false;
  if (isBillPaid(status, amountPaid, effectivePlanned)) return false;
  const due = isoDateOnly(dueDate);
  if (!due) return false;
  return due < todayIso;
}

export type BillDisplayGroup = "overdue" | "upcoming" | "floated" | "pending" | "settled";

const DISPLAY_GROUP_RANK: Record<BillDisplayGroup, number> = {
  overdue: 0,
  upcoming: 1,
  floated: 2,
  pending: 3,
  settled: 4,
};

export interface BillForOrder extends FloatState {
  id: number;
  dueDate: string | Date | null;
}

/** Overdue includes due today. Floated uses the original due date only as a sort key. */
export function billDisplayGroup(bill: BillForOrder, todayIso: string): BillDisplayGroup {
  if (bill.status === "paid" || bill.status === "skipped") return "settled";
  if (bill.status === "pending") return "pending";
  if (isActivelyFloated(bill, todayIso)) return "floated";
  const due = isoDateOnly(bill.dueDate);
  if (due && due <= todayIso) return "overdue";
  return "upcoming";
}

export function compareBillsForPlan(a: BillForOrder, b: BillForOrder, todayIso: string): number {
  const rankA = DISPLAY_GROUP_RANK[billDisplayGroup(a, todayIso)];
  const rankB = DISPLAY_GROUP_RANK[billDisplayGroup(b, todayIso)];
  if (rankA !== rankB) return rankA - rankB;
  const dateA = isoDateOnly(a.dueDate) ?? "9999-99-99";
  const dateB = isoDateOnly(b.dueDate) ?? "9999-99-99";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return a.id - b.id;
}

export function orderBillsForPlan<T extends BillForOrder>(bills: readonly T[], todayIso: string): T[] {
  return [...bills].sort((a, b) => compareBillsForPlan(a, b, todayIso));
}

export const BILL_GROUP_LABEL: Record<BillDisplayGroup, string> = {
  overdue: "Overdue and due today",
  upcoming: "Upcoming",
  floated: "Floated",
  pending: "Pending",
  settled: "Paid and skipped",
};

/** Same bill records, once each. Carryover rows are not copied into the viewed month. */
export function mergeBillRecords<T extends { id: number }>(
  monthBills: readonly T[],
  carryoverBills: readonly T[]
): T[] {
  const seen = new Set<number>();
  const merged: T[] = [];
  for (const bill of monthBills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    merged.push(bill);
  }
  for (const bill of carryoverBills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    merged.push(bill);
  }
  return merged;
}
