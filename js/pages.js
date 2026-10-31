/**
 * Balance Trust — which HTML page shows which part of the app.
 *
 * Every signed-in area has its own page (projects.html, invoices.html, …) and
 * each kind of user has their own dashboard page. Links inside the app still
 * use short addresses such as "#/projects/PRJ-000001"; when one of them
 * belongs to another page, the app opens that page (see App.route). Old links
 * and bookmarks to "index.html#/…" keep working the same way.
 *
 * This only decides where things are shown. The server checks every
 * permission again whatever page asks.
 */
const Pages = (() => {
  /** Route → page file. */
  const FILES = {
    'client-dashboard': 'pages/client-dashboard.html',
    'staff-dashboard': 'pages/staff-dashboard.html',
    'admin-dashboard': 'pages/admin-dashboard.html',
    'system-dashboard': 'pages/system-admin-dashboard.html',
    projects: 'pages/projects.html', project: 'pages/projects.html', monitoring: 'pages/projects.html',
    blocks: 'pages/blocks.html',
    subscription: 'pages/subscription.html',
    invoices: 'pages/invoices.html', finance: 'pages/invoices.html', payments: 'pages/payments.html', receipts: 'pages/receipts.html',
    documents: 'pages/documents.html',
    reports: 'pages/reports.html',
    property: 'pages/property.html', propertyOne: 'pages/property.html',
    cameras: 'pages/cameras.html',
    notifications: 'pages/notifications.html',
    profile: 'pages/profile.html', settings: 'pages/settings.html',
    admin: 'pages/admin.html'
  };

  const DASHBOARDS = ['system-dashboard', 'admin-dashboard', 'staff-dashboard', 'client-dashboard'];
  const DASHBOARD_LABELS = { 'system-dashboard': 'System administrator', 'admin-dashboard': 'Administrator', 'staff-dashboard': 'Staff', 'client-dashboard': 'Client' };
  const FLASH_KEY = 'bt.flash';

  /** The signed-in pages live in the "pages" folder; the website, sign-in and registration stay at the top. */
  const IN_PAGES = /\/pages\/[^/]*$/.test(location.pathname);
  const ROOT = IN_PAGES ? '../' : '';
  /** A link to a file given from the site's top folder (e.g. "pages/projects.html", "assets/logo.png"), from wherever this page is. */
  const url = (file) => ROOT + file;

  /** This page, from the site's top folder (e.g. "pages/projects.html"). */
  const current = () => (IN_PAGES ? 'pages/' : '') + decodeURIComponent(location.pathname.split('/').pop() || 'index.html');

  const roleKeys = (user) => (user && user.roles ? user.roles.map((r) => r.key || r) : []);

  /** Dashboards this person may open, their own first. */
  function dashboardsFor(user) {
    const roles = roleKeys(user);
    const can = (p) => !!user && (user.permissions.includes('*') || user.permissions.includes(p));
    const out = [];
    if (roles.includes('SYSTEM_ADMIN') && can('system.manage')) out.push('system-dashboard');
    if (can('user.manage')) out.push('admin-dashboard');
    if (roles.some((r) => r !== 'CLIENT')) out.push('staff-dashboard');
    if (!out.length || roles.includes('CLIENT')) out.push('client-dashboard');
    return out;
  }

  const dashboardOf = (user) => dashboardsFor(user)[0];

  /** The page file for a route; "dashboard" is the person's own dashboard. */
  function fileFor(route, user) {
    if (route === 'dashboard') return FILES[dashboardOf(user)];
    return FILES[route] || null;
  }

  /** A link to a route, on whatever page shows it. */
  function href(route, user) {
    const file = fileFor(route.split('/')[0], user);
    return (file ? url(file) : '') + '#/' + route;
  }

  /** A short message for the next page (e.g. "You have been signed out"). */
  function flash(message, type = 'info') {
    try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type })); } catch (e) { /* only a convenience */ }
  }
  function takeFlash() {
    try {
      const v = JSON.parse(sessionStorage.getItem(FLASH_KEY) || 'null');
      sessionStorage.removeItem(FLASH_KEY);
      return v;
    } catch (e) { return null; }
  }

  /** To the sign-in page, coming back here afterwards. */
  function toLogin(message, type) {
    if (message) flash(message, type);
    const here = current();
    const next = /^(pages\/)?[a-z-]+\.html$/.test(here) && !['index.html', 'login.html', 'register.html'].includes(here) ? here + location.hash : '';
    location.replace(url('login.html') + (next ? '?next=' + encodeURIComponent(next) : ''));
  }

  /** Where to go after signing in: the page asked for (only this site's own pages), or the dashboard. */
  function afterLogin(user) {
    const next = new URLSearchParams(location.search).get('next') || '';
    const m = /^(pages\/[a-z-]+\.html)(#\/[^\s]*)?$/.exec(next);
    if (m && Object.values(FILES).includes(m[1])) return url(next);
    return url(fileFor('dashboard', user));
  }

  /** Buttons to the other dashboards this person may open (e.g. a system administrator can also see the admin view). */
  function switcher(user, current) {
    const list = dashboardsFor(user);
    if (list.length < 2) return '';
    return '<nav class="bt-dash-switch" aria-label="Dashboards">' + list.map((d) => {
      const on = d === current;
      return '<a class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-outline-primary') + '" href="' + url(FILES[d]) + '"' + (on ? ' aria-current="page"' : '') + '>' + Utils.esc(DASHBOARD_LABELS[d]) + '</a>';
    }).join('') + '</nav>';
  }

  return { url, ROOT, switcher, FILES, DASHBOARDS, DASHBOARD_LABELS, current, dashboardsFor, dashboardOf, fileFor, href, flash, takeFlash, toLogin, afterLogin };
})();
