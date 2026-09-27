"use server";

import { db } from "@/db";
import { months, ledgers, incomeEvents, billInstances, billTemplates } from "@/db/schema";
import { eq, desc, asc, and, inArray } from "drizzle-orm";
import { endOfMonth, format } from "date-fns";
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
import { labelForMonthKey, shiftIsoDateToMonth } from "@/lib/month-dates";
import { numericToNumber, parseAvailableBalanceInput } from "@/lib/money";
import {
  buildPaycheckPlanningSnapshot,
  calendarMonthKey,
  isCurrentCalendarMonth,
  type MonthPlanningView,
} from "@/lib/paycheck-snapshot";
import { monthKeySchema } from "@/lib/validations/month";

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

  const today = new Date();
  const operational = isCurrentCalendarMonth(monthKey, today);
  const [ledgerRow] = await db
    .select({
      availableBalance: ledgers.availableBalance,
      availableBalanceUpdatedAt: ledgers.availableBalanceUpdatedAt,
    })
    .from(ledgers)
    .where(eq(ledgers.id, month.ledgerId))
    .limit(1);
  const storedBalance = numericToNumber(ledgerRow?.availableBalance ?? null);
  const planning = buildPaycheckPlanningSnapshot({
    income: income.map((event) => ({
      id: event.id,
      name: event.name,
      expectedDate: event.expectedDate,
      expectedAmount: event.expectedAmount,
      actualAmount: event.actualAmount,
      status: event.status,
    })),
    bills: bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      dueDate: bill.dueDate,
      plannedAmount: bill.plannedAmount,
      invoiceAmount: bill.invoiceAmount,
      amountPaid: bill.amountPaid,
      status: bill.status,
    })),
    // Historical and future months must not treat today's bank number as theirs.
    availableBalance: operational ? storedBalance : null,
    today,
  });

  let liveMonth: { href: string; label: string } | null = null;
  if (!operational) {
    const liveKey = calendarMonthKey(today);
    const live = await getMonthByKey(liveKey);
    if (live) liveMonth = { href: `/months/${liveKey}`, label: live.label };
  }

  const updatedAt = ledgerRow?.availableBalanceUpdatedAt ?? null;
  const updatedAtIso = (() => {
    if (!operational || updatedAt == null) return null;
    const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  })();

  return {
    month,
    incomeEvents: income,
    billInstances: billsWithWindow,
    windows,
    metrics,
    paycheckSummaries,
    attention,
    planningSnapshot: {
      operational,
      liveMonth,
      availableBalance: operational ? storedBalance : null,
      availableBalanceUpdatedAt: updatedAtIso,
      planning,
    } satisfies PlanningSnapshotPayload,
  };
}

export interface PlanningSnapshotPayload {
  /** True only when this page is the calendar's current month. */
  operational: boolean;
  liveMonth: { href: string; label: string } | null;
  /** Null when this is not the current month, or the user has not entered a balance. */
  availableBalance: number | null;
  availableBalanceUpdatedAt: string | null;
  planning: MonthPlanningView;
}

/**
 * Save the number the bank shows right now.
 * Pending payments are subtracted later, when the snapshot computes what is still available.
 */
export async function updateAvailableBankBalance(
  monthKey: string,
  rawAmount: string
): Promise<{ error: string } | { success: true }> {
  if (!hasDb()) return { error: "Database not configured" };
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." };
  const month = await getMonthByKey(monthKey);
  if (!month || month.ledgerId !== ledgerId) return { error: "Month not found" };
  if (!isCurrentCalendarMonth(monthKey)) {
    return { error: "Enter the available balance on the current month." };
  }
  const amount = parseAvailableBalanceInput(rawAmount);
  if (amount == null) {
    return { error: "Enter a dollar amount, like 2850 or -12.50." };
  }
  await db
    .update(ledgers)
    .set({
      availableBalance: amount,
      availableBalanceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ledgers.id, ledgerId));
  revalidatePath(`/months/${monthKey}`);
  revalidatePath("/months");
  return { success: true };
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

function dateValueToIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  const s = String(value).trim();
  return s ? s.slice(0, 10) : null;
}

/** Move an existing month to a different YYYY-MM, shifting bill and income dates. */
export async function retargetMonth(
  monthKey: string,
  newMonthKey: string
): Promise<{ error: string } | { success: true; monthKey: string }> {
  if (!hasDb()) return { error: "Database not configured" };
  const parsed = monthKeySchema.safeParse(newMonthKey.trim());
  if (!parsed.success) return { error: "Target month must be YYYY-MM" };
  const targetKey = parsed.data;
  if (targetKey === monthKey) return { error: "Choose a different month" };

  const month = await getMonthByKey(monthKey);
  if (!month) return { error: "Month not found" };

  const [collision] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.ledgerId, month.ledgerId), eq(months.monthKey, targetKey)))
    .limit(1);
  if (collision) return { error: `${labelForMonthKey(targetKey)} already exists` };

  await db
    .update(months)
    .set({
      monthKey: targetKey,
      label: labelForMonthKey(targetKey),
      updatedAt: new Date(),
    })
    .where(eq(months.id, month.id));

  const [bills, income] = await Promise.all([
    db.select({ id: billInstances.id, dueDate: billInstances.dueDate }).from(billInstances).where(eq(billInstances.monthId, month.id)),
    db
      .select({ id: incomeEvents.id, expectedDate: incomeEvents.expectedDate })
      .from(incomeEvents)
      .where(eq(incomeEvents.monthId, month.id)),
  ]);

  for (const bill of bills) {
    const iso = dateValueToIso(bill.dueDate);
    if (!iso) continue;
    await db
      .update(billInstances)
      .set({ dueDate: shiftIsoDateToMonth(iso, targetKey), updatedAt: new Date() })
      .where(eq(billInstances.id, bill.id));
  }
  for (const event of income) {
    const iso = dateValueToIso(event.expectedDate);
    if (!iso) continue;
    await db
      .update(incomeEvents)
      .set({ expectedDate: shiftIsoDateToMonth(iso, targetKey), updatedAt: new Date() })
      .where(eq(incomeEvents.id, event.id));
  }

  await recomputeAutoAssignmentsForMonth(month.id, targetKey);
  revalidatePath("/months");
  revalidatePath("/");
  revalidatePath(`/months/${monthKey}`);
  revalidatePath(`/months/${targetKey}`);
  return { success: true as const, monthKey: targetKey };
}

/** Permanently delete a month and all of its bills and income. */
export async function deleteMonth(
  monthKey: string
): Promise<{ error: string } | { success: true }> {
  if (!hasDb()) return { error: "Database not configured" };
  const month = await getMonthByKey(monthKey);
  if (!month) return { error: "Month not found" };

  await db.delete(billInstances).where(eq(billInstances.monthId, month.id));
  await db.delete(incomeEvents).where(eq(incomeEvents.monthId, month.id));
  await db.delete(months).where(eq(months.id, month.id));

  revalidatePath("/months");
  revalidatePath("/");
  revalidatePath(`/months/${monthKey}`);
  return { success: true as const };
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
