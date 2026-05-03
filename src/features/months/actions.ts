"use server";

import { db } from "@/db";
import { months, ledgers, incomeEvents, billInstances, billTemplates } from "@/db/schema";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { endOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { buildPaycheckWindows } from "@/lib/paycheck-windows";
import { assignBillToWindow } from "@/lib/paycheck-windows";
import { calculateMonthMetrics, type MonthMetrics } from "@/lib/month-metrics";
import {
  buildMonthAttention,
  buildPaycheckSummaries,
  type BillForFunding,
} from "@/lib/month-funding";
import type { IncomeEventForWindow } from "@/lib/paycheck-windows";
import { propagateMonth } from "@/lib/propagate-month";
import { recomputeAutoAssignmentsForMonth } from "@/lib/recompute-auto-assignments";
import { getSessionForServer } from "@/lib/auth-server";

function hasDb() {
  return !!process.env.DATABASE_URL;
}

/** Returns default ledger id only when session is valid. Used for ownership scoping. */
export async function getDefaultLedgerId(): Promise<number | null> {
  const session = await getSessionForServer();
  if (!session) return null;
  if (!hasDb()) return null;
  const [ledger] = await db
    .select()
    .from(ledgers)
    .where(eq(ledgers.isDefault, true))
    .limit(1);
  return ledger?.id ?? null;
}

/** Resolve month by id and ledger; returns null if not found or wrong ledger (for ownership checks). */
export async function getMonthByIdAndLedger(
  monthId: number,
  ledgerId: number
): Promise<{ id: number; ledgerId: number; monthKey: string } | null> {
  const [month] = await db
    .select({ id: months.id, ledgerId: months.ledgerId, monthKey: months.monthKey })
    .from(months)
    .where(and(eq(months.id, monthId), eq(months.ledgerId, ledgerId)))
    .limit(1);
  return month ?? null;
}

export type MonthListCardSummary = MonthMetrics & {
  /** Bills explicitly marked pending (sent, not cleared). */
  pendingBillCount: number;
};

export type MonthListRow = typeof months.$inferSelect & {
  cardSummary: MonthListCardSummary;
};

export async function getMonthsList(): Promise<MonthListRow[]> {
  if (!hasDb()) return [];
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return [];
  const monthRows = await db
    .select()
    .from(months)
    .where(eq(months.ledgerId, ledgerId))
    .orderBy(desc(months.monthKey));
  if (monthRows.length === 0) return [];

  const monthIds = monthRows.map((m) => m.id);
  const [incomeRows, billRows] = await Promise.all([
    db
      .select()
      .from(incomeEvents)
      .where(inArray(incomeEvents.monthId, monthIds))
      .orderBy(asc(incomeEvents.expectedDate), asc(incomeEvents.sortOrder)),
    db
      .select()
      .from(billInstances)
      .where(inArray(billInstances.monthId, monthIds))
      .orderBy(asc(billInstances.sortOrder), asc(billInstances.dueDate)),
  ]);

  const incomeByMonthId = new Map<number, (typeof incomeRows)[number][]>();
  for (const row of incomeRows) {
    const list = incomeByMonthId.get(row.monthId) ?? [];
    list.push(row);
    incomeByMonthId.set(row.monthId, list);
  }
  const billsByMonthId = new Map<number, (typeof billRows)[number][]>();
  for (const row of billRows) {
    const list = billsByMonthId.get(row.monthId) ?? [];
    list.push(row);
    billsByMonthId.set(row.monthId, list);
  }

  return monthRows.map((month) => {
    const income = incomeByMonthId.get(month.id) ?? [];
    const bills = billsByMonthId.get(month.id) ?? [];
    const metrics = calculateMonthMetrics(income, bills, month.monthKey);
    const pendingBillCount = bills.filter((b) => b.status === "pending").length;
    return {
      ...month,
      cardSummary: { ...metrics, pendingBillCount },
    };
  });
}

export async function getMonthByKey(monthKey: string) {
  if (!hasDb()) return null;
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return null;
  const [month] = await db
    .select()
    .from(months)
    .where(and(eq(months.ledgerId, ledgerId), eq(months.monthKey, monthKey)))
    .limit(1);
  return month ?? null;
}

export async function getOpenMonthKey(): Promise<string | null> {
  if (!hasDb()) return null;
  const list = await getMonthsList();
  const open = list.find((m) => m.status === "open");
  return open?.monthKey ?? null;
}

export async function getMonthWithData(monthKey: string) {
  if (!hasDb()) return null;
  const month = await getMonthByKey(monthKey);
  if (!month) return null;
  const income = await db
    .select()
    .from(incomeEvents)
    .where(eq(incomeEvents.monthId, month.id))
    .orderBy(asc(incomeEvents.expectedDate), asc(incomeEvents.sortOrder));
  const billsRows = await db
    .select()
    .from(billInstances)
    .where(eq(billInstances.monthId, month.id))
    .orderBy(asc(billInstances.sortOrder), asc(billInstances.dueDate));
  const templateIds = [...new Set(billsRows.map((b) => b.templateId).filter((id): id is number => id != null))];
  const templates =
    templateIds.length > 0
      ? await db
          .select({ id: billTemplates.id, defaultPaymentUrl: billTemplates.defaultPaymentUrl })
          .from(billTemplates)
          .where(inArray(billTemplates.id, templateIds))
      : [];
  const urlByTemplateId = Object.fromEntries(templates.map((t) => [t.id, t.defaultPaymentUrl]));
  const bills = billsRows.map((b) => ({
    ...b,
    paymentUrl: b.paymentUrl ?? (b.templateId ? urlByTemplateId[b.templateId] ?? null : null),
  }));
  const windows = buildPaycheckWindows(
    income as IncomeEventForWindow[],
    monthKey
  );
  const billsWithWindow = bills.map((b) => {
    const assigned = assignBillToWindow(b, windows);
    return {
      ...b,
      displayWindowKey: assigned?.windowKey ?? null,
      displayIncomeEventId: assigned?.incomeEventId ?? null,
    };
  });
  const metrics = calculateMonthMetrics(income, bills, monthKey);
  const billsForFunding = bills as BillForFunding[];
  const paycheckSummaries = buildPaycheckSummaries(
    windows,
    billsForFunding,
    income.map((e) => ({
      id: e.id,
      expectedAmount: e.expectedAmount,
      actualAmount: e.actualAmount,
    }))
  );
  const attention = buildMonthAttention(
    windows,
    billsForFunding,
    paycheckSummaries
  );
  return {
    month,
    incomeEvents: income,
    billInstances: billsWithWindow,
    windows,
    metrics,
    paycheckSummaries,
    attention,
  };
}

export async function closeMonth(monthKey: string) {
  if (!hasDb()) return { error: "Database not configured" };
  const month = await getMonthByKey(monthKey);
  if (!month) return { error: "Month not found" };
  await db
    .update(months)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(months.id, month.id));
  revalidatePath("/months");
  revalidatePath(`/months/${monthKey}`);
  return { success: true };
}

