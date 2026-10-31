/**
 * Balance Trust — the administrator's dashboard (admin-dashboard.html):
 * people, block requests, subscriptions, money owed, website messages and
 * the latest activity across the business.
 */
const AdminDashboard = (() => {
  const { html, raw } = Utils;
  const money = (list) => (list && list.length ? list.map((o) => Utils.formatMoney(o.amount, o.currency)).join(' · ') : '0');

  async function render(el) {
    el.innerHTML = UI.loadingState('Loading the admin dashboard…');
    let d;
    try {
      ({ data: d } = await Api.call('getAdminDashboard'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    const p = d.people;
    const sub = d.subscriptions;
    const stats = [
      UI.statCard({ label: 'Clients', value: p.clients, icon: 'people', hint: p.newThisMonth + ' new accounts this month', href: '#/admin/users' }),
      UI.statCard({ label: 'Staff', value: p.staff, icon: 'person-badge', href: '#/admin/users' }),
      UI.statCard({ label: 'Awaiting approval', value: p.awaitingApproval, icon: 'person-check', tone: p.awaitingApproval ? 'gold' : '', href: '#/admin/users' }),
      UI.statCard({ label: 'Block requests', value: d.projects.pendingReview.length, icon: 'inbox', tone: d.projects.pendingReview.length ? 'gold' : '', href: '#/admin/projects' }),
      UI.statCard({ label: 'Active subscriptions', value: sub.active, icon: 'patch-check', tone: 'green', hint: sub.endingSoon + ' end within 30 days', href: '#/admin/subscriptions' }),
      UI.statCard({ label: 'Outstanding invoices', value: money(d.finance.outstanding), icon: 'receipt', tone: d.finance.unpaidInvoices ? 'red' : '', hint: d.finance.unpaidInvoices + ' unpaid', href: '#/invoices' }),
      UI.statCard({ label: 'New website messages', value: d.website.newMessages, icon: 'envelope', tone: d.website.newMessages ? 'gold' : '', href: '#/admin/website' })
    ].join('');
    const statusRows = (obj) => Object.keys(obj).length ? '<ul class="bt-kv">' + Object.keys(obj).sort().map((k) => html`<li><span>${k}</span><strong>${obj[k]}</strong></li>`).join('') + '</ul>' : '<p class="text-muted mb-0">None yet.</p>';
    el.innerHTML = html`
      ${raw(Pages.switcher(App.user(), 'admin-dashboard'))}
      ${raw(UI.pageHeader({ title: 'Admin dashboard', subtitle: 'People, projects, subscriptions and money across the business.', actions: '<a class="btn btn-primary" href="#/admin/users"><i class="bi bi-people me-2" aria-hidden="true"></i>Users</a>' }))}
      <section class="bt-grid bt-grid--stats mb-4" aria-label="Summary">${raw(stats)}</section>
      <div class="bt-grid bt-grid--split">
        <div class="bt-grid">
          <section class="bt-card" aria-labelledby="h-ad-req"><div class="bt-card__header"><h2 id="h-ad-req">Block requests to review</h2><a class="small" href="#/admin/projects">All projects</a></div>
            ${raw(d.projects.pendingReview.length ? '<ul class="bt-list">' + d.projects.pendingReview.map((x) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-inbox" aria-hidden="true"></i></span><div class="bt-list__body"><p class="bt-list__title">${x.name}</p><p class="bt-list__text">${x.block} · ${x.location || ''}</p></div><a class="btn btn-sm btn-accent" href="#/projects/${encodeURIComponent(x.projectId)}/overview">Review</a></li>`).join('') + '</ul>' : '<p class="text-muted px-4 py-3 mb-0">No requests waiting.</p>')}</section>
          <section class="bt-card" aria-labelledby="h-ad-act"><div class="bt-card__header"><h2 id="h-ad-act">Latest activity</h2>${raw(App.can('audit.view') ? '<a class="small" href="#/admin/audit">Audit log</a>' : '')}</div>
            ${raw(d.recentActivity.length ? '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr></thead><tbody>' + d.recentActivity.map((a) => html`<tr><td class="small">${Utils.formatDateTime ? Utils.formatDateTime(a.at) : Utils.formatDate(a.at)}</td><td>${a.by}</td><td><code>${a.action}</code>${raw(a.status && a.status !== 'SUCCESS' ? ' ' + UI.statusBadge(a.status) : '')}</td><td class="small">${a.recordId}</td></tr>`).join('') + '</tbody></table></div>' : '<p class="text-muted px-4 py-3 mb-0">No activity to show.</p>')}</section>
        </div>
        <div class="bt-grid">
          <section class="bt-card" aria-labelledby="h-ad-sub"><div class="bt-card__header"><h2 id="h-ad-sub">Subscriptions</h2><a class="small" href="#/admin/subscriptions">Manage</a></div><div class="bt-card__body"><ul class="bt-kv">
            <li><span>Pay before sign-in</span><strong>${sub.required ? 'On' : 'Off'}</strong></li><li><span>Active</span><strong>${sub.active}</strong></li><li><span>Ending within 30 days</span><strong>${sub.endingSoon}</strong></li><li><span>Ended</span><strong>${sub.ended}</strong></li><li><span>Received this year</span><strong>${money(sub.paidThisYear)}</strong></li><li><span>Cash keys not used yet</span><strong>${sub.unusedKeys}</strong></li></ul></div></section>
          <section class="bt-card" aria-labelledby="h-ad-prj"><div class="bt-card__header"><h2 id="h-ad-prj">Projects by status</h2></div><div class="bt-card__body">${raw(statusRows(d.projects.byStatus))}<p class="small text-muted mt-3 mb-0">${d.projects.awaitingAuthorization} stage${d.projects.awaitingAuthorization === 1 ? '' : 's'} waiting for a client's authorization.</p></div></section>
          <section class="bt-card" aria-labelledby="h-ad-ppl"><div class="bt-card__header"><h2 id="h-ad-ppl">Accounts by status</h2></div><div class="bt-card__body">${raw(statusRows(p.byStatus))}</div></section>
          <section class="bt-card" aria-labelledby="h-ad-web"><div class="bt-card__header"><h2 id="h-ad-web">Website</h2>${raw(App.can('website.manage') ? '<a class="small" href="#/admin/website">Edit</a>' : '')}</div><div class="bt-card__body"><ul class="bt-kv"><li><span>New messages</span><strong>${d.website.newMessages}</strong></li><li><span>Photos in the gallery</span><strong>${d.website.galleryPhotos}</strong></li></ul></div></section>
        </div>
      </div>`;
  }

  return { render };
})();
