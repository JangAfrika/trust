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
      <button type="button" class="btn btn-primary" data-block="${b.blockId}">Select</button>
    </article>`;
  }

  function details(b) {
    const body = html`<p>${b.description}</p>
      ${b.features.length ? raw('<h3 class="h6">Included</h3><ul>' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      <dl class="bt-dl mb-3"><dt>Price</dt><dd>${b.price === null ? 'Price on request' : Utils.formatMoney(b.price, b.currency)}</dd><dt>Duration</dt><dd>${b.duration || 'To be agreed'}</dd></dl>
      ${b.terms ? raw(html`<h3 class="h6">Terms</h3><p class="small text-muted" style="white-space:pre-line">${b.terms}</p>`) : ''}
      <div class="bt-alert bt-alert--info mb-0"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Online project requests for this block open in the next release. Your project workspace, folders and first stages will be created automatically when it does.</span></div>`;
    UI.modal({ title: b.name, body, footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Close</button>' });
  }

  async function render(el) {
    el.innerHTML = UI.pageHeader({ title: 'Buy a Block', subtitle: 'Choose the service that fits your project.' }) + UI.skeletonCards(4, '18rem');
    let blocks;
    try {
      ({ data: blocks } = await Api.call('getBlocks'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      document.getElementById('bt-retry').addEventListener('click', () => render(el));
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
