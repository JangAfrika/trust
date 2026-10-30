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
    const asks = b.fields.filter((f) => f.filledBy === 'Client').length;
    return html`<article class="bt-card bt-block">
      <div class="bt-block__icon"><i class="bi bi-${ICONS[b.key] || 'box'}" aria-hidden="true"></i></div>
      <h3>${b.name}</h3>
      <p class="bt-block__desc">${b.description}</p>
      ${b.features.length ? raw('<ul class="bt-block__features">' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      ${b.duration ? raw(html`<p class="small mb-0"><i class="bi bi-clock me-1" aria-hidden="true"></i>${b.duration}</p>`) : ''}
      ${asks ? raw(html`<p class="small text-muted mb-0"><i class="bi bi-card-checklist me-1" aria-hidden="true"></i>${asks} details asked once, when you request it</p>`) : ''}
      ${raw(price(b))}
      ${b.status !== 'Active' ? raw(UI.statusBadge(b.status)) : ''}
      <a class="btn btn-primary" href="#/blocks/${encodeURIComponent(b.blockId)}">${App.can('block.purchase') ? 'See details and request' : 'See details'}</a>
    </article>`;
  }

  function fieldList(fields) {
    return BlockDetails.groups(fields).map(([section, list]) => html`<h3 class="h6 mt-3">${section}</h3><ul class="bt-checklist">${raw(list.map((f) => html`<li>${f.label}${raw(f.type === 'document' ? ' <span class="text-muted small">(file)</span>' : '')}${raw(f.required ? '' : ' <span class="text-muted small">(optional)</span>')}</li>`).join(''))}</ul>`).join('');
  }

  /** One block on its own page: everything about it, what it will ask, and the request form. */
  function page(el, b) {
    const today = new Date().toISOString().substring(0, 10);
    const clientFields = b.fields.filter((f) => f.filledBy === 'Client');
    const staffFields = b.fields.filter((f) => f.filledBy === 'Staff');
    const canBuy = App.can('block.purchase') && b.status === 'Active';
    el.innerHTML = UI.pageHeader({ title: b.name, subtitle: b.description, actions: '<a class="btn btn-outline-primary btn-sm" href="#/blocks"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i>All blocks</a>' }) + html`
      <div class="bt-grid bt-grid--split mb-4">
        <section class="bt-card" aria-labelledby="h-bk-about"><div class="bt-card__header"><h2 id="h-bk-about">About this block</h2>${raw(b.status !== 'Active' ? UI.statusBadge(b.status) : '')}</div><div class="bt-card__body">
          <dl class="bt-dl mb-3"><dt>Price</dt><dd>${b.price === null ? 'Price on request' : Utils.formatMoney(b.price, b.currency)}</dd><dt>Duration</dt><dd>${b.duration || 'To be agreed'}</dd><dt>Stages</dt><dd>${b.stages.length ? b.stages.length + ' stages, each authorized by you' : 'Agreed with you after review'}</dd></dl>
          ${raw(b.features.length ? '<h3 class="h6">Included</h3><ul class="bt-checklist">' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>' : '')}
          ${raw(b.stages.length ? '<h3 class="h6 mt-3">Stages of the work</h3><ol class="small ps-3 mb-0">' + b.stages.map((s) => html`<li>${s}</li>`).join('') + '</ol>' : '')}
          ${raw(b.terms ? html`<h3 class="h6 mt-3">Terms</h3><p class="small text-muted mb-0" style="white-space:pre-line">${b.terms}</p>` : '')}
        </div></section>
        <section class="bt-card" aria-labelledby="h-bk-need"><div class="bt-card__header"><h2 id="h-bk-need">What to prepare</h2></div><div class="bt-card__body">
          ${raw(clientFields.length ? '<p class="small text-muted mb-0">We ask for these once, in the form below, so the work can start without back-and-forth.</p>' + fieldList(clientFields) : '<p class="small text-muted mb-0">Nothing to prepare: we will contact you after your request.</p>')}
          ${raw(staffFields.length ? '<hr><p class="small text-muted mb-0">Our team then records, on the same page:</p>' + fieldList(staffFields) : '')}
        </div></section>
      </div>
      ${raw(canBuy ? html`<section class="bt-card" aria-labelledby="h-bk-req"><div class="bt-card__header"><h2 id="h-bk-req">Request this block</h2></div><div class="bt-card__body">
        <form id="bt-purchase" novalidate>
          <fieldset class="bt-fieldset"><legend>Your project</legend><div class="row g-3">
            <div class="col-sm-6"><label class="form-label" for="pb-name">Project name</label><input class="form-control" id="pb-name" name="projectName" maxlength="150" data-rules="required" placeholder="e.g. Family house"></div>
            <div class="col-sm-6"><label class="form-label" for="pb-location">Town or area</label><input class="form-control" id="pb-location" name="location" maxlength="200" data-rules="required" placeholder="Town, area or plot reference"></div>
            <div class="col-sm-6"><label class="form-label" for="pb-start">Preferred start date <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="pb-start" name="preferredStartDate" type="date" min="${today}"></div>
            <div class="col-12"><label class="form-label" for="pb-desc">Anything else we should know? <span class="text-muted fw-normal">(optional)</span></label><textarea class="form-control" id="pb-desc" name="description" rows="3" maxlength="2000"></textarea></div>
          </div></fieldset>
          ${raw(BlockDetails.formSections(clientFields))}
          ${raw(b.terms ? '<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="pb-terms" name="acceptTerms" value="true" data-rules="required"><label class="form-check-label" for="pb-terms">I accept the terms of this block.</label></div>' : '')}
          <p class="small text-muted">Balance Trust reviews every request and contacts you to confirm scope, price and schedule before any work or payment. You can change your answers later on the project's Details tab.</p>
          <button type="submit" class="btn btn-accent">Request this block</button>
        </form></div></section>` : '')}`;
    const form = el.querySelector('#bt-purchase');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(form);
      if (!Validation.validateForm(form)) return;
      const got = BlockDetails.collect(form, clientFields);
      if (!got) return;
      const v = Object.fromEntries(new FormData(form).entries());
      const btn = form.querySelector('[type=submit]');
      const restore = UI.busy(btn, 'Sending request…');
      let data;
      let message;
      try {
        ({ data, message } = await Api.call('purchaseBlock', {
          blockId: b.blockId, projectName: v.projectName, location: v.location,
          description: v.description, preferredStartDate: v.preferredStartDate, acceptTerms: !!v.acceptTerms, details: got.values
        }));
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
        return;
      }
      const failed = await BlockDetails.uploadFiles(data.projectId, got.files, (i, n) => { btn.lastChild.textContent = ` Uploading file ${i} of ${n}…`; });
      if (failed.length) UI.toast('error', 'Your request was sent, but these files did not upload: ' + failed.join('; ') + '. Add them on the Details tab.', 12000);
      else UI.toast('success', message);
      location.hash = '#/projects/' + encodeURIComponent(data.projectId) + '/details';
    });
  }

  async function render(el, blockId) {
    el.innerHTML = UI.pageHeader({ title: 'Buy a Block', subtitle: 'Choose the service that fits your project.' }) + UI.skeletonCards(4, '18rem');
    let blocks;
    try {
      ({ data: blocks } = await Api.call('getBlocks'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el, blockId));
      return;
    }
    if (blockId) {
      const b = blocks.find((x) => x.blockId === blockId);
      if (b) { page(el, b); return; }
    }
    const header = UI.pageHeader({ title: 'Buy a Block', subtitle: 'Choose the service that fits your project. Each block opens a dedicated project workspace.' });
    if (!blocks.length) {
      el.innerHTML = header + '<div class="bt-card">' + UI.emptyState({ icon: 'boxes', title: 'No blocks available', text: 'Service blocks have not been published yet. Please check back soon.' }) + '</div>';
      return;
    }
    el.innerHTML = header + '<div class="bt-grid bt-grid--cards">' + blocks.map(card).join('') + '</div>';
  }

  return { render };
})();
