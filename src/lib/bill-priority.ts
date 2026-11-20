import { isActivelyFloated, isoDateOnly } from "./bill-utils";
import { daysUntilLedgerDate } from "./ledger-date-math";

export interface PriorityBill {
  id: number;
  status: string;
  dueDate: string | Date | null;
  floatTargetDate?: string | Date | null;
  ownerMonthKey: string;
}

/** Pending payments are already initiated, and floated bills are deferred intentionally. */
export function isOverdueActionBill(bill: PriorityBill, todayIso: string): boolean {
  if (bill.status !== "scheduled" || isActivelyFloated(bill, todayIso)) return false;
  const due = isoDateOnly(bill.dueDate);
  return !!due && (daysUntilLedgerDate(due, todayIso) ?? 0) < 0;
}

export function isPriorityCarryover(
  bill: PriorityBill, todayIso: string, viewingMonthKey: string
): boolean {
  return bill.ownerMonthKey < viewingMonthKey && isOverdueActionBill(bill, todayIso);
}

/**
 * In the daily work list:
 * 1 overdue carryovers, 2 current-month overdue, 3 due today,
 * 4 future bills, 5 initiated payments awaiting clearance.
 * Preserve due-date ordering within each group; never reorder database rows.
 */
export function orderNowBills<T extends PriorityBill>(
  bills: readonly T[], todayIso: string, viewingMonthKey: string
): T[] {
  function rank(bill: T): number {
    if (isPriorityCarryover(bill, todayIso, viewingMonthKey)) return 0;
    if (isOverdueActionBill(bill, todayIso)) return 1;
    if (bill.status === "pending") return 4;
    const due = isoDateOnly(bill.dueDate);
    return due && due === todayIso ? 2 : 3;
  }
  return [...bills].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff) return diff;
    const dateA = isoDateOnly(a.dueDate) ?? "9999-99-99";
    const dateB = isoDateOnly(b.dueDate) ?? "9999-99-99";
    return dateA.localeCompare(dateB) || a.id - b.id;
  });
}
