/**
 * Balance Trust — finance: invoices, payments and receipts, on the Finance
 * page and in a project's Finance tab. Totals shown while typing are only a
 * preview; the server calculates every amount again and is the record.
 */
const Finance = (() => {
  const { html, raw } = Utils;
  const money = (n, c) => Utils.formatMoney(n, c);

  /* ---------- line items editor (shared with material orders) ---------- */
  /**
   * Builds an editable list of lines inside `host`. columns: [{ name, label,
   * type ('text' | 'number' | 'select'), options, width, step }]. qtyKey and
   * priceKey drive the running total. Returns { values(), total() }.
   */
  function lineItems(host, { columns, qtyKey, priceKey, currencyInput, addLabel = 'Add line' }) {
    host.innerHTML = html`<div class="bt-lines" role="group" aria-label="Lines"><div class="bt-lines__rows"></div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2"><button type="button" class="btn btn-sm btn-outline-primary" data-add-line><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${addLabel}</button><span class="bt-lines__total small">Total preview: <strong data-total>—</strong></span></div></div>`;
    const rowsEl = host.querySelector('.bt-lines__rows');
    let n = 0;
    const field = (c, i) => {
      const id = `ln-${c.name}-${i}`;
      const label = html`<label class="form-label small mb-1" for="${id}">${c.label}</label>`;
      if (c.type === 'select') return html`<div class="bt-lines__cell" style="flex:${c.width || 1}">${raw(label)}<select class="form-select form-select-sm" id="${id}" data-col="${c.name}">${raw(c.options.map(([v, l]) => html`<option value="${v}">${l}</option>`).join(''))}</select></div>`;
      return html`<div class="bt-lines__cell" style="flex:${c.width || 1}">${raw(label)}<input class="form-control form-control-sm" id="${id}" data-col="${c.name}" ${raw(c.type === 'number' ? `type="number" min="0" step="${c.step || 'any'}" inputmode="decimal"` : 'type="text" maxlength="300"')}></div>`;
    };
    const total = () => [...rowsEl.querySelectorAll('.bt-lines__row')].reduce((sum, r) => {
      const q = Number(r.querySelector(`[data-col="${qtyKey}"]`).value) || 0;
      const p = Number(r.querySelector(`[data-col="${priceKey}"]`).value) || 0;
      return sum + Math.round(q * p * 100) / 100;
    }, 0);
    const update = () => { host.querySelector('[data-total]').textContent = money(total(), currencyInput ? currencyInput.value.toUpperCase() : ''); };
    const add = () => {
      const i = n++;
      const row = document.createElement('div');
      row.className = 'bt-lines__row';
      row.innerHTML = columns.map((c) => field(c, i)).join('') + html`<button type="button" class="btn btn-sm btn-outline-primary bt-lines__remove" aria-label="Remove line ${i + 1}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
      row.querySelector('.bt-lines__remove').addEventListener('click', () => { if (rowsEl.children.length > 1) { row.remove(); update(); } });
      row.addEventListener('input', update);
      rowsEl.appendChild(row);
      return row;
    };
    host.querySelector('[data-add-line]').addEventListener('click', () => { add().querySelector('input,select').focus(); });
    if (currencyInput) currencyInput.addEventListener('input', update);
    add();
    update();
    return {
      total,
      values: () => [...rowsEl.querySelectorAll('.bt-lines__row')].map((r) => Object.fromEntries([...r.querySelectorAll('[data-col]')].map((x) => [x.dataset.col, x.value.trim()])))
        .filter((v) => Object.values(v).some((x) => x !== ''))
    };
  }

  /* ---------- downloads ---------- */
  async function pdf(button, params) {
    const restore = UI.busy(button, '');
    try {
      const { data } = await Api.call('getFinancePdf', params, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      Utils.saveBase64(data.fileName, data.mimeType, data.base64);
    } catch (err) {
      UI.toast('error', err.message);
    } finally {
      restore();
    }
  }

  /* ---------- views ---------- */
  function summaryCards(summary) {
    if (!summary.length) return '';
    return summary.map((s) => '<section class="bt-grid bt-grid--stats mb-4" aria-label="Totals in ' + Utils.esc(s.currency) + '">' + [
      UI.statCard({ label: 'Invoiced', value: money(s.invoiced, s.currency), icon: 'receipt' }),
      UI.statCard({ label: 'Paid', value: money(s.paid, s.currency), icon: 'check2-circle', tone: 'green' }),
      UI.statCard({ label: 'Outstanding', value: money(s.outstanding, s.currency), icon: 'hourglass-split', tone: 'gold' }),
      UI.statCard({ label: 'Overdue', value: money(s.overdue, s.currency), icon: 'exclamation-triangle', tone: s.overdue ? 'red' : '' })
    ].join('') + '</section>').join('');
  }

  function invoicesTable(list, showProject) {
    if (!list.length) return UI.emptyState({ icon: 'receipt', title: 'No invoices yet', text: 'Invoices appear here once Balance Trust issues them.' });
    return '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Invoice</th>' + (showProject ? '<th>Project</th>' : '') + '<th>Issued</th><th>Due</th><th class="num">Total</th><th class="num">Balance</th><th>Status</th><th class="num"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' +
      list.map((i) => html`<tr><td><strong>${i.invoiceNumber}</strong>${raw(i.description ? html`<div class="small text-muted">${i.description}</div>` : '')}</td>
        ${raw(showProject ? html`<td><a href="#/projects/${encodeURIComponent(i.projectId)}/finance">${i.project}</a></td>` : '')}
        <td>${Utils.formatDate(i.issueDate)}</td><td>${Utils.formatDate(i.dueDate)}</td>
        <td class="num">${money(i.total, i.currency)}</td><td class="num">${money(i.balance, i.currency)}</td><td>${raw(UI.statusBadge(i.status))}</td>
        <td class="num"><button type="button" class="btn btn-sm btn-outline-primary" data-invoice="${i.invoiceId}">Open</button></td></tr>`).join('') + '</tbody></table></div>';
  }

  function paymentsTable(payments, receipts) {
    if (!payments.length) return UI.emptyState({ icon: 'cash-coin', title: 'No payments recorded', text: 'Payments appear here, each with its receipt, once Balance Trust records them.' });
    const byPayment = Object.fromEntries(receipts.map((r) => [r.paymentId, r]));
    return '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th class="num">Amount</th><th>Receipt</th></tr></thead><tbody>' +
      payments.map((p) => {
        const r = byPayment[p.paymentId];
        return html`<tr><td>${Utils.formatDate(p.date)}</td><td>${p.invoiceNumber}</td><td>${p.method}</td><td>${p.reference || '—'}</td><td class="num">${money(p.amount, p.currency)}</td>
          <td>${raw(r ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-receipt="${r.receiptId}" ${raw(r.hasPdf ? '' : 'disabled')}><i class="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>${r.receiptNumber}</button>` : '—')}</td></tr>`;
      }).join('') + '</tbody></table></div>';
  }

  async function openInvoice(invoiceId, data, reload) {
    const m = UI.modal({ title: 'Invoice', size: 'lg', body: UI.loadingState('Loading invoice…') });
    let inv;
    try {
      ({ data: inv } = await Api.call('getInvoice', { invoiceId }));
    } catch (err) {
      m.el.querySelector('.modal-body').innerHTML = UI.errorState(err);
      return;
    }
    m.el.querySelector('.modal-title').textContent = 'Invoice ' + inv.invoiceNumber;
    const manage = data.can.manage;
    const open = inv.storedStatus === 'Issued' || inv.storedStatus === 'Partially Paid';
    m.el.querySelector('.modal-body').innerHTML = html`
      <div class="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><strong>${inv.project}</strong><div class="small text-muted">${inv.client} · issued ${Utils.formatDate(inv.issueDate)} · due ${Utils.formatDate(inv.dueDate)}</div></div>${raw(UI.statusBadge(inv.status))}</div>
      ${raw(inv.description ? html`<p>${inv.description}</p>` : '')}
      <div class="bt-table-wrap mb-3"><table class="bt-table"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>
        ${raw(inv.items.map((it) => html`<tr><td>${it.description}${raw(it.stage ? html`<div class="small text-muted">Stage: ${it.stage}</div>` : '')}</td><td class="num">${it.quantity}</td><td class="num">${money(it.unitPrice, inv.currency)}</td><td class="num">${money(it.lineTotal, inv.currency)}</td></tr>`).join(''))}
      </tbody></table></div>
      <dl class="bt-dl ms-auto mb-3" style="max-width:20rem"><dt>Subtotal</dt><dd class="text-end">${money(inv.subtotal, inv.currency)}</dd>${raw(inv.discount ? html`<dt>Discount</dt><dd class="text-end">− ${money(inv.discount, inv.currency)}</dd>` : '')}${raw(inv.tax ? html`<dt>Tax</dt><dd class="text-end">${money(inv.tax, inv.currency)}</dd>` : '')}<dt>Total</dt><dd class="text-end"><strong>${money(inv.total, inv.currency)}</strong></dd><dt>Paid</dt><dd class="text-end">${money(inv.amountPaid, inv.currency)}</dd><dt>Balance</dt><dd class="text-end"><strong>${money(inv.balance, inv.currency)}</strong></dd></dl>
      ${raw(inv.payments.length ? '<h3 class="h6">Payments</h3>' + paymentsTable(inv.payments, inv.receipts) : '')}`;
    const actions = [
      '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Close</button>',
      inv.hasPdf ? '<button type="button" class="btn btn-outline-primary" data-act="pdf"><i class="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>PDF</button>' : '',
      manage && inv.storedStatus !== 'Cancelled' && !inv.amountPaid ? '<button type="button" class="btn btn-outline-danger" data-act="cancel">Cancel invoice</button>' : '',
      manage && inv.storedStatus === 'Draft' ? '<button type="button" class="btn btn-primary" data-act="issue">Issue and send</button>' : '',
      manage && open ? '<button type="button" class="btn btn-accent" data-act="pay">Record payment</button>' : ''
    ].join('');
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = actions;
    m.el.querySelector('.modal-content').appendChild(footer);
    m.el.querySelectorAll('[data-receipt]').forEach((b) => b.addEventListener('click', () => pdf(b, { receiptId: b.dataset.receipt })));
    const act = (name, fn) => { const b = footer.querySelector(`[data-act="${name}"]`); if (b) b.addEventListener('click', () => fn(b)); };
    act('pdf', (b) => pdf(b, { invoiceId }));
    act('issue', async (b) => {
      if (!(await UI.confirm({ title: 'Issue invoice', message: `Issue ${inv.invoiceNumber} for ${money(inv.total, inv.currency)}? A PDF is created and the client is notified. Issued invoices cannot be edited.`, confirmLabel: 'Issue and send' }))) return;
      const restore = UI.busy(b, 'Issuing…');
      try { const res = await Api.call('issueInvoice', { invoiceId }); UI.toast('success', res.message); m.close(); reload(); } catch (err) { restore(); UI.toast('error', err.message); }
    });
    act('cancel', () => { m.close(); openCancel(inv, reload); });
    act('pay', () => { m.close(); openPayment(inv, data.settings, reload); });
  }

  function openCancel(inv, reload) {
    const m = UI.modal({ title: 'Cancel invoice ' + inv.invoiceNumber, body: '<form id="bt-cancel-inv" novalidate><label class="form-label" for="ci-reason">Reason</label><textarea class="form-control" id="ci-reason" name="reason" rows="3" maxlength="500" data-rules="required"></textarea><div class="form-text">The reason is recorded in the audit log and sent to the client.</div></form>', footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Keep invoice</button><button type="submit" class="btn btn-danger" form="bt-cancel-inv">Cancel invoice</button>' });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Validation.validateForm(f)) return;
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Cancelling…');
      try { const res = await Api.call('cancelInvoice', { invoiceId: inv.invoiceId, reason: f.elements.reason.value }); UI.toast('success', res.message); m.close(); reload(); } catch (err) { restore(); if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message); }
    });
  }

  function openPayment(inv, settings, reload) {
    const today = new Date().toISOString().substring(0, 10);
    const method = settings.paymentMethods.length
      ? html`<select class="form-select" id="pm-method" name="paymentMethod" data-rules="required"><option value="">Choose…</option>${raw(settings.paymentMethods.map((x) => html`<option>${x}</option>`).join(''))}</select>`
      : '<input class="form-control" id="pm-method" name="paymentMethod" maxlength="60" data-rules="required" placeholder="How was it paid?">';
    const m = UI.modal({
      title: 'Record payment for ' + inv.invoiceNumber,
      body: html`<form id="bt-payment" novalidate>
        <p class="small text-muted">Balance due: <strong>${money(inv.balance, inv.currency)}</strong>. Record only money that has actually been received. A receipt is generated automatically.</p>
        <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="pm-amount">Amount (${inv.currency})</label><input class="form-control" id="pm-amount" name="amount" type="number" min="0.01" step="0.01" max="${inv.balance}" value="${inv.balance}" data-rules="required"></div>
          <div class="col-sm-6"><label class="form-label" for="pm-date">Payment date</label><input class="form-control" id="pm-date" name="paymentDate" type="date" max="${today}" value="${today}" data-rules="required"></div></div>
        <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="pm-method">Payment method</label>${raw(method)}</div>
          <div class="col-sm-6"><label class="form-label" for="pm-ref">Reference <span class="text-muted fw-normal">(recommended)</span></label><input class="form-control" id="pm-ref" name="reference" maxlength="120" placeholder="Bank or mobile money reference"></div></div>
      </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-accent" form="bt-payment">Record payment</button>'
    });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!Validation.validateForm(f)) return;
      const v = Object.fromEntries(new FormData(f).entries());
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Recording…');
      try { const res = await Api.call('recordPayment', Object.assign({ invoiceId: inv.invoiceId }, v)); UI.toast('success', res.message); m.close(); reload(); } catch (err) { restore(); if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message); }
    });
  }

  async function openNewInvoice(data, project, reload) {
    // Stage choices are only offered when the invoice is for one known project.
    let stages = [];
    if (project) stages = project.stages || [];
    const due = new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10);
    const m = UI.modal({
      title: 'New invoice', size: 'xl',
      body: html`<form id="bt-new-inv" novalidate>
        <div class="row g-3 mb-3">
          ${raw(project ? '' : html`<div class="col-md-4"><label class="form-label" for="ni-project">Project</label><select class="form-select" id="ni-project" name="projectId" data-rules="required"><option value="">Choose…</option>${raw(data.projects.map((p) => html`<option value="${p.projectId}">${p.name} (${p.projectId})</option>`).join(''))}</select></div>`)}
          <div class="col-md-2"><label class="form-label" for="ni-currency">Currency</label><input class="form-control text-uppercase" id="ni-currency" name="currency" maxlength="3" value="${data.settings.defaultCurrency}" placeholder="e.g. GMD" data-rules="required"></div>
          <div class="col-md-3"><label class="form-label" for="ni-due">Due date</label><input class="form-control" id="ni-due" name="dueDate" type="date" value="${due}" data-rules="required"></div>
          <div class="col-md-${project ? 7 : 3}"><label class="form-label" for="ni-desc">Description <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="ni-desc" name="description" maxlength="500"></div>
        </div>
        <div id="ni-lines" class="mb-3"></div>
        <div class="row g-3"><div class="col-sm-3"><label class="form-label" for="ni-discount">Discount (amount)</label><input class="form-control" id="ni-discount" name="discount" type="number" min="0" step="0.01" placeholder="0"></div>
          <div class="col-sm-3"><label class="form-label" for="ni-tax">Tax rate (%)</label><input class="form-control" id="ni-tax" name="taxRate" type="number" min="0" max="100" step="0.01" placeholder="0"><div class="form-text">Only if tax applies to this invoice.</div></div></div>
        <p class="small text-muted mt-3 mb-0" id="ni-items-error" role="alert"></p>
      </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-outline-primary" data-save="draft">Save draft</button><button type="button" class="btn btn-primary" data-save="issue">Save and issue</button>'
    });
    const f = m.el.querySelector('form');
    const cols = [{ name: 'description', label: 'Description', width: 4 }];
    if (stages.length) cols.push({ name: 'stageId', label: 'Stage', type: 'select', width: 2, options: [['', '—']].concat(stages.map((s) => [s.stageId, s.number + '. ' + s.name])) });
    cols.push({ name: 'quantity', label: 'Qty', type: 'number', width: 1 }, { name: 'unitPrice', label: 'Unit price', type: 'number', width: 2, step: '0.01' });
    const lines = lineItems(m.el.querySelector('#ni-lines'), { columns: cols, qtyKey: 'quantity', priceKey: 'unitPrice', currencyInput: f.elements.currency });
    m.el.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
      Validation.clearErrors(f);
      const errEl = m.el.querySelector('#ni-items-error');
      errEl.textContent = '';
      if (!Validation.validateForm(f)) return;
      const items = lines.values();
      if (!items.length) { errEl.textContent = 'Add at least one line.'; return; }
      const v = Object.fromEntries(new FormData(f).entries());
      const restore = UI.busy(b, 'Saving…');
      try {
        const res = await Api.call('createInvoice', {
          projectId: project ? project.projectId : v.projectId, currency: v.currency.toUpperCase(), dueDate: v.dueDate, description: v.description,
          discount: v.discount, taxRate: v.taxRate, items, issueNow: b.dataset.save === 'issue'
        });
        UI.toast('success', res.message);
        m.close();
        reload();
      } catch (err) {
        restore();
        if (err.fields && err.fields.items) errEl.textContent = err.fields.items;
        if (!Validation.applyServerErrors(f, err.fields) && !(err.fields && err.fields.items)) UI.toast('error', err.message);
      }
    }));
  }

  function body(data, { showProject }) {
    const settingsNote = data.can.manage && !data.settings.companyConfigured
      ? '<div class="bt-alert bt-alert--info mb-4"><i class="bi bi-info-circle me-2" aria-hidden="true"></i>Invoices and receipts show only the business details you configure. Set COMPANY_NAME (and address, phone, email, tax ID, payment instructions) in Script Properties to print them.</div>' : '';
    return settingsNote + summaryCards(data.summary) +
      '<section class="bt-card mb-4" aria-labelledby="h-inv"><div class="bt-card__header"><h2 id="h-inv">Invoices</h2></div>' + invoicesTable(data.invoices, showProject) + '</section>' +
      '<section class="bt-card" aria-labelledby="h-pay"><div class="bt-card__header"><h2 id="h-pay">Payments and receipts</h2></div>' + paymentsTable(data.payments, data.receipts) + '</section>';
  }

  function wire(root, data, project, reload) {
    root.querySelectorAll('[data-invoice]').forEach((b) => b.addEventListener('click', () => openInvoice(b.dataset.invoice, data, reload)));
    root.querySelectorAll('[data-receipt]').forEach((b) => b.addEventListener('click', () => pdf(b, { receiptId: b.dataset.receipt })));
    root.querySelectorAll('[data-act="new-invoice"]').forEach((b) => b.addEventListener('click', () => openNewInvoice(data, project, reload)));
  }

  async function renderPage(el) {
    const header = (actions) => UI.pageHeader({ title: 'Finance', subtitle: 'Invoices, payments, receipts and balances for your projects.', actions });
    el.innerHTML = header() + UI.loadingState('Loading finance…');
    let data;
    try {
      ({ data } = await Api.call('getFinance'));
    } catch (err) {
      el.innerHTML = header() + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => renderPage(el));
      return;
    }
    const action = data.can.manage && data.projects.length ? '<button type="button" class="btn btn-primary" data-act="new-invoice"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New invoice</button>' : '';
    el.innerHTML = header(action) + body(data, { showProject: true });
    wire(el, data, null, () => renderPage(el));
  }

  async function renderProject(panel, p) {
    panel.innerHTML = UI.loadingState('Loading finance…');
    let data;
    try {
      ({ data } = await Api.call('getFinance', { projectId: p.projectId }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err);
      return;
    }
    const action = data.can.manage ? '<div class="d-flex justify-content-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-act="new-invoice"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New invoice</button></div>' : '';
    panel.innerHTML = action + body(data, { showProject: false });
    wire(panel, data, p, () => renderProject(panel, p));
  }

  /** Outstanding balance text for the monitoring overview. */
  async function statusText(projectId) {
    const { data } = await Api.call('getFinance', { projectId });
    if (!data.summary.length) return 'No invoices yet';
    return data.summary.map((s) => `${money(s.paid, s.currency)} paid · ${money(s.outstanding, s.currency)} outstanding${s.overdue ? ' (' + money(s.overdue, s.currency) + ' overdue)' : ''}`).join(' · ');
  }

  return { renderPage, renderProject, lineItems, statusText };
})();
