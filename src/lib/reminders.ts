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

export type ReminderKind = "none" | "due" | "overdue" | "payday" | "resurface" | "combined";
export type ReminderSlot = "morning" | "afternoon" | "evening" | "night";

export interface ReminderPlan {
  todayIso: string;
  slot: ReminderSlot;
  shouldNotify: boolean;
  kind: ReminderKind;
  title: string;
  body: string;
  targetPath: string;
  dedupeKey: string;
  dueBillIds: number[];
  overdueBillIds: number[];
  resurfacedBillIds: number[];
  paydayNames: string[];
}

const TITLE = "λledger";

/**
 * Lock-screen copy. Counts choose the sentence. Names and amounts stay off the phone.
 * A payday notice asks the user to verify the deposit. It does not say the money arrived.
 */
function billCount(count: number): string {
  return `${count} ${count === 1 ? "bill" : "bills"}`;
}

/**
 * Give a clear, actionable nudge without including private bill names or amounts
 * on the lock screen. All actionable scheduled bills are checked again next slot.
 */
export function reminderMessage(input: {
  due: number;
  overdue: number;
  resurfaced: number;
  payday: boolean;
}): { kind: ReminderKind; title: string; body: string } {
  const attentionCount = input.due + input.overdue + input.resurfaced;
  if (input.payday && attentionCount > 0) {
    return {
      kind: "combined",
      title: TITLE,
      body: `A paycheck is scheduled today and ${billCount(attentionCount)} need attention. Verify the deposit, then pay or float bills in λledger.`,
    };
  }
  if (input.payday) {
    return {
      kind: "payday",
      title: TITLE,
      body: "A paycheck is scheduled today. Verify the deposit, then plan bills.",
    };
  }
  if (input.overdue > 0) {
    return {
      kind: "overdue",
      title: TITLE,
      body: `${billCount(input.overdue)} overdue. Open λledger to pay or float ${input.overdue === 1 ? "it" : "them"}.`,
    };
  }
  if (input.due > 0) {
    return {
      kind: "due",
      title: TITLE,
      body: `${billCount(input.due)} due today. Open λledger to pay or float ${input.due === 1 ? "it" : "them"}.`,
    };
  }
  if (input.resurfaced > 0) {
    return {
      kind: "resurface",
      title: TITLE,
      body: `${billCount(input.resurfaced)} ready again after floating. Open λledger to pay or float ${input.resurfaced === 1 ? "it" : "them"}.`,
    };
  }
  return { kind: "none", title: TITLE, body: "" };
}

export function notificationTargetPath(monthKey: string | null | undefined): string {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) return `/months/${monthKey}`;
  return "/months";
}

export function dailyDedupeKey(todayIso: string, slot: ReminderSlot = "morning"): string {
  return `daily:${todayIso}:${slot}`;
}

/**
 * The VPS runs at 9 AM, 1 PM, 5 PM and 8 PM Indianapolis time.
 * Each run has its own dedupe key so outstanding bills repeat until handled.
 */
export function reminderSlotForHour(hour: number): ReminderSlot {
  if (hour < 13) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
}

/**
 * One plan for the ledger day.
 * Due notifications require the original due date, a scheduled bill, and no active float.
 * A float that lands today resurfaces even when the original due date was earlier.
 */
export function evaluateReminders(input: {
  todayIso: string;
  slot?: ReminderSlot;
  paydayAcknowledged?: boolean;
  workspaceMonthKey: string | null;
  bills: readonly ReminderBill[];
  income: readonly ReminderIncome[];
}): ReminderPlan {
  const dueBillIds: number[] = [];
  const overdueBillIds: number[] = [];
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
    else if ((due && due < input.todayIso) || (target && target < input.todayIso)) overdueBillIds.push(bill.id);
  }

  const paydayNames: string[] = [];
  const seenIncome = new Set<number>();
  for (const event of input.income) {
    if (input.paydayAcknowledged) break;
    if (seenIncome.has(event.id)) continue;
    seenIncome.add(event.id);
    if (event.status !== "expected") continue;
    if (isoDateOnly(event.expectedDate) !== input.todayIso) continue;
    paydayNames.push(event.name?.trim() || "Payday");
  }

  const message = reminderMessage({
    due: dueBillIds.length,
    overdue: overdueBillIds.length,
    resurfaced: resurfacedBillIds.length,
    payday: paydayNames.length > 0,
  });
  const targetPath = safeCallbackPath(notificationTargetPath(input.workspaceMonthKey));

  return {
    todayIso: input.todayIso,
    slot: input.slot ?? "morning",
    shouldNotify: message.kind !== "none",
    kind: message.kind,
    title: message.title,
    body: message.body,
    targetPath,
    dedupeKey: dailyDedupeKey(input.todayIso, input.slot ?? "morning"),
    dueBillIds,
    overdueBillIds,
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
