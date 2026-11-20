import {
  getEffectivePlannedAmount,
  isActivelyFloated,
  isoDateOnly,
  type FloatState,
} from "@/lib/bill-utils";
import { toCents } from "@/lib/money";
import { nextFuturePayday, type PaydayEvent } from "@/lib/payment-plan";
import { outstandingBillAmount, type BillForPlanning } from "@/lib/paycheck-snapshot";
import { buildPaycheckGroups } from "@/lib/paycheck-windows";

export type LedgerView = "now" | "plan" | "history";

/** Missing or unknown values open the daily dashboard on the current month. */
export function resolveLedgerView(
  raw: string | null | undefined,
  operational: boolean
): LedgerView {
  if (raw === "now" || raw === "plan" || raw === "history") return raw;
  return operational ? "now" : "history";
}

export interface DashboardBillState extends FloatState {
  id: number;
  dueDate: string | Date | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
}

/**
 * Paid, skipped, or a scheduled bill whose recorded payment already covers a real amount.
 * Pending has not cleared. A bill with no amount yet stays open so it can be filled in.
 */
export function isSettledRecord(bill: DashboardBillState): boolean {
  if (bill.status === "paid" || bill.status === "skipped") return true;
  if (bill.status === "pending") return false;
  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  if (effective <= 0) return false;
  return outstandingBillAmount(bill) === 0;
}

/** Scheduled bills still to decide, plus payments already sent. Floats are held out. */
export function isNowActionBill(bill: DashboardBillState, todayIso: string): boolean {
  if (isSettledRecord(bill)) return false;
  if (bill.status === "pending") return true;
  if (bill.status !== "scheduled") return false;
  return !isActivelyFloated(bill, todayIso);
}

export function splitBillsForViews<T extends DashboardBillState>(
  bills: readonly T[],
  todayIso: string
): { now: T[]; floated: T[]; history: T[] } {
  const now: T[] = [];
  const floated: T[] = [];
  const history: T[] = [];
  const seen = new Set<number>();
  for (const bill of bills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (isSettledRecord(bill)) {
      history.push(bill);
      continue;
    }
    if (isActivelyFloated(bill, todayIso)) {
      floated.push(bill);
      continue;
    }
    if (isNowActionBill(bill, todayIso)) now.push(bill);
  }
  return { now, floated, history };
}

export function obligationCents(bill: BillForPlanning): number {
  return Math.max(0, toCents(outstandingBillAmount(bill)));
}

export function sumObligationCents(bills: readonly BillForPlanning[]): number {
  return bills.reduce((sum, bill) => sum + obligationCents(bill), 0);
}

export interface PaycheckPeriodDef {
  incomeEventId: number;
  preKey: string | null;
  incomeKey: string | null;
  label: string;
}

export function paycheckPeriodDefs(
  windows: readonly { key: string; incomeEventId: number | null; label: string }[]
): PaycheckPeriodDef[] {
  const defs: PaycheckPeriodDef[] = [];
  for (const window of windows) {
    if (window.incomeEventId == null) continue;
    let def = defs.find((item) => item.incomeEventId === window.incomeEventId);
    if (!def) {
      def = {
        incomeEventId: window.incomeEventId,
        preKey: null,
        incomeKey: null,
        label: window.label,
      };
      defs.push(def);
    }
    if (window.key.startsWith("pre-")) def.preKey = window.key;
    if (window.key.startsWith("income-")) {
      def.incomeKey = window.key;
      def.label = window.label;
    }
  }
  return defs;
}

export interface PlanPeriod<T> {
  incomeEventId: number;
  label: string;
  before: T[];
  covered: T[];
  commitmentCents: number;
}

/**
 * One paycheck period. Floated bills are listed once, on their own.
 * Paid bills are omitted. A bill is not placed in two periods.
 */
export function groupPlanBills<
  T extends DashboardBillState & { displayWindowKey: string | null },
