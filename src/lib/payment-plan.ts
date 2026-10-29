import {
  getEffectivePlannedAmount,
  isActivelyFloated,
  isoDateOnly,
  type FloatState,
} from "@/lib/bill-utils";
import { centsToDollars, toCents } from "@/lib/money";

export interface PlanBill extends FloatState {
  id: number;
  name: string;
  dueDate: string | Date | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  ownerMonthKey?: string | null;
}

export interface PaydayEvent {
  name: string | null;
  expectedDate: string | Date;
  status: string;
}

export interface PlanLine {
  id: number;
  name: string;
  dueDate: string | null;
  amountCents: number;
  ownerMonthKey: string | null;
}

export interface PaydayChoice {
  date: string;
  name: string;
}

export interface PaymentPlan {
  todayIso: string;
  /** Next expected income on or after today. Bills due on this date belong to that paycheck. */
  nextIncomeDate: string | null;
  /** Next expected income strictly after today. Never invented. */
  nextPayday: PaydayChoice | null;
  hasFuturePayday: boolean;
  pending: PlanLine[];
  selectable: PlanLine[];
  /** Actionable scheduled bills due before the next income event. */
  defaultSelectedIds: number[];
  selectedIds: number[];
  pendingCents: number;
  selectedCents: number;
  /** Null when the bank balance has not been entered. */
  leftAfterSelectedCents: number | null;
  leftAfterSelected: number | null;
  floatedCount: number;
}

/**
 * Initiated amount still waiting to clear.
 * Uses the recorded amount when one was stored, otherwise the amount due.
 */
export function pendingObligationCents(bill: PlanBill): number {
  if (bill.status !== "pending") return 0;
  if (bill.amountPaid != null) return Math.max(0, toCents(bill.amountPaid));
  return Math.max(0, toCents(getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount)));
}

/** Remainder of a scheduled bill. Paid, skipped, pending, and active floats contribute nothing. */
export function selectableObligationCents(bill: PlanBill, todayIso: string): number {
  if (bill.status !== "scheduled") return 0;
  if (isActivelyFloated(bill, todayIso)) return 0;
  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  return Math.max(0, toCents(effective) - toCents(bill.amountPaid ?? 0));
}

export function nextIncomeDate(events: readonly PaydayEvent[], todayIso: string): string | null {
  let best: string | null = null;
  for (const event of events) {
    if (event.status === "received") continue;
    const date = isoDateOnly(event.expectedDate);
    if (!date || date < todayIso) continue;
    if (!best || date < best) best = date;
  }
  return best;
}

export function nextFuturePayday(
  events: readonly PaydayEvent[],
  todayIso: string
): PaydayChoice | null {
  let best: PaydayChoice | null = null;
  for (const event of events) {
    if (event.status === "received") continue;
    const date = isoDateOnly(event.expectedDate);
    if (!date || date <= todayIso) continue;
    if (!best || date < best.date) {
      best = { date, name: event.name?.trim() || "Payday" };
    }
  }
  return best;
}

function isSelectable(bill: PlanBill, todayIso: string): boolean {
  return bill.status === "scheduled" && !isActivelyFloated(bill, todayIso);
}

function isDefaultSelected(bill: PlanBill, todayIso: string, boundary: string | null): boolean {
  if (!isSelectable(bill, todayIso)) return false;
  const due = isoDateOnly(bill.dueDate);
  if (!due) return false;
  if (boundary) return due < boundary;
  return due <= todayIso;
}

function toLine(bill: PlanBill, amountCents: number): PlanLine {
  return {
    id: bill.id,
    name: bill.name,
    dueDate: isoDateOnly(bill.dueDate),
    amountCents,
    ownerMonthKey: bill.ownerMonthKey ?? null,
  };
}

function compareLines(a: PlanLine, b: PlanLine): number {
  const dateA = a.dueDate ?? "9999-99-99";
  const dateB = b.dueDate ?? "9999-99-99";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return a.id - b.id;
}

/**
 * Available balance, minus pending withdrawals that have not cleared,
 * minus the scheduled bills in the what-if selection.
 * Paid bills are already in the bank balance and are not subtracted again.
 */
export function buildPaymentPlan(input: {
  bills: readonly PlanBill[];
  paydayEvents: readonly PaydayEvent[];
  availableBalance: number | null;
  todayIso: string;
  /** Omit to use the default selection. An empty array selects nothing. */
  selectedIds?: readonly number[];
}): PaymentPlan {
  const todayIso = input.todayIso;
  const boundary = nextIncomeDate(input.paydayEvents, todayIso);
  const nextPayday = nextFuturePayday(input.paydayEvents, todayIso);
  const seen = new Set<number>();
  const pending: PlanLine[] = [];
  const selectable: PlanLine[] = [];
  const defaultSelectedIds: number[] = [];
  let floatedCount = 0;

  for (const bill of input.bills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (isActivelyFloated(bill, todayIso)) floatedCount += 1;
    if (bill.status === "pending") {
      pending.push(toLine(bill, pendingObligationCents(bill)));
      continue;
    }
    if (!isSelectable(bill, todayIso)) continue;
    selectable.push(toLine(bill, selectableObligationCents(bill, todayIso)));
    if (isDefaultSelected(bill, todayIso, boundary)) defaultSelectedIds.push(bill.id);
  }

  pending.sort(compareLines);
  selectable.sort(compareLines);
  defaultSelectedIds.sort((a, b) => a - b);

  const selectableIds = new Set(selectable.map((line) => line.id));
  const selectedIds = (input.selectedIds ?? defaultSelectedIds)
    .filter((id) => selectableIds.has(id))
    .filter((id, index, all) => all.indexOf(id) === index)
    .sort((a, b) => a - b);
  const selectedSet = new Set(selectedIds);

  const pendingCents = pending.reduce((sum, line) => sum + line.amountCents, 0);
  const selectedCents = selectable.reduce(
    (sum, line) => (selectedSet.has(line.id) ? sum + line.amountCents : sum),
    0
  );
  const leftAfterSelectedCents =
    input.availableBalance == null
      ? null
      : toCents(input.availableBalance) - pendingCents - selectedCents;

  return {
    todayIso,
    nextIncomeDate: boundary,
    nextPayday,
    hasFuturePayday: nextPayday != null,
    pending,
    selectable,
    defaultSelectedIds,
    selectedIds,
    pendingCents,
    selectedCents,
    leftAfterSelectedCents,
    leftAfterSelected:
      leftAfterSelectedCents == null ? null : centsToDollars(leftAfterSelectedCents),
    floatedCount,
  };
}
