import { addDays, parseISO, startOfDay } from "date-fns";
import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "./bill-utils";
import {
  assignBillToWindow,
  buildPaycheckWindows,
  type IncomeEventForWindow,
} from "./paycheck-windows";

/** Matches `DUE_SOON_DAYS` in month-funding / "Due soon" on the month workspace. */
const DUE_SOON_DAYS = 7;

export interface IncomeEventForMetrics {
  expectedAmount: number | null;
  actualAmount: number | null;
}

export interface BillInstanceForMetrics {
  dueDate: string | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  status: string;
  assignedIncomeEventId: number | null;
  assignedGroupKey: string | null;
}

export interface MonthMetrics {
  expectedIncome: number;
  receivedIncome: number;
  plannedExpenses: number;
  paidExpenses: number;
  /** Amount still to pay (planned minus paid). */
  remainingExpenses: number;
  /** Leftover = received income minus paid expenses (what you have after bills paid so far). */
  leftover: number;
  overdueCount: number;
  /**
   * Unpaid bills with due date from today through today + 7 days, excluding overdue.
   * Aligns with `buildMonthAttention` dueSoonIds.
   */
  dueSoonCount: number;
  unassignedCount: number;
}

export interface IncomeRowForMetrics extends IncomeEventForMetrics {
  id: number;
  expectedDate: string;
  name?: string | null;
}

export function calculateMonthMetrics(
  incomeEvents: IncomeRowForMetrics[],
  billInstances: BillInstanceForMetrics[],
  monthKey: string
): MonthMetrics {
  const expectedIncome = incomeEvents.reduce(
    (sum, e) => sum + (e.expectedAmount ?? 0),
    0
  );
  const receivedIncome = incomeEvents.reduce(
    (sum, e) => sum + (e.actualAmount ?? 0),
    0
  );

  const windows = buildPaycheckWindows(
    incomeEvents.map((e) => ({
      id: e.id,
      expectedDate: e.expectedDate,
      name: e.name,
    })) as IncomeEventForWindow[],
    monthKey
  );

  let plannedExpenses = 0;
  let paidExpenses = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let unassignedCount = 0;

  const today = startOfDay(new Date());
  const soonEnd = addDays(today, DUE_SOON_DAYS);

  for (const b of billInstances) {
    const effective = getEffectivePlannedAmount(
      b.plannedAmount,
      b.invoiceAmount
    );
    plannedExpenses += effective;
    const paid = isBillPaid(b.status, b.amountPaid, effective);
    if (paid) {
      paidExpenses += b.amountPaid ?? effective;
    }
    if (
      isBillOverdue(
        b.dueDate,
        b.status,
        b.amountPaid,
        effective
      )
    ) {
      overdueCount++;
    }
    if (
      !paid &&
      b.dueDate &&
      !isBillOverdue(b.dueDate, b.status, b.amountPaid, effective)
    ) {
      const due = startOfDay(parseISO(String(b.dueDate).slice(0, 10)));
      if (due >= today && due <= soonEnd) {
        dueSoonCount++;
      }
    }
    if (assignBillToWindow(b, windows) == null) {
      unassignedCount++;
    }
  }

  const remainingExpenses = plannedExpenses - paidExpenses;
  const leftover = receivedIncome - paidExpenses;

  return {
    expectedIncome,
    receivedIncome,
    plannedExpenses,
    paidExpenses,
    remainingExpenses,
    leftover,
    overdueCount,
    dueSoonCount,
    unassignedCount,
  };
}
