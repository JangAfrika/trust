/**
 * Balance Trust — Buy a Block: service selection. Blocks, prices and terms
 * come from the database; nothing is hard-coded here.
 */
const Blocks = (() => {
  const { html, raw } = Utils;
  const ICONS = { BUILD: 'bricks', SUPERVISE: 'clipboard-check', BUILD_TO_PLAN: 'rulers', MANAGE: 'house-gear' };

  function price(b) {
    return b.price === null
      ? '<p class="bt-block__price bt-block__price--unset">Price on request</p>'
      : html`<p class="bt-block__price">${Utils.formatMoney(b.price, b.currency)}</p>`;
  }

  function card(b) {
    return html`<article class="bt-card bt-block">
      <div class="bt-block__icon"><i class="bi bi-${ICONS[b.key] || 'box'}" aria-hidden="true"></i></div>
      <h3>${b.name}</h3>
      <p class="bt-block__desc">${b.description}</p>
      ${b.features.length ? raw('<ul class="bt-block__features">' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      ${b.duration ? raw(html`<p class="small mb-0"><i class="bi bi-clock me-1" aria-hidden="true"></i>${b.duration}</p>`) : ''}
      ${raw(price(b))}
      ${b.status !== 'Active' ? raw(UI.statusBadge(b.status)) : ''}
      ${App.can('block.purchase') ? raw(html`<button type="button" class="btn btn-primary" data-block="${b.blockId}">Select</button>`) : ''}
    </article>`;
  }

  function details(b) {
    const today = new Date().toISOString().substring(0, 10);
    const body = html`<p>${b.description}</p>
      ${b.features.length ? raw('<h3 class="h6">Included</h3><ul>' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      <dl class="bt-dl mb-3"><dt>Price</dt><dd>${b.price === null ? 'Price on request' : Utils.formatMoney(b.price, b.currency)}</dd><dt>Duration</dt><dd>${b.duration || 'To be agreed'}</dd></dl>
      ${b.terms ? raw(html`<h3 class="h6">Terms</h3><p class="small text-muted" style="white-space:pre-line">${b.terms}</p>`) : ''}
      <hr>
      <h3 class="h6 mb-3">Your project</h3>
      <form id="bt-purchase" novalidate>
        <div class="mb-3"><label class="form-label" for="pb-name">Project name</label><input class="form-control" id="pb-name" name="projectName" maxlength="150" data-rules="required" placeholder="e.g. Family house"></div>
        <div class="mb-3"><label class="form-label" for="pb-location">Location</label><input class="form-control" id="pb-location" name="location" maxlength="200" data-rules="required" placeholder="Town, area or plot reference"></div>
        <div class="mb-3"><label class="form-label" for="pb-desc">What do you need? <span class="text-muted fw-normal">(optional)</span></label><textarea class="form-control" id="pb-desc" name="description" rows="3" maxlength="2000"></textarea></div>
        <div class="mb-3"><label class="form-label" for="pb-start">Preferred start date <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="pb-start" name="preferredStartDate" type="date" min="${today}"></div>
        ${b.terms ? raw('<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="pb-terms" name="acceptTerms" value="true" data-rules="required"><label class="form-check-label" for="pb-terms">I accept the terms of this block.</label></div>') : ''}
        <p class="small text-muted mb-0">Balance Trust reviews every request and contacts you to confirm scope, price and schedule before any work or payment.</p>
      </form>`;
    const m = UI.modal({
      title: b.name,
      body,
      size: 'lg',
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-accent" form="bt-purchase">Request this block</button>'
    });
    const form = m.el.querySelector('#bt-purchase');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(form);
      if (!Validation.validateForm(form)) return;
      const v = Object.fromEntries(new FormData(form).entries());
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Sending request…');
      try {
        const { data, message } = await Api.call('purchaseBlock', {
          blockId: b.blockId, projectName: v.projectName, location: v.location,
          description: v.description, preferredStartDate: v.preferredStartDate, acceptTerms: !!v.acceptTerms
        });
        m.close();
        UI.toast('success', message);
        location.hash = '#/projects/' + encodeURIComponent(data.projectId);
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
      }
    });
  }

  async function render(el) {
    el.innerHTML = UI.pageHeader({ title: 'Buy a Block', subtitle: 'Choose the service that fits your project.' }) + UI.skeletonCards(4, '18rem');
    let blocks;
    try {
      ({ data: blocks } = await Api.call('getBlocks'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    const header = UI.pageHeader({ title: 'Buy a Block', subtitle: 'Choose the service that fits your project. Each block opens a dedicated project workspace.' });
    if (!blocks.length) {
      el.innerHTML = header + '<div class="bt-card">' + UI.emptyState({ icon: 'boxes', title: 'No blocks available', text: 'Service blocks have not been published yet. Please check back soon.' }) + '</div>';
      return;
    }
    el.innerHTML = header + '<div class="bt-grid bt-grid--cards">' + blocks.map(card).join('') + '</div>';
    el.querySelectorAll('[data-block]').forEach((btn) => btn.addEventListener('click', () => details(blocks.find((b) => b.blockId === btn.dataset.block))));
  }

  return { render };
})();
