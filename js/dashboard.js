/**
 * Balance Trust — dashboard: who is signed in, their projects, what needs
 * their attention, what they can do next and their financial position.
 */
const Dashboard = (() => {
  const { html, raw } = Utils;

  function outstandingValue(list) {
    if (!list) return null;
    if (!list.length) return '0';
    return list.map((o) => Utils.formatMoney(o.amount, o.currency)).join(' · ');
  }

  function quickActions() {
    const actions = [
      App.can('block.purchase') && ['#/blocks', 'bag-plus', 'Buy a Block'],
      ['#/projects', 'buildings', 'View Projects'],
      App.can('document.view') && ['#/documents', 'folder2-open', 'View Documents'],
      App.can('finance.view.own', 'finance.view.all') && ['#/invoices', 'receipt', 'Invoices'],
      App.can('finance.view.own', 'finance.view.all') && ['#/receipts', 'file-earmark-check', 'Receipts'],
      App.can('block.purchase') && ['#/subscription', 'patch-check', 'Subscription'],
      ['#/notifications', 'bell', 'Notifications']
    ].filter(Boolean);
    return '<div class="bt-actions">' + actions.map(([href, icon, label]) =>
      html`<a class="bt-action" href="${href}"><i class="bi bi-${icon}" aria-hidden="true"></i>${label}</a>`).join('') + '</div>';
  }

  function subscriptionCard(sub) {
    if (!sub || sub.exempt) return '';
    const s = sub.subscription;
    const body = !s
      ? '<p class="mb-2">You have no subscription yet.</p><a class="btn btn-sm btn-accent" href="#/subscription">Choose a plan</a>'
      : html`<p class="mb-1"><strong>${s.plan}</strong> ${raw(UI.statusBadge(s.status))}</p><p class="small text-muted mb-2">${s.status === 'Active' ? 'Active until ' + Utils.formatDate(s.endDate) + ' (' + s.daysLeft + ' day' + (s.daysLeft === 1 ? '' : 's') + ' left)' : 'Ended on ' + Utils.formatDate(s.endDate)}</p><a class="btn btn-sm btn-outline-primary" href="#/subscription">${s.status === 'Active' ? 'Renew or view payments' : 'Renew now'}</a>`;
    return html`<section class="bt-card" aria-labelledby="h-sub"><div class="bt-card__header"><h2 id="h-sub">Subscription</h2></div><div class="bt-card__body">${raw(body)}</div></section>`;
  }

  async function render(el) {
    el.innerHTML = UI.loadingState('Loading dashboard…');
    let data;
    let sub = null;
    try {
      const subCall = App.can('block.purchase') ? Api.call('getMySubscription').then((r) => r.data).catch(() => null) : Promise.resolve(null);
      [{ data }, sub] = await Promise.all([Api.call('getDashboard'), subCall]);
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    const s = data.summary;
    App.setUnread(s.unreadNotifications);
    const firstName = String(data.user.fullName || '').split(' ')[0];

    const stats = [
      UI.statCard({ label: 'Active projects', value: s.activeProjects, icon: 'buildings', href: '#/projects/active' }),
      UI.statCard({ label: 'Completed', value: s.completedProjects, icon: 'check2-circle', tone: 'green', href: '#/projects/completed' }),
      UI.statCard({ label: 'Pending approvals', value: s.pendingApprovals, icon: 'hourglass-split', tone: s.pendingApprovals ? 'gold' : '', hint: s.pendingApprovals ? 'Awaiting your authorization' : 'Nothing waiting on you' }),
      s.outstandingPayments ? UI.statCard({ label: 'Outstanding', value: outstandingValue(s.outstandingPayments), icon: 'receipt', tone: s.outstandingPayments.length ? 'red' : '', href: '#/invoices' }) : '',
      UI.statCard({ label: 'Documents', value: s.documents, icon: 'folder2-open', href: '#/documents' }),
      UI.statCard({ label: 'Unread notifications', value: s.unreadNotifications, icon: 'bell', href: '#/notifications' })
    ].join('');

    const projects = data.projects.length
      ? '<div class="bt-grid bt-grid--cards">' + data.projects.map(UI.projectCard).join('') + '</div>'
      : '<div class="bt-card">' + UI.emptyState({
        icon: 'buildings', title: 'No projects yet',
        text: 'You have not created or purchased a project block.',
        actionHref: App.can('block.purchase') ? '#/blocks' : '', actionLabel: 'Buy a Block'
      }) + '</div>';

    const attention = data.attention.length
      ? '<ul class="bt-list">' + data.attention.map((a) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-hourglass-split" aria-hidden="true"></i></span><div class="bt-list__body"><p class="bt-list__title">${a.title}</p><p class="bt-list__text">Project ${a.projectId}</p></div><a class="btn btn-sm btn-accent" href="#/projects/${encodeURIComponent(a.projectId)}/${a.tab || 'overview'}">Review</a></li>`).join('') + '</ul>'
      : '<p class="text-muted px-4 py-3 mb-0">Nothing needs your attention right now.</p>';

    el.innerHTML = html`
      ${raw(Pages.switcher(App.user(), 'client-dashboard'))}
      ${raw(UI.pageHeader({ title: 'Welcome, ' + firstName, subtitle: 'Here is where your projects stand today.', actions: App.can('block.purchase') ? '<a class="btn btn-accent" href="#/blocks"><i class="bi bi-bag-plus me-2" aria-hidden="true"></i>Buy a Block</a>' : '' }))}
      <section class="bt-grid bt-grid--stats mb-4" aria-label="Summary">${raw(stats)}</section>
      <div class="bt-grid bt-grid--split">
        <section aria-labelledby="h-projects">
          <div class="d-flex justify-content-between align-items-center mb-3"><h2 id="h-projects" class="mb-0">My Projects</h2><a href="#/projects" class="small">View all</a></div>
          ${raw(projects)}
        </section>
        <div class="bt-grid">
          <section class="bt-card" aria-labelledby="h-attention"><div class="bt-card__header"><h2 id="h-attention">Needs your attention</h2></div>${raw(attention)}</section>
          ${raw(subscriptionCard(sub))}
          <section class="bt-card" aria-labelledby="h-actions"><div class="bt-card__header"><h2 id="h-actions">Quick actions</h2></div><div class="bt-card__body">${raw(quickActions())}</div></section>
          <section class="bt-card" aria-labelledby="h-profile"><div class="bt-card__header"><h2 id="h-profile">Your profile</h2><a class="small" href="#/profile">Edit</a></div>
            <div class="bt-card__body d-flex gap-3 align-items-center"><span class="bt-avatar" style="width:3rem;height:3rem;font-size:1rem" aria-hidden="true">${Utils.initials(data.user.fullName)}</span>
            <div><strong>${data.user.fullName}</strong><div class="small text-muted">${data.user.email}</div><div class="small text-muted">${data.user.roles.map((r) => r.name).join(', ')}</div></div></div></section>
        </div>
      </div>`;
  }

  return { render };
})();
