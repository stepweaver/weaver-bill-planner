self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "λledger";
  const body =
    typeof payload.body === "string" && payload.body
      ? payload.body
      : "Open λledger to plan bills.";
  const path = typeof payload.url === "string" ? payload.url : "/months";
  const url = path.startsWith("/") && !path.startsWith("//") ? path : "/months";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const safe = typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/months";
  const target = new URL(safe, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).origin !== self.location.origin || !("focus" in client)) continue;
        if ("navigate" in client) {
          await client.navigate(target.href);
        }
        return client.focus();
      }
      return self.clients.openWindow(target.href);
    })
  );
});
