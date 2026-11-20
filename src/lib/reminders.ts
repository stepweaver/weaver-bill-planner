import { getEffectivePlannedAmount, isActivelyFloated, isoDateOnly } from "@/lib/bill-utils";
import { daysUntilLedgerDate } from "@/lib/ledger-date-math";
import { safeCallbackPath } from "@/lib/callback-path";

export interface ReminderBill {
  id: number;
  name: string;
  dueDate: string | Date | null;
  status: string;
  floatTargetDate?: string | Date | null;
  ownerMonthKey: string;
  plannedAmount?: number | null;
  invoiceAmount?: number | null;
  amountPaid?: number | null;
}

export interface ReminderIncome {
  id: number;
  name: string | null;
  expectedDate: string | Date;
  status: string;
}

export type ReminderKind = "none" | "upcoming" | "due" | "overdue" | "payday" | "resurface" | "combined";
export type ReminderSlot = "morning" | "afternoon" | "evening";

export interface ReminderPlan {
  todayIso: string;
  slot: ReminderSlot;
  shouldNotify: boolean;
  kind: ReminderKind;
  title: string;
  body: string;
  targetPath: string;
  dedupeKey: string;
  upcomingBillIds: number[];
  dueBillIds: number[];
  overdueBillIds: number[];
  overdueCarryoverBillIds: number[];
  resurfacedBillIds: number[];
  paydayNames: string[];
}

const TITLE = "λledger";
export const UPCOMING_REMINDER_DAYS = 2;

/** Discreet lock-screen language: no bill names, dollar amounts or account data. */
export function reminderMessage(input: {
  upcoming?: boolean;
  due: boolean;
  overdue: boolean;
  overdueCarryover?: boolean;
  resurfaced: boolean;
  payday: boolean;
}): { kind: ReminderKind; title: string; body: string } {
  const needsAttention = !!input.upcoming || input.due || input.overdue || input.resurfaced;
  if (input.payday && input.overdueCarryover) {
    return {
      kind: "combined",
      title: TITLE,
      body: "A paycheck is scheduled today, and overdue carryover bills need attention first. Verify the deposit and plan payments.",
    };
  }
  if (input.payday && needsAttention) {
    return {
      kind: "combined",
      title: TITLE,
      body: input.due || input.overdue || input.resurfaced
        ? "A paycheck is scheduled today and bills are ready. Verify the deposit, then plan bills."
        : "A paycheck is scheduled today. Verify the deposit and plan bills due soon.",
    };
  }
  if (input.payday) {
    return {
      kind: "payday",
      title: TITLE,
      body: "A paycheck is scheduled today. Verify the deposit, then plan bills.",
    };
  }
  if (input.overdueCarryover) {
    return {
      kind: "overdue",
      title: TITLE,
      body: "Overdue bills carried from an earlier month need attention first. Open λledger to handle them.",
    };
  }
  if (input.overdue) {
    return { kind: "overdue", title: TITLE, body: "Bills are overdue. Open λledger to pay or float them." };
  }
  if (input.due) {
    return { kind: "due", title: TITLE, body: "Bills are due today. Open λledger to plan payments." };
  }
  if (input.resurfaced) {
    return { kind: "resurface", title: TITLE, body: "A floated bill is ready to pay. Open λledger to plan it." };
  }
  if (input.upcoming) {
    return {
      kind: "upcoming",
      title: TITLE,
      body: "Bills are due within two days. Open λledger to plan ahead.",
    };
  }
  return { kind: "none", title: TITLE, body: "" };
}

export function notificationTargetPath(monthKey: string | null | undefined): string {
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) return "/months/" + monthKey;
  return "/months";
}

export function dailyDedupeKey(todayIso: string, slot: ReminderSlot = "morning"): string {
  return "daily:" + todayIso + ":" + slot;
}

