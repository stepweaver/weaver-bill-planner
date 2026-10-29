"use server";

import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { notificationDeliveries, pushSubscriptions } from "@/db/schema";
import { getDefaultLedgerId } from "@/features/months/actions";
import { isExpiredPushSubscription } from "@/lib/reminders";
import { readVapidConfig, sendWebPush } from "@/lib/web-push";

export interface NotificationFailure {
  id: number;
  kind: string;
  lastError: string | null;
  attemptCount: number;
  createdAt: string;
}

function isMissingRelation(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("42P01") || text.includes("does not exist");
}

export async function getNotificationSetup(): Promise<
  { error: string } | { publicKey: string | null }
> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." };
  return { publicKey: readVapidConfig()?.publicKey ?? null };
}

export async function savePushSubscription(raw: {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}): Promise<{ error: string } | { success: true }> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." };
  const endpoint = raw.endpoint?.trim() ?? "";
  const p256dh = raw.keys?.p256dh?.trim() ?? "";
  const auth = raw.keys?.auth?.trim() ?? "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return { error: "That subscription could not be saved." };
  }
  const headerList = await headers();
  const userAgent = headerList.get("user-agent")?.slice(0, 300) ?? null;
  const expirationTime =
    typeof raw.expirationTime === "number" && Number.isFinite(raw.expirationTime)
      ? new Date(raw.expirationTime)
      : null;
  await db
    .insert(pushSubscriptions)
    .values({
      ledgerId,
      endpoint,
      p256dh,
      auth,
      expirationTime,
      userAgent,
      enabled: true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        ledgerId,
        p256dh,
        auth,
        expirationTime,
        userAgent,
        enabled: true,
        updatedAt: new Date(),
      },
    });
  return { success: true };
}

export async function disablePushSubscription(
  endpoint: string
): Promise<{ error: string } | { success: true }> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." };
  if (!endpoint.startsWith("https://")) return { error: "That subscription could not be updated." };
  await db
    .update(pushSubscriptions)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.ledgerId, ledgerId)));
  return { success: true };
}

export async function sendTestNotification(): Promise<
  { error: string } | { success: true; sent: number }
> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { error: "You need to sign in again." };
  if (!readVapidConfig()) return { error: "Notifications are not configured on the server." };
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.ledgerId, ledgerId), eq(pushSubscriptions.enabled, true)));
  if (subs.length === 0) return { error: "Enable notifications on this device first." };

  const payload = {
    title: "λledger",
    body: "Notifications are on. This is a test.",
    url: "/months",
  };
  const dedupeKey = `test:${new Date().toISOString()}`;
  let sent = 0;

  for (const subscription of subs) {
    const [row] = await db
      .insert(notificationDeliveries)
      .values({
        ledgerId,
        subscriptionId: subscription.id,
        dedupeKey,
        kind: "test",
        title: payload.title,
        body: payload.body,
        targetPath: payload.url,
        status: "sending",
        attemptCount: 1,
      })
      .returning({ id: notificationDeliveries.id });
    const result = await sendWebPush(subscription, payload);
    if (!row) continue;
    if (result.ok) {
      sent += 1;
      await db
        .update(notificationDeliveries)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(notificationDeliveries.id, row.id));
      continue;
    }
    await db
      .update(notificationDeliveries)
      .set({ status: "failed", lastError: result.message, updatedAt: new Date() })
      .where(eq(notificationDeliveries.id, row.id));
    if (isExpiredPushSubscription(result.statusCode)) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
    }
  }

  if (sent === 0) return { error: "The test notification could not be delivered." };
  return { success: true, sent };
}

export async function listNotificationFailures(): Promise<
  { ready: false } | { ready: true; failures: NotificationFailure[] }
> {
  const ledgerId = await getDefaultLedgerId();
  if (!ledgerId) return { ready: false };
  try {
    const rows = await db
      .select({
        id: notificationDeliveries.id,
        kind: notificationDeliveries.kind,
        lastError: notificationDeliveries.lastError,
        attemptCount: notificationDeliveries.attemptCount,
        createdAt: notificationDeliveries.createdAt,
      })
      .from(notificationDeliveries)
      .where(
        and(eq(notificationDeliveries.ledgerId, ledgerId), eq(notificationDeliveries.status, "failed"))
      )
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(20);
    return {
      ready: true,
      failures: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        lastError: row.lastError,
        attemptCount: row.attemptCount,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
      })),
    };
  } catch (error) {
    if (isMissingRelation(error)) return { ready: false };
    throw error;
  }
}
