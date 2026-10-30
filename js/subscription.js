/**
 * Balance Trust — the subscriber's Subscription page: current plan and end
 * date, the plans with their prices, payment by Wave, PayPal or a credit /
 * Visa card, and the payment history.
 *
 * Paying opens the provider's own checkout page (Wave or PayPal); card and
 * Wave details are entered there, never here. On the way back the server
 * checks with the provider before anything changes, so returning to this page
 * proves nothing by itself.
 */
const Subscription = (() => {
  const { html, raw } = Utils;
  const RETURN_KEY = 'bt.payReturn';
  const METHOD = {
    Wave: { label: 'Pay with Wave', icon: 'phone', cls: 'btn-primary' },
    PayPal: { label: 'Pay with PayPal', icon: 'paypal', cls: 'btn-outline-primary' },
    Card: { label: 'Pay by credit or Visa card', icon: 'credit-card', cls: 'btn-outline-primary' }
  };

  /**
   * Called once at start-up. Wave and PayPal send the payer back to
   * <site>/?pay=<payment>; the reference is kept (even across a sign-in) and
   * the address is cleaned so a reload does not repeat it.
   */
  function captureReturn() {
    const q = new URLSearchParams(location.search);
    const id = q.get('pay');
    if (!id || !/^[A-Z]{2,4}-\d{6,}$/.test(id)) return;
    try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ id, r: q.get('r') || '' })); } catch (e) { /* confirmed later from the history */ }
    history.replaceState(null, '', location.pathname + '#/subscription');
  }

  function takeReturn() {
    try {
      const v = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
      sessionStorage.removeItem(RETURN_KEY);
      return v;
    } catch (e) { return null; }
  }

  const price = (amount, currency) => (amount === null || amount === undefined ? '' : Utils.formatMoney(amount, currency));
  const period = (m) => (m === 1 ? 'month' : m === 12 ? 'year' : m + ' months');

  function planCard(p, data) {
    const prices = [p.localPrice !== null ? price(p.localPrice, p.localCurrency) : '', p.intlPrice !== null ? price(p.intlPrice, p.intlCurrency) : ''].filter(Boolean);
    const current = data.subscription && data.subscription.status === 'Active' && data.subscription.planId === p.planId;
    return html`<article class="bt-card bt-block">
      <div class="bt-block__icon"><i class="bi bi-patch-check" aria-hidden="true"></i></div>
      <h3>${p.name}</h3>
      ${p.description ? raw(html`<p class="bt-block__desc">${p.description}</p>`) : ''}
      ${p.features.length ? raw('<ul class="bt-block__features">' + p.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      <p class="bt-block__price">${prices.join(' · ')} <span class="small text-muted fw-normal">per ${period(p.periodMonths)}</span></p>
      ${raw(p.methods.length
        ? '<div class="d-grid gap-2">' + p.methods.map((m) => html`<button type="button" class="btn ${METHOD[m].cls}" data-plan="${p.planId}" data-method="${m}"><i class="bi bi-${METHOD[m].icon} me-1" aria-hidden="true"></i>${current ? METHOD[m].label.replace('Pay', 'Renew') : METHOD[m].label}</button>`).join('') + '</div>'
        : '<p class="small text-muted mb-0">Online payment is not available for this plan yet. Contact us to pay by cash or bank transfer.</p>')}
      ${raw(p.methods.includes('Wave') && (p.methods.includes('PayPal')) ? html`<p class="small text-muted mb-0">Wave is charged in ${p.localCurrency}; PayPal and cards in ${p.intlCurrency}.</p>` : '')}
    </article>`;
  }

  function status(data) {
    const s = data.subscription;
    if (!s) {
      return html`<section class="bt-card mb-4"><div class="bt-card__body d-flex gap-3 align-items-start"><i class="bi bi-info-circle fs-4 text-muted" aria-hidden="true"></i><div><h2 class="h5 mb-1">No subscription yet</h2><p class="mb-0 text-muted">${data.required && !data.exempt ? 'A subscription is needed before you can request a block. Choose a plan below.' : 'Choose a plan below.'}</p></div></div></section>`;
    }
    return html`<section class="bt-card mb-4" aria-labelledby="h-sub-now"><div class="bt-card__header"><h2 id="h-sub-now">Your subscription</h2>${raw(UI.statusBadge(s.status))}</div><div class="bt-card__body">
      <dl class="bt-dl"><dt>Plan</dt><dd>${s.plan}</dd><dt>${s.status === 'Active' ? 'Active until' : 'Ended on'}</dt><dd>${Utils.formatDate(s.endDate)}${s.status === 'Active' ? ' (' + s.daysLeft + ' day' + (s.daysLeft === 1 ? '' : 's') + ' left)' : ''}</dd></dl>
      ${raw(s.status === 'Active' ? '<p class="small text-muted mt-3 mb-0">Paying again adds a new period after the current one ends, so no days are lost.</p>' : '')}
    </div></section>`;
  }

  function paymentsTable(payments) {
    if (!payments.length) return '';
    return html`<section class="bt-card mt-4" aria-labelledby="h-sub-pay"><div class="bt-card__header"><h2 id="h-sub-pay">Payments</h2></div><div class="bt-table-wrap"><table class="bt-table">
      <thead><tr><th>Date</th><th>Plan</th><th>Method</th><th class="num">Amount</th><th>Status</th><th>Period</th><th>Reference</th></tr></thead><tbody>
      ${raw(payments.map((p) => html`<tr><td>${Utils.formatDate(p.paidAt || p.createdAt)}</td><td>${p.plan}</td><td>${p.method}</td><td class="num">${Utils.formatMoney(p.amount, p.currency)}</td><td>${raw(UI.statusBadge(p.status))}${raw(p.failureReason ? html`<div class="small text-muted">${p.failureReason}</div>` : '')}</td><td class="small">${p.periodStart ? Utils.formatDate(p.periodStart) + ' – ' + Utils.formatDate(p.periodEnd) : '—'}</td><td class="small">${p.paymentId}${raw(p.reference ? html`<div class="text-muted">${p.reference}</div>` : '')}</td></tr>`).join(''))}
      </tbody></table></div></section>`;
  }

  async function pay(btn, planId, method) {
    const restore = UI.busy(btn, 'Opening checkout…');
    try {
      const { data } = await Api.call('startSubscriptionPayment', { planId, method });
      // The provider's own page; it must open in the browser itself (Wave needs that to open its app).
      window.location.assign(data.redirectUrl);
    } catch (err) {
      restore();
      UI.toast('error', (err.fields && err.fields.method) || err.message);
    }
  }

  async function confirmReturn(el, ret) {
    const box = document.createElement('div');
    box.className = 'mb-4';
    box.innerHTML = UI.loadingState('Checking your payment with ' + (ret.r === 'cancel' ? 'the provider' : 'Wave or PayPal') + '…');
    el.prepend(box);
    try {
      const { data, message } = await Api.call('confirmSubscriptionPayment', { paymentId: ret.id });
      const type = data.status === 'Paid' ? 'success' : data.status === 'Pending' ? 'info' : 'error';
      box.innerHTML = html`<div class="bt-alert bt-alert--${type}" role="${type === 'error' ? 'alert' : 'status'}"><i class="bi bi-${type === 'success' ? 'check-circle' : type === 'info' ? 'hourglass-split' : 'exclamation-circle'}" aria-hidden="true"></i><span>${message}</span></div>`;
      return data.status;
    } catch (err) {
      box.innerHTML = html`<div class="bt-alert bt-alert--error" role="alert"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>${err.message}</span></div>`;
      return null;
    }
  }

  async function render(el) {
    const header = UI.pageHeader({ title: 'Subscription', subtitle: 'Your plan, its renewal and your payments.' });
    el.innerHTML = header + UI.skeletonCards(3, '14rem');
    const ret = takeReturn();
    let data;
    try {
      ({ data } = await Api.call('getMySubscription'));
    } catch (err) {
      el.innerHTML = header + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    const plans = data.plans.length
      ? '<h2 class="h5 mb-3">Plans</h2><div class="bt-grid bt-grid--cards">' + data.plans.map((p) => planCard(p, data)).join('') + '</div>'
      : '<div class="bt-card">' + UI.emptyState({ icon: 'patch-question', title: 'No plans yet', text: 'Subscription plans have not been published yet. Please check back soon.' }) + '</div>';
    el.innerHTML = header + '<div id="bt-sub-return"></div>' + status(data) + plans + paymentsTable(data.payments) +
      '<p class="small text-muted mt-4 mb-0"><i class="bi bi-shield-lock me-1" aria-hidden="true"></i>You pay on the Wave or PayPal page. Balance Trust never sees your card number or Wave PIN.</p>';
    el.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => pay(b, b.dataset.plan, b.dataset.method)));
    if (ret) {
      const st = await confirmReturn(el.querySelector('#bt-sub-return'), ret);
      if (st && st !== 'Pending') {
        // Show the new end date and history without losing the message.
        const msg = el.querySelector('#bt-sub-return').innerHTML;
        await render(el);
        el.querySelector('#bt-sub-return').innerHTML = msg;
      }
    }
  }

  /** Small notice for the block page when a subscription is needed first. Returns '' when not needed. */
  async function blockNotice() {
    try {
      const { data } = await Api.call('getMySubscription');
      if (!data.required || data.exempt || (data.subscription && data.subscription.status === 'Active')) return '';
      return '<div class="bt-alert bt-alert--info mb-0"><i class="bi bi-patch-check" aria-hidden="true"></i><span>A subscription is needed before you can request a block. <a href="#/subscription">Choose a plan</a>, then come back to this page.</span></div>';
    } catch (e) { return ''; }
  }

  return { render, captureReturn, blockNotice };
})();
