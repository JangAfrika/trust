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
    ['projects', 'Projects', 'buildings', () => App.can('project.view.all')],
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
      list.map((b) => html`<tr><td>${b.sortOrder}</td><td><strong>${b.name}</strong><div class="small text-muted">${b.description}</div></td><td class="num">${b.price === null ? 'On request' : Utils.formatMoney(b.price, b.currency)}</td><td>${b.duration || '—'}</td><td class="small">${String(b.defaultStages || '').split(/\r?\n|;/).filter((x) => x.trim()).length || '—'}</td><td>${raw(UI.statusBadge(b.status))}</td><td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-edit-block="${b.blockId}">Edit</button></td></tr>`).join('') + '</tbody></table></section>';
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
    try { ({ data: s } = await Api.call('adminGetSystem')); } catch (err) { panel.innerHTML = UI.errorState(err); return; }
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
    el.innerHTML = UI.pageHeader({ title: 'Administration', subtitle: 'Users, roles, blocks, projects, audit log and system status.' }) +
      '<nav class="bt-tabs mb-4" aria-label="Administration sections">' + tabs.map(([k, l, i]) => html`<a class="bt-tabs__link" href="#/admin/${k}" ${raw(k === tab ? 'aria-current="page"' : '')}><i class="bi bi-${i}" aria-hidden="true"></i>${l}</a>`).join('') + '</nav><div id="bt-admin-panel"></div>';
    const panel = el.querySelector('#bt-admin-panel');
    if (tab === 'audit') return audit(panel, arg ? { userId: arg } : {});
    if (tab === 'users') {
      await users(panel, () => render(el, tab));
      if (arg) openUser(arg); // #/admin/users/<id> opens that person's profile: a link that can be shared or bookmarked
      return;
    }
    return ({ roles, blocks, projects, system })[tab](panel, () => render(el, tab));
  }

  return { render, openUser };
})();
