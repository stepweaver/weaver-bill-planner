"use server";

import { db } from "@/db";
import { billInstances, incomeEvents } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { incomeEventSchema } from "@/lib/validations/income";
import { recomputeAssignmentsForMonth } from "@/features/bills/actions";
import { getDefaultLedgerId, getMonthByIdAndLedger } from "@/features/months/actions";

/**
 * A dated income entry is either a scheduled payday (no deposited amount) or
 * money actually received. Expected dollar amounts are no longer collected.
 * Existing expectedDate/status columns remain because payday reminders and
 * paycheck windows rely on scheduled dates.
 */
function parseIncome(formData: FormData, allowScheduled: boolean) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = incomeEventSchema.safeParse({
    name: raw.name,
    expectedDate: raw.expectedDate,
    expectedAmount: null,
    actualAmount: raw.actualAmount === "" || raw.actualAmount == null ? null : raw.actualAmount,
    status: "received",
    notes: raw.notes || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors } as const;
  }
  const entry = parsed.data;
  if (entry.actualAmount == null && !allowScheduled) {
    return { error: { actualAmount: ["Enter the amount received."] } } as const;
  }
  if (entry.actualAmount != null && (!Number.isFinite(entry.actualAmount) || entry.actualAmount <= 0)) {
    return { error: { actualAmount: ["Amount received must be greater than zero."] } } as const;
  }
  return {
    data: {
      name: entry.name.trim(),
      expectedDate: entry.expectedDate,
      expectedAmount: null,
      actualAmount: entry.actualAmount,
      status: entry.actualAmount == null ? "expected" : "received",
      notes: entry.notes,
    },
  } as const;
}

export async function createIncome(monthId: number, monthKey: string, formData: FormData) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: { form: ["Unauthorized"] } };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month || month.monthKey !== monthKey) return { error: { form: ["Forbidden"] } };
  const parsed = parseIncome(formData, false);
  if ("error" in parsed) return { error: parsed.error };
  try {
    await db.insert(incomeEvents).values({ monthId, ...parsed.data });
    await recomputeAssignmentsForMonth(monthId, monthKey);
    revalidatePath(`/months/${monthKey}`, "page");
    revalidatePath("/months", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to create income", error);
    return { error: { form: ["Couldn't save income. Please try again."] } };
  }
}

export async function updateIncome(id: number, monthKey: string, formData: FormData) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: { form: ["Unauthorized"] } };
  const [existing] = await db
    .select({ monthId: incomeEvents.monthId, status: incomeEvents.status })
    .from(incomeEvents)
    .where(eq(incomeEvents.id, id))
    .limit(1);
  if (!existing) return { error: { form: ["Income entry not found"] } };
  const month = await getMonthByIdAndLedger(existing.monthId, ledgerId);
  if (!month || month.monthKey !== monthKey) return { error: { form: ["Forbidden"] } };

  // Only a previously scheduled payday can remain amount-less on edit.
  const parsed = parseIncome(formData, existing.status === "expected");
  if ("error" in parsed) return { error: parsed.error };
  try {
    await db
      .update(incomeEvents)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(incomeEvents.id, id), eq(incomeEvents.monthId, existing.monthId)));
    await recomputeAssignmentsForMonth(existing.monthId, monthKey);
    revalidatePath(`/months/${monthKey}`, "page");
    revalidatePath("/months", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to update income", error);
    return { error: { form: ["Couldn't update income. Please try again."] } };
  }
}

export async function deleteIncome(id: number, monthKey: string) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Please sign in again." };
  const [entry] = await db
    .select({ monthId: incomeEvents.monthId })
    .from(incomeEvents)
    .where(eq(incomeEvents.id, id))
    .limit(1);
  if (!entry) return { error: "Income entry not found." };
  const month = await getMonthByIdAndLedger(entry.monthId, ledgerId);
  if (!month || month.monthKey !== monthKey) return { error: "You cannot delete this income entry." };

  try {
    // The FK is ON DELETE NO ACTION. Unlink bills first, including manually
    // assigned paycheck groups, without deleting or changing the bills themselves.
    await db
      .update(billInstances)
      .set({
        assignedIncomeEventId: null,
        assignedGroupKey: null,
        manualAssignment: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(billInstances.monthId, entry.monthId),
          or(
            eq(billInstances.assignedIncomeEventId, id),
            inArray(billInstances.assignedGroupKey, [`income-${id}`, `pre-${id}`])
          )
        )
      );
    await db.delete(incomeEvents).where(and(eq(incomeEvents.id, id), eq(incomeEvents.monthId, entry.monthId)));
    await recomputeAssignmentsForMonth(entry.monthId, monthKey);
    revalidatePath(`/months/${monthKey}`, "page");
    revalidatePath("/months", "page");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete income", error);
    return { error: "Couldn't delete this income entry. No bills were deleted. Please try again." };
  }
}
