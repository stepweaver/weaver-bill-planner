import { format, startOfDay } from "date-fns";
import { getEffectivePlannedAmount, isBillPaid } from "@/lib/bill-utils";
import { centsToDollars, toCents } from "@/lib/money";
import { buildPaycheckGroups } from "@/lib/paycheck-windows";

/**
 * Planning snapshot for the current month.
 *
 * The figure that matters is the typed bank balance minus every bill that is
 * still due (scheduled) or pending. A positive result covers those bills. A
 * negative result is the shortfall: something has to wait for the next pay period.
 *
 * Pending uses the amount already sent. Due uses the remainder still unpaid.
 * Paid and skipped bills are out. Carryover bills stay owned by their original
 * month and join this total on the current month, because they still have to
 * be paid from today's balance.
 */

export interface IncomeForPlanning {
  id: number;
  name: string | null;
  expectedDate: string | Date;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
}

export interface BillForPlanning {
  id: number;
  name: string;
  dueDate: string | Date | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  status: string;
}

export interface PlanningBillLine {
  id: number;
  name: string;
  dueDate: string | null;
  amount: number;
  /** Present on still-to-cover lines. */
  status?: "scheduled" | "pending";
}

export interface NextIncomeSnapshot {
  names: string[];
  /** Earliest still-expected event date in the group (what the NEXT line shows). */
  date: string;
  /**
   * First date of the paycheck group. Bills due on this date belong to this
   * paycheck and are excluded from needs-funding.
   */
  boundaryDate: string;
  expectedAmount: number;
}

export interface MonthPlanningView {
  nextIncome: NextIncomeSnapshot | null;
  needsFunding: PlanningBillLine[];
  needsFundingTotal: number;
  pendingClearance: PlanningBillLine[];
  pendingClearanceTotal: number;
  /**
   * Due and pending bills still to pay from today's balance, including carryover.
   */
  stillToCover: PlanningBillLine[];
  stillToCoverTotal: number;
  /**
   * Typed bank balance minus `stillToCoverTotal`.
   * Null when no available balance has been entered.
   * Zero and negative values are real results. Negative means short.
   */
  leftAfterBills: number | null;
  /**
   * Typed bank balance minus pending payments.
   * Null when no available balance has been entered.
   * Zero and negative values are real results.
   */
  availableAfterPending: number | null;
  /**
   * Null when no available balance has been entered, or this month has no
   * upcoming income group. Zero and negative values are real results.
   */
  safeUntilNextIncome: number | null;
  incomeStillExpected: number;
  billsStillOutstanding: number;
  recognizedIncome: number;
  knownObligations: number;
  projectedDiscretionary: number;
}

export function isCurrentCalendarMonth(monthKey: string, today: Date = new Date()): boolean {
  return monthKey === format(startOfDay(today), "yyyy-MM");
}

export function calendarMonthKey(today: Date = new Date()): string {
  return format(startOfDay(today), "yyyy-MM");
}

function isoDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return format(value, "yyyy-MM-dd");
  }
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 10);
}

function compareLines(a: PlanningBillLine, b: PlanningBillLine): number {
  const dateA = a.dueDate ?? "9999-99-99";
  const dateB = b.dueDate ?? "9999-99-99";
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  return a.id - b.id;
}

function dollarsFromCents(cents: number): number {
  return centsToDollars(cents);
}

/**
 * One income event in the month projection.
 * Received, or any stored actual amount, replaces expected. It is not added to it.
 */
export function recognizedIncomeAmount(event: {
  status: string;
  expectedAmount: number | null;
  actualAmount: number | null;
}): number {
  if (event.status === "received" || event.actualAmount != null) {
    return event.actualAmount ?? 0;
  }
  return event.expectedAmount ?? 0;
}

/** Expected amount still not replaced by an actual/received figure. */
export function incomeStillExpectedAmount(event: {
  status: string;
  expectedAmount: number | null;
  actualAmount: number | null;
}): number {
  if (event.status === "received" || event.actualAmount != null) return 0;
  return event.expectedAmount ?? 0;
}

