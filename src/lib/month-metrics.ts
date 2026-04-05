import { getEffectivePlannedAmount, isBillPaid, isBillOverdue } from "./bill-utils";
import {
  assignBillToWindow,
  buildPaycheckWindows,
  type IncomeEventForWindow,
} from "./paycheck-windows";

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
  let unassignedCount = 0;

  for (const b of billInstances) {
    const effective = getEffectivePlannedAmount(
      b.plannedAmount,
      b.invoiceAmount
    );
    plannedExpenses += effective;
    if (isBillPaid(b.status, b.amountPaid, effective)) {
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
    unassignedCount,
  };
}
