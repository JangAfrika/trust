/**
 * Balance Trust — service worker. It makes the app installable and lets it
 * open quickly and show a clear "you are offline" notice without a network.
 *
 * It keeps ONLY the app's own public files (pages, styles, scripts, icons)
 * and the pinned Bootstrap and font files. It never stores or answers API
 * calls: requests to Apps Script (script.google.com and its user content
 * host), every POST, and anything else not listed here go straight to the
 * network untouched, so no record, document or session token is ever cached.
 *
 * After changing files in frontend/, raise VERSION so installed apps pick
 * them up promptly (they also refresh on their own, because the app's own
 * files are fetched from the network first whenever it is reachable).
 */
const VERSION = 'bt-v7';
const SHELL = `${VERSION}-shell`;
const CDN = `${VERSION}-cdn`;

const SHELL_FILES = [
  './', 'manifest.webmanifest',
  'index.html', 'login.html', 'register.html', 'pages/client-dashboard.html', 'pages/staff-dashboard.html', 'pages/admin-dashboard.html', 'pages/system-admin-dashboard.html',
  'pages/subscription.html', 'pages/projects.html', 'pages/blocks.html', 'pages/invoices.html', 'pages/payments.html', 'pages/receipts.html', 'pages/documents.html', 'pages/reports.html',
  'pages/property.html', 'pages/cameras.html', 'pages/notifications.html', 'pages/profile.html', 'pages/settings.html', 'pages/admin.html',
  'css/style.css', 'css/components.css', 'css/responsive.css', 'css/dark.css',
  'js/theme.js', 'js/a11y.js', 'js/config.js', 'js/utils.js', 'js/validation.js', 'js/api.js', 'js/ui.js', 'js/pages.js',
  'js/auth.js', 'js/site.js', 'js/notifications.js', 'js/live.js', 'js/dashboard.js', 'js/dashboard-staff.js', 'js/dashboard-admin.js', 'js/dashboard-system.js',
  'js/blockdetails.js', 'js/blocks.js', 'js/projects.js', 'js/documents.js', 'js/finance.js', 'js/materials.js', 'js/workspace.js', 'js/cameras.js',
  'js/subscription.js', 'js/property.js', 'js/profile.js', 'js/reports.js', 'js/admin.js', 'js/install.js', 'js/app.js',
  'assets/logo.png', 'assets/favicon.png', 'assets/apple-touch-icon.png', 'assets/icon-192.png', 'assets/icon-512.png'
];

/** Third-party files the page loads by exact version; safe to keep. */
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // Each file on its own, so one missing file never stops the install.
      .then((cache) => Promise.all(SHELL_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bt-') && k !== SHELL && k !== CDN).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Network first, with a short wait; the saved copy is used when offline or very slow. */
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(SHELL);
  const fromNetwork = fetch(request).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(cacheKey || request, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
    const saved = await cache.match(cacheKey || request, { ignoreSearch: true });
    return saved || fromNetwork;
  } catch (e) {
    const saved = await cache.match(cacheKey || request, { ignoreSearch: true });
    if (saved) return saved;
    throw e;
  }
}

/** Versioned CDN files never change, so the saved copy is used first. */
async function cacheFirst(request) {
  const cache = await caches.open(CDN);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // API calls and uploads: never touched
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
    if (req.mode === 'navigate') {
      // Each page is its own file; the site root is index.html.
      const file = url.pathname.endsWith('/') ? 'index.html' : null;
      event.respondWith(networkFirst(req, file));
      return;
    }
    // Only the app's own static files; anything else passes through.
    if (/\.(html|css|js|png|svg|ico|webmanifest)$/.test(url.pathname)) event.respondWith(networkFirst(req));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    // hls.js and other lazily loaded libraries are fine too; camera streams are on other hosts and pass through.
    event.respondWith(cacheFirst(req));
  }
  // Everything else (Apps Script, camera streams, Drive) goes straight to the network.
});
