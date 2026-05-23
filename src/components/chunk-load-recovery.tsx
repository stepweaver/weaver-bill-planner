"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "ledger-chunk-reload-attempted";

function isChunkLoadError(reason: unknown): boolean {
  const message =
    typeof reason === "string"
      ? reason
      : reason instanceof Error
        ? reason.message
        : typeof reason === "object" &&
            reason !== null &&
            "message" in reason
          ? String((reason as { message: unknown }).message)
          : String(reason);
  return /ChunkLoadError|Failed to load chunk|Loading chunk \d+ failed/i.test(
    message
  );
}

/** After a VPS deploy, stale tabs may request removed chunks; reload once to pick up the new build. */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const maybeReload = (reason: unknown) => {
      if (!isChunkLoadError(reason)) return;
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      maybeReload(event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      maybeReload(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