export function reminderSlotForHour(hour: number): ReminderSlot {
  return hour < 13 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/** No push when a missed systemd timer is caught up overnight. */
export function isReminderQuietHour(hour: number): boolean {
  return !Number.isFinite(hour) || hour < 8 || hour >= 21;
}

/**
 * Morning: upcoming, due, overdue, float returns and unacknowledged payday.
 * Afternoon: unacknowledged payday follow-up only.
 * Evening: unresolved due/overdue/float return follow-up only.
 *
 * A handled bill drops out on the next run. Pending means sent, not cleared;
 * it is excluded from additional bill reminders.
 */
export function evaluateReminders(input: {
  todayIso: string;
  slot?: ReminderSlot;
  paydayAcknowledged?: boolean;
  workspaceMonthKey: string | null;
  bills: readonly ReminderBill[];
  income: readonly ReminderIncome[];
}): ReminderPlan {
  const slot = input.slot ?? "morning";
  const upcomingBillIds: number[] = [];
  const dueBillIds: number[] = [];
  const overdueBillIds: number[] = [];
  const overdueCarryoverBillIds: number[] = [];
  const resurfacedBillIds: number[] = [];
  const seen = new Set<number>();

  for (const bill of input.bills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (bill.status !== "scheduled" || isActivelyFloated(bill, input.todayIso)) continue;

    // A scheduled bill may already have a fully recorded payment. Do not nag
    // about it; only treat positive, known balances as covered.
    const total = getEffectivePlannedAmount(bill.plannedAmount ?? null, bill.invoiceAmount ?? null);
    if (total > 0 && bill.amountPaid != null && bill.amountPaid >= total) continue;

    const due = isoDateOnly(bill.dueDate);
    const target = isoDateOnly(bill.floatTargetDate ?? null);
    const daysUntilDue = due ? daysUntilLedgerDate(due, input.todayIso) : null;

    if (daysUntilDue === 0) {
      dueBillIds.push(bill.id);
      continue;
    }
    // A float whose planning hold ends today gets the more helpful "ready" copy.
    if (target === input.todayIso) {
      resurfacedBillIds.push(bill.id);
      continue;
    }
    if ((daysUntilDue != null && daysUntilDue < 0) || (target && target < input.todayIso)) {
      overdueBillIds.push(bill.id);
      if (bill.ownerMonthKey < input.todayIso.slice(0, 7)) overdueCarryoverBillIds.push(bill.id);
      continue;
    }
    if (daysUntilDue != null && daysUntilDue > 0 && daysUntilDue <= UPCOMING_REMINDER_DAYS) {
      upcomingBillIds.push(bill.id);
    }
  }

  const paydayNames: string[] = [];
  const seenIncome = new Set<number>();
  if (!input.paydayAcknowledged) {
    for (const event of input.income) {
      if (seenIncome.has(event.id)) continue;
      seenIncome.add(event.id);
      if (event.status !== "expected" || isoDateOnly(event.expectedDate) !== input.todayIso) continue;
      paydayNames.push(event.name?.trim() || "Payday");
    }
  }

  const message = reminderMessage({
    upcoming: slot === "morning" && upcomingBillIds.length > 0,
    due: slot !== "afternoon" && dueBillIds.length > 0,
    overdue: slot !== "afternoon" && overdueBillIds.length > 0,
    overdueCarryover: slot !== "afternoon" && overdueCarryoverBillIds.length > 0,
    resurfaced: slot !== "afternoon" && resurfacedBillIds.length > 0,
    payday: slot !== "evening" && paydayNames.length > 0,
  });
  return {
    todayIso: input.todayIso,
    slot,
    shouldNotify: message.kind !== "none",
    kind: message.kind,
    title: message.title,
    body: message.body,
    targetPath: safeCallbackPath(notificationTargetPath(input.workspaceMonthKey)),
    dedupeKey: dailyDedupeKey(input.todayIso, slot),
    upcomingBillIds,
    dueBillIds,
    overdueBillIds,
    overdueCarryoverBillIds,
    resurfacedBillIds,
    paydayNames,
  };
}

export interface DeliveryRowState {
  status: string;
  attemptCount: number;
}

export const MAX_DELIVERY_ATTEMPTS = 3;
export const STALE_SENDING_MINUTES = 30;

/**
 * A process that crashes after claiming a delivery must not block all future
 * attempts. Only a stale sending claim may be reclaimed; the database claim
 * itself must still be atomic. A crash after acceptance by a push provider
 * can result in a duplicate, because Web Push has no exactly-once receipt.
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
  ) return "claim";
  return "skip";
}

export function isExpiredPushSubscription(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}
