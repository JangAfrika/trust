/**
 * Balance Trust — application shell: start-up, hash router, role-aware
 * navigation and the "planned module" placeholder for areas not built yet.
 *
 * Navigation is filtered by the permissions the server returned for this
 * user. That only hides links; the backend enforces every permission again.
 */
const App = (() => {
  const { html, raw } = Utils;
  let user = null;
  let logoOk = null;

  const can = (...perms) => !!user && (user.permissions.includes('*') || perms.some((p) => user.permissions.includes(p)));

  /** Main navigation. `show` decides visibility from server-issued permissions. */
  const NAV = [
    { route: 'dashboard', label: 'Dashboard', icon: 'grid-1x2', show: () => true },
    { route: 'projects', label: 'My Projects', icon: 'buildings', show: () => can('project.view.own', 'project.view.assigned', 'project.view.all'),
      children: [['projects', 'All Projects'], ['projects/active', 'Active'], ['projects/completed', 'Completed'], ['projects/archived', 'Archived']] },
    { route: 'blocks', label: 'Buy a Block', icon: 'bag-plus', show: () => can('block.purchase', 'block.manage') },
    { route: 'monitoring', label: 'Project Monitoring', icon: 'camera-video', show: () => can('project.view.own', 'project.view.assigned', 'project.view.all') },
    { route: 'documents', label: 'Documents', icon: 'folder2-open', show: () => can('document.view') },
    { route: 'finance', label: 'Finance', icon: 'cash-stack', show: () => can('finance.view.own', 'finance.view.all') },
    { route: 'property', label: 'Property Management', icon: 'house-door', show: () => can('property.view.own', 'property.view.all', 'property.manage') },
    { route: 'notifications', label: 'Notifications', icon: 'bell', show: () => true },
    { route: 'reports', label: 'Reports', icon: 'bar-chart-line', show: () => can('report.view.own', 'report.view.assigned', 'report.view.all', 'report.view.property') },
    { section: 'Account' },
    { route: 'profile', label: 'Profile', icon: 'person-circle', show: () => true },
    { route: 'settings', label: 'Settings', icon: 'gear', show: () => true },
    { route: 'admin', label: 'Administration', icon: 'shield-lock', show: () => can('user.manage', 'system.manage') }
  ];

  /** Modules that are designed but not yet built: shown honestly, never faked. */
  const PLANNED = {
    monitoring: ['Project Monitoring', 'camera-video', 'Live site view, progress, photos and videos, and stage authorization for each project.'],
    documents: ['Documents', 'folder2-open', 'Contracts, invoices, receipts, plans and reports, stored securely in Google Drive.'],
    finance: ['Finance', 'cash-stack', 'Invoices, payments, receipts, outstanding balances and material orders.'],
    property: ['Property Management', 'house-door', 'Properties, units, tenants, rent collection and maintenance requests.'],
    reports: ['Reports', 'bar-chart-line', 'Project, financial, property and activity reports with PDF export.'],
    admin: ['Administration', 'shield-lock', 'Users, roles, blocks, audit logs, system health, storage and backups.']
  };

  const ROUTES = {
    dashboard: (el) => Dashboard.render(el),
    projects: (el, args) => Projects.renderList(el, args[0] || 'all'),
    project: (el, args) => Projects.renderOne(el, args[0]),
    blocks: (el) => Blocks.render(el),
    notifications: (el) => Notifications.render(el),
    profile: (el) => Profile.render(el),
    settings: (el) => Profile.renderSettings(el)
  };

  const TITLES = { dashboard: 'Dashboard', projects: 'My Projects', project: 'Project', blocks: 'Buy a Block', notifications: 'Notifications', profile: 'Profile', settings: 'Settings' };

  function navAllowed(route) {
    const item = NAV.find((n) => n.route === route);
    return !item || item.show();
  }

  function parseHash() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').map(decodeURIComponent);
    if (parts[0] === 'projects' && parts[1] && /^[A-Z]{2,4}-\d+$/.test(parts[1])) return { route: 'project', args: [parts[1]], navRoute: 'projects' };
    return { route: parts[0], args: parts.slice(1), navRoute: parts.join('/') };
  }

  function renderNav(activeRoute) {
    const items = NAV.filter((n) => n.section || n.show());
    const nav = document.getElementById('bt-nav');
    nav.innerHTML = items.map((n) => {
      if (n.section) return html`<li class="bt-nav__section">${n.section}</li>`;
      const current = activeRoute === n.route || (activeRoute.startsWith(n.route + '/') && !n.children);
      let sub = '';
      if (n.children && activeRoute.split('/')[0] === n.route) {
        sub = '<ul class="bt-nav__sub">' + n.children.map(([r, l]) =>
          html`<li><a class="bt-nav__link" href="#/${r}" ${raw(activeRoute === r ? 'aria-current="page"' : '')}>${l}</a></li>`).join('') + '</ul>';
      }
      return html`<li><a class="bt-nav__link" href="#/${n.route}" ${raw(current && !n.children ? 'aria-current="page"' : '')}><i class="bi bi-${n.icon}" aria-hidden="true"></i>${n.label}</a>${raw(sub)}</li>`;
    }).join('');

    const mobile = [
      ['dashboard', 'Home', 'grid-1x2'],
      ['projects', 'Projects', 'buildings'],
      can('block.purchase', 'block.manage') ? ['blocks', 'Buy', 'bag-plus'] : null,
      ['notifications', 'Alerts', 'bell']
    ].filter(Boolean).filter(([r]) => navAllowed(r));
    document.getElementById('bt-mobile-nav').innerHTML = mobile.map(([r, l, i]) =>
      html`<a href="#/${r}" ${raw(activeRoute.split('/')[0] === r ? 'aria-current="page"' : '')}><i class="bi bi-${i}" aria-hidden="true"></i>${l}</a>`).join('') +
      '<a href="#" id="bt-mobile-menu"><i class="bi bi-list" aria-hidden="true"></i>Menu</a>';
    document.getElementById('bt-mobile-menu').addEventListener('click', (e) => { e.preventDefault(); toggleNav(true); });
  }

  function toggleNav(open) {
    const shell = document.getElementById('bt-app-root');
    shell.classList.toggle('nav-open', open);
    document.getElementById('bt-menu-toggle').setAttribute('aria-expanded', String(open));
    if (open) document.querySelector('#bt-nav a').focus();
  }

  function plannedModule(el, key) {
    const [title, icon, text] = PLANNED[key];
    el.innerHTML = UI.pageHeader({ title }) + '<div class="bt-card">' + UI.emptyState({
      icon, title: title + ' is being built', text: text + ' This area will open here in a coming release.',
      actionHref: '#/dashboard', actionLabel: 'Back to dashboard'
    }) + '</div>';
  }

  async function route() {
    if (!user) return;
    toggleNav(false);
    const { route: r, args, navRoute } = parseHash();
    const el = document.getElementById('bt-content');
    renderNav(navRoute);
    const allowed = navAllowed(r === 'project' ? 'projects' : r);
    let title = TITLES[r] || (PLANNED[r] ? PLANNED[r][0] : 'Not found');
    document.getElementById('bt-page-title').textContent = title;
    document.title = title + ' · ' + APP_CONFIG.appName;
    if (!allowed) {
      el.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'lock', title: 'Not available', text: 'Your account does not have access to this area.', actionHref: '#/dashboard', actionLabel: 'Back to dashboard' }) + '</div>';
    } else if (ROUTES[r]) {
      await ROUTES[r](el, args);
    } else if (PLANNED[r]) {
      plannedModule(el, r);
    } else {
      el.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'signpost-split', title: 'Page not found', text: 'This page does not exist.', actionHref: '#/dashboard', actionLabel: 'Back to dashboard' }) + '</div>';
    }
    el.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function setUser(u) {
    user = u;
    document.getElementById('bt-user-name').textContent = u.fullName;
    document.getElementById('bt-user-email').textContent = u.email;
    document.getElementById('bt-avatar').textContent = Utils.initials(u.fullName);
  }

  function setUnread(count) {
    const dot = document.getElementById('bt-bell-count');
    dot.hidden = !count;
    dot.textContent = count > 99 ? '99+' : String(count || '');
    document.getElementById('bt-bell').setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');
  }

  /** Uses the official logo when assets/logo.png exists, otherwise the BT monogram. */
  function applyBrand(scope) {
    const apply = () => (scope || document).querySelectorAll('[data-brand]').forEach((b) => b.classList.toggle('no-logo', !logoOk));
    if (logoOk !== null) return apply();
    const img = new Image();
    img.onload = () => { logoOk = true; apply(); };
    img.onerror = () => { logoOk = false; apply(); };
    img.src = 'assets/logo.png';
    apply();
  }

  async function start() {
    const session = Session.get();
    document.getElementById('bt-splash').classList.add('is-hidden');
    if (!session) return Auth.show('login');
    try {
      const { data } = await Api.call('getUser');
      const authRoot = document.getElementById('bt-auth-root');
      authRoot.hidden = true;
      authRoot.innerHTML = '';
      document.getElementById('bt-app-root').hidden = false;
      setUser(data);
      applyBrand();
      if (!location.hash) history.replaceState(null, '', '#/dashboard');
      await route();
      Notifications.refreshCount();
    } catch (err) {
      if (err.code !== 'UNAUTHENTICATED') Auth.show('login', { alert: err.message });
    }
  }

  function init() {
    document.getElementById('bt-version').textContent = `${APP_CONFIG.appName} v${APP_CONFIG.version}`;
    applyBrand();
    window.addEventListener('hashchange', route);
    window.addEventListener('bt:unauthenticated', () => Auth.show('login', { alert: 'Your session has ended. Please sign in again.', alertType: 'info' }));
    document.getElementById('bt-menu-toggle').addEventListener('click', () => toggleNav(!document.getElementById('bt-app-root').classList.contains('nav-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleNav(false); });
    document.getElementById('bt-app-root').addEventListener('click', (e) => {
      if (e.currentTarget.classList.contains('nav-open') && !e.target.closest('#bt-sidebar') && !e.target.closest('#bt-menu-toggle') && !e.target.closest('#bt-mobile-menu')) toggleNav(false);
    });
    document.getElementById('bt-logout').addEventListener('click', () => Auth.logout());
    start();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { start, can, applyBrand, setUser, setUnread, user: () => user };
})();
