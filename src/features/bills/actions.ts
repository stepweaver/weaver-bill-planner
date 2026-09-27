"use server";

import { db } from "@/db";
import { billInstances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { billDueDateSchema, billInstanceSchema, billQuickStatusSchema } from "@/lib/validations/bill";
import { resolveAmountPaidForStatus } from "@/lib/bill-utils";
import { recomputeAutoAssignmentsForMonth } from "@/lib/recompute-auto-assignments";
import { getDefaultLedgerId, getMonthByIdAndLedger } from "@/features/months/actions";

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toBool(v: unknown): boolean {
  return v === "on" || v === true || v === "true";
}

const BILL_UPDATE_DENIED = "That bill could not be updated.";

async function authorizeBill(id: number, monthId: number, monthKey: string) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." as const };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month || month.monthKey !== monthKey) return { error: BILL_UPDATE_DENIED };
  const [bill] = await db.select().from(billInstances).where(eq(billInstances.id, id)).limit(1);
  if (!bill || bill.monthId !== monthId) return { error: BILL_UPDATE_DENIED };
  return { bill };
}

export async function createBill(monthId: number, monthKey: string, formData: FormData) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: { form: ["Unauthorized"] } };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month) return { error: { form: ["Forbidden"] } };
  const raw = Object.fromEntries(formData.entries());
  const parsed = billInstanceSchema.safeParse({
    name: raw.name,
    dueDate: raw.dueDate || null,
    plannedAmount: toNum(raw.plannedAmount),
    invoiceAmount: toNum(raw.invoiceAmount),
    amountPaid: toNum(raw.amountPaid),
    status: raw.status ?? "scheduled",
    notes: raw.notes || null,
    paymentUrl: raw.paymentUrl && String(raw.paymentUrl).trim() ? raw.paymentUrl : null,
    assignedIncomeEventId: toNum(raw.assignedIncomeEventId),
    assignedGroupKey: raw.assignedGroupKey || null,
    manualAssignment: toBool(raw.manualAssignment),
    templateId: toNum(raw.templateId),
    isRecurring: toBool(raw.isRecurring),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const amountPaid = resolveAmountPaidForStatus(
    d.status,
    d.amountPaid,
    d.plannedAmount,
    d.invoiceAmount
  );
  const [inserted] = await db
    .insert(billInstances)
    .values({
      monthId,
      templateId: d.templateId,
      name: d.name,
      dueDate: d.dueDate,
      plannedAmount: d.plannedAmount,
      invoiceAmount: d.invoiceAmount,
      amountPaid,
      status: d.status,
      notes: d.notes,
      paymentUrl: d.paymentUrl,
      assignedIncomeEventId: d.assignedIncomeEventId,
      assignedGroupKey: d.assignedGroupKey,
      manualAssignment: d.manualAssignment,
      isRecurring: d.isRecurring,
    })
    .returning();
  if (inserted && !d.manualAssignment) {
    await recomputeAutoAssignmentsForMonth(monthId, monthKey);
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function updateBill(
  id: number,
  monthId: number,
  monthKey: string,
  formData: FormData
) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: { form: ["Unauthorized"] } };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month) return { error: { form: ["Forbidden"] } };
  const [bill] = await db.select({ monthId: billInstances.monthId }).from(billInstances).where(eq(billInstances.id, id)).limit(1);
  if (!bill || bill.monthId !== monthId) return { error: { form: ["Forbidden"] } };
  const raw = Object.fromEntries(formData.entries());
  const parsed = billInstanceSchema.safeParse({
    name: raw.name,
    dueDate: raw.dueDate || null,
    plannedAmount: toNum(raw.plannedAmount),
    invoiceAmount: toNum(raw.invoiceAmount),
    amountPaid: toNum(raw.amountPaid),
    status: raw.status ?? "scheduled",
    notes: raw.notes || null,
    paymentUrl: raw.paymentUrl && String(raw.paymentUrl).trim() ? raw.paymentUrl : null,
    assignedIncomeEventId: toNum(raw.assignedIncomeEventId),
    assignedGroupKey: raw.assignedGroupKey || null,
    manualAssignment: toBool(raw.manualAssignment),
    templateId: toNum(raw.templateId),
    isRecurring: toBool(raw.isRecurring),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const amountPaid = resolveAmountPaidForStatus(
    d.status,
    d.amountPaid,
    d.plannedAmount,
    d.invoiceAmount
  );
  await db
    .update(billInstances)
    .set({
      templateId: d.templateId,
      name: d.name,
      dueDate: d.dueDate,
      plannedAmount: d.plannedAmount,
      invoiceAmount: d.invoiceAmount,
      amountPaid,
      status: d.status,
      notes: d.notes,
      paymentUrl: d.paymentUrl,
      assignedIncomeEventId: d.assignedIncomeEventId,
      assignedGroupKey: d.assignedGroupKey,
      manualAssignment: d.manualAssignment,
      isRecurring: d.isRecurring,
      updatedAt: new Date(),
    })
    .where(eq(billInstances.id, id));
  if (!d.manualAssignment) {
    await recomputeAutoAssignmentsForMonth(monthId, monthKey);
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

/** Row-level due date change. Recomputes auto assignment the same way a full update does. */
export async function updateBillDueDate(
  id: number,
  monthId: number,
  monthKey: string,
  dueDate: string | null
) {
  const auth = await authorizeBill(id, monthId, monthKey);
  if ("error" in auth) return { error: auth.error };
  const parsed = billDueDateSchema.safeParse(dueDate === "" ? null : dueDate);
  if (!parsed.success) return { error: "Enter a valid due date." };
  await db
    .update(billInstances)
    .set({
      dueDate: parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(billInstances.id, id));
  if (!auth.bill.manualAssignment) {
    await recomputeAutoAssignmentsForMonth(monthId, monthKey);
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true as const };
}

/** Row-level Due → Pending or Pending → Paid. Fills a missing amount paid from amount due. */
export async function updateBillPaymentState(
  id: number,
  monthId: number,
  monthKey: string,
  status: "pending" | "paid"
) {
  const auth = await authorizeBill(id, monthId, monthKey);
  if ("error" in auth) return { error: auth.error };
  const parsed = billQuickStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "That bill could not be updated." };
  const amountPaid = resolveAmountPaidForStatus(
    parsed.data,
    auth.bill.amountPaid,
    auth.bill.plannedAmount,
    auth.bill.invoiceAmount
  );
  await db
    .update(billInstances)
    .set({
      status: parsed.data,
      amountPaid,
      updatedAt: new Date(),
    })
    .where(eq(billInstances.id, id));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true as const };
}

export async function deleteBill(id: number, monthKey: string): Promise<{ success?: true; error?: string }> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Unauthorized" };
  const [bill] = await db.select({ monthId: billInstances.monthId }).from(billInstances).where(eq(billInstances.id, id)).limit(1);
  if (!bill) return { error: "Not found" };
  const month = await getMonthByIdAndLedger(bill.monthId, ledgerId);
  if (!month) return { error: "Forbidden" };
  await db.delete(billInstances).where(eq(billInstances.id, id));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

/** Re-runs auto-assignment after income changes. Preserves manual overrides. */
export async function recomputeAssignmentsForMonth(monthId: number, monthKey: string) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Unauthorized" };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month) return { error: "Forbidden" };
  await recomputeAutoAssignmentsForMonth(monthId, monthKey);
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}
