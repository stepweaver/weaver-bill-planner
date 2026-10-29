import { isActivelyFloated, isoDateOnly } from "@/lib/bill-utils";
import { safeCallbackPath } from "@/lib/callback-path";

export interface ReminderBill {
  id: number;
  name: string;
  dueDate: string | Date | null;
  status: string;
  floatTargetDate?: string | Date | null;
  ownerMonthKey: string;
}

export interface ReminderIncome {
  id: number;
  name: string | null;
  expectedDate: string | Date;
  status: string;
}

export type ReminderKind = "none" | "due" | "payday" | "resurface" | "combined";

export interface ReminderPlan {
  todayIso: string;
  shouldNotify: boolean;
  kind: ReminderKind;
  title: string;
  body: string;
  targetPath: string;
  dedupeKey: string;
  dueBillIds: number[];
  resurfacedBillIds: number[];
  paydayNames: string[];
}

const TITLE = "λledger";

/**
 * Lock-screen copy. Counts choose the sentence. Names and amounts stay off the phone.
 * A payday notice asks the user to verify the deposit. It does not say the money arrived.
 */
export function reminderMessage(input: {
  due: boolean;
  resurfaced: boolean;
  payday: boolean;
}): { kind: ReminderKind; title: string; body: string } {
  const billsReady = input.due || input.resurfaced;
  if (input.payday && billsReady) {
    return {
      kind: "combined",
      title: TITLE,
      body: "A paycheck is scheduled today and bills are ready. Verify the deposit, then plan bills.",
    };
  }
  if (input.payday) {
    return {
      kind: "payday",
      title: TITLE,
      body: "A paycheck is scheduled today. Verify the deposit, then plan bills.",
    };
  }
  if (input.due) {
    return {
      kind: "due",
      title: TITLE,
      body: "Bills are due today. Open λledger to plan payments.",
    };
  }
  if (input.resurfaced) {
    return {
      kind: "resurface",
      title: TITLE,
      body: "A floated bill is ready to pay. Open λledger to plan it.",
    };
  }
  return { kind: "none", title: TITLE, body: "" };
}

export function notificationTargetPath(monthKey: string | null | undefined): string {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) return `/months/${monthKey}`;
  return "/months";
}

export function dailyDedupeKey(todayIso: string): string {
  return `daily:${todayIso}`;
}

/**
 * One plan for the ledger day.
 * Due notifications require the original due date, a scheduled bill, and no active float.
 * A float that lands today resurfaces even when the original due date was earlier.
 */
export function evaluateReminders(input: {
  todayIso: string;
  workspaceMonthKey: string | null;
  bills: readonly ReminderBill[];
  income: readonly ReminderIncome[];
}): ReminderPlan {
  const dueBillIds: number[] = [];
  const resurfacedBillIds: number[] = [];
  const seen = new Set<number>();

  for (const bill of input.bills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (bill.status !== "scheduled") continue;
    if (isActivelyFloated(bill, input.todayIso)) continue;
    const due = isoDateOnly(bill.dueDate);
    const target = isoDateOnly(bill.floatTargetDate ?? null);
    if (due === input.todayIso) {
      dueBillIds.push(bill.id);
      continue;
    }
    if (target === input.todayIso) resurfacedBillIds.push(bill.id);
  }

  const paydayNames: string[] = [];
  const seenIncome = new Set<number>();
  for (const event of input.income) {
    if (seenIncome.has(event.id)) continue;
    seenIncome.add(event.id);
    if (event.status !== "expected") continue;
    if (isoDateOnly(event.expectedDate) !== input.todayIso) continue;
    paydayNames.push(event.name?.trim() || "Payday");
  }

  const message = reminderMessage({
    due: dueBillIds.length > 0,
    resurfaced: resurfacedBillIds.length > 0,
    payday: paydayNames.length > 0,
  });
  const targetPath = safeCallbackPath(notificationTargetPath(input.workspaceMonthKey));

  return {
    todayIso: input.todayIso,
    shouldNotify: message.kind !== "none",
    kind: message.kind,
    title: message.title,
    body: message.body,
    targetPath,
    dedupeKey: dailyDedupeKey(input.todayIso),
    dueBillIds,
    resurfacedBillIds,
    paydayNames,
  };
}

export interface DeliveryRowState {
  status: string;
  attemptCount: number;
}

export const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * Whether this process may send.
 * `sending` is already claimed, so a second run skips it instead of sending twice.
 */
export function deliveryClaim(
  existing: DeliveryRowState | null,
  maxAttempts: number = MAX_DELIVERY_ATTEMPTS
): "insert" | "claim" | "skip" {
  if (!existing) return "insert";
  if (existing.status === "sent" || existing.status === "sending") return "skip";
  if (
    (existing.status === "pending" || existing.status === "failed") &&
    existing.attemptCount < maxAttempts
  ) {
    return "claim";
  }
  return "skip";
}

/** Gone endpoints are removed so the next run does not keep retrying them. */
export function isExpiredPushSubscription(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}