export async function closeMonthFormAction(formData: FormData) {
  const monthKey = formData.get("monthKey");
  if (typeof monthKey !== "string") return;
  await closeMonth(monthKey);
}

/** Build a draft month from active templates (for first month or "from templates" flow). */
export async function getDraftFromTemplates(targetMonthKey: string) {
  if (!hasDb()) return null;
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return null;
  const templates = await db
    .select()
    .from(billTemplates)
    .where(eq(billTemplates.ledgerId, ledgerId))
    .orderBy(asc(billTemplates.sortOrder), asc(billTemplates.name));
  const active = templates.filter((t) => t.active !== false);
  if (active.length === 0) return null;
  const [y, m] = targetMonthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = endOfMonth(first);
  const lastDay = last.getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const weekdaysInMonth = (weekdays: number[]): string[] => {
    const out: string[] = [];
    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(y, m - 1, day);
      if (weekdays.includes(date.getDay())) out.push(date.toISOString().slice(0, 10));
    }
    return out;
  };

  const billInstancesDraft: Array<{
    templateId: number | null;
    name: string;
    dueDate: string | null;
    plannedAmount: number | null;
    paymentUrl: string | null;
    isRecurring: boolean;
  }> = [];
  for (const t of active) {
    const dueWeekdaysRaw = t.dueWeekdays?.trim();
    const dueWeekdays = dueWeekdaysRaw
      ? dueWeekdaysRaw.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6)
      : [];
    if (dueWeekdays.length > 0) {
      for (const dueDate of weekdaysInMonth(dueWeekdays)) {
        billInstancesDraft.push({
          templateId: t.id,
          name: t.name,
          dueDate,
          plannedAmount: t.defaultPlannedAmount,
          paymentUrl: t.defaultPaymentUrl,
          isRecurring: true,
        });
      }
    } else {
      const hasDueDay = t.defaultDueDay != null && t.defaultDueDay >= 1 && t.defaultDueDay <= 31;
      const dueDate = hasDueDay
        ? new Date(y, m - 1, Math.min(t.defaultDueDay!, lastDay)).toISOString().slice(0, 10)
        : null;
      billInstancesDraft.push({
        templateId: t.id,
        name: t.name,
        dueDate,
        plannedAmount: t.defaultPlannedAmount,
        paymentUrl: t.defaultPaymentUrl,
        isRecurring: true,
      });
    }
  }
  return {
    targetMonthKey,
    label: `${monthNames[m - 1]} ${y}`,
    billInstances: billInstancesDraft,
    incomeEvents: [] as Array<{ name: string; expectedDate: string; expectedAmount: number | null }>,
  };
}

