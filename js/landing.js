/**
 * Balance Trust — the welcome page: the first page anyone sees when they open
 * the link without being signed in. It says what Balance Trust offers, how it
 * works and why to choose it, and leads to Log in or Sign up.
 *
 * The services (blocks), their prices and what each one asks for come from
 * the database through the public getPublicSite action; contact details show
 * only when an administrator has entered them (Administration → System).
 * Nothing here is invented: the "how it works" and "why us" points describe
 * what the app itself does.
 */
const Landing = (() => {
  const { html, raw } = Utils;
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

  let root;

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

  function contact(company) {
    const rows = [['building', company.name], ['geo-alt', company.address], ['telephone', company.phone], ['envelope', company.email]].filter(([, v]) => v);
    if (!rows.length) return '';
    return html`<section class="bt-landing__section" aria-labelledby="h-l-contact"><div class="bt-landing__wrap">
      <h2 id="h-l-contact">Contact us</h2>
      <ul class="bt-landing__contact">${raw(rows.map(([icon, v]) => {
        const val = icon === 'telephone' ? html`<a href="tel:${v.replace(/[^\d+]/g, '')}">${v}</a>` : icon === 'envelope' ? html`<a href="mailto:${v}">${v}</a>` : Utils.esc(v);
        return html`<li><i class="bi bi-${icon}" aria-hidden="true"></i><span style="white-space:pre-line">${raw(val)}</span></li>`;
      }).join(''))}</ul></div></section>`;
  }

  const actions = (size) => html`<div class="bt-landing__actions">
      <button type="button" class="btn btn-accent ${size}" data-go="login"><i class="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Log in</button>
      <button type="button" class="btn btn-outline-light ${size}" data-go="signup"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>Sign up</button>
    </div>
    <p class="bt-landing__hint">Log in if you already have an account. Sign up if you don't.</p>`;

  function page(site) {
    return html`<button class="bt-icon-btn bt-theme-float" type="button" data-theme-toggle></button>
    <div class="bt-landing">
      <header class="bt-landing__hero">
        <div class="bt-landing__wrap">
          <nav class="bt-landing__top" aria-label="Account">
            <span class="bt-brand" data-brand>
              <img class="bt-brand__logo" src="assets/logo.png" alt="">
              <span class="bt-brand__mono" aria-hidden="true">BT</span>
              <span class="bt-brand__name">BALANCE TRUST<small>Build · Supervise · Manage</small></span>
            </span>
            <span class="bt-landing__top-links"><button type="button" class="btn btn-sm btn-link text-white" data-go="login">Log in</button><button type="button" class="btn btn-sm btn-accent" data-go="signup">Sign up</button></span>
          </nav>
          <h1>Trust through <em>visibility</em>, accountability and control.</h1>
          <p class="bt-landing__lead">${site.company.name || 'Balance Trust'} builds, supervises and manages construction projects and property, and lets you follow and approve every stage from wherever you are.</p>
          ${raw(actions('btn-lg'))}
        </div>
      </header>
      <main id="bt-landing-main" tabindex="-1">
        <section class="bt-landing__section" aria-labelledby="h-l-offer"><div class="bt-landing__wrap">
          <h2 id="h-l-offer">What we offer</h2>
          <p class="bt-landing__sub">Choose the block that fits your project. Each one opens its own project workspace.</p>
          <div class="bt-grid bt-grid--cards">${raw(site.blocks.map(blockCard).join(''))}</div>
        </div></section>
        <section class="bt-landing__section bt-landing__section--alt" aria-labelledby="h-l-how"><div class="bt-landing__wrap">
          <h2 id="h-l-how">What we do, step by step</h2>
          <ol class="bt-landing__steps">${raw(STEPS.map(([icon, t, d]) => html`<li><span class="bt-landing__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><div><h3>${t}</h3><p>${d}</p></div></li>`).join(''))}</ol>
        </div></section>
        <section class="bt-landing__section" aria-labelledby="h-l-why"><div class="bt-landing__wrap">
          <h2 id="h-l-why">Why choose us</h2>
          <ul class="bt-landing__why">${raw(WHY.map(([icon, t, d]) => html`<li class="bt-card"><span class="bt-landing__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><h3>${t}</h3><p>${d}</p></li>`).join(''))}</ul>
        </div></section>
        ${raw(contact(site.company))}
        <section class="bt-landing__cta" aria-labelledby="h-l-cta"><div class="bt-landing__wrap">
          <h2 id="h-l-cta">Ready to start?</h2>
          ${raw(actions(''))}
        </div></section>
      </main>
      <footer class="bt-landing__foot"><div class="bt-landing__wrap">© ${new Date().getFullYear()} ${site.company.name || APP_CONFIG.appName}</div></footer>
    </div>`;
  }

  function draw(site) {
    root.innerHTML = page(site);
    App.applyBrand(root);
    Theme.bind(root);
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { Auth.show(b.dataset.go); window.scrollTo(0, 0); }));
  }

  async function show() {
    root = document.getElementById('bt-auth-root');
    document.getElementById('bt-app-root').hidden = true;
    root.hidden = false;
    document.title = APP_CONFIG.appName;
    let site = { company: {}, blocks: FALLBACK_BLOCKS };
    draw(site);
    if (!Api.isConfigured()) return;
    try {
      const { data } = await Api.call('getPublicSite');
      if (root.querySelector('.bt-landing')) {
        site = { company: data.company || {}, blocks: data.blocks.length ? data.blocks : FALLBACK_BLOCKS };
        const y = window.scrollY;
        draw(site);
        window.scrollTo(0, y);
      }
    } catch (e) { /* the page still works with the services list above */ }
  }

  return { show };
})();
