/**
 * Balance Trust — Administration: users, roles and permissions, service
 * blocks, all projects, audit log, and system status (health, storage,
 * configuration, backups). Each tab shows only for people whose server-side
 * permissions allow it; the backend checks every action again.
 */
const Admin = (() => {
  const { html, raw } = Utils;
  const TABS = [
    ['users', 'Users', 'people', () => App.can('user.manage')],
    ['roles', 'Roles', 'person-badge', () => App.can('user.manage', 'system.manage')],
    ['blocks', 'Blocks', 'boxes', () => App.can('block.manage')],
    ['subscriptions', 'Subscriptions', 'patch-check', () => App.can('subscription.manage')],
    ['projects', 'Projects', 'buildings', () => App.can('project.view.all')],
    ['website', 'Website', 'globe2', () => App.can('website.manage')],
    ['audit', 'Audit log', 'journal-check', () => App.can('audit.view')],
    ['system', 'System', 'hdd-stack', () => App.can('config.view', 'system.manage')]
  ];

  function formModal({ title, body, submitLabel, size, onSubmit, danger }) {
    const m = UI.modal({ title, size, body: `<form id="bt-admin-form" novalidate>${body}</form>`, footer: `<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" form="bt-admin-form">${Utils.esc(submitLabel)}</button>` });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      if (!Validation.validateForm(f)) return;
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      try {
        const res = await onSubmit(f);
        UI.toast('success', res.message);
        m.close();
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
      }
    });
    return m;
  }

  const roleChecks = (roles, selected, canSys) => roles.map((r) => html`<div class="form-check"><input class="form-check-input" type="checkbox" name="roles" value="${r.key}" id="rl-${r.key}" ${raw(selected.includes(r.key) ? 'checked' : '')} ${raw(r.key === 'SYSTEM_ADMIN' && !canSys ? 'disabled' : '')}><label class="form-check-label" for="rl-${r.key}">${r.name}</label></div>`).join('');
  const checkedRoles = (f) => [...f.querySelectorAll('[name=roles]:checked')].map((x) => x.value);

  /* ---------- users ---------- */
  async function users(panel, reload, filters = {}) {
    panel.innerHTML = UI.loadingState('Loading users…');
    let data;
    try { ({ data } = await Api.call('adminGetUsers', Object.assign({ pageSize: 200 }, filters))); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    const me = App.user().userId;
    panel.innerHTML = html`<div class="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div><label class="form-label small mb-1" for="au-search">Search</label><input class="form-control" id="au-search" value="${filters.search || ''}" placeholder="Name, email or phone"></div>
        <div><label class="form-label small mb-1" for="au-role">Role</label><select class="form-select" id="au-role"><option value="">All roles</option>${raw(data.roles.map((r) => html`<option value="${r.key}" ${raw(filters.role === r.key ? 'selected' : '')}>${r.name}</option>`).join(''))}</select></div>
        <div><label class="form-label small mb-1" for="au-status">Status</label><select class="form-select" id="au-status"><option value="">All</option>${raw(data.statuses.map((s) => html`<option ${raw(filters.status === s ? 'selected' : '')}>${s}</option>`).join(''))}</select></div>
        <button type="button" class="btn btn-outline-primary" data-act="filter">Apply</button>
        <button type="button" class="btn btn-primary ms-auto" data-act="new-user"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>Add user</button></div>
      <section class="bt-card bt-table-wrap"><table class="bt-table"><thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Last sign-in</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>
        ${raw(data.items.map((u) => html`<tr class="bt-row-click" data-open-user="${u.userId}"><td><button type="button" class="bt-linkish fw-semibold" data-open-user="${u.userId}">${u.name}</button><div class="small text-muted">${u.email}${u.phone ? ' · ' + u.phone : ''}</div></td><td class="small">${u.roles.map((r) => r.name).join(', ') || '—'}</td><td>${raw(UI.statusBadge(u.status))}</td><td class="small">${u.lastLoginAt ? Utils.timeAgo(u.lastLoginAt) : 'Never'}</td>
          <td class="num">${raw(u.userId === me ? '<span class="small text-muted">You</span>' : html`<button type="button" class="btn btn-sm btn-outline-primary" data-edit-user="${u.userId}">Edit</button>`)}</td></tr>`).join(''))}
      </tbody></table>${raw(data.items.length ? '' : UI.emptyState({ icon: 'people', title: 'No users match' }))}</section>`;
    const val = (id) => panel.querySelector(id).value;
    panel.querySelector('[data-act="filter"]').addEventListener('click', () => users(panel, reload, { search: val('#au-search'), role: val('#au-role'), status: val('#au-status') }));
    panel.querySelector('#au-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') panel.querySelector('[data-act="filter"]').click(); });
    const again = () => users(panel, reload, filters);
    panel.querySelector('[data-act="new-user"]').addEventListener('click', () => formModal({
      title: 'Add a user', submitLabel: 'Add user',
      body: html`<p class="small text-muted">They receive an email with a code to set their own password. Nobody else ever knows it.</p>
        <div class="mb-3"><label class="form-label" for="nu-name">Full name</label><input class="form-control" id="nu-name" name="fullName" maxlength="120" data-rules="required"></div>
        <div class="row g-3 mb-3"><div class="col-sm-7"><label class="form-label" for="nu-email">Email</label><input class="form-control" id="nu-email" name="email" type="email" data-rules="required email"></div>
          <div class="col-sm-5"><label class="form-label" for="nu-phone">Phone</label><input class="form-control" id="nu-phone" name="phone" type="tel" maxlength="40"></div></div>
        <fieldset><legend class="form-label fs-6">Roles</legend>${raw(roleChecks(data.roles, [], data.canAssignSystemAdmin))}<input type="hidden" name="roles-error" id="nu-roles"></fieldset>`,
      onSubmit: async (f) => {
        const roles = checkedRoles(f);
        if (!roles.length) throw Object.assign(new Error('Choose at least one role.'), { fields: null });
        const res = await Api.call('adminCreateUser', { fullName: f.elements.fullName.value, email: f.elements.email.value, phone: f.elements.phone.value, roles });
        again();
        return res;
      }
    }));
    panel.querySelectorAll('[data-edit-user]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      editUser(data.items.find((x) => x.userId === b.dataset.editUser), data, again);
    }));
    panel.querySelector('tbody').addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-user]')) return;
      const row = e.target.closest('[data-open-user]');
      if (row) openUser(row.dataset.openUser, again);
    });
  }

  /** Roles and status of one person. meta = { roles, statuses, canAssignSystemAdmin }. */
  function editUser(u, meta, after) {
    formModal({
      title: 'Edit ' + u.name, submitLabel: 'Save',
      body: html`<p class="small text-muted mb-3">${u.email}. Suspending signs them out everywhere.</p>
        <div class="mb-3"><label class="form-label" for="eu-status">Status</label><select class="form-select" id="eu-status" name="status">${raw(meta.statuses.map((x) => html`<option ${raw(x === u.status ? 'selected' : '')}>${x}</option>`).join(''))}</select></div>
        <fieldset><legend class="form-label fs-6">Roles</legend>${raw(roleChecks(meta.roles, u.roles.map((r) => r.key), meta.canAssignSystemAdmin))}</fieldset>`,
      onSubmit: async (f) => {
        const roles = checkedRoles(f);
        if (!roles.length) throw Object.assign(new Error('Choose at least one role.'), { fields: null });
        const res = await Api.call('adminUpdateUser', { userId: u.userId, status: f.elements.status.value, roles });
        if (after) after();
        return res;
      }
    });
  }

  const dt = (v) => (v ? Utils.formatDate(v, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

  /**
   * A person's full profile in a side panel: details, roles, projects,
   * properties, sign-ins and recent activity, with the actions an
   * administrator may take. Any list that shows a person can open it.
   */
  async function openUser(userId, afterChange) {
    const d = UI.drawer({ title: 'Profile', body: UI.loadingState('Loading profile…'), wide: true, link: '#/admin/users/' + encodeURIComponent(userId) });
    let p;
    try {
      ({ data: p } = await Api.call('adminGetUser', { userId }));
    } catch (err) {
      d.body.innerHTML = UI.errorState(err);
      return;
    }
    const u = p.user;
    d.setTitle(u.name);
    const activeRoles = p.roles.filter((r) => r.status !== 'Revoked');
    const reopen = () => { d.close(); openUser(userId, afterChange); if (afterChange) afterChange(); };
    const row = (label, value) => html`<dt>${label}</dt><dd>${value || '—'}</dd>`;
    d.body.innerHTML = html`
      <div class="bt-person-head"><span class="bt-avatar" aria-hidden="true">${Utils.initials(u.name)}</span>
        <div class="flex-grow-1" style="min-width:0"><p class="h5 mb-0">${u.name}</p><p class="small text-muted mb-0 text-break">${u.email}${u.phone ? ' · ' + u.phone : ''}</p></div>${raw(UI.statusBadge(u.status))}</div>
      <div class="d-flex flex-wrap gap-2 mb-4">
        ${raw(p.isSelf ? '<span class="small text-muted">This is your own account. Another administrator changes your access.</span>' : '<button type="button" class="btn btn-sm btn-primary" data-act="edit"><i class="bi bi-person-gear me-1" aria-hidden="true"></i>Edit roles and status</button>')}
        ${raw(!p.isSelf && p.sessions.active ? '<button type="button" class="btn btn-sm btn-outline-danger" data-act="signout"><i class="bi bi-box-arrow-right me-1" aria-hidden="true"></i>Sign out everywhere</button>' : '')}
        <a class="btn btn-sm btn-outline-primary" href="mailto:${u.email}"><i class="bi bi-envelope me-1" aria-hidden="true"></i>Email</a>
        ${raw(u.phone ? html`<a class="btn btn-sm btn-outline-primary" href="tel:${u.phone.replace(/[^\d+]/g, '')}"><i class="bi bi-telephone me-1" aria-hidden="true"></i>Call</a>` : '')}
        <button type="button" class="btn btn-sm btn-outline-primary" data-act="audit"><i class="bi bi-journal-check me-1" aria-hidden="true"></i>Full activity</button>
      </div>
      <section class="bt-drawer__section"><h3>Details</h3><dl class="bt-dl">
        ${raw(row('Account type', u.accountType))}${raw(row('Country', u.country))}${raw(row('Address', u.address))}
        ${raw(row('Joined', dt(u.createdAt)))}${raw(row('Last sign-in', u.lastLoginAt ? dt(u.lastLoginAt) + ' (' + Utils.timeAgo(u.lastLoginAt) + ')' : 'Never'))}
        ${raw(row('Signed in now', p.sessions.active ? p.sessions.active + ' device' + (p.sessions.active === 1 ? '' : 's') : 'No'))}${raw(u.failedLogins ? row('Failed sign-ins', String(u.failedLogins)) : '')}
      </dl></section>
      <section class="bt-drawer__section"><h3>Roles</h3>${raw(p.roles.length ? '<ul class="bt-list">' + p.roles.map((r) => html`<li class="bt-list__item"><div class="bt-list__body"><p class="bt-list__title">${r.name}</p><p class="bt-list__text">Since ${Utils.formatDate(r.since)}${r.assignedBy ? ' · by ' + r.assignedBy : ''}</p></div>${raw(UI.statusBadge(r.status))}</li>`).join('') + '</ul>' : '<p class="small text-muted">No roles.</p>')}</section>
      <section class="bt-drawer__section"><h3>Projects (${p.projects.length})</h3>${raw(p.projects.length ? '<ul class="bt-list">' + p.projects.map((x) => html`<li class="bt-list__item"><div class="bt-list__body"><a class="bt-list__title d-block" href="#/projects/${encodeURIComponent(x.projectId)}/overview">${x.name}</a><p class="bt-list__text">${x.role} · ${x.progress}% complete</p></div>${raw(UI.statusBadge(x.status))}</li>`).join('') + '</ul>' : '<p class="small text-muted">Not on any project.</p>')}</section>
      ${raw(p.properties.length ? html`<section class="bt-drawer__section"><h3>Properties (${p.properties.length})</h3><ul class="bt-list">${raw(p.properties.map((x) => html`<li class="bt-list__item"><div class="bt-list__body"><a class="bt-list__title d-block" href="#/property/${encodeURIComponent(x.propertyId)}/overview">${x.name}</a><p class="bt-list__text">${x.role}${x.leaseStart ? ' · lease from ' + Utils.formatDate(x.leaseStart) : ''}</p></div>${raw(UI.statusBadge(x.status))}</li>`).join(''))}</ul></section>` : '')}
      <section class="bt-drawer__section"><h3>Recent activity</h3>${raw(p.activity.length ? '<ol class="bt-timeline">' + p.activity.map((a) => html`<li class="bt-timeline__item"><p class="mb-0"><code>${a.action}</code>${raw(a.status && a.status !== 'SUCCESS' ? ' ' + UI.statusBadge('Failed') : '')}</p><p class="small text-muted mb-2">${dt(a.at)} · ${a.module}${a.recordId ? ' · ' + a.recordId : ''}${a.by !== 'self' ? ' · by ' + a.by : ''}</p></li>`).join('') + '</ol>' : '<p class="small text-muted">No activity recorded yet.</p>')}</section>`;
    const on = (sel, fn) => { const b = d.body.querySelector(sel); if (b) b.addEventListener('click', fn); };
    on('[data-act="edit"]', () => editUser({ userId: u.userId, name: u.name, email: u.email, status: u.status, roles: activeRoles }, { roles: p.allRoles, statuses: p.statuses, canAssignSystemAdmin: p.canAssignSystemAdmin }, reopen));
    on('[data-act="signout"]', async () => {
      if (!(await UI.confirm({ title: 'Sign out everywhere', message: `${u.name} is signed out on every device and must sign in again.`, confirmLabel: 'Sign out', danger: true }))) return;
      try { const res = await Api.call('adminSignOutUser', { userId: u.userId }); UI.toast('success', res.message); reopen(); } catch (err) { UI.toast('error', err.message); }
    });
    on('[data-act="audit"]', () => { d.close(); location.hash = '#/admin/audit/' + encodeURIComponent(u.userId); });
  }

  /** One audit entry in full. */
  function openAudit(a) {
    const pretty = (v) => { try { return JSON.stringify(JSON.parse(v), null, 2); } catch (e) { return v; } };
    const d = UI.drawer({ title: a.action });
    d.body.innerHTML = html`<dl class="bt-dl mb-4"><dt>When</dt><dd>${dt(a.at)}</dd><dt>Who</dt><dd>${raw(a.userId && /^[A-Z]{2,4}-\d+$/.test(a.userId) && App.can('user.manage') ? html`<button type="button" class="bt-linkish" data-open-user="${a.userId}">${a.user}</button>` : Utils.esc(a.user))}</dd>
        <dt>Area</dt><dd>${a.module}</dd><dt>Record</dt><dd>${a.recordId || '—'}</dd><dt>Result</dt><dd>${raw(UI.statusBadge(a.status && a.status !== 'SUCCESS' ? 'Failed' : 'Completed'))}</dd></dl>
      ${raw(a.oldValue ? html`<section class="bt-drawer__section"><h3>Before</h3><pre class="small bg-body-tertiary p-3 rounded text-wrap">${pretty(a.oldValue)}</pre></section>` : '')}
      ${raw(a.newValue ? html`<section class="bt-drawer__section"><h3>After</h3><pre class="small bg-body-tertiary p-3 rounded text-wrap">${pretty(a.newValue)}</pre></section>` : '')}
      <p class="small text-muted mb-0">Audit entries are read-only and cannot be edited or deleted.</p>`;
    const b = d.body.querySelector('[data-open-user]');
    if (b) b.addEventListener('click', () => openUser(b.dataset.openUser));
  }

  /* ---------- roles ---------- */
  async function roles(panel) {
    panel.innerHTML = UI.loadingState('Loading roles…');
    let data;
    try { ({ data } = await Api.call('adminGetRoles')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    const labels = Object.fromEntries(data.catalog.map((c) => [c.key, c.label]));
    panel.innerHTML = (data.canEdit ? '' : '<div class="bt-alert bt-alert--info mb-3"><i class="bi bi-info-circle me-2" aria-hidden="true"></i>Only a System Administrator can change what a role may do. You can assign roles to people on the Users tab.</div>') +
      '<div class="d-grid gap-3">' + data.roles.map((r) => html`<article class="bt-card"><div class="bt-card__header"><div><h2>${r.name}</h2><p class="small text-muted mb-0">${r.description} · ${r.users} user${r.users === 1 ? '' : 's'}</p></div>${raw(data.canEdit && !r.locked ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-edit-role="${r.key}">Edit permissions</button>` : '')}</div>
        <div class="bt-card__body"><div class="d-flex flex-wrap gap-2">${raw(r.permissions.includes('*') ? '<span class="bt-badge bt-badge--success"><i class="bi bi-shield-check" aria-hidden="true"></i>Every permission</span>' : r.permissions.map((p) => html`<span class="bt-badge bt-badge--neutral" title="${p}">${labels[p] || p}</span>`).join(''))}</div></div></article>`).join('') + '</div>';
    panel.querySelectorAll('[data-edit-role]').forEach((b) => b.addEventListener('click', () => {
      const r = data.roles.find((x) => x.key === b.dataset.editRole);
      formModal({
        title: 'Permissions: ' + r.name, submitLabel: 'Save permissions', size: 'lg',
        body: '<p class="small text-muted">Changes apply to everyone with this role at their next request.</p><div class="row">' + data.catalog.map((c) => html`<div class="col-md-6"><div class="form-check"><input class="form-check-input" type="checkbox" name="perm" value="${c.key}" id="pm-${c.key}" ${raw(r.permissions.includes(c.key) ? 'checked' : '')}><label class="form-check-label" for="pm-${c.key}">${c.label} <span class="small text-muted">(${c.key})</span></label></div></div>`).join('') + '</div>',
        onSubmit: async (f) => { const res = await Api.call('adminUpdateRole', { roleKey: r.key, permissions: [...f.querySelectorAll('[name=perm]:checked')].map((x) => x.value) }); roles(panel); return res; }
      });
    }));
  }

  /* ---------- blocks ---------- */
  async function blocks(panel) {
    panel.innerHTML = UI.loadingState('Loading blocks…');
    let list;
    try { ({ data: list } = await Api.call('adminGetBlocks')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    panel.innerHTML = '<div class="d-flex justify-content-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-act="new-block"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add block</button></div>' +
      '<section class="bt-card bt-table-wrap"><table class="bt-table"><thead><tr><th>#</th><th>Block</th><th class="num">Price</th><th>Duration</th><th>Default stages</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      list.map((b) => html`<tr><td>${b.sortOrder}</td><td><strong>${b.name}</strong><div class="small text-muted">${b.description}</div></td><td class="num">${b.price === null ? 'On request' : Utils.formatMoney(b.price, b.currency)}</td><td>${b.duration || '—'}</td><td class="small">${String(b.defaultStages || '').split(/\r?\n|;/).filter((x) => x.trim()).length || '—'}</td><td>${raw(UI.statusBadge(b.status))}</td><td class="num text-nowrap"><button type="button" class="btn btn-sm btn-outline-primary" data-fields-block="${b.blockId}">Details list</button> <button type="button" class="btn btn-sm btn-outline-primary" data-edit-block="${b.blockId}">Edit</button></td></tr>`).join('') + '</tbody></table></section>';
    const form = (b) => formModal({
      title: b ? 'Edit ' + b.name : 'Add a block', submitLabel: 'Save block', size: 'lg',
      body: html`<div class="row g-3 mb-3"><div class="col-sm-8"><label class="form-label" for="bk-name">Name</label><input class="form-control" id="bk-name" name="name" maxlength="120" data-rules="required" value="${b ? b.name : ''}"></div>
          <div class="col-sm-2"><label class="form-label" for="bk-order">Order</label><input class="form-control" id="bk-order" name="sortOrder" type="number" min="0" max="999" value="${b ? b.sortOrder : ''}"></div>
          <div class="col-sm-2"><label class="form-label" for="bk-status">Status</label><select class="form-select" id="bk-status" name="status"><option ${raw(!b || b.status === 'Active' ? 'selected' : '')}>Active</option><option ${raw(b && b.status === 'Inactive' ? 'selected' : '')}>Inactive</option></select></div></div>
        <div class="mb-3"><label class="form-label" for="bk-desc">Description</label><textarea class="form-control" id="bk-desc" name="description" rows="2" maxlength="1000" data-rules="required">${b ? b.description : ''}</textarea></div>
        <div class="row g-3 mb-3"><div class="col-sm-4"><label class="form-label" for="bk-price">Price <span class="text-muted fw-normal">(empty = on request)</span></label><input class="form-control" id="bk-price" name="price" type="number" min="0" step="0.01" value="${b && b.price !== null ? b.price : ''}"></div>
          <div class="col-sm-3"><label class="form-label" for="bk-cur">Currency</label><input class="form-control text-uppercase" id="bk-cur" name="currency" maxlength="3" value="${b ? b.currency : ''}"></div>
          <div class="col-sm-5"><label class="form-label" for="bk-dur">Duration</label><input class="form-control" id="bk-dur" name="duration" maxlength="120" value="${b ? b.duration : ''}" placeholder="e.g. 6 to 9 months"></div></div>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="bk-feat">Features <span class="text-muted fw-normal">(one per line)</span></label><textarea class="form-control" id="bk-feat" name="features" rows="4" maxlength="3000">${b ? b.features : ''}</textarea></div>
          <div class="col-sm-6"><label class="form-label" for="bk-stages">Default stages <span class="text-muted fw-normal">(one per line)</span></label><textarea class="form-control" id="bk-stages" name="defaultStages" rows="4" maxlength="3000">${b ? b.defaultStages : ''}</textarea><div class="form-text">New projects of this block start with these stages.</div></div></div>
        <div><label class="form-label" for="bk-terms">Terms</label><textarea class="form-control" id="bk-terms" name="terms" rows="3" maxlength="5000">${b ? b.terms : ''}</textarea><div class="form-text">If set, clients must accept them when requesting this block.</div></div>`,
      onSubmit: async (f) => { const res = await Api.call('adminSaveBlock', Object.assign({ blockId: b ? b.blockId : '' }, Object.fromEntries(new FormData(f).entries()))); blocks(panel); return res; }
    });
    panel.querySelector('[data-act="new-block"]').addEventListener('click', () => form(null));
    panel.querySelectorAll('[data-edit-block]').forEach((x) => x.addEventListener('click', () => form(list.find((b) => b.blockId === x.dataset.editBlock))));
    panel.querySelectorAll('[data-fields-block]').forEach((x) => x.addEventListener('click', () => blockFields(x.dataset.fieldsBlock)));
  }

  /* ---------- subscriptions: plans, subscribers, payments ---------- */
  const periodLabel = (m) => (m === 1 ? '1 month' : m === 12 ? '1 year' : m + ' months');

  async function subscriptions(panel) {
    panel.innerHTML = UI.loadingState('Loading subscriptions…');
    let d;
    try { ({ data: d } = await Api.call('adminGetSubscriptions')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    const st = d.settings;
    const yes = (ok, text, missing) => html`<li>${raw(ok ? '<i class="bi bi-check-circle text-success" aria-hidden="true"></i>' : '<i class="bi bi-x-circle text-danger" aria-hidden="true"></i>')} ${text}${raw(ok ? '' : html` <span class="small text-muted">${missing}</span>`)}</li>`;
    const money = (a, c) => (a === null ? '—' : Utils.formatMoney(a, c));
    panel.innerHTML = html`
      <section class="bt-card mb-4" aria-labelledby="h-sub-set"><div class="bt-card__header"><h2 id="h-sub-set">Payments setup</h2></div><div class="bt-card__body">
        <ul class="list-unstyled d-grid gap-2 mb-3">
          ${raw(yes(st.wave, 'Wave', '— add WAVE_API_KEY in Apps Script → Project Settings → Script Properties.'))}
          ${raw(yes(st.modem, 'Visa and other cards, through Modem Pay', '— add MODEM_PAY_SECRET_KEY (from your Modem Pay dashboard) in Script Properties.'))}
          ${raw(yes(st.frontendUrl, 'Site address (FRONTEND_URL), where payers return', '— set it in Administration → System.'))}
        </ul>
        <div class="d-flex flex-wrap align-items-center gap-3">
          <div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="sub-required" ${raw(st.required ? 'checked' : '')} ${raw(App.can('system.manage') ? '' : 'disabled')}><label class="form-check-label" for="sub-required">Clients must pay a yearly subscription before they can sign up or sign in</label></div>
          <span class="small text-muted">Reminders go out ${st.reminderDays} days and 1 day before a subscription ends.${raw(App.can('system.manage') ? '' : ' A System Administrator can change these settings.')}</span>
        </div>
      </div></section>
      <section class="bt-card mb-4" aria-labelledby="h-sub-plans"><div class="bt-card__header"><h2 id="h-sub-plans">Plans</h2><button type="button" class="btn btn-primary btn-sm" data-act="new-plan"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add plan</button></div>
        ${raw(d.plans.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>#</th><th>Plan</th><th>Period</th><th class="num">Price (Wave, Visa card, cash)</th><th class="num">Other price</th><th>Can be paid by</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(d.plans.map((p) => html`<tr><td>${p.sortOrder}</td><td><strong>${p.name}</strong>${raw(p.description ? html`<div class="small text-muted">${p.description}</div>` : '')}</td><td>${periodLabel(p.periodMonths)}</td><td class="num">${money(p.localPrice, p.localCurrency)}</td><td class="num">${money(p.intlPrice, p.intlCurrency)}</td><td class="small">${p.methods.join(', ') || 'Staff-recorded payments only'}</td><td>${raw(UI.statusBadge(p.status))}</td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-edit-plan="${p.planId}">Edit</button></td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'patch-plus', title: 'No plans yet', text: 'Add a plan with its price. Clients see it on the Subscription page and the welcome page.' }))}
      </section>
      <section class="bt-card mb-4" aria-labelledby="h-sub-subs"><div class="bt-card__header"><h2 id="h-sub-subs">Subscribers (${d.subscriptions.length})</h2><button type="button" class="btn btn-outline-primary btn-sm" data-act="record" ${raw(d.plans.length ? '' : 'disabled')}><i class="bi bi-cash-coin me-1" aria-hidden="true"></i>Record a payment</button></div>
        ${raw(d.subscriptions.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Subscriber</th><th>Plan</th><th>Status</th><th>Until</th><th class="num">Days left</th></tr></thead><tbody>${raw(d.subscriptions.map((x) => html`<tr><td>${raw(App.can('user.manage') ? html`<a href="#/admin/users/${x.userId}">${x.user}</a>` : Utils.esc(x.user))}</td><td>${x.plan}</td><td>${raw(UI.statusBadge(x.status))}</td><td>${Utils.formatDate(x.endDate)}</td><td class="num">${x.status === 'Active' ? x.daysLeft : '—'}</td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'people', title: 'No subscribers yet' }))}
      </section>
      <section class="bt-card mb-4" aria-labelledby="h-sub-keys"><div class="bt-card__header"><h2 id="h-sub-keys">Cash payments and activation keys</h2><button type="button" class="btn btn-primary btn-sm" data-act="issue-key" ${raw(d.plans.length ? '' : 'disabled')}><i class="bi bi-key me-1" aria-hidden="true"></i>Record cash payment and issue key</button></div>
        <p class="small text-muted px-3 pt-3 mb-0">When a client pays at the office, record it here. They get a one-time key to enter when they sign up, or when they renew. The key is shown only once.</p>
        ${raw(d.keys.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Date paid</th><th>Paid by</th><th>Plan</th><th class="num">Amount</th><th>Key</th><th>Status</th><th>Used by</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(d.keys.map((k) => html`<tr><td>${Utils.formatDate(k.paidAt)}</td><td>${k.issuedTo}${raw(k.issuedPhone ? html`<div class="small text-muted">${k.issuedPhone}</div>` : '')}</td><td>${k.plan}</td><td class="num">${Utils.formatMoney(k.amount, k.currency)}<div class="small text-muted">${k.method}</div></td><td class="small">${k.hint}<div class="text-muted">${k.reference}</div><div class="text-muted">recorded by ${k.recordedBy}</div></td><td>${raw(UI.statusBadge(k.status))}</td><td class="small">${k.usedBy}${raw(k.usedAt ? html`<div class="text-muted">${Utils.formatDate(k.usedAt)}</div>` : '')}</td><td class="num">${raw(k.status === 'Unused' ? html`<button type="button" class="btn btn-sm btn-outline-danger" data-revoke-key="${k.keyId}">Cancel key</button>` : '')}</td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'key', title: 'No activation keys yet' }))}
      </section>
      <section class="bt-card" aria-labelledby="h-sub-pays"><div class="bt-card__header"><h2 id="h-sub-pays">Payments</h2></div>
        ${raw(d.payments.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Date</th><th>Subscriber</th><th>Plan</th><th>Method</th><th class="num">Amount</th><th>Status</th><th>Reference</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(d.payments.map((p) => html`<tr><td>${Utils.formatDate(p.paidAt || p.createdAt)}</td><td>${p.user}</td><td>${p.plan}</td><td>${p.method}${raw(p.recordedBy ? html`<div class="small text-muted">recorded by ${p.recordedBy}</div>` : '')}</td><td class="num">${Utils.formatMoney(p.amount, p.currency)}</td><td>${raw(UI.statusBadge(p.status))}${raw(p.failureReason ? html`<div class="small text-muted">${p.failureReason}</div>` : '')}</td><td class="small">${p.paymentId}${raw(p.reference ? html`<div class="text-muted">${p.reference}</div>` : '')}</td><td class="num">${raw(p.status === 'Pending' && ['Wave', 'PayPal', 'Card'].includes(p.method) ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-check-pay="${p.paymentId}">Check now</button>` : '')}</td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'receipt', title: 'No payments yet' }))}
      </section>`;
    const reload = () => subscriptions(panel);
    const sw = panel.querySelector('#sub-required');
    sw.addEventListener('change', async () => {
      try { const res = await Api.call('adminUpdateConfig', { key: 'SUBSCRIPTION_REQUIRED', value: sw.checked ? 'true' : 'false' }); UI.toast('success', sw.checked ? 'Clients now pay before they can use their account.' : 'Subscriptions are now optional.'); return res; } catch (err) { sw.checked = !sw.checked; UI.toast('error', err.message); }
    });
    const planForm = (p) => formModal({
      title: p ? 'Edit ' + p.name : 'Add a plan', submitLabel: 'Save plan', size: 'lg',
      body: html`<div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="pl-name">Name</label><input class="form-control" id="pl-name" name="name" maxlength="80" data-rules="required" value="${p ? p.name : ''}"></div>
          <div class="col-sm-2"><label class="form-label" for="pl-period">Period</label><select class="form-select" id="pl-period" name="periodMonths">${raw(d.periods.map((m) => html`<option value="${m}" ${raw(p && p.periodMonths === m ? 'selected' : '')}>${periodLabel(m)}</option>`).join(''))}</select></div>
          <div class="col-sm-2"><label class="form-label" for="pl-order">Order</label><input class="form-control" id="pl-order" name="sortOrder" type="number" min="0" max="999" value="${p ? p.sortOrder : ''}"></div>
          <div class="col-sm-2"><label class="form-label" for="pl-status">Status</label><select class="form-select" id="pl-status" name="status"><option ${raw(!p || p.status === 'Active' ? 'selected' : '')}>Active</option><option ${raw(p && p.status === 'Inactive' ? 'selected' : '')}>Inactive</option></select></div></div>
        <div class="mb-3"><label class="form-label" for="pl-desc">Description <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="pl-desc" name="description" maxlength="500" value="${p ? p.description : ''}"></div>
        <div class="mb-3"><label class="form-label" for="pl-feat">What it includes <span class="text-muted fw-normal">(one per line)</span></label><textarea class="form-control" id="pl-feat" name="features" rows="3" maxlength="2000">${p ? p.features.join('\n') : ''}</textarea></div>
        <div class="row g-3"><div class="col-sm-3"><label class="form-label" for="pl-lp">Price per year</label><input class="form-control" id="pl-lp" name="localPrice" type="number" min="0" step="0.01" value="${p && p.localPrice !== null ? p.localPrice : ''}"></div>
          <div class="col-sm-3"><label class="form-label" for="pl-lc">Currency</label><input class="form-control text-uppercase" id="pl-lc" name="localCurrency" maxlength="3" placeholder="e.g. GMD" value="${p ? p.localCurrency : ''}"></div>
          <div class="col-sm-3"><label class="form-label" for="pl-ip">Other price <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="pl-ip" name="intlPrice" type="number" min="0" step="0.01" value="${p && p.intlPrice !== null ? p.intlPrice : ''}"></div>
          <div class="col-sm-3"><label class="form-label" for="pl-ic">Currency</label><input class="form-control text-uppercase" id="pl-ic" name="intlCurrency" maxlength="3" placeholder="e.g. USD" value="${p ? p.intlCurrency : ''}"></div></div>
        <p class="form-text mb-0">Wave, Visa cards (Modem Pay) and activation keys use the local price, e.g. in GMD. The other price is optional, for cash or bank payments taken in another currency.</p>`,
      onSubmit: async (f) => { const res = await Api.call('adminSavePlan', Object.assign({ planId: p ? p.planId : '' }, Object.fromEntries(new FormData(f).entries()))); reload(); return res; }
    });
    panel.querySelector('[data-act="new-plan"]').addEventListener('click', () => planForm(null));
    panel.querySelectorAll('[data-edit-plan]').forEach((b) => b.addEventListener('click', () => planForm(d.plans.find((p) => p.planId === b.dataset.editPlan))));
    panel.querySelector('[data-act="record"]').addEventListener('click', () => formModal({
      title: 'Record a payment', submitLabel: 'Record payment',
      body: html`<p class="small text-muted">For money received outside the app: cash, bank transfer, or Wave sent straight to your number. The subscription is extended by the plan's period.</p>
        <div class="mb-3"><label class="form-label" for="rp-user">Subscriber</label><select class="form-select" id="rp-user" name="userId" data-rules="required"><option value="">Choose…</option>${raw(d.clients.map((c) => html`<option value="${c.userId}">${c.name} (${c.email})</option>`).join(''))}</select></div>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="rp-plan">Plan</label><select class="form-select" id="rp-plan" name="planId">${raw(d.plans.map((p) => html`<option value="${p.planId}">${p.name} (${periodLabel(p.periodMonths)})</option>`).join(''))}</select></div>
          <div class="col-sm-6"><label class="form-label" for="rp-price">Price paid</label><select class="form-select" id="rp-price" name="priceType"><option value="local">Main price</option><option value="intl">Other price</option></select></div></div>
        <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="rp-method">Method</label><select class="form-select" id="rp-method" name="method">${raw(d.manualMethods.map((m) => html`<option>${m}</option>`).join(''))}</select></div>
          <div class="col-sm-6"><label class="form-label" for="rp-date">Date received</label><input class="form-control" id="rp-date" name="paidAt" type="date" max="${new Date().toISOString().substring(0, 10)}"></div>
          <div class="col-12"><label class="form-label" for="rp-ref">Reference</label><input class="form-control" id="rp-ref" name="reference" maxlength="120" data-rules="required" placeholder="Receipt number, bank or Wave transaction ID"></div></div>`,
      onSubmit: async (f) => { const res = await Api.call('adminRecordSubscriptionPayment', Object.fromEntries(new FormData(f).entries())); reload(); return res; }
    }));
    panel.querySelector('[data-act="issue-key"]').addEventListener('click', () => formModal({
      title: 'Record a cash payment', submitLabel: 'Record and issue key',
      body: html`<p class="small text-muted">Record the money first. The client then gets a one-time key to activate a year of subscription.</p>
        <div class="row g-3 mb-3"><div class="col-sm-7"><label class="form-label" for="ik-name">Paid by (name)</label><input class="form-control" id="ik-name" name="issuedTo" maxlength="120" data-rules="required"></div>
          <div class="col-sm-5"><label class="form-label" for="ik-phone">Phone <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="ik-phone" name="issuedPhone" type="tel" maxlength="40" placeholder="+220 …"></div></div>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="ik-plan">Plan</label><select class="form-select" id="ik-plan" name="planId">${raw(d.plans.filter((p) => p.status === 'Active').map((p) => html`<option value="${p.planId}">${p.name} (${p.localPrice !== null ? Utils.formatMoney(p.localPrice, p.localCurrency) : 'no local price'})</option>`).join(''))}</select></div>
          <div class="col-sm-6"><label class="form-label" for="ik-price">Price paid</label><select class="form-select" id="ik-price" name="priceType"><option value="local">Main price</option><option value="intl">Other price</option></select></div></div>
        <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="ik-method">Paid by</label><select class="form-select" id="ik-method" name="method">${raw(d.manualMethods.map((m) => html`<option>${m}</option>`).join(''))}</select></div>
          <div class="col-sm-6"><label class="form-label" for="ik-date">Date received</label><input class="form-control" id="ik-date" name="paidAt" type="date" max="${new Date().toISOString().substring(0, 10)}"></div>
          <div class="col-12"><label class="form-label" for="ik-ref">Receipt number or reference</label><input class="form-control" id="ik-ref" name="reference" maxlength="120" data-rules="required"></div></div>`,
      onSubmit: async (f) => {
        const res = await Api.call('adminIssueActivationKey', Object.fromEntries(new FormData(f).entries()));
        const k = res.data;
        // Shown once the form has closed, so the two dialogs never overlap.
        setTimeout(() => showKey(k), 450);
        return res;
      }
    }));
    const showKey = (k) => {
        const shown = UI.modal({
          title: 'Activation key for ' + k.issuedTo,
          body: html`<p>Give this key to ${k.issuedTo}. It activates one year of "${k.plan}" (${Utils.formatMoney(k.amount, k.currency)} received). It works once.</p>
            <p class="text-center my-4"><code class="fs-3 user-select-all" id="ik-key">${k.key}</code></p>
            <div class="bt-alert bt-alert--info mb-0"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Write it on the receipt or send it to the client now. For security it is not stored and cannot be shown again; if it is lost, cancel it and issue a new one.</span></div>`,
          footer: '<button type="button" class="btn btn-outline-primary" data-copy-key><i class="bi bi-clipboard me-1" aria-hidden="true"></i>Copy</button><button type="button" class="btn btn-primary" data-bs-dismiss="modal">Done</button>'
        });
        shown.el.querySelector('[data-copy-key]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(k.key); UI.toast('success', 'Key copied.'); } catch (e) { UI.toast('info', 'Select the key and copy it.'); } });
        reload();
    };
    panel.querySelectorAll('[data-revoke-key]').forEach((b) => b.addEventListener('click', () => formModal({
      title: 'Cancel this key', submitLabel: 'Cancel key', danger: true,
      body: '<p class="small text-muted">The key will no longer work. Use this if the payment was refunded or recorded by mistake.</p><div><label class="form-label" for="rk-reason">Reason</label><input class="form-control" id="rk-reason" name="reason" maxlength="300" data-rules="required"></div>',
      onSubmit: async (f) => { const res = await Api.call('adminRevokeActivationKey', { keyId: b.dataset.revokeKey, reason: new FormData(f).get('reason') }); reload(); return res; }
    })));
    panel.querySelectorAll('[data-check-pay]').forEach((b) => b.addEventListener('click', async () => {
      const restore = UI.busy(b, 'Checking…');
      try { const { message } = await Api.call('adminCheckSubscriptionPayment', { paymentId: b.dataset.checkPay }); UI.toast('info', message); reload(); } catch (err) { restore(); UI.toast('error', err.message); }
    }));
  }

  /* ---------- website: texts, gallery photos, contact messages ---------- */

  /** Shrinks a photo in the browser (longest side 1600 px, JPEG) so the website loads fast. */
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg', mimeType: 'image/jpeg', base64: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as a photo.')); };
      img.src = url;
    });
  }

  async function website(panel) {
    panel.innerHTML = UI.loadingState('Loading the website settings…');
    let d;
    try { ({ data: d } = await Api.call('adminGetWebsite')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    const reload = () => website(panel);
    const c = d.company;
    const newCount = d.messages.filter((m) => m.status === 'New').length;
    panel.innerHTML = html`
      <section class="bt-card mb-4" aria-labelledby="h-w-msg"><div class="bt-card__header"><h2 id="h-w-msg">Messages from the Contact tab${raw(newCount ? html` <span class="badge text-bg-warning">${newCount} new</span>` : '')}</h2></div>
        ${raw(d.messages.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Received</th><th>From</th><th>Subject</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(d.messages.map((m) => html`<tr><td class="small">${Utils.formatDate(m.createdAt)}</td><td>${m.fullName}<div class="small text-muted">${[m.email, m.phone].filter(Boolean).join(' · ')}</div></td><td>${m.subject}</td><td>${raw(UI.statusBadge(m.status))}${raw(m.handledBy ? html`<div class="small text-muted">${m.handledBy}</div>` : '')}</td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-msg="${m.messageId}">Open</button></td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'envelope', title: 'No messages yet', text: 'Messages sent from the website\'s Contact tab appear here, and administrators are notified.' }))}
      </section>
      <section class="bt-card mb-4" aria-labelledby="h-w-gal"><div class="bt-card__header"><h2 id="h-w-gal">Gallery</h2><button type="button" class="btn btn-primary btn-sm" data-act="add-photo"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add photo</button></div>
        ${raw(d.gallery.length ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>#</th><th>Photo</th><th>Category</th><th>Status</th><th>Added</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(d.gallery.map((g) => html`<tr><td>${g.sortOrder}</td><td><strong>${g.title || '(no title)'}</strong>${raw(g.caption ? html`<div class="small text-muted">${g.caption}</div>` : '')}</td><td>${g.category}</td><td>${raw(UI.statusBadge(g.status === 'Active' ? 'Published' : g.status))}</td><td class="small">${Utils.formatDate(g.createdAt)}<div class="text-muted">${g.uploadedBy}</div></td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-photo="${g.imageId}">Edit</button></td></tr>`).join(''))}</tbody></table></div>` : UI.emptyState({ icon: 'images', title: 'No photos yet', text: 'Add photos of your projects. Published photos appear on the website\'s Gallery tab.' }))}
      </section>
      <section class="bt-card" aria-labelledby="h-w-txt"><div class="bt-card__header"><h2 id="h-w-txt">Website texts</h2></div><div class="bt-card__body">
        <p class="small text-muted">Each text appears on the website once it is filled in. Leave one empty to leave it off. The company name, address, phone and email come from Administration → System (${c.name ? 'set' : 'not set yet'}).</p>
        <div class="bt-table-wrap"><table class="bt-table"><tbody>${raw(Object.keys(d.texts).map((k) => html`<tr><th scope="row" class="w-25">${d.texts[k].label}</th><td class="small" style="white-space:pre-line">${d.texts[k].value || '—'}</td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-text="${k}">Edit</button></td></tr>`).join(''))}</tbody></table></div>
      </div></section>`;

    panel.querySelectorAll('[data-text]').forEach((b) => b.addEventListener('click', () => {
      const t = d.texts[b.dataset.text];
      const long = t.max > 200;
      formModal({
        title: t.label, submitLabel: 'Save', size: long ? 'lg' : '',
        body: long
          ? html`<label class="form-label visually-hidden" for="wt-value">${t.label}</label><textarea class="form-control" id="wt-value" name="value" rows="${t.max > 1500 ? 10 : 5}" maxlength="${t.max}">${t.value}</textarea><div class="form-text">Up to ${t.max} characters. Leave empty to remove it from the website.</div>`
          : html`<label class="form-label visually-hidden" for="wt-value">${t.label}</label><input class="form-control" id="wt-value" name="value" maxlength="${t.max}" value="${t.value}"><div class="form-text">Leave empty to remove it from the website.</div>`,
        onSubmit: async (f) => { const res = await Api.call('adminSaveWebsiteText', { key: b.dataset.text, value: f.elements.value.value }); reload(); return res; }
      });
    }));

    const photoFields = (g) => html`<div class="row g-3"><div class="col-sm-8"><label class="form-label" for="gp-title">Title <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="gp-title" name="title" maxlength="120" value="${g ? g.title : ''}"></div>
        <div class="col-sm-4"><label class="form-label" for="gp-order">Order</label><input class="form-control" id="gp-order" name="sortOrder" type="number" min="0" max="9999" value="${g ? g.sortOrder : ''}"></div>
        <div class="col-12"><label class="form-label" for="gp-caption">Caption <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="gp-caption" name="caption" maxlength="500" value="${g ? g.caption : ''}"></div>
        <div class="col-sm-6"><label class="form-label" for="gp-cat">Category</label><select class="form-select" id="gp-cat" name="category">${raw(d.categories.map((x) => html`<option ${raw(g && g.category === x ? 'selected' : '')}>${x}</option>`).join(''))}</select></div></div>`;

    panel.querySelector('[data-act="add-photo"]').addEventListener('click', () => formModal({
      title: 'Add a photo', submitLabel: 'Upload photo', size: 'lg',
      body: html`<div class="mb-3"><label class="form-label" for="gp-file">Photo</label><input class="form-control" id="gp-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" data-rules="required"><div class="form-text">JPEG, PNG or WebP. It is resized for the web before upload. Only add photos you have the right to publish, and avoid showing people without their consent.</div></div>
        ${raw(photoFields(null))}<div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="gp-pub" name="publish" checked><label class="form-check-label" for="gp-pub">Publish on the website now</label></div>`,
      onSubmit: async (f) => {
        const file = f.elements.file.files[0];
        if (!file) throw Object.assign(new Error('Choose a photo.'), { fields: { file: 'Choose a photo.' } });
        const upload = await shrinkImage(file);
        const res = await Api.call('adminUploadGalleryImage', { title: f.elements.title.value, caption: f.elements.caption.value, category: f.elements.category.value, sortOrder: f.elements.sortOrder.value, publish: f.elements.publish.checked, file: upload }, { timeoutMs: 90000 });
        reload();
        return res;
      }
    }));

    panel.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => {
      const g = d.gallery.find((x) => x.imageId === b.dataset.photo);
      formModal({
        title: 'Edit photo', submitLabel: 'Save', size: 'lg',
        body: html`${raw(photoFields(g))}<div class="mt-3"><label class="form-label" for="gp-status">Show on the website</label><select class="form-select" id="gp-status" name="status"><option value="Active" ${raw(g.status === 'Active' ? 'selected' : '')}>Published</option><option value="Hidden" ${raw(g.status === 'Hidden' ? 'selected' : '')}>Hidden</option><option value="Removed">Remove the photo</option></select></div>`,
        onSubmit: async (f) => { const res = await Api.call('adminUpdateGalleryImage', Object.assign({ imageId: g.imageId }, Object.fromEntries(new FormData(f).entries()))); reload(); return res; }
      });
    }));

    panel.querySelectorAll('[data-msg]').forEach((b) => b.addEventListener('click', () => {
      const m = d.messages.find((x) => x.messageId === b.dataset.msg);
      const reply = m.email ? 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re: ' + m.subject) : '';
      formModal({
        title: m.subject, submitLabel: 'Save', size: 'lg',
        body: html`<p class="small text-muted mb-2">From <strong>${m.fullName}</strong> · ${Utils.formatDate(m.createdAt)}</p>
          <ul class="list-unstyled small mb-3">${raw(m.email ? html`<li><i class="bi bi-envelope me-2" aria-hidden="true"></i><a href="${reply}">${m.email}</a></li>` : '')}${raw(m.phone ? html`<li><i class="bi bi-telephone me-2" aria-hidden="true"></i><a href="tel:${m.phone.replace(/[^\d+]/g, '')}">${m.phone}</a></li>` : '')}</ul>
          <div class="bt-card p-3 mb-3" style="white-space:pre-line">${m.message}</div>
          <div class="row g-3"><div class="col-sm-5"><label class="form-label" for="cm-status">Status</label><select class="form-select" id="cm-status" name="status">${raw(d.statuses.map((x) => html`<option ${raw((m.status === 'New' ? 'Read' : m.status) === x ? 'selected' : '')}>${x}</option>`).join(''))}</select></div>
            <div class="col-12"><label class="form-label" for="cm-notes">Note for colleagues <span class="text-muted fw-normal">(optional)</span></label><textarea class="form-control" id="cm-notes" name="notes" rows="2" maxlength="2000">${m.notes}</textarea></div></div>`,
        onSubmit: async (f) => { const res = await Api.call('adminUpdateContactMessage', Object.assign({ messageId: m.messageId }, Object.fromEntries(new FormData(f).entries()))); reload(); return res; }
      });
    }));
  }

  /* ---------- a block's details list (what it asks for; its own sheet) ---------- */
  const TYPE_LABELS = { text: 'Short answer', textarea: 'Long answer', number: 'Number', date: 'Date', select: 'Choice from a list', yesno: 'Yes or no', document: 'File upload' };

  async function blockFields(blockId, drawer) {
    const d = drawer || UI.drawer({ title: 'Details list', wide: true, body: UI.loadingState('Loading…') });
    let data;
    try { ({ data } = await Api.call('adminGetBlockFields', { blockId })); } catch (err) { d.body.innerHTML = UI.errorState(err); return; }
    d.setTitle(data.name + ': details list');
    const sections = BlockDetails.groups(data.fields);
    d.body.innerHTML = html`<p class="small text-muted">Everything this block asks for. Clients answer their details when they request the block; staff record theirs on the project's Details tab. Answers are kept in the sheet <strong>${data.sheet}</strong>, one row per project and one column per detail.</p>
      <div class="d-flex justify-content-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-act="new-field"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a detail</button></div>
      ${raw(sections.length ? sections.map(([section, list]) => html`<section class="bt-drawer__section"><h3>${section}</h3><div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>#</th><th>Detail</th><th>Answer</th><th>By</th><th>Status</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>${raw(list.map((f) => html`<tr><td class="small">${f.sortOrder}</td><td>${f.label}${raw(f.required ? ' <span class="text-danger" title="Required">*</span>' : '')}${raw(f.help ? html`<div class="small text-muted">${f.help}</div>` : '')}</td><td class="small">${TYPE_LABELS[f.type] || f.type}${raw(f.type === 'select' ? html`<div class="text-muted">${f.options.join(' · ')}</div>` : f.type === 'document' ? html`<div class="text-muted">${f.documentType}</div>` : '')}</td><td class="small">${f.filledBy}</td><td>${raw(UI.statusBadge(f.status))}</td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-edit-field="${f.fieldId}">Edit</button></td></tr>`).join(''))}</tbody></table></div></section>`).join('') : UI.emptyState({ icon: 'card-checklist', title: 'No details yet', text: 'Add the details this block needs, so nobody has to ask for them later.' }))}`;
    const sectionNames = [...new Set(data.fields.map((f) => f.section))];
    const edit = (f) => formModal({
      title: f ? 'Edit detail' : 'Add a detail', submitLabel: 'Save detail', size: 'lg',
      body: html`<div class="mb-3"><label class="form-label" for="bf-label">Question</label><input class="form-control" id="bf-label" name="label" maxlength="120" data-rules="required" value="${f ? f.label : ''}" placeholder="e.g. Plot size"></div>
        <div class="row g-3 mb-3">
          <div class="col-sm-6"><label class="form-label" for="bf-section">Section</label><input class="form-control" id="bf-section" name="section" maxlength="60" data-rules="required" list="bf-sections" value="${f ? f.section : ''}"><datalist id="bf-sections">${raw(sectionNames.map((x) => html`<option value="${x}">`).join(''))}</datalist></div>
          <div class="col-sm-6"><label class="form-label" for="bf-by">Filled in by</label><select class="form-select" id="bf-by" name="filledBy">${raw(data.fillers.map((x) => html`<option ${raw(f && f.filledBy === x ? 'selected' : '')}>${x}</option>`).join(''))}</select><div class="form-text">Client: asked when the block is requested. Staff: recorded by the team.</div></div>
          <div class="col-sm-6"><label class="form-label" for="bf-type">Answer type</label><select class="form-select" id="bf-type" name="fieldType" ${raw(f ? 'disabled' : '')}>${raw(data.types.map((x) => html`<option value="${x}" ${raw(f && f.type === x ? 'selected' : '')}>${TYPE_LABELS[x] || x}</option>`).join(''))}</select>${raw(f ? '<div class="form-text">The answer type cannot change once answers exist.</div>' : '')}</div>
          <div class="col-sm-3"><label class="form-label" for="bf-unit">Unit <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="bf-unit" name="unit" maxlength="20" value="${f ? f.unit : ''}" placeholder="e.g. m²"></div>
          <div class="col-sm-3"><label class="form-label" for="bf-order">Order</label><input class="form-control" id="bf-order" name="sortOrder" type="number" min="0" max="9999" value="${f ? f.sortOrder : ''}"></div>
        </div>
        <div class="mb-3" data-when="select"><label class="form-label" for="bf-options">Choices <span class="text-muted fw-normal">(one per line)</span></label><textarea class="form-control" id="bf-options" name="options" rows="4" maxlength="2000">${f && f.type === 'select' ? f.options.join('\n') : ''}</textarea></div>
        <div class="mb-3" data-when="document"><label class="form-label" for="bf-doctype">Saved in Documents as</label><select class="form-select" id="bf-doctype" name="documentType">${raw(data.documentTypes.map((x) => html`<option ${raw((f ? f.documentType : 'Other documents') === x ? 'selected' : '')}>${x}</option>`).join(''))}</select></div>
        <div class="mb-3"><label class="form-label" for="bf-help">Help text <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="bf-help" name="helpText" maxlength="300" value="${f ? f.help : ''}"></div>
        <div class="d-flex flex-wrap gap-4"><div class="form-check"><input class="form-check-input" type="checkbox" id="bf-req" name="required" value="true" ${raw(f && f.required ? 'checked' : '')}><label class="form-check-label" for="bf-req">Required</label></div>
          <div class="form-check"><input class="form-check-input" type="checkbox" id="bf-retired" name="retired" value="true" ${raw(f && f.status === 'Retired' ? 'checked' : '')}><label class="form-check-label" for="bf-retired">Retired (no longer asked; answers are kept)</label></div></div>`,
      onSubmit: async (form) => {
        const v = Object.fromEntries(new FormData(form).entries());
        const type = f ? f.type : v.fieldType;
        const res = await Api.call('adminSaveBlockField', {
          blockId, fieldId: f ? f.fieldId : '', label: v.label, section: v.section, filledBy: v.filledBy, fieldType: type,
          options: type === 'document' ? v.documentType : type === 'select' ? v.options : '', unit: v.unit, helpText: v.helpText,
          sortOrder: v.sortOrder, required: !!v.required, status: v.retired ? 'Retired' : 'Active'
        });
        blockFields(blockId, d);
        return res;
      }
    });
    const open = (f) => {
      const m = edit(f);
      const typeSel = m.el.querySelector('#bf-type');
      const sync = () => m.el.querySelectorAll('[data-when]').forEach((x) => { x.hidden = x.dataset.when !== typeSel.value; });
      typeSel.addEventListener('change', sync);
      sync();
    };
    d.body.querySelector('[data-act="new-field"]').addEventListener('click', () => open(null));
    d.body.querySelectorAll('[data-edit-field]').forEach((x) => x.addEventListener('click', () => open(data.fields.find((f) => f.fieldId === x.dataset.editField))));
  }

  /* ---------- projects ---------- */
  async function projects(panel) {
    panel.innerHTML = UI.loadingState('Loading projects…');
    let list;
    try { ({ data: list } = await Api.call('adminGetProjects')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    if (!list.length) { panel.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'buildings', title: 'No projects yet' }) + '</div>'; return; }
    const pending = list.filter((p) => p.status === 'Pending Review').length;
    panel.innerHTML = (pending ? html`<div class="bt-alert bt-alert--info mb-3"><i class="bi bi-inbox me-2" aria-hidden="true"></i>${pending} block request${pending === 1 ? '' : 's'} waiting for review.</div>` : '') +
      '<section class="bt-card bt-table-wrap"><table class="bt-table"><thead><tr><th>Project</th><th>Client</th><th>Block</th><th>Status</th><th>Current stage</th><th class="num">Progress</th><th class="num">Team</th><th>Requested</th></tr></thead><tbody>' +
      list.map((p) => html`<tr><td><a href="#/projects/${encodeURIComponent(p.projectId)}/overview"><strong>${p.name}</strong></a><div class="small text-muted">${p.projectId}</div></td><td>${p.client}</td><td class="small">${p.block}</td><td>${raw(UI.statusBadge(p.status))}</td><td class="small">${p.currentStage || '—'}</td><td class="num">${p.progress}%</td><td class="num">${p.team}</td><td class="small">${Utils.formatDate(p.createdAt)}</td></tr>`).join('') + '</tbody></table></section>';
  }

  /* ---------- audit log ---------- */
  async function audit(panel, filters = {}) {
    panel.innerHTML = UI.loadingState('Loading the audit log…');
    let data;
    try { ({ data } = await Api.call('getAuditLogs', Object.assign({ pageSize: 50 }, filters))); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    panel.innerHTML = html`<div class="d-flex flex-wrap gap-2 align-items-end mb-3">
        <div><label class="form-label small mb-1" for="al-search">Search</label><input class="form-control" id="al-search" value="${filters.search || ''}" placeholder="Action, record, user, value"></div>
        <div><label class="form-label small mb-1" for="al-module">Module</label><select class="form-select" id="al-module"><option value="">All</option>${raw(data.modules.map((m) => html`<option ${raw(filters.module === m ? 'selected' : '')}>${m}</option>`).join(''))}</select></div>
        <div><label class="form-label small mb-1" for="al-from">From</label><input class="form-control" id="al-from" type="date" value="${filters.from || ''}"></div>
        <div><label class="form-label small mb-1" for="al-to">To</label><input class="form-control" id="al-to" type="date" value="${filters.to || ''}"></div>
        <button type="button" class="btn btn-outline-primary" data-act="filter">Apply</button>
        <span class="small text-muted ms-auto">${data.total} entr${data.total === 1 ? 'y' : 'ies'} · read-only, nothing here can be edited or deleted</span></div>
      <section class="bt-card bt-table-wrap"><table class="bt-table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Change</th></tr></thead><tbody>
        ${raw(data.items.map((a) => html`<tr class="bt-row-click" data-audit="${a.auditId}" tabindex="0" aria-label="Details of ${a.action}"><td class="small text-nowrap">${Utils.formatDate(a.at, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td class="small">${a.user}</td><td><code>${a.action}</code>${raw(a.status && a.status !== 'SUCCESS' ? ' ' + UI.statusBadge('Failed') : '')}<div class="small text-muted">${a.module}</div></td><td class="small">${a.recordId}</td><td class="small bt-audit-change">${raw(a.oldValue ? html`<div class="text-muted">Before: ${a.oldValue.substring(0, 300)}</div>` : '')}${raw(a.newValue ? html`<div>After: ${a.newValue.substring(0, 300)}</div>` : '')}</td></tr>`).join(''))}
      </tbody></table></section>
      ${raw(data.pages > 1 ? html`<div class="d-flex gap-2 justify-content-center mt-3"><button type="button" class="btn btn-sm btn-outline-primary" data-page="${data.page - 1}" ${raw(data.page <= 1 ? 'disabled' : '')}>Newer</button><span class="small align-self-center">Page ${data.page} of ${data.pages}</span><button type="button" class="btn btn-sm btn-outline-primary" data-page="${data.page + 1}" ${raw(data.page >= data.pages ? 'disabled' : '')}>Older</button></div>` : '')}`;
    const read = () => ({ search: panel.querySelector('#al-search').value, module: panel.querySelector('#al-module').value, from: panel.querySelector('#al-from').value, to: panel.querySelector('#al-to').value, userId: filters.userId || '' });
    const tbody = panel.querySelector('tbody');
    const openRow = (e) => { const r = e.target.closest('[data-audit]'); if (r) openAudit(data.items.find((a) => a.auditId === r.dataset.audit)); };
    tbody.addEventListener('click', openRow);
    tbody.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(e); } });
    if (filters.userId) panel.insertAdjacentHTML('afterbegin', html`<div class="bt-alert bt-alert--info mb-3 d-flex align-items-center gap-2"><i class="bi bi-funnel" aria-hidden="true"></i><span class="me-auto">Showing activity of ${data.items[0] ? (data.items[0].userId === filters.userId ? data.items[0].user : filters.userId) : filters.userId} only.</span><a class="btn btn-sm btn-outline-primary" href="#/admin/audit">Show everyone</a></div>`);
    panel.querySelector('[data-act="filter"]').addEventListener('click', () => audit(panel, read()));
    panel.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => audit(panel, Object.assign(read(), { page: Number(b.dataset.page) }))));
  }

  /* ---------- system ---------- */
  async function system(panel) {
    panel.innerHTML = UI.loadingState('Checking the system…');
    let s;
    try { ({ data: s } = await Api.call('adminGetSystem', {}, { timeoutMs: 90000 })); /* the health check reads every sheet, so allow longer */ } catch (err) { panel.innerHTML = UI.errorState(err); return; }
    const okBadge = (ok) => UI.statusBadge(ok ? 'Completed' : 'Failed').replace('>Completed<', '>OK<').replace('>Failed<', '>Problem<');
    const detail = (d) => (d && typeof d === 'object' ? Object.entries(d).filter(([k]) => k !== 'ok').map(([k, v]) => `${k}: ${Array.isArray(v) ? (v.length ? JSON.stringify(v) : 'none') : typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`).join(' · ') : d || '');
    panel.innerHTML = html`
      <section class="bt-card mb-4" aria-labelledby="h-health"><div class="bt-card__header"><h2 id="h-health">Health</h2>${raw(okBadge(s.health.ok))}</div>
        <ul class="bt-list">${raw(s.health.checks.map((c) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-${c.ok ? 'check-lg' : 'exclamation-triangle'}" aria-hidden="true"></i></span><div class="bt-list__body"><p class="bt-list__title">${c.check}</p><p class="bt-list__text">${detail(c.detail)}</p></div>${raw(okBadge(c.ok))}</li>`).join(''))}</ul>
        <p class="small text-muted px-4 py-2 mb-0">Checked ${Utils.formatDate(s.health.checkedAt, { hour: '2-digit', minute: '2-digit' })} · email quota left today: ${s.mailQuotaRemaining === null ? 'unknown' : s.mailQuotaRemaining} · scheduled jobs: ${s.triggers.length ? s.triggers.join(', ') : 'none installed (run installTriggers)'}</p></section>
      <div class="bt-grid bt-grid--split mb-4">
        <section class="bt-card" aria-labelledby="h-config"><div class="bt-card__header"><h2 id="h-config">Configuration</h2></div><div class="bt-table-wrap"><table class="bt-table"><tbody>
          ${raw(s.config.readonly.map((c) => html`<tr><td><code>${c.key}</code></td><td class="small text-break">${c.value}</td><td class="small text-muted">Fixed</td></tr>`).join(''))}
          ${raw(s.config.editable.map((c) => html`<tr><td><code>${c.key}</code></td><td class="small text-break">${c.value || raw(html`<span class="text-muted">${c.default ? 'default: ' + c.default : 'not set'}</span>`)}</td><td class="num">${raw(s.canManage ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-config="${c.key}">Edit</button>` : '')}</td></tr>`).join(''))}
        </tbody></table></div></section>
        <div class="d-grid gap-4 align-content-start">
          <section class="bt-card" aria-labelledby="h-backups"><div class="bt-card__header"><h2 id="h-backups">Backups</h2>${raw(s.canManage ? '<button type="button" class="btn btn-sm btn-primary" data-act="backup">Back up now</button>' : '')}</div>
            ${raw(s.backups.length ? '<ul class="bt-list">' + s.backups.slice(0, 8).map((b) => html`<li class="bt-list__item"><div class="bt-list__body"><p class="bt-list__title small">${b.fileName}</p><p class="bt-list__text">${Utils.formatDate(b.createdAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${b.createdBy}</p></div>${raw(UI.statusBadge(b.status))}</li>`).join('') + '</ul>' : '<p class="small text-muted px-4 py-3 mb-0">No backups yet. One copy of the database is kept per day in the Backups folder.</p>')}</section>
          <section class="bt-card" aria-labelledby="h-tables"><div class="bt-card__header"><h2 id="h-tables">Database</h2></div><div class="bt-table-wrap" style="max-height:22rem"><table class="bt-table"><thead><tr><th>Sheet</th><th class="num">Rows</th></tr></thead><tbody>${raw(s.tables.map((t) => html`<tr><td class="small">${t.sheet}</td><td class="num small">${t.rows === null ? 'missing' : t.rows}</td></tr>`).join(''))}</tbody></table></div></section>
        </div>
      </div>`;
    panel.querySelectorAll('[data-config]').forEach((b) => b.addEventListener('click', () => {
      const c = s.config.editable.find((x) => x.key === b.dataset.config);
      const long = ['COMPANY_ADDRESS', 'PAYMENT_INSTRUCTIONS'].includes(c.key);
      formModal({
        title: 'Edit ' + c.key, submitLabel: 'Save',
        body: html`<label class="form-label" for="cf-value">Value</label>${raw(long ? html`<textarea class="form-control" id="cf-value" name="value" rows="4" maxlength="2000">${c.value}</textarea>` : html`<input class="form-control" id="cf-value" name="value" maxlength="2000" value="${c.value}">`)}<div class="form-text">Leave empty to use the default${c.default ? ' (' + c.default + ')' : ''}. The change is recorded in the audit log.</div>`,
        onSubmit: async (f) => { const res = await Api.call('adminUpdateConfig', { key: c.key, value: f.elements.value.value }); system(panel); return res; }
      });
    }));
    const backup = panel.querySelector('[data-act="backup"]');
    if (backup) backup.addEventListener('click', async () => {
      const restore = UI.busy(backup, 'Backing up…');
      try { const res = await Api.call('adminRunBackup', {}, { timeoutMs: APP_CONFIG.uploadTimeoutMs }); UI.toast('success', res.message); system(panel); } catch (err) { restore(); UI.toast('error', err.message); }
    });
  }

  async function render(el, tab, arg) {
    const tabs = TABS.filter((t) => t[3]());
    if (!tabs.length) { el.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'lock', title: 'Not available' }) + '</div>'; return; }
    if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
    el.innerHTML = UI.pageHeader({ title: 'Administration', subtitle: 'Users, roles, blocks, subscriptions, projects, the website, audit log and system status.' }) +
      '<nav class="bt-tabs mb-4" aria-label="Administration sections">' + tabs.map(([k, l, i]) => html`<a class="bt-tabs__link" href="#/admin/${k}" ${raw(k === tab ? 'aria-current="page"' : '')}><i class="bi bi-${i}" aria-hidden="true"></i>${l}</a>`).join('') + '</nav><div id="bt-admin-panel"></div>';
    const panel = el.querySelector('#bt-admin-panel');
    if (tab === 'audit') return audit(panel, arg ? { userId: arg } : {});
    if (tab === 'users') {
      await users(panel, () => render(el, tab));
      if (arg) openUser(arg); // #/admin/users/<id> opens that person's profile: a link that can be shared or bookmarked
      return;
    }
    return ({ roles, blocks, subscriptions, projects, system, website })[tab](panel, () => render(el, tab));
  }

  return { render, openUser };
})();
