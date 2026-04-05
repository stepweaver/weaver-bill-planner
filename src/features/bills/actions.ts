"use server";

import { db } from "@/db";
import { billInstances, incomeEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { billInstanceSchema } from "@/lib/validations/bill";
import { recomputeAutoAssignmentsForMonth } from "@/lib/recompute-auto-assignments";
import {
  buildPaycheckWindows,
  type IncomeEventForWindow,
} from "@/lib/paycheck-windows";
import { getDefaultLedgerId, getMonthByIdAndLedger } from "@/features/months/actions";

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toBool(v: unknown): boolean {
  return v === "on" || v === true || v === "true";
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
  const [inserted] = await db
    .insert(billInstances)
    .values({
      monthId,
      templateId: d.templateId,
      name: d.name,
      dueDate: d.dueDate,
      plannedAmount: d.plannedAmount,
      invoiceAmount: d.invoiceAmount,
      amountPaid: d.amountPaid,
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
  await db
    .update(billInstances)
    .set({
      templateId: d.templateId,
      name: d.name,
      dueDate: d.dueDate,
      plannedAmount: d.plannedAmount,
      invoiceAmount: d.invoiceAmount,
      amountPaid: d.amountPaid,
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

const QUICK_STATUSES = new Set(["scheduled", "pending", "paid", "skipped"]);

async function assertBillOwned(
  billId: number,
  monthId: number
): Promise<{ ok: true } | { error: string }> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Unauthorized" };
  const month = await getMonthByIdAndLedger(monthId, ledgerId);
  if (!month) return { error: "Forbidden" };
  const [row] = await db
    .select({ monthId: billInstances.monthId })
    .from(billInstances)
    .where(eq(billInstances.id, billId))
    .limit(1);
  if (!row || row.monthId !== monthId) return { error: "Forbidden" };
  return { ok: true };
}

export async function quickUpdateBillStatus(
  billId: number,
  monthId: number,
  monthKey: string,
  status: string
): Promise<{ success?: true; error?: string }> {
  if (!QUICK_STATUSES.has(status)) return { error: "Invalid status" };
  const gate = await assertBillOwned(billId, monthId);
  if ("error" in gate) return gate;
  await db
    .update(billInstances)
    .set({ status, updatedAt: new Date() })
    .where(eq(billInstances.id, billId));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function quickUpdateBillAmountPaid(
  billId: number,
  monthId: number,
  monthKey: string,
  amountPaid: number | null
): Promise<{ success?: true; error?: string }> {
  const gate = await assertBillOwned(billId, monthId);
  if ("error" in gate) return gate;
  await db
    .update(billInstances)
    .set({ amountPaid, updatedAt: new Date() })
    .where(eq(billInstances.id, billId));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function quickUpdateBillNotes(
  billId: number,
  monthId: number,
  monthKey: string,
  notes: string | null
): Promise<{ success?: true; error?: string }> {
  const gate = await assertBillOwned(billId, monthId);
  if ("error" in gate) return gate;
  const trimmed = notes?.trim() ? notes.trim() : null;
  await db
    .update(billInstances)
    .set({ notes: trimmed, updatedAt: new Date() })
    .where(eq(billInstances.id, billId));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

/** `windowKey` null or empty string = return to auto-assignment */
export async function quickAssignBillToWindow(
  billId: number,
  monthId: number,
  monthKey: string,
  windowKey: string | null
): Promise<{ success?: true; error?: string }> {
  const gate = await assertBillOwned(billId, monthId);
  if ("error" in gate) return gate;
  if (windowKey == null || windowKey === "") {
    await db
      .update(billInstances)
      .set({
        manualAssignment: false,
        assignedGroupKey: null,
        assignedIncomeEventId: null,
        updatedAt: new Date(),
      })
      .where(eq(billInstances.id, billId));
    await recomputeAutoAssignmentsForMonth(monthId, monthKey);
  } else {
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
    const w = windows.find((x) => x.key === windowKey);
    if (!w) return { error: "Invalid paycheck window" };
    await db
      .update(billInstances)
      .set({
        manualAssignment: true,
        assignedGroupKey: windowKey,
        assignedIncomeEventId: w.incomeEventId,
        updatedAt: new Date(),
      })
      .where(eq(billInstances.id, billId));
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}
