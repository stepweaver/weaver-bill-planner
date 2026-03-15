"use server";

import { db } from "@/db";
import { billInstances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { billInstanceSchema } from "@/lib/validations/bill";
import { assignBillToWindow } from "@/lib/paycheck-windows";
import { buildPaycheckWindows } from "@/lib/paycheck-windows";
import type { IncomeEventForWindow } from "@/lib/paycheck-windows";

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toBool(v: unknown): boolean {
  return v === "on" || v === true || v === "true";
}

export async function createBill(monthId: number, monthKey: string, formData: FormData) {
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
    await recomputeBillAssignment(monthId, monthKey);
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
    await recomputeBillAssignment(monthId, monthKey);
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

export async function deleteBill(id: number, monthKey: string) {
  await db.delete(billInstances).where(eq(billInstances.id, id));
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}

async function recomputeBillAssignment(monthId: number, monthKey: string) {
  const { db: database } = await import("@/db");
  const { incomeEvents } = await import("@/db/schema");
  const bills = await database
    .select()
    .from(billInstances)
    .where(eq(billInstances.monthId, monthId));
  const income = await database
    .select({ id: incomeEvents.id, expectedDate: incomeEvents.expectedDate, name: incomeEvents.name })
    .from(incomeEvents)
    .where(eq(incomeEvents.monthId, monthId));
  const windows = buildPaycheckWindows(
    income as IncomeEventForWindow[],
    monthKey
  );
  for (const bill of bills) {
    if (bill.manualAssignment) continue;
    const assigned = assignBillToWindow(bill, windows);
    if (assigned) {
      await database
        .update(billInstances)
        .set({
          assignedGroupKey: assigned.windowKey,
          assignedIncomeEventId: assigned.incomeEventId,
          updatedAt: new Date(),
        })
        .where(eq(billInstances.id, bill.id));
    }
  }
}

export async function recomputeAssignmentsForMonth(monthId: number, monthKey: string) {
  const { db: database } = await import("@/db");
  const { incomeEvents } = await import("@/db/schema");
  const bills = await database
    .select()
    .from(billInstances)
    .where(eq(billInstances.monthId, monthId));
  const income = await database
    .select({ id: incomeEvents.id, expectedDate: incomeEvents.expectedDate, name: incomeEvents.name })
    .from(incomeEvents)
    .where(eq(incomeEvents.monthId, monthId));
  const windows = buildPaycheckWindows(
    income as IncomeEventForWindow[],
    monthKey
  );
  for (const bill of bills) {
    const assigned = assignBillToWindow(bill, windows);
    await database
      .update(billInstances)
      .set({
        manualAssignment: false,
        assignedGroupKey: assigned?.windowKey ?? null,
        assignedIncomeEventId: assigned?.incomeEventId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(billInstances.id, bill.id));
  }
  revalidatePath(`/months/${monthKey}`, "page");
  return { success: true };
}
