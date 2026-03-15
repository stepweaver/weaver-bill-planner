"use server";

import { db } from "@/db";
import { billTemplates } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDefaultLedgerId } from "@/features/months/actions";
import { billTemplateSchema } from "@/lib/validations/template";

function hasDb() {
  return !!process.env.DATABASE_URL;
}

export async function getTemplatesList() {
  if (!hasDb()) return [];
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return [];
  return db
    .select()
    .from(billTemplates)
    .where(eq(billTemplates.ledgerId, ledgerId))
    .orderBy(asc(billTemplates.sortOrder), asc(billTemplates.name));
}

export async function createTemplate(formData: FormData) {
  if (!hasDb()) return { error: "Database not configured" };
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "No default ledger" };
  const raw = Object.fromEntries(formData.entries());
  const parsed = billTemplateSchema.safeParse({
    name: raw.name,
    defaultDueDay: raw.defaultDueDay ? Number(raw.defaultDueDay) : null,
    dueWeekdays: raw.dueWeekdays && String(raw.dueWeekdays).trim() ? raw.dueWeekdays : null,
    defaultPlannedAmount: raw.defaultPlannedAmount ? Number(raw.defaultPlannedAmount) : null,
    defaultPaymentUrl: raw.defaultPaymentUrl && String(raw.defaultPaymentUrl).trim() ? raw.defaultPaymentUrl : null,
    active: raw.active === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await db.insert(billTemplates).values({
    ledgerId,
    name: d.name,
    defaultDueDay: d.defaultDueDay,
    dueWeekdays: d.dueWeekdays,
    defaultPlannedAmount: d.defaultPlannedAmount,
    defaultPaymentUrl: d.defaultPaymentUrl,
    active: d.active,
  });
  revalidatePath("/templates");
  return { success: true };
}

export async function updateTemplate(
  id: number,
  formData: FormData
) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Unauthorized" };
  if (!hasDb()) return { error: "Database not configured" };
  const [template] = await db.select({ ledgerId: billTemplates.ledgerId }).from(billTemplates).where(eq(billTemplates.id, id)).limit(1);
  if (!template || template.ledgerId !== ledgerId) return { error: "Forbidden" };
  const raw = Object.fromEntries(formData.entries());
  const parsed = billTemplateSchema.safeParse({
    name: raw.name,
    defaultDueDay: raw.defaultDueDay ? Number(raw.defaultDueDay) : null,
    dueWeekdays: raw.dueWeekdays && String(raw.dueWeekdays).trim() ? raw.dueWeekdays : null,
    defaultPlannedAmount: raw.defaultPlannedAmount ? Number(raw.defaultPlannedAmount) : null,
    defaultPaymentUrl: raw.defaultPaymentUrl && String(raw.defaultPaymentUrl).trim() ? raw.defaultPaymentUrl : null,
    active: raw.active === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  await db
    .update(billTemplates)
    .set({
      name: d.name,
      defaultDueDay: d.defaultDueDay,
      dueWeekdays: d.dueWeekdays,
      defaultPlannedAmount: d.defaultPlannedAmount,
      defaultPaymentUrl: d.defaultPaymentUrl,
      active: d.active,
      updatedAt: new Date(),
    })
    .where(eq(billTemplates.id, id));
  revalidatePath("/templates");
  return { success: true };
}

export async function deleteTemplate(id: number) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Unauthorized" };
  if (!hasDb()) return { error: "Database not configured" };
  const [template] = await db.select({ ledgerId: billTemplates.ledgerId }).from(billTemplates).where(eq(billTemplates.id, id)).limit(1);
  if (!template || template.ledgerId !== ledgerId) return { error: "Forbidden" };
  await db.delete(billTemplates).where(eq(billTemplates.id, id));
  revalidatePath("/templates");
  return { success: true };
}
