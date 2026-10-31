/**
 * Balance Trust — material orders tab of a project: request (project staff),
 * approve or reject (approvers), then ordering and delivery.
 */
const Materials = (() => {
  const { html, raw } = Utils;
  const money = (n, c) => Utils.formatMoney(n, c);

  function orderCard(o, data) {
    const mine = o.requestedById === App.user().userId;
    const buttons = [
      data.can.approve && o.approvalStatus === 'Pending' && !mine ? html`<button type="button" class="btn btn-sm btn-accent" data-approve="${o.orderId}">Approve or reject</button>` : '',
      data.can.approve && o.approvalStatus === 'Pending' && mine ? '<span class="small text-muted">Waiting for another approver</span>' : '',
      data.can.request && o.approvalStatus === 'Approved' && o.deliveryStatus !== 'Delivered' && o.deliveryStatus !== 'Cancelled' ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-delivery="${o.orderId}">Update delivery</button>` : ''
    ].join(' ');
    return html`<article class="bt-card bt-stage" aria-label="Order from ${o.supplier}">
      <div class="bt-stage__head"><span class="bt-stage__num" aria-hidden="true"><i class="bi bi-truck"></i></span>
        <div class="flex-grow-1 min-w-0"><h3 class="bt-stage__name">${o.supplier}</h3><p class="bt-stage__meta">${o.stage || 'Whole project'} · requested by ${o.requestedBy}, ${Utils.formatDate(o.requestedDate)}${o.expectedDelivery ? ' · expected ' + Utils.formatDate(o.expectedDelivery) : ''}</p></div>
        <div class="d-flex flex-wrap gap-2">${raw(UI.statusBadge(o.approvalStatus))}${raw(o.approvalStatus === 'Approved' ? UI.statusBadge(o.deliveryStatus) : '')}</div></div>
      <div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Material</th><th class="num">Quantity</th><th class="num">Unit price</th><th class="num">Total</th></tr></thead><tbody>
        ${raw(o.items.map((it) => html`<tr><td>${it.material}</td><td class="num">${it.quantity} ${it.unit}</td><td class="num">${money(it.unitPrice, o.currency)}</td><td class="num">${money(it.totalPrice, o.currency)}</td></tr>`).join(''))}
        <tr><td colspan="3"><strong>Order total</strong></td><td class="num"><strong>${money(o.totalPrice, o.currency)}</strong></td></tr></tbody></table></div>
      ${raw(o.approvedBy ? html`<p class="small text-muted mb-0">${o.approvalStatus} by ${o.approvedBy}, ${Utils.formatDate(o.approvalDate)}${o.orderDate ? ' · ordered ' + Utils.formatDate(o.orderDate) : ''}</p>` : '')}
      ${raw(o.notes ? html`<p class="small mb-0" style="white-space:pre-line">${o.notes}</p>` : '')}
      ${raw(o.documents.length ? '<div class="d-flex flex-wrap gap-2">' + o.documents.map((d) => html`<button type="button" class="btn btn-sm btn-outline-primary" data-doc="${d.documentId}"><i class="bi bi-paperclip me-1" aria-hidden="true"></i>${d.name}</button>`).join('') + '</div>' : '')}
      ${raw(buttons.trim() ? `<div class="d-flex flex-wrap gap-2 align-items-center">${buttons}</div>` : '')}
    </article>`;
  }

  function openNew(p, data, reload) {
    const m = UI.modal({
      title: 'Request materials', size: 'xl',
      body: html`<form id="bt-mat-form" novalidate>
        <div class="row g-3 mb-3">
          <div class="col-md-4"><label class="form-label" for="mo-supplier">Supplier</label><input class="form-control" id="mo-supplier" name="supplier" maxlength="150" data-rules="required"></div>
          <div class="col-md-3"><label class="form-label" for="mo-stage">Stage</label><select class="form-select" id="mo-stage" name="stageId"><option value="">Whole project</option>${raw(p.stages.map((s) => html`<option value="${s.stageId}" ${raw(s.name === p.currentStage ? 'selected' : '')}>${s.number}. ${s.name}</option>`).join(''))}</select></div>
          <div class="col-md-2"><label class="form-label" for="mo-currency">Currency</label><input class="form-control text-uppercase" id="mo-currency" name="currency" maxlength="3" value="${data.defaultCurrency}" placeholder="e.g. GMD" data-rules="required"></div>
          <div class="col-md-3"><label class="form-label" for="mo-delivery">Expected delivery</label><input class="form-control" id="mo-delivery" name="expectedDelivery" type="date"></div>
        </div>
        <div id="mo-lines" class="mb-3"></div>
        <div class="row g-3"><div class="col-md-6"><label class="form-label" for="mo-file">Quote or pro-forma <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="mo-file" name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"></div>
          <div class="col-md-6"><label class="form-label" for="mo-notes">Notes <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="mo-notes" name="notes" maxlength="1000"></div></div>
        <p class="small text-muted mt-3 mb-0" id="mo-items-error" role="alert"></p>
      </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-mat-form">Send for approval</button>'
    });
    const f = m.el.querySelector('form');
    const lines = Finance.lineItems(m.el.querySelector('#mo-lines'), {
      columns: [{ name: 'material', label: 'Material', width: 4 }, { name: 'quantity', label: 'Qty', type: 'number', width: 1 }, { name: 'unit', label: 'Unit', width: 1 }, { name: 'unitPrice', label: 'Unit price', type: 'number', width: 2, step: '0.01' }],
      qtyKey: 'quantity', priceKey: 'unitPrice', currencyInput: f.elements.currency, addLabel: 'Add material'
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      const errEl = m.el.querySelector('#mo-items-error');
      errEl.textContent = '';
      if (!Validation.validateForm(f)) return;
      const items = lines.values();
      if (!items.length) { errEl.textContent = 'Add at least one material.'; return; }
      const v = Object.fromEntries(new FormData(f).entries());
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Sending…');
      try {
        const file = f.elements.file.files[0];
        const params = { projectId: p.projectId, supplier: v.supplier, stageId: v.stageId, currency: v.currency.toUpperCase(), expectedDelivery: v.expectedDelivery, notes: v.notes, items };
        if (file) params.file = { fileName: file.name, mimeType: file.type || 'application/octet-stream', base64: await Utils.readFileBase64(file) };
        const res = await Api.call('createMaterialOrder', params, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
        UI.toast('success', res.message);
        m.close();
        reload();
      } catch (err) {
        restore();
        if (err.fields && err.fields.items) errEl.textContent = err.fields.items;
        if (!Validation.applyServerErrors(f, err.fields) && !(err.fields && err.fields.items)) UI.toast('error', err.message);
      }
    });
  }

  function openApprove(o, reload) {
    const m = UI.modal({
      title: 'Material order from ' + o.supplier,
      body: html`<p>Total <strong>${money(o.totalPrice, o.currency)}</strong> for ${o.items.length} material${o.items.length === 1 ? '' : 's'}, requested by ${o.requestedBy}.</p>
        <form id="bt-mat-approve" novalidate>
          <div class="form-check"><input class="form-check-input" type="radio" name="decision" id="ma-ok" value="approved" checked><label class="form-check-label" for="ma-ok">Approve</label></div>
          <div class="form-check mb-3"><input class="form-check-input" type="radio" name="decision" id="ma-no" value="rejected"><label class="form-check-label" for="ma-no">Reject</label></div>
          <label class="form-label" for="ma-comment">Comment <span class="text-muted fw-normal">(required to reject)</span></label><textarea class="form-control" id="ma-comment" name="comment" rows="2" maxlength="500"></textarea>
        </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-accent" form="bt-mat-approve">Submit decision</button>'
    });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      try { const res = await Api.call('approveMaterialOrder', { orderId: o.orderId, decision: f.elements.decision.value, comment: f.elements.comment.value }); UI.toast('success', res.message); m.close(); reload(); } catch (err) { restore(); if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message); }
    });
  }

  function openDelivery(o, data, reload) {
    const m = UI.modal({
      title: 'Delivery: ' + o.supplier,
      body: html`<form id="bt-mat-delivery" novalidate>
        <div class="mb-3"><label class="form-label" for="md-status">Delivery status</label><select class="form-select" id="md-status" name="deliveryStatus">${raw(data.deliveryStatuses.map((s) => html`<option ${raw(s === o.deliveryStatus ? 'selected' : '')}>${s}</option>`).join(''))}</select></div>
        <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="md-order">Order date</label><input class="form-control" id="md-order" name="orderDate" type="date" value="${(o.orderDate || '').substring(0, 10)}"></div>
          <div class="col-sm-6"><label class="form-label" for="md-exp">Expected delivery</label><input class="form-control" id="md-exp" name="expectedDelivery" type="date" value="${(o.expectedDelivery || '').substring(0, 10)}"></div></div>
      </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-mat-delivery">Save</button>'
    });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f).entries());
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      try { const res = await Api.call('updateMaterialDelivery', Object.assign({ orderId: o.orderId }, v)); UI.toast('success', res.message); m.close(); reload(); } catch (err) { restore(); if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message); }
    });
  }

  async function renderProject(panel, p) {
    panel.innerHTML = UI.loadingState('Loading material orders…');
    let data;
    try {
      ({ data } = await Api.call('getMaterialOrders', { projectId: p.projectId }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err);
      return;
    }
    const reload = () => renderProject(panel, p);
    const add = data.can.request ? '<div class="d-flex justify-content-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-act="new-order"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Request materials</button></div>' : '';
    panel.innerHTML = add + (data.items.length
      ? '<div class="d-grid gap-3">' + data.items.map((o) => orderCard(o, data)).join('') + '</div>'
      : '<div class="bt-card">' + UI.emptyState({ icon: 'truck', title: 'No material orders yet', text: 'Materials the team requests for this project, with their approval and delivery, appear here.' }) + '</div>');
    const byId = Object.fromEntries(data.items.map((o) => [o.orderId, o]));
    panel.querySelectorAll('[data-act="new-order"]').forEach((b) => b.addEventListener('click', () => openNew(p, data, reload)));
    panel.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => openApprove(byId[b.dataset.approve], reload)));
    panel.querySelectorAll('[data-delivery]').forEach((b) => b.addEventListener('click', () => openDelivery(byId[b.dataset.delivery], data, reload)));
    panel.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => Documents.download(b, b.dataset.doc)));
  }

  return { renderProject };
})();
