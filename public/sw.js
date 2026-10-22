// Minimal service worker: it lets Android install the app and shows push notifications.
// It deliberately caches nothing: pages are per-user and show verification codes, so every
// request goes to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(fetch(event.request)));

// A request arrived while the app may be closed. The notification uses the device's own default
// sound. If the app is open and visible it plays its own tone, so nothing extra is shown here.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === "visible")) return;
      await self.registration.showNotification(data.title || "New verification request", {
        body: data.body || "A request is waiting for you.",
        icon: "/icons/192",
        badge: "/icons/192",
        tag: "new-request",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: data.url || "/admin" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          if ("navigate" in w) await w.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
