import { sendNotification, setVapidDetails } from "web-push";

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  url: string;
}

/** Public key is safe to hand to the browser. The private key stays in this process. */
export function readVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:ledger@localhost";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function configureWebPush(): { publicKey: string } | null {
  const config = readVapidConfig();
  if (!config) return null;
  setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return { publicKey: config.publicKey };
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: WebPushPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number; message: string }> {
  if (!configureWebPush()) return { ok: false, message: "VAPID keys are not configured." };
  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url })
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error != null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const message = error instanceof Error ? error.message : "Push delivery failed.";
    return { ok: false, statusCode, message: message.slice(0, 500) };
  }
}