>(
  bills: readonly T[],
  periods: readonly PaycheckPeriodDef[],
  todayIso: string
): { periods: PlanPeriod<T>[]; floated: T[]; unassigned: T[] } {
  const floated: T[] = [];
  const open: T[] = [];
  const seen = new Set<number>();
  for (const bill of bills) {
    if (seen.has(bill.id)) continue;
    seen.add(bill.id);
    if (isSettledRecord(bill)) continue;
    if (isActivelyFloated(bill, todayIso)) {
      floated.push(bill);
      continue;
    }
    open.push(bill);
  }

  const used = new Set<number>();
  const grouped = periods.map((period) => {
    const before = open.filter((bill) => period.preKey != null && bill.displayWindowKey === period.preKey);
    const covered = open.filter(
      (bill) => period.incomeKey != null && bill.displayWindowKey === period.incomeKey
    );
    for (const bill of [...before, ...covered]) used.add(bill.id);
    return {
      incomeEventId: period.incomeEventId,
      label: period.label,
      before,
      covered,
      commitmentCents: sumObligationCents([...before, ...covered]),
    };
  });

  return {
    periods: grouped,
    floated,
    unassigned: open.filter((bill) => !used.has(bill.id)),
  };
}

export interface IncomeMoneyEvent {
  id: number;
  name?: string | null;
  expectedDate: string | Date;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
}

export interface PaycheckGroupMoney {
  scheduledCents: number | null;
  /** Recorded actuals only. Unreceived scheduled amounts stay out of this figure. */
  receivedCents: number | null;
  stillScheduledCents: number;
  memberIds: number[];
}

/**
 * Income for one paycheck group, using the same two-day grouping as paycheck windows.
 * An actual or received amount replaces that event's scheduled amount. It is not added to it.
 */
export function paycheckGroupMoney(
  events: readonly IncomeMoneyEvent[],
  anchorId: number
): PaycheckGroupMoney {
  const dated = events.flatMap((event) => {
    const date = isoDateOnly(event.expectedDate);
    if (!date) return [];
    return [{ event, date }];
  });
  const groups = buildPaycheckGroups(
    dated.map((row) => ({
      id: row.event.id,
      expectedDate: row.date,
      name: row.event.name,
    }))
  );
  const group = groups.find((item) => item.events.some((event) => event.id === anchorId));
  const memberIds = new Set(group ? group.events.map((event) => event.id) : [anchorId]);
  const members = events.filter((event) => memberIds.has(event.id));

  let scheduledCents = 0;
  let scheduledKnown = false;
  let receivedCents = 0;
  let receivedKnown = false;
  let stillScheduledCents = 0;
  for (const event of members) {
    if (event.expectedAmount != null) {
      scheduledKnown = true;
      scheduledCents += toCents(event.expectedAmount);
    }
    const recorded = event.status === "received" || event.actualAmount != null;
    if (recorded) {
      receivedKnown = true;
      receivedCents += toCents(event.actualAmount ?? 0);
    } else if (event.expectedAmount != null) {
      stillScheduledCents += toCents(event.expectedAmount);
    }
  }

  return {
    scheduledCents: scheduledKnown ? scheduledCents : null,
    receivedCents: receivedKnown ? receivedCents : null,
    stillScheduledCents,
    memberIds: [...memberIds],
  };
}

export function projectGroupRemainder(
  money: Pick<PaycheckGroupMoney, "receivedCents" | "stillScheduledCents">,
  commitmentCents: number
): { remainderCents: number | null; basis: "received" | "scheduled" | "none" } {
  const hasReceived = money.receivedCents != null;
  const hasScheduled = money.stillScheduledCents > 0;
  if (!hasReceived && !hasScheduled) return { remainderCents: null, basis: "none" };
  const received = money.receivedCents ?? 0;
  if (hasScheduled) {
    return {
      remainderCents: received + money.stillScheduledCents - commitmentCents,
      basis: "scheduled",
    };
  }
  return { remainderCents: received - commitmentCents, basis: "received" };
}

export interface NextPaydayCard {
  date: string;
  name: string;
  /** Scheduled amount of the unreceived events on that date. Not cash on hand. */
  scheduledCents: number | null;
}

export function nextPaydayCard(
  events: readonly (PaydayEvent & { expectedAmount?: number | null })[],
  todayIso: string
): NextPaydayCard | null {
  const next = nextFuturePayday(events, todayIso);
  if (!next) return null;
  const sameDay = events.filter(
    (event) => event.status !== "received" && isoDateOnly(event.expectedDate) === next.date
  );
  const amounts = sameDay
    .map((event) => event.expectedAmount)
    .filter((amount): amount is number => amount != null);
  return {
    date: next.date,
    name: next.name,
    scheduledCents: amounts.length > 0 ? amounts.reduce((sum, amount) => sum + toCents(amount), 0) : null,
  };
}
