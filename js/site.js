/**
 * Balance Trust — the public website (index.html): Home, Services, About,
 * Gallery and Contact, with Log in and Sign up.
 *
 * Services, prices, plans, the About texts, gallery photos and contact
 * details all come from the database through the public getPublicSite
 * action, as entered by the business in Administration. Nothing is invented:
 * a tab with nothing entered yet says so. The "how it works" and "why us"
 * points describe what the app itself does.
 */
const Site = (() => {
  const { html, raw } = Utils;
  const TABS = [['home', 'Home', 'house'], ['services', 'Services', 'grid'], ['about', 'About', 'info-circle'], ['gallery', 'Gallery', 'images'], ['contact', 'Contact', 'envelope']];
  const ICONS = { BUILD: 'bricks', SUPERVISE: 'clipboard-check', BUILD_TO_PLAN: 'rulers', MANAGE: 'house-gear' };

  // Shown only if the server cannot be reached: the four services from the concept document, without prices.
  const FALLBACK_BLOCKS = [
    { key: 'BUILD', name: 'Buy a Block to Build', description: 'For clients who want construction execution.', features: [], price: null, asks: [] },
    { key: 'SUPERVISE', name: 'Buy a Block to Supervise', description: 'For clients who need professional project supervision.', features: [], price: null, asks: [] },
    { key: 'BUILD_TO_PLAN', name: 'Build to Plan', description: 'For clients who have an established design or plan and require execution according to the plan.', features: [], price: null, asks: [] },
    { key: 'MANAGE', name: 'Buy a Block to Manage', description: 'For property and project management.', features: [], price: null, asks: [] }
  ];

  const STEPS = [
    ['person-plus', 'Create your account', 'Sign up with your email or phone number. It takes a minute.'],
    ['bag-plus', 'Choose a block', 'Build, supervise, build to your plan, or manage a property. Tell us about your project once: the form asks everything the work needs.'],
    ['chat-square-text', 'We confirm the plan', 'Our team reviews your request and agrees scope, price and schedule with you before any work or payment.'],
    ['camera-video', 'Follow the work', 'See every stage with photos, videos, written updates and live site cameras, from wherever you are.'],
    ['shield-check', 'Authorize each stage', 'The next stage starts only when you approve the one before it.'],
    ['house-heart', 'Keep and manage', 'Every document stays in one place, and after the build we can look after tenants, rent and maintenance.']
  ];

  const WHY = [
    ['eye', 'You see your site', 'Photos, videos, reports and live cameras show the real progress, not just what you are told.'],
    ['hand-thumbs-up', 'You stay in control', 'Nothing moves to the next stage, and no stage is paid for, without your authorization.'],
    ['receipt', 'Every payment on record', 'Invoices, payments and receipts are recorded against each stage of your project.'],
    ['folder-check', 'All your documents together', 'Contracts, plans, permits and reports form a permanent history of your building.'],
    ['people', 'One team, start to finish', 'The same platform covers building, supervision, planning and property management.'],
    ['lock', 'Your information protected', 'Secure sign-in, access by role, and a log of every change made to your records.']
  ];

  const METHOD_NAMES = { Wave: 'Wave', PayPal: 'PayPal', Card: 'Visa card' };

  let root;
  let site = { company: {}, blocks: FALLBACK_BLOCKS, plans: [], site: {}, gallery: [] };
  let signedIn = false;
  const images = {}; // imageId → object URL, loaded once

  const currentTab = () => {
    const t = location.hash.replace('#', '');
    return TABS.some(([k]) => k === t) ? t : 'home';
  };

  /* ---------- pieces ---------- */

  function actions(size, light = true) {
    if (signedIn) {
      return html`<div class="bt-landing__actions"><a class="btn btn-accent ${size}" href="login.html"><i class="bi bi-grid-1x2 me-1" aria-hidden="true"></i>Open my dashboard</a></div>`;
    }
    return html`<div class="bt-landing__actions">
      <a class="btn btn-accent ${size}" href="login.html"><i class="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Log in</a>
      <a class="btn ${light ? 'btn-outline-light' : 'btn-outline-primary'} ${size}" href="register.html"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>Sign up</a>
    </div>
    <p class="bt-landing__hint">Log in if you already have an account. Sign up if you don't.</p>`;
  }

  function blockCard(b) {
    return html`<article class="bt-card bt-block">
      <div class="bt-block__icon"><i class="bi bi-${ICONS[b.key] || 'box'}" aria-hidden="true"></i></div>
      <h3>${b.name}</h3>
      <p class="bt-block__desc">${b.description}</p>
      ${b.features.length ? raw('<ul class="bt-block__features">' + b.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}
      ${b.duration ? raw(html`<p class="small mb-0"><i class="bi bi-clock me-1" aria-hidden="true"></i>${b.duration}</p>`) : ''}
      ${raw(b.price === null || b.price === undefined ? '<p class="bt-block__price bt-block__price--unset">Price on request</p>' : html`<p class="bt-block__price">${Utils.formatMoney(b.price, b.currency)}</p>`)}
      ${b.asks.length ? raw(html`<details class="bt-landing__asks"><summary>What to prepare (${b.asks.length})</summary><ul>${raw(b.asks.map((a) => html`<li>${a}</li>`).join(''))}</ul></details>`) : ''}
    </article>`;
  }

  function plansSection() {
    if (!site.plans || !site.plans.length) return '';
    const period = (m) => (m === 1 ? 'month' : m === 12 ? 'year' : m + ' months');
    const cards = site.plans.map((p) => {
      const price = p.localPrice !== null ? Utils.formatMoney(p.localPrice, p.localCurrency) : '';
      return html`<article class="bt-card bt-block"><div class="bt-block__icon"><i class="bi bi-patch-check" aria-hidden="true"></i></div><h3>${p.name}</h3>${p.description ? raw(html`<p class="bt-block__desc">${p.description}</p>`) : ''}${p.features.length ? raw('<ul class="bt-block__features">' + p.features.map((f) => html`<li>${f}</li>`).join('') + '</ul>') : ''}<p class="bt-block__price">${price} <span class="small text-muted fw-normal">per ${period(p.periodMonths)}</span></p></article>`;
    }).join('');
    const methods = (site.paymentMethods || []).map((m) => METHOD_NAMES[m] || m);
    return html`<section class="bt-landing__section bt-landing__section--alt" aria-labelledby="h-s-plans"><div class="bt-landing__wrap">
      <h2 id="h-s-plans">Subscription</h2>
      <p class="bt-landing__sub">${site.subscriptionRequired ? 'Your account opens with a yearly subscription, paid when you sign up.' : 'Subscribe for ongoing access to our services.'}${methods.length ? ' Pay with ' + methods.join(', ').replace(/, ([^,]*)$/, ' or $1') + ', or in cash at our office.' : ''}</p>
      <div class="bt-grid bt-grid--cards">${raw(cards)}</div></div></section>`;
  }

  const paragraphs = (text) => String(text || '').split(/\n\s*\n|\r?\n/).map((p) => p.trim()).filter(Boolean).map((p) => html`<p>${p}</p>`).join('');

  const soon = (icon, title, text) => '<div class="bt-card">' + UI.emptyState({ icon, title, text }) + '</div>';

  /* ---------- tabs ---------- */

  function home() {
    const t = site.site || {};
    const lead = t.intro || `${site.company.name || 'Balance Trust'} builds, supervises and manages construction projects and property, and lets you follow and approve every stage from wherever you are.`;
    return html`<header class="bt-landing__hero bt-site__hero"><div class="bt-landing__wrap">
        ${raw(t.headline ? html`<h1>${t.headline}</h1>` : '<h1>Trust through <em>visibility</em>, accountability and control.</h1>')}
        <p class="bt-landing__lead">${lead}</p>
        ${raw(actions('btn-lg'))}
      </div></header>
      <section class="bt-landing__section" aria-labelledby="h-h-how"><div class="bt-landing__wrap">
        <h2 id="h-h-how">What we do, step by step</h2>
        <ol class="bt-landing__steps">${raw(STEPS.map(([icon, ti, d]) => html`<li><span class="bt-landing__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><div><h3>${ti}</h3><p>${d}</p></div></li>`).join(''))}</ol>
        <p class="mt-4 mb-0"><a href="#services" class="fw-semibold">See our services and prices <i class="bi bi-arrow-right" aria-hidden="true"></i></a></p>
      </div></section>
      <section class="bt-landing__section bt-landing__section--alt" aria-labelledby="h-h-why"><div class="bt-landing__wrap">
        <h2 id="h-h-why">Why choose us</h2>
        <ul class="bt-landing__why">${raw(WHY.map(([icon, ti, d]) => html`<li class="bt-card"><span class="bt-landing__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><h3>${ti}</h3><p>${d}</p></li>`).join(''))}</ul>
      </div></section>`;
  }

  function services() {
    return html`<section class="bt-landing__section" aria-labelledby="h-s-offer"><div class="bt-landing__wrap">
        <h2 id="h-s-offer">Our services</h2>
        <p class="bt-landing__sub">Choose the block that fits your project. Each one opens its own project workspace, and its form asks for everything the work needs, so you are not asked again later.</p>
        <div class="bt-grid bt-grid--cards">${raw(site.blocks.map(blockCard).join(''))}</div>
      </div></section>${raw(plansSection())}`;
  }

  function about() {
    const t = site.site || {};
    const has = t.about || t.mission || t.vision || (t.values && t.values.length);
    if (!has) return html`<section class="bt-landing__section"><div class="bt-landing__wrap"><h2>About ${site.company.name || 'us'}</h2>${raw(soon('info-circle', 'Our story is coming soon', 'Information about our company will be published here.'))}</div></section>`;
    const cards = [['bullseye', 'Our mission', t.mission], ['eye', 'Our vision', t.vision]].filter(([, , v]) => v);
    return html`<section class="bt-landing__section" aria-labelledby="h-a"><div class="bt-landing__wrap">
        <h2 id="h-a">About ${site.company.name || 'us'}</h2>
        ${raw(t.about ? html`<div class="bt-site__prose">${raw(paragraphs(t.about))}</div>` : '')}
        ${raw(cards.length ? '<div class="bt-landing__why">' + cards.map(([icon, ti, v]) => html`<div class="bt-card p-4"><span class="bt-landing__icon mb-2"><i class="bi bi-${icon}" aria-hidden="true"></i></span><h3>${ti}</h3>${raw(paragraphs(v))}</div>`).join('') + '</div>' : '')}
        ${raw(t.values && t.values.length ? html`<h3 class="h5 mt-5">Our values</h3><ul class="bt-site__values">${raw(t.values.map((v) => html`<li><i class="bi bi-check2-circle" aria-hidden="true"></i>${v}</li>`).join(''))}</ul>` : '')}
      </div></section>`;
  }

  function gallery() {
    const list = site.gallery || [];
    if (!list.length) return html`<section class="bt-landing__section"><div class="bt-landing__wrap"><h2>Gallery</h2>${raw(soon('images', 'Photos coming soon', 'Photos of our projects and properties will be published here.'))}</div></section>`;
    const cats = [...new Set(list.map((g) => g.category))];
    return html`<section class="bt-landing__section" aria-labelledby="h-g"><div class="bt-landing__wrap">
        <h2 id="h-g">Gallery</h2>
        <p class="bt-landing__sub">Our work, from the first block to the finished building.</p>
        ${raw(cats.length > 1 ? '<div class="bt-site__filters" role="group" aria-label="Show photos of">' + ['All'].concat(cats).map((c, i) => html`<button type="button" class="btn btn-sm ${i ? 'btn-outline-primary' : 'btn-primary'}" data-cat="${c}" aria-pressed="${i ? 'false' : 'true'}">${c}</button>`).join('') + '</div>' : '')}
        <ul class="bt-site__gallery">${raw(list.map((g) => html`<li data-category="${g.category}"><button type="button" class="bt-site__photo" data-image="${g.imageId}" aria-label="${g.title || 'Photo'}${g.caption ? ': ' + g.caption : ''}"><span class="bt-site__img" data-img="${g.imageId}"><span class="spinner-border spinner-border-sm text-muted" aria-hidden="true"></span></span>${raw(g.title ? html`<span class="bt-site__photo-title">${g.title}</span>` : '')}</button></li>`).join(''))}</ul>
      </div></section>`;
  }

  function contact() {
    const c = site.company || {};
    const t = site.site || {};
    const rows = [['building', c.name], ['geo-alt', c.address], ['telephone', c.phone], ['envelope', c.email], ['clock', t.hours]].filter(([, v]) => v);
    const details = rows.length || t.mapUrl || (t.social && t.social.length)
      ? html`<ul class="bt-landing__contact">${raw(rows.map(([icon, v]) => {
          const val = icon === 'telephone' ? html`<a href="tel:${v.replace(/[^\d+]/g, '')}">${v}</a>` : icon === 'envelope' ? html`<a href="mailto:${v}">${v}</a>` : Utils.esc(v);
          return html`<li><i class="bi bi-${icon}" aria-hidden="true"></i><span style="white-space:pre-line">${raw(val)}</span></li>`;
        }).join(''))}
        ${raw(t.mapUrl ? html`<li><i class="bi bi-map" aria-hidden="true"></i><a href="${t.mapUrl}" target="_blank" rel="noopener">Find us on the map</a></li>` : '')}
        ${raw((t.social || []).map((u) => html`<li><i class="bi bi-link-45deg" aria-hidden="true"></i><a href="${u}" target="_blank" rel="noopener">${u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></li>`).join(''))}</ul>`
      : '<p class="text-muted">Our contact details will be published here soon. You can already send us a message.</p>';
    return html`<section class="bt-landing__section" aria-labelledby="h-c"><div class="bt-landing__wrap">
        <h2 id="h-c">Contact us</h2>
        <div class="row g-4 mt-1">
          <div class="col-lg-5">${raw(details)}</div>
          <div class="col-lg-7"><div class="bt-card p-4">
            <h3 class="h5 mb-3">Send us a message</h3>
            <div id="bt-contact-result"></div>
            <form id="bt-contact-form" novalidate>
              <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="c-name">Your name</label><input class="form-control" id="c-name" name="fullName" autocomplete="name" maxlength="120" data-rules="required"></div>
                <div class="col-sm-6"><label class="form-label" for="c-phone">Phone <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="c-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" placeholder="+220 …"></div></div>
              <div class="mb-3"><label class="form-label" for="c-email">Email</label><input class="form-control" id="c-email" name="email" type="email" autocomplete="email" data-rules="email"><div class="form-text">An email or a phone number, so we can answer you.</div></div>
              <div class="mb-3"><label class="form-label" for="c-subject">Subject</label><input class="form-control" id="c-subject" name="subject" maxlength="150" data-rules="required"></div>
              <div class="mb-3"><label class="form-label" for="c-message">Message</label><textarea class="form-control" id="c-message" name="message" rows="5" maxlength="3000" data-rules="required"></textarea></div>
              <div class="bt-site__hp" aria-hidden="true"><label for="c-website">Website</label><input id="c-website" name="website" tabindex="-1" autocomplete="off"></div>
              <button class="btn btn-primary" type="submit"><i class="bi bi-send me-1" aria-hidden="true"></i>Send message</button>
            </form>
          </div></div>
        </div>
      </div></section>`;
  }

  const RENDER = { home, services, about, gallery, contact };

  /* ---------- page ---------- */

  function frame(tab) {
    return html`<div class="bt-landing bt-site">
      <header class="bt-site__bar"><div class="bt-landing__wrap bt-site__bar-inner">
        <a class="bt-brand" href="#home" data-brand>
          <img class="bt-brand__logo" src="assets/logo.png" alt="">
          <span class="bt-brand__mono" aria-hidden="true">BT</span>
          <span class="bt-brand__name">${site.company.name ? site.company.name.toUpperCase() : 'BALANCE TRUST'}<small>Build · Supervise · Manage</small></span>
        </a>
        <nav class="bt-site__tabs" aria-label="Website">${raw(TABS.map(([k, label, icon]) => html`<a href="#${k}" ${raw(k === tab ? 'aria-current="page"' : '')}><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span></a>`).join(''))}</nav>
        <div class="bt-site__account">
          <button class="bt-icon-btn bt-site__theme" type="button" data-theme-toggle></button>
          ${raw(signedIn ? '<a class="btn btn-sm btn-accent" href="login.html">My dashboard</a>' : '<a class="btn btn-sm btn-link text-white" href="login.html">Log in</a><a class="btn btn-sm btn-accent" href="register.html">Sign up</a>')}
        </div>
      </div></header>
      <main id="bt-site-main" tabindex="-1">${raw(RENDER[tab]())}
        <section class="bt-landing__cta" aria-labelledby="h-cta"><div class="bt-landing__wrap"><h2 id="h-cta">Ready to start?</h2>${raw(actions(''))}</div></section>
      </main>
      <footer class="bt-landing__foot"><div class="bt-landing__wrap d-flex flex-wrap justify-content-between gap-2">
        <span>© ${new Date().getFullYear()} ${site.company.name || APP_CONFIG.appName}</span>
        <nav aria-label="Website, again" class="d-flex flex-wrap gap-3">${raw(TABS.map(([k, label]) => html`<a href="#${k}">${label}</a>`).join(''))}</nav>
      </div></footer>
    </div>`;
  }

  async function loadImage(id) {
    if (images[id]) return images[id];
    const { data } = await Api.call('getGalleryImage', { imageId: id });
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    images[id] = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
    return images[id];
  }

  function showImage(holder, url, alt) {
    holder.innerHTML = '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || '';
    holder.appendChild(img);
  }

  function wireGallery() {
    const holders = [...root.querySelectorAll('[data-img]')];
    if (!holders.length) return;
    const byId = Object.fromEntries((site.gallery || []).map((g) => [g.imageId, g]));
    const load = (h) => loadImage(h.dataset.img).then((url) => showImage(h, url, byId[h.dataset.img].title)).catch(() => { h.innerHTML = '<i class="bi bi-image text-muted" aria-hidden="true"></i>'; });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); load(e.target); } }), { rootMargin: '200px' });
      holders.forEach((h) => io.observe(h));
    } else holders.forEach(load);
    root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('[data-cat]').forEach((x) => { const on = x === b; x.classList.toggle('btn-primary', on); x.classList.toggle('btn-outline-primary', !on); x.setAttribute('aria-pressed', String(on)); });
      root.querySelectorAll('.bt-site__gallery > li').forEach((li) => { li.hidden = b.dataset.cat !== 'All' && li.dataset.category !== b.dataset.cat; });
    }));
    root.querySelectorAll('[data-image]').forEach((b) => b.addEventListener('click', async () => {
      const g = byId[b.dataset.image];
      const m = UI.modal({ title: g.title || 'Photo', size: 'xl', body: '<div class="bt-site__full"><span class="spinner-border text-muted" aria-hidden="true"></span></div>' + (g.caption ? html`<p class="mt-3 mb-0">${g.caption}</p>` : '') });
      try { showImage(m.el.querySelector('.bt-site__full'), await loadImage(g.imageId), g.title); } catch (e) { m.el.querySelector('.bt-site__full').innerHTML = UI.errorState(e); }
    }));
  }

  function wireContact() {
    const form = root.querySelector('#bt-contact-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(form);
      if (!Validation.validateForm(form)) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const restore = UI.busy(form.querySelector('[type=submit]'), 'Sending…');
      try {
        const { message } = await Api.call('sendContactMessage', values);
        root.querySelector('#bt-contact-result').innerHTML = html`<div class="bt-alert bt-alert--success mb-3" role="status"><i class="bi bi-check-circle" aria-hidden="true"></i><span>${message}</span></div>`;
        form.reset();
        restore();
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
      }
    });
  }

  function draw(focus) {
    const tab = currentTab();
    root.innerHTML = frame(tab);
    App.applyBrand(root);
    Theme.bind(root);
    wireGallery();
    wireContact();
    const label = TABS.find(([k]) => k === tab)[1];
    document.title = (tab === 'home' ? '' : label + ' · ') + (site.company.name || APP_CONFIG.appName);
    if (focus) { window.scrollTo(0, 0); root.querySelector('#bt-site-main').focus({ preventScroll: true }); }
  }

  async function show(isSignedIn) {
    signedIn = !!isSignedIn;
    root = document.getElementById('bt-auth-root');
    document.getElementById('bt-app-root').hidden = true;
    root.hidden = false;
    draw(false);
    window.addEventListener('hashchange', () => draw(true));
    if (!Api.isConfigured()) return;
    try {
      const { data } = await Api.call('getPublicSite');
      site = { company: data.company || {}, blocks: data.blocks.length ? data.blocks : FALLBACK_BLOCKS, plans: data.plans || [], paymentMethods: data.paymentMethods || [], subscriptionRequired: !!data.subscriptionRequired, site: data.site || {}, gallery: data.gallery || [] };
      const y = window.scrollY;
      draw(false);
      window.scrollTo(0, y);
    } catch (e) { /* the page still works with the services list above */ }
  }

  return { show };
})();
