"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  disablePushSubscription,
  savePushSubscription,
  sendTestNotification,
  type NotificationFailure,
} from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export function NotificationControls({
  publicKey,
  ready,
  failures,
}: {
  publicKey: string | null;
  ready: boolean;
  failures: NotificationFailure[];
}) {
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  async function enable() {
    if (!publicKey || busy) return;
    setBusy("enable");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications blocked. Allow them in device settings.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        expirationTime: json.expirationTime,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Notifications on.");
    } catch {
      toast.error("Couldn't turn on notifications.");
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy("disable");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      if (endpoint) {
        const result = await disablePushSubscription(endpoint);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Notifications off.");
    } catch {
      toast.error("Couldn't turn notifications off.");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    if (busy) return;
    setBusy("test");
    try {
      const result = await sendTestNotification();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Test notification sent.");
    } catch {
      toast.error("Couldn't send the test notification.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        iPhone: Add λledger to your Home Screen, then open it there to turn on alerts.
        Desktop: Turn on alerts in your browser.
      </p>
      {!publicKey ? (
        <p>Push alerts aren&apos;t configured on the server.</p>
      ) : !supported ? (
        <p>This browser doesn&apos;t support push alerts.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-11" disabled={busy != null} onClick={() => void enable()}>
            {busy === "enable" ? "Enabling" : "Turn on alerts"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={busy != null}
            onClick={() => void disable()}
          >
            {busy === "disable" ? "Disabling" : "Turn off"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={busy != null}
            onClick={() => void test()}
          >
            {busy === "test" ? "Sending" : "Send test"}
          </Button>
        </div>
      )}
      {!ready ? (
        <p className="text-muted-foreground">
          Delivery history needs the notifications migration.
        </p>
      ) : failures.length === 0 ? (
        <p className="text-muted-foreground">No failed alerts.</p>
      ) : (
        <ul className="space-y-2">
          {failures.map((failure) => (
            <li key={failure.id} className="rounded border px-3 py-2">
              <p className="font-medium">
                {failure.kind} · {failure.attemptCount} {failure.attemptCount === 1 ? "attempt" : "attempts"}
              </p>
              <p className="text-muted-foreground">{failure.lastError || "Delivery failed."}</p>
              {failure.createdAt ? (
                <p className="text-[11px] text-muted-foreground">
                  <time dateTime={failure.createdAt}>{failure.createdAt.slice(0, 16).replace("T", " ")} UTC</time>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
