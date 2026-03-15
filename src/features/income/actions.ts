"use server";

import { db } from "@/db";
import { incomeEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { incomeEventSchema } from "@/lib/validations/income";
import { recomputeAssignmentsForMonth } from "@/features/bills/actions";

export async function createIncome(monthId: number, monthKey: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = incomeEventSchema.safeParse({
    name: raw.name,
    expectedDate: raw.expectedDate,
    expectedAmount: raw.expectedAmount || null,
    actualAmount: raw.actualAmount || null,
    status: raw.status ?? "expected",
    notes: raw.notes || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await db.insert(incomeEvents).values({
    monthId,
    name: d.name,
    expectedDate: d.expectedDate,
    expectedAmount: d.expectedAmount,
    actualAmount: d.actualAmount,
    status: d.status,
    notes: d.notes,
  });
  await recomputeAssignmentsForMonth(monthId, monthKey);
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function updateIncome(
  id: number,
  monthKey: string,
  formData: FormData
) {
  const [existing] = await db.select({ monthId: incomeEvents.monthId }).from(incomeEvents).where(eq(incomeEvents.id, id));
  if (!existing) return { error: { form: ["Income event not found"] } };
  const raw = Object.fromEntries(formData.entries());
  const parsed = incomeEventSchema.safeParse({
    name: raw.name,
    expectedDate: raw.expectedDate,
    expectedAmount: raw.expectedAmount || null,
    actualAmount: raw.actualAmount || null,
    status: raw.status ?? "expected",
    notes: raw.notes || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await db
    .update(incomeEvents)
    .set({
      name: d.name,
      expectedDate: d.expectedDate,
      expectedAmount: d.expectedAmount,
      actualAmount: d.actualAmount,
      status: d.status,
      notes: d.notes,
      updatedAt: new Date(),
    })
    .where(eq(incomeEvents.id, id));
  await recomputeAssignmentsForMonth(existing.monthId, monthKey);
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function deleteIncome(id: number, monthKey: string) {
  const [ev] = await db.select({ monthId: incomeEvents.monthId }).from(incomeEvents).where(eq(incomeEvents.id, id));
  await db.delete(incomeEvents).where(eq(incomeEvents.id, id));
  if (ev) await recomputeAssignmentsForMonth(ev.monthId, monthKey);
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}
