// Minimal service worker: it lets Android install the app and shows push notifications.
// It deliberately caches nothing: pages are per-user and show verification codes, so every
// request goes to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(fetch(event.request)));

// How the phone vibrates for each kind of notification (the sound is the device's own default).
const VIBRATION = {
  new_request: [180, 90, 180],
  reset_requested: [150, 80, 150, 80, 150],
  code_issued: [120, 60, 120, 60, 240],
  request_denied: [400],
  request_removed: [250, 120, 250],
  access_changed: [100, 60, 300],
};

// Something happened that concerns this person while the app may be closed. The notification uses
// the device's own default sound. If the app is open and visible it plays its own tone for the
// event, so nothing extra is shown here.
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
      await self.registration.showNotification(data.title || "Auth Signature", {
        body: data.body || "You have a new notification.",
        icon: "/icons/192",
        badge: "/icons/192",
        // One notification per kind: a newer one of the same kind replaces the older one.
        tag: data.kind || "notification",
        renotify: true,
        requireInteraction: data.kind === "new_request" || data.kind === "reset_requested",
        vibrate: VIBRATION[data.kind] || [200, 100, 200],
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
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