/** Full effective amount of a bill that is not skipped. Paid and pending still count. */
export function knownObligationAmount(bill: BillForPlanning): number {
  if (bill.status === "skipped") return 0;
  return getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
}

/**
 * Remainder still unpaid. Pending stays in this figure (it has not cleared),
 * even when amountPaid already covers the effective amount — that flag means
 * the payment was sent, not that it has settled. Paid and skipped contribute nothing.
 */
export function outstandingBillAmount(bill: BillForPlanning): number {
  if (bill.status === "skipped" || bill.status === "paid") return 0;
  if (bill.status === "pending") return pendingClearanceAmount(bill);
  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  if (isBillPaid(bill.status, bill.amountPaid, effective)) return 0;
  return dollarsFromCents(Math.max(0, toCents(effective) - toCents(bill.amountPaid ?? 0)));
}

/**
 * Money that still has to be started before the next paycheck.
 * Pending is excluded here because that amount is already subtracted from
 * the available balance.
 */
export function uninitiatedObligationBeforePayday(bill: BillForPlanning): number {
  if (bill.status === "pending" || bill.status === "skipped") return 0;
  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  if (isBillPaid(bill.status, bill.amountPaid, effective)) return 0;
  return dollarsFromCents(Math.max(0, toCents(effective) - toCents(bill.amountPaid ?? 0)));
}

/** Initiated amount sitting in pending. amountPaid when set, otherwise the effective amount. */
export function pendingClearanceAmount(bill: BillForPlanning): number {
  if (bill.status !== "pending") return 0;
  const effective = getEffectivePlannedAmount(bill.plannedAmount, bill.invoiceAmount);
  if (bill.amountPaid != null) return bill.amountPaid;
  return effective;
}

/**
 * Next paycheck group on or after today that still has an expected event.
 * Received events do not keep a group in the "next" slot.
 * The boundary date is the group's first date, including groups merged within two days.
 */
export function findNextIncomeGroup(
  income: IncomeForPlanning[],
  today: Date
): NextIncomeSnapshot | null {
  const normalized = income.map((event) => ({
    event,
    date: isoDateOnly(event.expectedDate),
  }));
  const groups = buildPaycheckGroups(
    normalized
      .filter((row): row is { event: IncomeForPlanning; date: string } => row.date != null)
      .map((row) => ({
        id: row.event.id,
        expectedDate: row.date,
        name: row.event.name,
      }))
  );
  const todayIso = format(startOfDay(today), "yyyy-MM-dd");
  const byId = new Map(income.map((event) => [event.id, event]));

  for (const group of groups) {
    const boundaryDate = group.dates[0];
    if (!boundaryDate || boundaryDate < todayIso) continue;
    const stillExpected = group.events
      .map((event) => byId.get(event.id))
      .filter((event): event is IncomeForPlanning => event != null && event.status !== "received");
    if (stillExpected.length === 0) continue;
    const dates = stillExpected
      .map((event) => isoDateOnly(event.expectedDate))
      .filter((date): date is string => date != null)
      .sort();
    const expectedCents = stillExpected.reduce(
      (sum, event) => sum + toCents(event.expectedAmount ?? 0),
      0
    );
    return {
      names: stillExpected.map((event) => event.name?.trim() || "Income"),
      date: dates[0] ?? boundaryDate,
      boundaryDate,
      expectedAmount: dollarsFromCents(expectedCents),
    };
  }
  return null;
}

function dueBeforeBoundary(dueDate: string | Date | null, boundaryDate: string): boolean {
  const due = isoDateOnly(dueDate);
  if (!due) return false;
  return due < boundaryDate;
}

