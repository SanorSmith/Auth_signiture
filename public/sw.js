// Minimal service worker so Android can install the app. It deliberately caches nothing:
// pages are per-user and show verification codes, so every request goes to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(fetch(event.request)));
