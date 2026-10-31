/**
 * Balance Trust — the staff dashboard (staff-dashboard.html): project
 * managers, site supervisors, finance officers and property managers see the
 * work waiting for them. Each section appears only for the work their role
 * does; the server decides that from their permissions.
 */
const StaffDashboard = (() => {
  const { html, raw } = Utils;
  const money = (list) => (list && list.length ? list.map((o) => Utils.formatMoney(o.amount, o.currency)).join(' · ') : '0');

  function listCard(id, title, items, empty, row, more) {
    return html`<section class="bt-card" aria-labelledby="${id}"><div class="bt-card__header"><h2 id="${id}">${title}</h2>${raw(more || '')}</div>
      ${raw(items.length ? '<ul class="bt-list">' + items.map(row).join('') + '</ul>' : html`<p class="text-muted px-4 py-3 mb-0">${empty}</p>`)}</section>`;
  }

  const item = (icon, title, text, href, label) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><div class="bt-list__body"><p class="bt-list__title">${title}</p><p class="bt-list__text">${text}</p></div>${raw(href ? html`<a class="btn btn-sm btn-outline-primary" href="${href}">${label || 'Open'}</a>` : '')}</li>`;

  async function render(el) {
    el.innerHTML = UI.loadingState('Loading your dashboard…');
    let d;
    try {
      ({ data: d } = await Api.call('getStaffDashboard'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    App.setUnread(d.unread);
    const s = d.sections;
    const first = String(d.user.fullName || '').split(' ')[0];
    const stats = [
      UI.statCard({ label: 'Open projects', value: d.counts.openProjects, icon: 'buildings', href: '#/projects/active' }),
      s.stages ? UI.statCard({ label: 'Stages in progress', value: s.stages.length, icon: 'list-check', tone: s.stages.some((x) => x.status === 'Delayed') ? 'red' : '' }) : '',
      s.reviews ? UI.statCard({ label: 'Requests to review', value: s.reviews.length, icon: 'inbox', tone: s.reviews.length ? 'gold' : '' }) : '',
      s.materials ? UI.statCard({ label: s.materialsMode === 'approve' ? 'Orders to approve' : 'My open orders', value: s.materials.length, icon: 'truck', tone: s.materials.length && s.materialsMode === 'approve' ? 'gold' : '' }) : '',
      s.finance ? UI.statCard({ label: 'Outstanding', value: money(s.finance.outstanding), icon: 'receipt', tone: s.finance.overdue ? 'red' : '', hint: s.finance.overdue ? s.finance.overdue + ' overdue' : s.finance.unpaidCount + ' unpaid invoices', href: '#/invoices' }) : '',
      s.maintenance ? UI.statCard({ label: 'Open maintenance', value: s.maintenance.length, icon: 'tools', href: '#/property' }) : '',
      s.subscriptions ? UI.statCard({ label: 'Active subscriptions', value: s.subscriptions.active, icon: 'patch-check', hint: s.subscriptions.endingSoon + ' end within 30 days', href: '#/admin/subscriptions' }) : '',
      UI.statCard({ label: 'Unread notifications', value: d.unread, icon: 'bell', href: '#/notifications' })
    ].filter(Boolean).join('');

    const left = [];
    if (s.reviews) left.push(listCard('h-sd-rev', 'New block requests to review', s.reviews, 'No requests waiting.', (p) => item('inbox', p.name, p.block + ' · ' + (p.location || ''), '#/projects/' + encodeURIComponent(p.projectId), 'Review')));
    if (s.stages) left.push(listCard('h-sd-stg', 'Stages to move forward', s.stages, 'No stages in progress on your projects.', (x) => item(x.status === 'Delayed' ? 'exclamation-triangle' : 'list-check', x.name + ' · ' + x.percent + '%', x.project + ' · ' + x.status + (x.due ? ' · due ' + Utils.formatDate(x.due) : ''), '#/projects/' + encodeURIComponent(x.projectId) + '/stages', 'Update')));
    if (s.materials) left.push(listCard('h-sd-mat', s.materialsMode === 'approve' ? 'Material orders to approve' : 'My material orders', s.materials, 'Nothing waiting.', (o) => item('truck', (o.supplier || 'Order ' + o.orderId) + ' · ' + Utils.formatMoney(o.total, o.currency), o.project + ' · ' + o.approval + (o.delivery ? ' · ' + o.delivery : ''), '#/projects/' + encodeURIComponent(o.projectId) + '/materials')));
    if (s.maintenance) left.push(listCard('h-sd-mnt', 'Maintenance requests', s.maintenance, 'No open requests.', (m) => item('tools', m.issue, m.priority + ' priority · ' + m.status + ' · reported ' + Utils.formatDate(m.reported), '#/property/' + encodeURIComponent(m.propertyId) + '/maintenance')));

    const projects = d.projects.length
      ? '<div class="bt-grid bt-grid--cards">' + d.projects.map(UI.projectCard).join('') + '</div>'
      : '<div class="bt-card">' + UI.emptyState({ icon: 'buildings', title: 'No projects assigned yet', text: 'Projects you are added to appear here.' }) + '</div>';

    el.innerHTML = html`
      ${raw(Pages.switcher(App.user(), 'staff-dashboard'))}
      ${raw(UI.pageHeader({ title: 'Welcome, ' + first, subtitle: 'The work waiting for you today. ' + d.user.roles.map((r) => r.name).join(', ') + '.' }))}
      <section class="bt-grid bt-grid--stats mb-4" aria-label="Summary">${raw(stats)}</section>
      <div class="bt-grid bt-grid--split">
        <div class="bt-grid">${raw(left.join('') || '<div class="bt-card">' + UI.emptyState({ icon: 'check2-circle', title: 'Nothing waiting', text: 'You are all caught up.' }) + '</div>')}</div>
        <div class="bt-grid">
          ${raw(listCard('h-sd-upd', 'Latest updates', d.recentUpdates, 'No updates yet.', (u) => item('chat-square-text', u.title, u.project + ' · ' + (u.by || '') + ' · ' + Utils.formatDate(u.at), '#/projects/' + encodeURIComponent(u.projectId) + '/updates')))}
          ${raw(s.finance ? html`<section class="bt-card" aria-labelledby="h-sd-fin"><div class="bt-card__header"><h2 id="h-sd-fin">Finance</h2><a class="small" href="#/invoices">Invoices</a></div><div class="bt-card__body"><ul class="bt-kv"><li><span>Unpaid invoices</span><strong>${s.finance.unpaidCount}</strong></li><li><span>Overdue</span><strong>${s.finance.overdue}</strong></li><li><span>Drafts not issued</span><strong>${s.finance.drafts}</strong></li><li><span>Outstanding</span><strong>${money(s.finance.outstanding)}</strong></li></ul></div></section>` : '')}
          ${raw(s.subscriptions ? html`<section class="bt-card" aria-labelledby="h-sd-sub"><div class="bt-card__header"><h2 id="h-sd-sub">Subscriptions</h2><a class="small" href="#/admin/subscriptions">Manage</a></div><div class="bt-card__body"><ul class="bt-kv"><li><span>Active</span><strong>${s.subscriptions.active}</strong></li><li><span>Ending within 30 days</span><strong>${s.subscriptions.endingSoon}</strong></li><li><span>Online payments not yet confirmed</span><strong>${s.subscriptions.pendingPayments}</strong></li></ul></div></section>` : '')}
        </div>
      </div>
      <section class="mt-4" aria-labelledby="h-sd-prj"><div class="d-flex justify-content-between align-items-center mb-3"><h2 id="h-sd-prj" class="mb-0">My projects</h2><a href="#/projects" class="small">View all</a></div>${raw(projects)}</section>`;
  }

  return { render };
})();
