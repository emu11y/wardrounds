/* WardRounds service worker — minimal, install-enabling, network-first.
 *
 * Its primary job is to satisfy Chrome/Android's PWA installability criteria
 * (a registered service worker WITH a fetch handler) so the `beforeinstallprompt`
 * event fires and our custom install button can appear.
 *
 * It deliberately does NOT cache app JS/CSS or any Supabase/API responses — a
 * clinical tool must never serve a stale bundle or stale patient data. Only the
 * bare app shell is cached, and only as an offline fallback for navigations.
 */

const CACHE = 'wardrounds-shell-v1'
const SHELL = ['/', '/index.html', '/wardrounds-icon.png', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept cross-origin (Supabase, CDNs, analytics) — always live network.
  if (url.origin !== self.location.origin) return

  // Navigations: network-first so the freshest shell wins; fall back to the
  // cached shell only when genuinely offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/'))
      )
    )
    return
  }

  // Same-origin static assets pass straight through to the network (keeps hashed
  // JS/CSS bundles fresh). The mere presence of this fetch handler is what makes
  // the app installable.
})