export async function getPropagationDraft(sourceMonthId: number, targetMonthKey: string) {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId || !hasDb()) return null;
  const sourceMonth = await getMonthByIdAndLedger(sourceMonthId, ledgerId);
  if (!sourceMonth) return null;
  const sourceBills = await db.select().from(billInstances).where(eq(billInstances.monthId, sourceMonthId));
  const sourceIncome = await db.select().from(incomeEvents).where(eq(incomeEvents.monthId, sourceMonthId));
  return propagateMonth(
    sourceBills.map((b) => ({
      templateId: b.templateId,
      name: b.name,
      dueDate: b.dueDate != null ? String(b.dueDate) : null,
      plannedAmount: b.plannedAmount,
      paymentUrl: b.paymentUrl,
      isRecurring: b.isRecurring,
    })),
    sourceIncome.map((e) => ({
      name: e.name,
      expectedDate: String(e.expectedDate),
      expectedAmount: e.expectedAmount,
    })),
    targetMonthKey
  );
}

export async function createMonthFromPropagation(draft: {
  targetMonthKey: string;
  label: string;
  billInstances: Array<{
    templateId: number | null;
    name: string;
    dueDate: string | null;
    plannedAmount: number | null;
    paymentUrl: string | null;
    isRecurring: boolean;
  }>;
  incomeEvents: Array<{
    name: string;
    expectedDate: string;
    expectedAmount: number | null;
  }>;
}) {
  if (!hasDb()) return { error: "Database not configured" };
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "No default ledger" };
  const [existing] = await db
    .select()
    .from(months)
    .where(
      and(eq(months.ledgerId, ledgerId), eq(months.monthKey, draft.targetMonthKey))
    )
    .limit(1);
  if (existing) return { error: "Month already exists" };
  const [newMonth] = await db
    .insert(months)
    .values({
      ledgerId,
      monthKey: draft.targetMonthKey,
      label: draft.label,
      status: "open",
    })
    .returning();
  if (!newMonth) return { error: "Failed to create month" };
  for (const b of draft.billInstances) {
    const dueDate = typeof b.dueDate === "string" && b.dueDate.trim() ? b.dueDate : null;
    await db.insert(billInstances).values({
      monthId: newMonth.id,
      templateId: b.templateId,
      name: b.name,
      dueDate,
      plannedAmount: b.plannedAmount,
      paymentUrl: b.paymentUrl,
      status: "scheduled",
      isRecurring: b.isRecurring,
    });
  }
  const validIncome = draft.incomeEvents.filter(
    (e) => e.name?.trim() && e.expectedDate
  );
  for (const e of validIncome) {
    await db.insert(incomeEvents).values({
      monthId: newMonth.id,
      name: e.name.trim(),
      expectedDate: e.expectedDate,
      expectedAmount: e.expectedAmount,
      status: "expected",
    });
  }
  await recomputeAutoAssignmentsForMonth(newMonth.id, draft.targetMonthKey);
  revalidatePath("/months");
  revalidatePath(`/months/${draft.targetMonthKey}`);
  return { success: true, monthKey: draft.targetMonthKey };
}
