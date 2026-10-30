import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  billInstances,
  incomeEvents,
  ledgers,
  months,
  notificationDeliveries,
  pushSubscriptions,
} from "../db/schema";
import { LEDGER_TIME_ZONE, ledgerMonthKey, ledgerTodayIso } from "../lib/ledger-time";
import {
  MAX_DELIVERY_ATTEMPTS,
  evaluateReminders,
  reminderSlotForHour,
  isExpiredPushSubscription,
  type ReminderPlan,
} from "../lib/reminders";
import { readVapidConfig, sendWebPush } from "../lib/web-push";

async function claimDelivery(input: {
  ledgerId: number;
  subscriptionId: number;
  plan: ReminderPlan;
}): Promise<{ id: number; attemptCount: number } | null> {
  await db
    .insert(notificationDeliveries)
    .values({
      ledgerId: input.ledgerId,
      subscriptionId: input.subscriptionId,
      dedupeKey: input.plan.dedupeKey,
      kind: input.plan.kind,
      title: input.plan.title,
      body: input.plan.body,
      targetPath: input.plan.targetPath,
      status: "pending",
      attemptCount: 0,
    })
    .onConflictDoNothing({
      target: [notificationDeliveries.dedupeKey, notificationDeliveries.subscriptionId],
    });

  const [claimed] = await db
    .update(notificationDeliveries)
    .set({
      status: "sending",
      attemptCount: sql`${notificationDeliveries.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationDeliveries.dedupeKey, input.plan.dedupeKey),
        eq(notificationDeliveries.subscriptionId, input.subscriptionId),
        inArray(notificationDeliveries.status, ["pending", "failed"]),
        lt(notificationDeliveries.attemptCount, MAX_DELIVERY_ATTEMPTS)
      )
    )
    .returning({
      id: notificationDeliveries.id,
      attemptCount: notificationDeliveries.attemptCount,
    });

  return claimed ?? null;
}

async function finishDelivery(
  id: number,
  result: { ok: true } | { ok: false; message: string }
) {
  if (result.ok) {
    await db
      .update(notificationDeliveries)
      .set({ status: "sent", sentAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(notificationDeliveries.id, id));
    return;
  }
  await db
    .update(notificationDeliveries)
    .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
    .where(eq(notificationDeliveries.id, id));
}

export async function runReminders(options: { dryRun: boolean }): Promise<number> {
  const todayIso = ledgerTodayIso();
  const monthKey = ledgerMonthKey();
  try {
    const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: LEDGER_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
    const slot = reminderSlotForHour(localHour);
    const ledgerRows = await db.select().from(ledgers).where(eq(ledgers.isDefault, true));
    const reports = [];

    for (const ledger of ledgerRows) {
      const [workspace] = await db
        .select({ monthKey: months.monthKey })
        .from(months)
        .where(and(eq(months.ledgerId, ledger.id), eq(months.monthKey, monthKey)))
        .limit(1);
      const billRows = await db
        .select({
          id: billInstances.id,
          name: billInstances.name,
          dueDate: billInstances.dueDate,
          status: billInstances.status,
          floatTargetDate: billInstances.floatTargetDate,
          ownerMonthKey: months.monthKey,
        })
        .from(billInstances)
        .innerJoin(months, eq(billInstances.monthId, months.id))
        .where(
          and(
            eq(months.ledgerId, ledger.id),
            eq(billInstances.status, "scheduled"),
            or(sql`${billInstances.dueDate} <= ${todayIso}`, sql`${billInstances.floatTargetDate} <= ${todayIso}`)
          )
        );
      const incomeRows = await db
        .select({
          id: incomeEvents.id,
          name: incomeEvents.name,
          expectedDate: incomeEvents.expectedDate,
          status: incomeEvents.status,
        })
        .from(incomeEvents)
        .innerJoin(months, eq(incomeEvents.monthId, months.id))
        .where(
          and(
            eq(months.ledgerId, ledger.id),
            eq(incomeEvents.expectedDate, todayIso),
            eq(incomeEvents.status, "expected")
          )
        );
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.ledgerId, ledger.id), eq(pushSubscriptions.enabled, true)));
      const plan = evaluateReminders({
        todayIso,
        slot,
        workspaceMonthKey: workspace?.monthKey ?? null,
        bills: billRows,
        income: incomeRows,
      });
      const report: Record<string, unknown> = {
        ledgerId: ledger.id,
        todayIso,
        timezone: LEDGER_TIME_ZONE,
        dryRun: options.dryRun,
        kind: plan.kind,
        shouldNotify: plan.shouldNotify,
        title: plan.title,
        body: plan.body,
        targetPath: plan.targetPath,
        dedupeKey: plan.dedupeKey,
        dueBillIds: plan.dueBillIds,
        overdueBillIds: plan.overdueBillIds,
        resurfacedBillIds: plan.resurfacedBillIds,
        paydayNames: plan.paydayNames,
        subscriptions: subscriptions.length,
        sent: 0,
        failed: 0,
        removedSubscriptions: 0,
      };

      if (!options.dryRun && plan.shouldNotify && subscriptions.length > 0) {
        if (!readVapidConfig()) {
          report.error = "VAPID keys are not configured.";
          reports.push(report);
          console.log(JSON.stringify({ timezone: LEDGER_TIME_ZONE, todayIso, reports }, null, 2));
          console.error("VAPID keys are not configured.");
          return 1;
        }
        for (const subscription of subscriptions) {
          let outcome: "skipped" | "sent" | "failed" = "skipped";
          for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS; attempt += 1) {
            const claimed = await claimDelivery({
              ledgerId: ledger.id,
              subscriptionId: subscription.id,
              plan,
            });
            if (!claimed) break;
            const result = await sendWebPush(subscription, {
              title: plan.title,
              body: plan.body,
              url: plan.targetPath,
            });
            await finishDelivery(claimed.id, result);
            if (result.ok) {
              outcome = "sent";
              break;
            }
            outcome = "failed";
            if (isExpiredPushSubscription(result.statusCode)) {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
              report.removedSubscriptions = Number(report.removedSubscriptions) + 1;
              break;
            }
          }
          if (outcome === "sent") report.sent = Number(report.sent) + 1;
          if (outcome === "failed") report.failed = Number(report.failed) + 1;
        }
      }

      reports.push(report);
    }

    console.log(JSON.stringify({ timezone: LEDGER_TIME_ZONE, todayIso, reports }, null, 2));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification job failed.";
    console.error(message);
    return 1;
  }
}
