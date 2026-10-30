"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { incomeEvents, months, paydayAcknowledgments } from "@/db/schema";
import { getDefaultLedgerId } from "@/features/months/actions";
import { ledgerTodayIso } from "@/lib/ledger-time";

/** Confirms the user finished the payday plan; does not mark income as received. */
export async function acknowledgePayday(): Promise<{ success: true } | { error: string }> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "Please sign in again." };
  const todayIso = ledgerTodayIso();
  const [payday] = await db.select({ id: incomeEvents.id })
    .from(incomeEvents)
    .innerJoin(months, eq(incomeEvents.monthId, months.id))
    .where(and(
      eq(months.ledgerId, ledgerId),
      eq(incomeEvents.expectedDate, todayIso)
    )).limit(1);
  if (!payday) return { error: "No payday is scheduled for today." };

  await db.insert(paydayAcknowledgments)
    .values({ ledgerId, paydayDate: todayIso })
    .onConflictDoNothing({
      target: [paydayAcknowledgments.ledgerId, paydayAcknowledgments.paydayDate]
    });
  revalidatePath(`/months/${todayIso.slice(0, 7)}`);
  return { success: true };
}

export async function isPaydayAcknowledged(): Promise<boolean> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return false;
  const [row] = await db.select({ id: paydayAcknowledgments.id })
    .from(paydayAcknowledgments)
    .where(and(
      eq(paydayAcknowledgments.ledgerId, ledgerId),
      eq(paydayAcknowledgments.paydayDate, ledgerTodayIso())
    )).limit(1);
  return !!row;
}
