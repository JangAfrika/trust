/**
 * Balance Trust — notifications centre and the unread badge.
 */
const Notifications = (() => {
  const { html } = Utils;
  const ICONS = { account: 'person-check', project: 'buildings', payment: 'cash', invoice: 'receipt', stage: 'flag', document: 'file-earmark-text', maintenance: 'tools', rent: 'house' };

  async function refreshCount() {
    try {
      const { data } = await Api.call('getNotifications', { unreadOnly: true, pageSize: 1 });
      App.setUnread(data.unread);
    } catch (e) { /* the badge is non-essential */ }
  }

  function item(n) {
    return html`<li class="bt-list__item ${n.read ? '' : 'is-unread'}">
      <span class="bt-list__icon"><i class="bi bi-${ICONS[n.type] || 'bell'}" aria-hidden="true"></i></span>
      <div class="bt-list__body"><p class="bt-list__title">${n.title}</p><p class="bt-list__text">${n.message}</p></div>
      <div class="text-end"><div class="bt-list__time">${Utils.timeAgo(n.createdAt)}</div>
      ${n.read ? '' : Utils.raw(html`<button type="button" class="btn btn-link btn-sm p-0" data-read="${n.notificationId}">Mark as read</button>`)}</div>
    </li>`;
  }

  async function render(el, page = 1) {
    el.innerHTML = UI.loadingState('Loading notifications…');
    let data;
    try {
      ({ data } = await Api.call('getNotifications', { page, pageSize: 20 }));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      document.getElementById('bt-retry').addEventListener('click', () => render(el, page));
      return;
    }
    App.setUnread(data.unread);
    const actions = data.unread ? '<button type="button" class="btn btn-outline-primary" id="bt-read-all">Mark all as read</button>' : '';
    const header = UI.pageHeader({ title: 'Notifications', subtitle: data.unread ? `${data.unread} unread` : 'You are all caught up.', actions });
    if (!data.items.length) {
      el.innerHTML = header + '<div class="bt-card">' + UI.emptyState({ icon: 'bell-slash', title: 'No notifications yet', text: 'Updates about your account, projects and payments will appear here.' }) + '</div>';
      return;
    }
    const pager = data.pages > 1 ? html`<nav class="d-flex justify-content-between align-items-center p-3" aria-label="Pages">
      <button class="btn btn-sm btn-outline-primary" data-page="${data.page - 1}" ${Utils.raw(data.page <= 1 ? 'disabled' : '')}>Previous</button>
      <span class="small text-muted">Page ${data.page} of ${data.pages}</span>
      <button class="btn btn-sm btn-outline-primary" data-page="${data.page + 1}" ${Utils.raw(data.page >= data.pages ? 'disabled' : '')}>Next</button></nav>` : '';
    el.innerHTML = header + '<div class="bt-card"><ul class="bt-list">' + data.items.map(item).join('') + '</ul>' + pager + '</div>';

    el.querySelectorAll('[data-read]').forEach((btn) => btn.addEventListener('click', async () => {
      const restore = UI.busy(btn, 'Saving…');
      try {
        await Api.call('markNotificationRead', { notificationId: btn.dataset.read });
        render(el, data.page);
      } catch (err) { restore(); UI.toast('error', err.message); }
    }));
    el.querySelectorAll('[data-page]').forEach((btn) => btn.addEventListener('click', () => render(el, Number(btn.dataset.page))));
    const all = el.querySelector('#bt-read-all');
    if (all) all.addEventListener('click', async () => {
      const restore = UI.busy(all, 'Saving…');
      try {
        await Api.call('markNotificationRead', { all: true });
        render(el, 1);
      } catch (err) { restore(); UI.toast('error', err.message); }
    });
  }

  return { render, refreshCount };
})();
