import { db } from "@/db";
import { billInstances, incomeEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  assignBillToWindow,
  buildPaycheckWindows,
  type IncomeEventForWindow,
} from "@/lib/paycheck-windows";

/**
 * Re-runs due-date auto-assignment for all bills in a month that are not manually assigned.
 * Clears stored assignment when no window matches. Never modifies manualAssignment or manual rows.
 */
export async function recomputeAutoAssignmentsForMonth(
  monthId: number,
  monthKey: string
): Promise<void> {
  const bills = await db
    .select()
    .from(billInstances)
    .where(eq(billInstances.monthId, monthId));
  const income = await db
    .select({
      id: incomeEvents.id,
      expectedDate: incomeEvents.expectedDate,
      name: incomeEvents.name,
    })
    .from(incomeEvents)
    .where(eq(incomeEvents.monthId, monthId));
  const windows = buildPaycheckWindows(
    income as IncomeEventForWindow[],
    monthKey
  );
  for (const bill of bills) {
    if (bill.manualAssignment) continue;
    const assigned = assignBillToWindow(bill, windows);
    await db
      .update(billInstances)
      .set({
        assignedGroupKey: assigned?.windowKey ?? null,
        assignedIncomeEventId: assigned?.incomeEventId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(billInstances.id, bill.id));
  }
}
