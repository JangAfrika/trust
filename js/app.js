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
    { route: 'cameras', label: 'Live Cameras', icon: 'camera-reels', show: () => can('project.view.own', 'project.view.assigned', 'project.view.all', 'property.view.own', 'property.view.all') },
    { route: 'documents', label: 'Documents', icon: 'folder2-open', show: () => can('document.view') },
    { route: 'finance', label: 'Finance', icon: 'cash-stack', show: () => can('finance.view.own', 'finance.view.all') },
    { route: 'property', label: 'Property Management', icon: 'house-door', show: () => can('property.view.own', 'property.view.all', 'property.manage') },
    { route: 'notifications', label: 'Notifications', icon: 'bell', show: () => true },
    { route: 'reports', label: 'Reports', icon: 'bar-chart-line', show: () => can('report.view.own', 'report.view.assigned', 'report.view.all', 'report.view.property', 'finance.view.own', 'finance.view.all', 'property.view.own', 'audit.view') },
    { section: 'Account' },
    { route: 'profile', label: 'Profile', icon: 'person-circle', show: () => true },
    { route: 'settings', label: 'Settings', icon: 'gear', show: () => true },
    { route: 'admin', label: 'Administration', icon: 'shield-lock', show: () => can('user.manage', 'system.manage', 'block.manage', 'audit.view', 'config.view') }
  ];

  /** Modules that are designed but not yet built: shown honestly, never faked. */
  const ROUTES = {
    dashboard: (el) => Dashboard.render(el),
    projects: (el, args) => Projects.renderList(el, args[0] || 'all'),
    project: (el, args) => Projects.renderOne(el, args[0], args[1]),
    monitoring: (el) => Projects.renderList(el, 'active', { title: 'Project Monitoring', subtitle: 'Open a project to follow its stages, photos, videos, updates and live site, and to authorize the next stage.' }),
    blocks: (el) => Blocks.render(el),
    documents: (el) => Documents.renderPage(el),
    property: (el) => Property.renderList(el),
    propertyOne: (el, args) => Property.renderOne(el, args[0], args[1]),
    finance: (el) => Finance.renderPage(el),
    notifications: (el) => Notifications.render(el),
    profile: (el) => Profile.render(el),
    settings: (el) => Profile.renderSettings(el),
    reports: (el, args) => Reports.render(el, args[0]),
    admin: (el, args) => Admin.render(el, args[0], args[1]),
    cameras: (el) => Cameras.renderWall(el)
  };

  const TITLES = { dashboard: 'Dashboard', projects: 'My Projects', project: 'Project', monitoring: 'Project Monitoring', documents: 'Documents', finance: 'Finance', property: 'Property Management', propertyOne: 'Property', blocks: 'Buy a Block', notifications: 'Notifications', profile: 'Profile', settings: 'Settings', reports: 'Reports', admin: 'Administration', cameras: 'Live Cameras' };

  /**
   * Tables each page shows. When one changes on the server the page reloads
   * itself in place (see live.js). The Live Site tab is left alone so camera
   * streams keep playing; it refreshes its own recordings list.
   */
  const PROJECT_TAB_LIVE = {
    overview: ['PROJECTS', 'PROJECT_STAGES', 'PROJECT_UPDATES', 'PROJECT_MEDIA', 'INVOICES', 'PAYMENTS', 'MATERIAL_ORDERS'],
    stages: ['PROJECTS', 'PROJECT_STAGES'], media: ['PROJECT_MEDIA'], updates: ['PROJECT_UPDATES'], documents: ['DOCUMENTS'],
    finance: ['INVOICES', 'PAYMENTS', 'RECEIPTS'], materials: ['MATERIAL_ORDERS'], team: ['PROJECT_MEMBERS']
  };
  const PROPERTY_LIVE = ['PROPERTIES', 'PROPERTY_UNITS', 'TENANTS', 'RENT_PAYMENTS', 'MAINTENANCE'];
  function liveKeys(r, args) {
    switch (r) {
      case 'dashboard': return ['PROJECTS', 'PROJECT_STAGES', 'PROJECT_UPDATES', 'INVOICES', 'PAYMENTS', 'MATERIAL_ORDERS', 'MAINTENANCE', 'RENT_PAYMENTS'];
      case 'projects': case 'monitoring': return ['PROJECTS', 'PROJECT_STAGES', 'PROJECT_MEMBERS'];
      case 'project': return PROJECT_TAB_LIVE[args[1] || 'overview'] || [];
      case 'documents': return ['DOCUMENTS'];
      case 'finance': return ['INVOICES', 'PAYMENTS', 'RECEIPTS'];
      case 'property': return PROPERTY_LIVE;
      case 'propertyOne': return args[1] === 'cameras' ? [] : PROPERTY_LIVE;
      case 'notifications': return ['NOTIFICATIONS'];
      case 'admin': return ({ users: ['USERS', 'USER_ROLES'], roles: ['ROLES', 'USER_ROLES'], blocks: ['BLOCKS'], projects: ['PROJECTS', 'PROJECT_STAGES'], audit: ['AUDIT_LOG'] })[args[0] || 'users'] || [];
      default: return [];
    }
  }

  let navCount = 0;

  /**
   * Re-renders the current page with fresh data without blanking it: the new
   * version is built hidden next to the old one and swapped in when it has
   * finished loading, keeping the scroll position.
   */
  async function refreshQuietly(r, args, nav) {
    const content = document.getElementById('bt-content');
    const old = content.firstElementChild;
    const el = document.createElement('div');
    el.hidden = true;
    content.appendChild(el);
    if (r === 'project') Workspace.invalidate();
    try {
      await ROUTES[r](el, args);
      // Some pages finish loading parts after the first await; wait for their spinners (up to 10 s).
      for (let i = 0; i < 100 && el.querySelector('.bt-state[role=status]'); i++) await new Promise((res) => setTimeout(res, 100));
    } catch (e) { /* keep the old page */ }
    if (nav !== navCount || !old || !old.isConnected) { el.remove(); return; }
    const y = window.scrollY;
    old.remove();
    el.hidden = false;
    window.scrollTo(0, y);
  }

  function navAllowed(route) {
    const item = NAV.find((n) => n.route === route);
    return !item || item.show();
  }

  function parseHash() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').map(decodeURIComponent);
    if (parts[0] === 'projects' && parts[1] && /^[A-Z]{2,4}-\d+$/.test(parts[1])) return { route: 'project', args: [parts[1], parts[2]], navRoute: 'projects' };
    if (parts[0] === 'property' && parts[1] && /^[A-Z]{2,4}-\d+$/.test(parts[1])) return { route: 'propertyOne', args: [parts[1], parts[2]], navRoute: 'property' };
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

  async function route() {
    if (!user) return;
    toggleNav(false);
    const { route: r, args, navRoute } = parseHash();
    // Each navigation renders into a fresh container, so a slow response from
    // the page the user just left can never overwrite the page they are on.
    const content = document.getElementById('bt-content');
    const el = document.createElement('div');
    content.replaceChildren(el);
    const nav = ++navCount;
    Live.resetPage();
    if (r !== 'project') Workspace.leave();
    renderNav(navRoute);
    const allowed = navAllowed(r === 'project' ? 'projects' : r === 'propertyOne' ? 'property' : r);
    const title = TITLES[r] || 'Not found';
    document.getElementById('bt-page-title').textContent = title;
    document.title = title + ' · ' + APP_CONFIG.appName;
    if (!allowed) {
      el.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'lock', title: 'Not available', text: 'Your account does not have access to this area.', actionHref: '#/dashboard', actionLabel: 'Back to dashboard' }) + '</div>';
    } else if (ROUTES[r]) {
      await ROUTES[r](el, args);
      const keys = liveKeys(r, args);
      if (keys.length && nav === navCount) Live.watch(keys, () => { if (nav === navCount) refreshQuietly(r, args, nav); });
    } else {
      el.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'signpost-split', title: 'Page not found', text: 'This page does not exist.', actionHref: '#/dashboard', actionLabel: 'Back to dashboard' }) + '</div>';
    }
    if (r === 'settings' && allowed) A11y.renderSettings(el);
    if (nav === navCount) {
      content.focus({ preventScroll: true });
      A11y.pageChanged(document.getElementById('bt-page-title').textContent);
    }
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
      Live.start();
    } catch (err) {
      if (err.code !== 'UNAUTHENTICATED') Auth.show('login', { alert: err.message });
    }
  }

  function init() {
    document.getElementById('bt-version').textContent = `${APP_CONFIG.appName} v${APP_CONFIG.version}`;
    applyBrand();
    Theme.bind(document.getElementById('bt-app-root'));
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