export function buildPaycheckPlanningSnapshot(input: {
  income: IncomeForPlanning[];
  /** Bills owned by the month on screen. These alone drive month projection. */
  bills: BillForPlanning[];
  /**
   * Unresolved scheduled/pending bills owned by earlier months.
   * Operational planning only: needs funding and pending clearance.
   */
  carryoverBills?: BillForPlanning[];
  availableBalance: number | null;
  today?: Date;
}): MonthPlanningView {
  const today = input.today ?? new Date();
  const nextIncome = findNextIncomeGroup(input.income, today);
  const seenIds = new Set(input.bills.map((bill) => bill.id));
  const operationalBills = [
    ...input.bills,
    ...(input.carryoverBills ?? []).filter((bill) => !seenIds.has(bill.id)),
  ];

  const needsFunding: PlanningBillLine[] = [];
  if (nextIncome) {
    for (const bill of operationalBills) {
      if (!dueBeforeBoundary(bill.dueDate, nextIncome.boundaryDate)) continue;
      const amount = uninitiatedObligationBeforePayday(bill);
      if (amount === 0) continue;
      needsFunding.push({
        id: bill.id,
        name: bill.name,
        dueDate: isoDateOnly(bill.dueDate),
        amount,
      });
    }
    needsFunding.sort(compareLines);
  }

  const pendingClearance: PlanningBillLine[] = [];
  for (const bill of operationalBills) {
    if (bill.status !== "pending") continue;
    pendingClearance.push({
      id: bill.id,
      name: bill.name,
      dueDate: isoDateOnly(bill.dueDate),
      amount: pendingClearanceAmount(bill),
    });
  }
  pendingClearance.sort(compareLines);

  const stillToCover: PlanningBillLine[] = [];
  for (const bill of operationalBills) {
    if (bill.status !== "scheduled" && bill.status !== "pending") continue;
    const amount = outstandingBillAmount(bill);
    if (amount === 0) continue;
    stillToCover.push({
      id: bill.id,
      name: bill.name,
      dueDate: isoDateOnly(bill.dueDate),
      amount,
      status: bill.status,
    });
  }
  stillToCover.sort(compareLines);

  const needsFundingCents = needsFunding.reduce((sum, line) => sum + toCents(line.amount), 0);
  const pendingCents = pendingClearance.reduce((sum, line) => sum + toCents(line.amount), 0);
  const stillToCoverCents = stillToCover.reduce((sum, line) => sum + toCents(line.amount), 0);
  const leftAfterBills =
    input.availableBalance == null
      ? null
      : dollarsFromCents(toCents(input.availableBalance) - stillToCoverCents);
  const availableAfterPending =
    input.availableBalance == null
      ? null
      : dollarsFromCents(toCents(input.availableBalance) - pendingCents);
  const safeUntilNextIncome =
    availableAfterPending == null || nextIncome == null
      ? null
      : dollarsFromCents(toCents(availableAfterPending) - needsFundingCents);

  const recognizedCents = input.income.reduce(
    (sum, event) => sum + toCents(recognizedIncomeAmount(event)),
    0
  );
  const stillExpectedCents = input.income.reduce(
    (sum, event) => sum + toCents(incomeStillExpectedAmount(event)),
    0
  );
  const knownObligationCents = input.bills.reduce(
    (sum, bill) => sum + toCents(knownObligationAmount(bill)),
    0
  );
  const outstandingCents = input.bills.reduce(
    (sum, bill) => sum + toCents(outstandingBillAmount(bill)),
    0
  );

  return {
    nextIncome,
    needsFunding,
    needsFundingTotal: dollarsFromCents(needsFundingCents),
    pendingClearance,
    pendingClearanceTotal: dollarsFromCents(pendingCents),
    stillToCover,
    stillToCoverTotal: dollarsFromCents(stillToCoverCents),
    leftAfterBills,
    availableAfterPending,
    safeUntilNextIncome,
    incomeStillExpected: dollarsFromCents(stillExpectedCents),
    billsStillOutstanding: dollarsFromCents(outstandingCents),
    recognizedIncome: dollarsFromCents(recognizedCents),
    knownObligations: dollarsFromCents(knownObligationCents),
    projectedDiscretionary: dollarsFromCents(recognizedCents - knownObligationCents),
  };
}
