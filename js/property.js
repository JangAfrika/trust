/**
 * Balance Trust — Property Management: the property list, a tenant's own
 * tenancy, and one property's units, tenants, rent, maintenance and report.
 * Buttons follow the `can` flags from the server, which checks every action.
 */
const Property = (() => {
  const { html, raw } = Utils;
  const money = (n, c) => Utils.formatMoney(n, c);
  const TABS = [['overview', 'Overview', 'speedometer2'], ['units', 'Units & Tenants', 'door-open'], ['rent', 'Rent', 'cash-coin'], ['maintenance', 'Maintenance', 'tools'], ['cameras', 'Cameras', 'camera-video'], ['report', 'Report', 'bar-chart-line']];

  /* ---------- small helpers ---------- */
  function formModal({ title, body, submitLabel, size, onSubmit }) {
    const m = UI.modal({ title, size, body: `<form id="bt-prop-form" novalidate>${body}</form>`, footer: `<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-prop-form">${Utils.esc(submitLabel)}</button>` });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      if (!Validation.validateForm(f)) return;
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      try {
        const res = await onSubmit(Object.fromEntries(new FormData(f).entries()), f);
        UI.toast('success', res.message);
        m.close();
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
      }
    });
    return m;
  }

  function rentCards(summary) {
    return summary.map((s) => '<section class="bt-grid bt-grid--stats mb-4" aria-label="Rent in ' + Utils.esc(s.currency) + '">' + [
      UI.statCard({ label: 'Rent due', value: money(s.due, s.currency), icon: 'calendar-check' }),
      UI.statCard({ label: 'Collected', value: money(s.collected, s.currency), icon: 'check2-circle', tone: 'green' }),
      UI.statCard({ label: 'Outstanding', value: money(s.outstanding, s.currency), icon: 'hourglass-split', tone: 'gold', hint: s.overdue ? money(s.overdue, s.currency) + ' overdue' : '' }),
      UI.statCard({ label: 'Collection rate', value: s.collectionRate === null ? '—' : s.collectionRate + '%', icon: 'percent', tone: s.collectionRate !== null && s.collectionRate < 80 ? 'red' : '' })
    ].join('') + '</section>').join('');
  }

  function rentTable(rows, { payable } = {}) {
    if (!rows.length) return UI.emptyState({ icon: 'cash-coin', title: 'No rent recorded yet', text: 'Monthly rent charges and payments appear here.' });
    return '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Period</th><th>Unit</th><th>Tenant</th><th>Due</th><th class="num">Amount due</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th>' + (payable ? '<th><span class="visually-hidden">Actions</span></th>' : '') + '</tr></thead><tbody>' +
      rows.map((r) => html`<tr><td>${r.period}</td><td>${r.unit}</td><td>${r.tenant}</td><td>${Utils.formatDate(r.dueDate)}</td><td class="num">${money(r.amountDue, r.currency)}</td><td class="num">${money(r.amountPaid, r.currency)}${raw(r.paymentDate ? html`<div class="small text-muted">${Utils.formatDate(r.paymentDate)}${r.reference ? ' · ' + r.reference : ''}</div>` : '')}</td><td class="num">${money(r.balance, r.currency)}</td><td>${raw(UI.statusBadge(r.status))}</td>${raw(payable ? (r.balance > 0 ? html`<td class="num"><button type="button" class="btn btn-sm btn-accent" data-pay-rent="${r.rentId}">Record payment</button></td>` : '<td></td>') : '')}</tr>`).join('') + '</tbody></table></div>';
  }

  function maintenanceList(items, { manage } = {}) {
    if (!items.length) return '<div class="bt-card">' + UI.emptyState({ icon: 'tools', title: 'No maintenance requests', text: 'Issues reported by tenants, owners or staff appear here.' }) + '</div>';
    const prio = { Urgent: 'danger', High: 'warning', Medium: 'neutral', Low: 'neutral' };
    return '<div class="d-grid gap-3">' + items.map((m) => html`<article class="bt-card bt-stage" aria-label="${m.issue}">
      <div class="bt-stage__head"><span class="bt-stage__num" aria-hidden="true"><i class="bi bi-tools"></i></span>
        <div class="flex-grow-1 min-w-0"><h3 class="bt-stage__name">${m.issue}</h3><p class="bt-stage__meta">${m.unit ? 'Unit ' + m.unit + ' · ' : ''}reported by ${m.reportedBy}, ${Utils.formatDate(m.reportedAt)}${m.assignedTo ? ' · assigned to ' + m.assignedTo : ''}</p></div>
        <div class="d-flex flex-wrap gap-2"><span class="bt-badge bt-badge--${prio[m.priority] || 'neutral'}"><i class="bi bi-flag" aria-hidden="true"></i>${m.priority}</span>${raw(UI.statusBadge(m.status))}</div></div>
      <p class="small mb-0" style="white-space:pre-line">${m.description}</p>
      ${raw(m.resolution ? html`<p class="small mb-0"><strong>Resolution:</strong> ${m.resolution}${m.resolvedAt ? ' (' + Utils.formatDate(m.resolvedAt) + ')' : ''}</p>` : '')}
      ${raw(manage && m.status !== 'Closed' ? html`<div><button type="button" class="btn btn-sm btn-outline-primary" data-update-mnt="${m.requestId}">Update</button></div>` : '')}
    </article>`).join('') + '</div>';
  }

  function reportIssue({ propertyId, units, priorities, onDone }) {
    formModal({
      title: 'Report a maintenance issue', submitLabel: 'Send request',
      body: html`${raw(units && units.length ? html`<div class="mb-3"><label class="form-label" for="mr-unit">Unit <span class="text-muted fw-normal">(optional)</span></label><select class="form-select" id="mr-unit" name="unitId"><option value="">Whole property / common area</option>${raw(units.map((u) => html`<option value="${u.unitId}">${u.number}</option>`).join(''))}</select></div>` : '')}
        <div class="mb-3"><label class="form-label" for="mr-issue">Issue</label><input class="form-control" id="mr-issue" name="issue" maxlength="150" data-rules="required" placeholder="e.g. Leaking tap in the kitchen"></div>
        <div class="mb-3"><label class="form-label" for="mr-desc">Details</label><textarea class="form-control" id="mr-desc" name="description" rows="3" maxlength="2000" data-rules="required"></textarea></div>
        <div><label class="form-label" for="mr-prio">Priority</label><select class="form-select" id="mr-prio" name="priority">${raw((priorities || ['Low', 'Medium', 'High', 'Urgent']).map((p) => html`<option ${raw(p === 'Medium' ? 'selected' : '')}>${p}</option>`).join(''))}</select></div>`,
      onSubmit: async (v) => { const res = await Api.call('createMaintenanceRequest', Object.assign({ propertyId }, v)); onDone(); return res; }
    });
  }

  /* ---------- list page ---------- */
  function tenancyCard(t, reload) {
    return html`<section class="bt-card mb-4" aria-labelledby="h-ten-${t.tenantId}"><div class="bt-card__header"><h2 id="h-ten-${t.tenantId}">Your home: ${t.property}, unit ${t.unit}</h2><button type="button" class="btn btn-sm btn-accent" data-report-tenancy="${t.unitId}" data-property="${t.propertyId}">Report an issue</button></div>
      <div class="bt-card__body"><dl class="bt-dl mb-3"><dt>Location</dt><dd>${t.location || '—'}</dd><dt>Lease</dt><dd>${Utils.formatDate(t.leaseStart)} → ${t.leaseEnd ? Utils.formatDate(t.leaseEnd) : 'open-ended'}</dd><dt>Monthly rent</dt><dd>${money(t.rentAmount, t.currency)}</dd></dl>
        <h3 class="h6">Rent</h3>${raw(rentTable(t.rent))}
        <h3 class="h6 mt-4">Maintenance requests</h3>${raw(maintenanceList(t.maintenance))}</div></section>`;
  }

  function propertyCard(p) {
    const rent = p.rent[0];
    return html`<article class="bt-card bt-project">
      <div class="bt-project__top"><div><h3 class="bt-project__name">${p.name}</h3><div class="bt-project__meta"><span><i class="bi bi-geo-alt" aria-hidden="true"></i>${p.location || '—'}</span><span><i class="bi bi-house" aria-hidden="true"></i>${p.type}</span>${raw(p.owner ? html`<span><i class="bi bi-person" aria-hidden="true"></i>${p.owner}</span>` : '')}</div></div>${raw(UI.statusBadge(p.status))}</div>
      <div class="bt-project__stage">${p.occupied} of ${p.units} units occupied${p.openMaintenance ? html` · <strong>${p.openMaintenance}</strong> open maintenance` : ''}</div>
      ${raw(rent ? html`<div class="small">Rent collected: <strong>${money(rent.collected, rent.currency)}</strong> of ${money(rent.due, rent.currency)}${rent.collectionRate !== null ? ' (' + rent.collectionRate + '%)' : ''}</div>` : '<div class="small text-muted">No rent recorded yet</div>')}
      <div class="bt-project__foot"><span></span><a class="btn btn-sm btn-outline-primary" href="#/property/${encodeURIComponent(p.propertyId)}">Open</a></div>
    </article>`;
  }

  function openNewProperty(reload) {
    formModal({
      title: 'Add a property', submitLabel: 'Add property',
      body: `<div class="mb-3"><label class="form-label" for="np-name">Property name</label><input class="form-control" id="np-name" name="name" maxlength="150" data-rules="required"></div>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="np-type">Type</label><input class="form-control" id="np-type" name="propertyType" maxlength="60" data-rules="required" placeholder="e.g. Apartments, House, Shop"></div>
          <div class="col-sm-6"><label class="form-label" for="np-project">Built project ID <span class="text-muted fw-normal">(optional)</span></label><input class="form-control text-uppercase" id="np-project" name="projectId" maxlength="20" placeholder="PRJ-000001"></div></div>
        <div class="mb-3"><label class="form-label" for="np-owner">Owner's email</label><input class="form-control" id="np-owner" name="ownerEmail" type="email"><div class="form-text">Leave empty when you give a project ID: its client becomes the owner.</div></div>
        <div><label class="form-label" for="np-location">Location</label><input class="form-control" id="np-location" name="location" maxlength="200"><div class="form-text">Taken from the project when left empty.</div></div>`,
      onSubmit: async (v) => { const res = await Api.call('createProperty', v); location.hash = '#/property/' + encodeURIComponent(res.data.propertyId); return res; }
    });
  }

  async function renderList(el) {
    const header = (actions) => UI.pageHeader({ title: 'Property Management', subtitle: 'Properties, tenants, rent collection and maintenance.', actions });
    el.innerHTML = header() + UI.skeletonCards(3, '12rem');
    let data;
    try {
      ({ data } = await Api.call('getProperties'));
    } catch (err) {
      el.innerHTML = header() + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => renderList(el));
      return;
    }
    const reload = () => renderList(el);
    const action = data.can.manage ? '<button type="button" class="btn btn-primary" data-act="new-property"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add property</button>' : '';
    const tenancies = data.tenancies.map((t) => tenancyCard(t, reload)).join('');
    const list = data.items.length
      ? (data.items.length > 1 ? rentCards(data.summary) : '') + '<div class="bt-grid bt-grid--cards">' + data.items.map(propertyCard).join('') + '</div>'
      : (tenancies ? '' : '<div class="bt-card">' + UI.emptyState({ icon: 'house-door', title: 'No properties yet', text: data.can.manage ? 'Add a property to start managing its units, tenants and rent.' : 'Completed buildings that Balance Trust manages for you will appear here.' }) + '</div>');
    el.innerHTML = header(action) + tenancies + list;
    el.querySelectorAll('[data-act="new-property"]').forEach((b) => b.addEventListener('click', () => openNewProperty(reload)));
    el.querySelectorAll('[data-report-tenancy]').forEach((b) => b.addEventListener('click', () => reportIssue({ propertyId: b.dataset.property, onDone: reload })));
  }

  /* ---------- one property ---------- */
  function overview(p) {
    const occupied = p.units.filter((u) => u.status === 'Occupied').length;
    const open = p.maintenance.filter((m) => m.status !== 'Completed' && m.status !== 'Closed');
    const ending = p.tenants.filter((t) => t.leaseEnding);
    return '<section class="bt-grid bt-grid--stats mb-4" aria-label="Occupancy">' + [
      UI.statCard({ label: 'Units', value: p.units.length, icon: 'door-open' }),
      UI.statCard({ label: 'Occupied', value: p.units.length ? `${occupied} (${Math.round(occupied / p.units.length * 100)}%)` : '0', icon: 'people', tone: 'green' }),
      UI.statCard({ label: 'Open maintenance', value: open.length, icon: 'tools', tone: open.some((m) => m.priority === 'Urgent') ? 'red' : 'gold' }),
      UI.statCard({ label: 'Leases ending in 30 days', value: ending.length, icon: 'calendar-x', tone: ending.length ? 'gold' : '' })
    ].join('') + '</section>' + rentCards(p.rentSummary) +
      (ending.length ? '<section class="bt-card"><div class="bt-card__header"><h2>Leases ending soon</h2></div><ul class="bt-list">' + ending.map((t) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-calendar-x" aria-hidden="true"></i></span><div class="bt-list__body"><p class="bt-list__title">${t.name}, unit ${t.unit}</p><p class="bt-list__text">Lease ends ${Utils.formatDate(t.leaseEnd)}</p></div></li>`).join('') + '</ul></section>' : '');
  }

  function units(p) {
    const addUnit = p.can.manage ? '<button type="button" class="btn btn-primary btn-sm" data-act="add-unit"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add unit</button>' : '';
    const unitRows = p.units.length
      ? '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Unit</th><th>Type</th><th class="num">Rent</th><th>Status</th><th>Tenant</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
        p.units.map((u) => html`<tr><td><strong>${u.number}</strong></td><td>${u.type || '—'}</td><td class="num">${u.rentAmount === null ? '—' : money(u.rentAmount, u.currency)}</td><td>${raw(UI.statusBadge(u.status))}</td><td>${u.tenant || '—'}</td>
          <td class="num text-nowrap">${raw(p.can.tenants && u.status === 'Vacant' ? html`<button type="button" class="btn btn-sm btn-accent" data-add-tenant="${u.unitId}">Add tenant</button> ` : '')}${raw(p.can.manage ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-edit-unit="${u.unitId}">Edit</button>` : '')}</td></tr>`).join('') + '</tbody></table></div>'
      : UI.emptyState({ icon: 'door-open', title: 'No units yet', text: 'Add the flats, shops or rooms of this property.' });
    const tenantRows = p.tenants.length
      ? '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Tenant</th><th>Unit</th><th>Contact</th><th>Lease</th><th class="num">Rent</th><th>Status</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
        p.tenants.map((t) => html`<tr><td><strong>${t.name}</strong>${raw(t.hasAccount ? ' <span class="bt-badge bt-badge--neutral" title="Has a Balance Trust account"><i class="bi bi-person-check" aria-hidden="true"></i>Account</span>' : '')}</td><td>${t.unit}</td><td class="small">${t.phone || ''}${raw(t.phone && t.email ? '<br>' : '')}${t.email || ''}</td><td class="small">${Utils.formatDate(t.leaseStart)} → ${t.leaseEnd ? Utils.formatDate(t.leaseEnd) : 'open'}</td><td class="num">${money(t.rentAmount, t.currency)}</td><td>${raw(UI.statusBadge(t.status))}</td>
          <td class="num">${raw(p.can.tenants && t.status === 'Active' ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-end-tenancy="${t.tenantId}" data-name="${t.name}">End tenancy</button>` : '')}</td></tr>`).join('') + '</tbody></table></div>'
      : UI.emptyState({ icon: 'people', title: 'No tenants yet', text: 'Tenants appear here once a vacant unit is let.' });
    return `<section class="bt-card mb-4" aria-labelledby="h-units"><div class="bt-card__header"><h2 id="h-units">Units</h2>${addUnit}</div>${unitRows}</section>` +
      `<section class="bt-card" aria-labelledby="h-tenants"><div class="bt-card__header"><h2 id="h-tenants">Tenants</h2></div>${tenantRows}</section>`;
  }

  function rent(p) {
    const action = p.can.rent && p.tenants.some((t) => t.status === 'Active') ? '<button type="button" class="btn btn-primary btn-sm" data-act="charge-rent"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Create rent charges</button>' : '';
    return rentCards(p.rentSummary) + `<section class="bt-card" aria-labelledby="h-rent"><div class="bt-card__header"><h2 id="h-rent">Rent collection</h2>${action}</div>${rentTable(p.rent, { payable: p.can.rent })}</section>`;
  }

  function maintenance(p) {
    const action = p.can.report ? '<div class="d-flex justify-content-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-act="report"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Report an issue</button></div>' : '';
    return action + maintenanceList(p.maintenance, { manage: p.can.maintenance });
  }

  async function report(p, panel) {
    panel.innerHTML = UI.loadingState('Building the report…');
    let r;
    try {
      ({ data: r } = await Api.call('getPropertyReport', { propertyId: p.propertyId }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err);
      return;
    }
    const rows = [];
    r.byPeriod.forEach((x) => x.totals.forEach((t) => rows.push([x.period, t.currency, t.due, t.collected, t.outstanding, t.collectionRate === null ? '' : t.collectionRate])));
    panel.innerHTML = html`<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><p class="small text-muted mb-0">Generated ${Utils.formatDate(r.generatedAt, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-outline-primary" data-act="csv"><i class="bi bi-filetype-csv me-1" aria-hidden="true"></i>Download CSV</button><button type="button" class="btn btn-sm btn-outline-primary" data-act="print"><i class="bi bi-printer me-1" aria-hidden="true"></i>Print</button></div></div>
      <section class="bt-grid bt-grid--stats mb-4">${raw([
        UI.statCard({ label: 'Occupancy', value: r.occupancy.units ? Math.round(r.occupancy.occupied / r.occupancy.units * 100) + '%' : '—', icon: 'people', hint: `${r.occupancy.occupied} of ${r.occupancy.units} units` }),
        UI.statCard({ label: 'Maintenance requests', value: r.maintenance.total, icon: 'tools', hint: r.maintenance.urgentOpen ? r.maintenance.urgentOpen + ' urgent open' : '' }),
        UI.statCard({ label: 'Average days to resolve', value: r.maintenance.averageDaysToResolve === null ? '—' : r.maintenance.averageDaysToResolve, icon: 'stopwatch' })
      ].join(''))}</section>
      ${raw(rentCards(r.rentTotals))}
      <section class="bt-card mb-4"><div class="bt-card__header"><h2>Rent collection by month</h2></div>${raw(rows.length ? '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Period</th><th class="num">Due</th><th class="num">Collected</th><th class="num">Outstanding</th><th class="num">Collection rate</th></tr></thead><tbody>' + rows.map(([per, c, due, col, out, rate]) => html`<tr><td>${per}</td><td class="num">${money(due, c)}</td><td class="num">${money(col, c)}</td><td class="num">${money(out, c)}</td><td class="num">${rate === '' ? '—' : rate + '%'}</td></tr>`).join('') + '</tbody></table></div>' : UI.emptyState({ icon: 'cash-coin', title: 'No rent recorded yet' }))}</section>
      <section class="bt-card"><div class="bt-card__header"><h2>Maintenance by status</h2></div><div class="bt-table-wrap"><table class="bt-table"><tbody>${raw(Object.entries(r.maintenance.byStatus).map(([s, n]) => html`<tr><td>${s}</td><td class="num">${n}</td></tr>`).join(''))}</tbody></table></div></section>`;
    panel.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
    panel.querySelector('[data-act="csv"]').addEventListener('click', () => {
      const lines = [['Period', 'Currency', 'Due', 'Collected', 'Outstanding', 'Collection rate %']].concat(rows).map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
      Utils.saveBase64(`${r.propertyId}-rent-report.csv`, 'text/csv', btoa(unescape(encodeURIComponent(lines.join('\r\n')))));
    });
  }

  function wire(p, el, panel, reload) {
    const on = (sel, fn) => el.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
    on('[data-act="edit-property"]', () => formModal({
      title: 'Edit property', submitLabel: 'Save property',
      body: html`<div class="mb-3"><label class="form-label" for="ep-name">Name</label><input class="form-control" id="ep-name" name="name" maxlength="150" data-rules="required" value="${p.name}"></div>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="ep-type">Type</label><input class="form-control" id="ep-type" name="propertyType" maxlength="60" value="${p.type}"></div>
          <div class="col-sm-6"><label class="form-label" for="ep-status">Status</label><select class="form-select" id="ep-status" name="status">${raw(p.statuses.property.map((s) => html`<option ${raw(s === p.status ? 'selected' : '')}>${s}</option>`).join(''))}</select></div></div>
        <div><label class="form-label" for="ep-loc">Location</label><input class="form-control" id="ep-loc" name="location" maxlength="200" value="${p.location}"></div>`,
      onSubmit: async (v) => { const res = await Api.call('updateProperty', Object.assign({ propertyId: p.propertyId }, v)); reload(); return res; }
    }));
    const unitForm = (u) => formModal({
      title: u ? 'Edit unit ' + u.number : 'Add a unit', submitLabel: u ? 'Save unit' : 'Add unit',
      body: html`<div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="uf-num">Unit number</label><input class="form-control" id="uf-num" name="unitNumber" maxlength="40" data-rules="required" value="${u ? u.number : ''}"></div>
          <div class="col-sm-6"><label class="form-label" for="uf-type">Type <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="uf-type" name="unitType" maxlength="60" value="${u ? u.type : ''}" placeholder="e.g. 2-bedroom flat"></div></div>
        <div class="row g-3"><div class="col-sm-5"><label class="form-label" for="uf-rent">Monthly rent</label><input class="form-control" id="uf-rent" name="rentAmount" type="number" min="0" step="0.01" value="${u && u.rentAmount !== null ? u.rentAmount : ''}"></div>
          <div class="col-sm-3"><label class="form-label" for="uf-cur">Currency</label><input class="form-control text-uppercase" id="uf-cur" name="currency" maxlength="3" data-rules="required" value="${u ? u.currency : p.settings.defaultCurrency}" placeholder="GMD"></div>
          ${raw(!u || u.status !== 'Occupied' ? html`<div class="col-sm-4"><label class="form-label" for="uf-status">Status</label><select class="form-select" id="uf-status" name="status"><option ${raw(!u || u.status === 'Vacant' ? 'selected' : '')}>Vacant</option><option ${raw(u && u.status === 'Unavailable' ? 'selected' : '')}>Unavailable</option></select></div>` : '')}</div>`,
      onSubmit: async (v) => { const res = await Api.call('saveUnit', Object.assign({ propertyId: p.propertyId, unitId: u ? u.unitId : '' }, v)); reload(); return res; }
    });
    on('[data-act="add-unit"]', () => unitForm(null));
    on('[data-edit-unit]', (b) => unitForm(p.units.find((u) => u.unitId === b.dataset.editUnit)));
    on('[data-add-tenant]', (b) => {
      const u = p.units.find((x) => x.unitId === b.dataset.addTenant);
      formModal({
        title: 'New tenant for unit ' + u.number, submitLabel: 'Add tenant',
        body: html`<div class="mb-3"><label class="form-label" for="nt-name">Full name</label><input class="form-control" id="nt-name" name="fullName" maxlength="120" data-rules="required"></div>
          <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="nt-phone">Phone</label><input class="form-control" id="nt-phone" name="phone" type="tel" maxlength="40"></div>
            <div class="col-sm-6"><label class="form-label" for="nt-email">Email</label><input class="form-control" id="nt-email" name="email" type="email" data-rules="email"><div class="form-text">If they have a Balance Trust account with this email, they can see their tenancy.</div></div></div>
          <div class="row g-3"><div class="col-sm-4"><label class="form-label" for="nt-start">Lease start</label><input class="form-control" id="nt-start" name="leaseStart" type="date" data-rules="required"></div>
            <div class="col-sm-4"><label class="form-label" for="nt-end">Lease end</label><input class="form-control" id="nt-end" name="leaseEnd" type="date"></div>
            <div class="col-sm-4"><label class="form-label" for="nt-rent">Monthly rent (${u.currency})</label><input class="form-control" id="nt-rent" name="rentAmount" type="number" min="0" step="0.01" data-rules="required" value="${u.rentAmount === null ? '' : u.rentAmount}"></div></div>`,
        onSubmit: async (v) => { const res = await Api.call('addTenant', Object.assign({ unitId: u.unitId }, v)); reload(); return res; }
      });
    });
    on('[data-end-tenancy]', (b) => formModal({
      title: 'End tenancy of ' + b.dataset.name, submitLabel: 'End tenancy',
      body: html`<p class="small text-muted">The unit becomes vacant. Rent records are kept.</p><label class="form-label" for="et-date">Last day</label><input class="form-control" id="et-date" name="endDate" type="date" data-rules="required" value="${new Date().toISOString().substring(0, 10)}">`,
      onSubmit: async (v) => { const res = await Api.call('endTenancy', { tenantId: b.dataset.endTenancy, endDate: v.endDate }); reload(); return res; }
    }));
    on('[data-act="charge-rent"]', () => {
      const today = new Date().toISOString().substring(0, 10);
      const period = today.substring(0, 7);
      const due = today > period + '-05' ? today : period + '-05';
      formModal({
        title: 'Create rent charges', submitLabel: 'Create charges',
        body: html`<p class="small text-muted">Creates one charge per active tenant at their monthly rent. Tenants who already have a charge for the month are skipped.</p>
          <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="rc-period">Month</label><input class="form-control" id="rc-period" name="period" type="month" data-rules="required" value="${period}"></div>
            <div class="col-sm-6"><label class="form-label" for="rc-due">Due date</label><input class="form-control" id="rc-due" name="dueDate" type="date" data-rules="required" value="${due}"></div></div>`,
        onSubmit: async (v) => { const res = await Api.call('createRentCharges', Object.assign({ propertyId: p.propertyId }, v)); reload(); return res; }
      });
    });
    on('[data-pay-rent]', (b) => {
      const r = p.rent.find((x) => x.rentId === b.dataset.payRent);
      const today = new Date().toISOString().substring(0, 10);
      const methods = p.settings.paymentMethods;
      formModal({
        title: `Rent payment: ${r.tenant}, ${r.period}`, submitLabel: 'Record payment',
        body: html`<p class="small text-muted">Balance due: <strong>${money(r.balance, r.currency)}</strong>. Record only money actually received.</p>
          <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="rp-amount">Amount (${r.currency})</label><input class="form-control" id="rp-amount" name="amount" type="number" min="0.01" step="0.01" max="${r.balance}" value="${r.balance}" data-rules="required"></div>
            <div class="col-sm-6"><label class="form-label" for="rp-date">Payment date</label><input class="form-control" id="rp-date" name="paymentDate" type="date" max="${today}" value="${today}" data-rules="required"></div></div>
          <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="rp-method">Payment method</label>${raw(methods.length ? html`<select class="form-select" id="rp-method" name="paymentMethod" data-rules="required"><option value="">Choose…</option>${raw(methods.map((x) => html`<option>${x}</option>`).join(''))}</select>` : '<input class="form-control" id="rp-method" name="paymentMethod" maxlength="60" data-rules="required">')}</div>
            <div class="col-sm-6"><label class="form-label" for="rp-ref">Reference <span class="text-muted fw-normal">(recommended)</span></label><input class="form-control" id="rp-ref" name="reference" maxlength="120"></div></div>`,
        onSubmit: async (v) => { const res = await Api.call('recordRentPayment', Object.assign({ rentId: r.rentId }, v)); reload(); return res; }
      });
    });
    on('[data-act="report"]', () => reportIssue({ propertyId: p.propertyId, units: p.units, priorities: p.statuses.priority, onDone: reload }));
    on('[data-update-mnt]', (b) => {
      const m = p.maintenance.find((x) => x.requestId === b.dataset.updateMnt);
      formModal({
        title: 'Update: ' + m.issue, submitLabel: 'Save',
        body: html`<div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="um-status">Status</label><select class="form-select" id="um-status" name="status">${raw(p.statuses.maintenance.map((s) => html`<option ${raw(s === m.status ? 'selected' : '')}>${s}</option>`).join(''))}</select></div>
            <div class="col-sm-6"><label class="form-label" for="um-prio">Priority</label><select class="form-select" id="um-prio" name="priority">${raw(p.statuses.priority.map((s) => html`<option ${raw(s === m.priority ? 'selected' : '')}>${s}</option>`).join(''))}</select></div></div>
          <div class="mb-3"><label class="form-label" for="um-assign">Assigned to</label><select class="form-select" id="um-assign" name="assignedTo"><option value="">${m.assignedTo ? m.assignedTo + ' (unchanged)' : 'Not assigned'}</option>${raw(p.assignable.map((s) => html`<option value="${s.userId}">${s.name}</option>`).join(''))}</select></div>
          <div><label class="form-label" for="um-res">Resolution</label><textarea class="form-control" id="um-res" name="resolution" rows="2" maxlength="2000" placeholder="Required when completing">${m.resolution || ''}</textarea></div>`,
        onSubmit: async (v) => { const res = await Api.call('updateMaintenanceRequest', Object.assign({ requestId: m.requestId }, v)); reload(); return res; }
      });
    });
  }

  async function renderOne(el, propertyId, tab) {
    tab = TABS.some(([k]) => k === tab) ? tab : 'overview';
    el.innerHTML = UI.loadingState('Loading property…');
    let p;
    try {
      ({ data: p } = await Api.call('getProperty', { propertyId }));
    } catch (err) {
      el.innerHTML = err.code === 'NOT_FOUND'
        ? '<div class="bt-card">' + UI.emptyState({ icon: 'search', title: 'Property not found', text: 'This property does not exist or you do not have access to it.', actionHref: '#/property', actionLabel: 'Back to properties' }) + '</div>'
        : UI.errorState(err);
      return;
    }
    document.getElementById('bt-page-title').textContent = p.name;
    document.title = p.name + ' · ' + APP_CONFIG.appName;
    const reload = () => renderOne(el, propertyId, tab);
    const nav = '<nav class="bt-tabs mb-4" aria-label="Property sections">' + TABS.map(([k, l, i]) => html`<a class="bt-tabs__link" href="#/property/${encodeURIComponent(p.propertyId)}/${k}" ${raw(k === tab ? 'aria-current="page"' : '')}><i class="bi bi-${i}" aria-hidden="true"></i>${l}</a>`).join('') + '</nav>';
    el.innerHTML = html`<div class="bt-card mb-3"><div class="bt-card__body d-flex flex-wrap justify-content-between gap-3">
        <div><p class="small text-muted mb-1">${p.propertyId}${p.projectId ? ' · built as ' + p.projectId : ''}</p><h1 class="mb-1">${p.name}</h1>
          <div class="bt-project__meta"><span><i class="bi bi-geo-alt" aria-hidden="true"></i>${p.location || '—'}</span><span><i class="bi bi-house" aria-hidden="true"></i>${p.type}</span><span><i class="bi bi-person" aria-hidden="true"></i>Owner: ${p.owner || '—'}</span>${raw(p.manager ? html`<span><i class="bi bi-person-badge" aria-hidden="true"></i>Managed by ${p.manager}</span>` : '')}</div></div>
        <div class="d-flex flex-column align-items-end gap-2">${raw(UI.statusBadge(p.status))}${raw(p.can.manage ? '<button type="button" class="btn btn-outline-primary btn-sm" data-act="edit-property"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit</button>' : '')}</div>
      </div></div>${raw(nav)}<div id="bt-prop-panel"></div>`;
    const panel = el.querySelector('#bt-prop-panel');
    if (tab === 'overview') panel.innerHTML = overview(p);
    else if (tab === 'units') panel.innerHTML = units(p);
    else if (tab === 'rent') panel.innerHTML = rent(p);
    else if (tab === 'maintenance') panel.innerHTML = maintenance(p);
    else if (tab === 'report') report(p, panel);
    else if (tab === 'cameras') Cameras.renderPanel(panel, { type: 'Property', id: p.propertyId });
    wire(p, el, panel, reload);
  }

  return { renderList, renderOne };
})();
