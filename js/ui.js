/**
 * Balance Trust — global UI components: toasts, modals, confirm dialogs,
 * loading/empty/error states, badges, progress bars and cards.
 * Components return HTML strings built with Utils.html (auto-escaped).
 */
const UI = (() => {
  const { html, raw, esc } = Utils;

  /* ---------- Toast ---------- */
  const TOAST_ICONS = { success: 'check-circle-fill', error: 'exclamation-octagon-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };

  function toast(type, message, timeoutMs = 5000) {
    const host = document.getElementById('bt-toasts');
    const el = document.createElement('div');
    el.className = 'bt-toast bt-toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = html`<i class="bi bi-${TOAST_ICONS[type] || TOAST_ICONS.info}" aria-hidden="true"></i><span>${message}</span><button type="button" class="bt-toast__close" aria-label="Dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
    const remove = () => el.remove();
    el.querySelector('button').addEventListener('click', remove);
    host.appendChild(el);
    if (timeoutMs) setTimeout(remove, timeoutMs);
  }

  /* ---------- States ---------- */
  function loadingState(text = 'Loading…') {
    return html`<div class="bt-state" role="status" aria-live="polite"><div class="spinner-border text-secondary" style="width:1.75rem;height:1.75rem" aria-hidden="true"></div><p>${text}</p></div>`;
  }

  function emptyState({ icon = 'inbox', title, text, actionHref, actionLabel }) {
    return html`<div class="bt-state"><div class="bt-state__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></div><h3>${title}</h3>${text ? raw(html`<p>${text}</p>`) : ''}${actionHref ? raw(html`<a class="btn btn-accent" href="${actionHref}">${actionLabel}</a>`) : ''}</div>`;
  }

  function errorState(err, retryId) {
    const message = (err && err.message) || 'We could not complete this request. Please try again or contact support.';
    return html`<div class="bt-state bt-state--error" role="alert"><div class="bt-state__icon"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i></div><h3>Something went wrong</h3><p>${message}</p>${err && err.reference ? raw(html`<p class="bt-state__ref">Reference: ${err.reference}</p>`) : ''}${retryId ? raw(html`<button type="button" class="btn btn-outline-primary" id="${retryId}">Try again</button>`) : ''}</div>`;
  }

  function skeletonCards(count = 3, height = '8rem') {
    return '<div class="bt-grid bt-grid--cards" aria-hidden="true">' +
      Array.from({ length: count }, () => `<div class="bt-skeleton" style="height:${esc(height)}"></div>`).join('') + '</div>';
  }

  /* ---------- Busy buttons (prevents duplicate submissions) ---------- */
  function busy(button, text) {
    const original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = html`<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${text || 'Processing…'}`;
    return () => {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
    };
  }

  /* ---------- Modal / ConfirmDialog ---------- */
  function modal({ title, body, footer, size }) {
    const el = document.createElement('div');
    el.className = 'modal fade';
    el.tabIndex = -1;
    el.setAttribute('aria-labelledby', 'bt-modal-title');
    el.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ${size ? 'modal-' + esc(size) : ''}"><div class="modal-content">
      <div class="modal-header"><h2 class="modal-title" id="bt-modal-title">${esc(title)}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}</div></div>`;
    document.body.appendChild(el);
    const instance = new bootstrap.Modal(el);
    el.addEventListener('hidden.bs.modal', () => { instance.dispose(); el.remove(); });
    instance.show();
    return { el, instance, close: () => instance.hide() };
  }

  function confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let decided = false;
      const m = modal({
        title,
        body: html`<p class="mb-0">${message}</p>`,
        footer: html`<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmLabel}</button>`
      });
      m.el.querySelector('[data-confirm]').addEventListener('click', () => { decided = true; resolve(true); m.close(); });
      m.el.addEventListener('hidden.bs.modal', () => { if (!decided) resolve(false); });
    });
  }

  /* ---------- StatusBadge ---------- */
  const STATUS_STYLES = {
    success: { match: /^(active|completed|approved|paid|verified|closed|received)$/i, icon: 'check-circle' },
    warning: { match: /^(awaiting|pending|in progress|registered|assigned|submitted|partially|due)/i, icon: 'hourglass-split' },
    danger: { match: /^(rejected|delayed|suspended|overdue|cancelled|failed)$/i, icon: 'x-circle' },
    neutral: { match: /^(not started|draft|archived|inactive)$/i, icon: 'dash-circle' }
  };

  function statusBadge(status) {
    const s = String(status || 'Unknown');
    let variant = 'info';
    let icon = 'circle';
    Object.keys(STATUS_STYLES).some((k) => {
      if (STATUS_STYLES[k].match.test(s)) { variant = k; icon = STATUS_STYLES[k].icon; return true; }
      return false;
    });
    return html`<span class="bt-badge bt-badge--${variant}"><i class="bi bi-${icon}" aria-hidden="true"></i>${s}</span>`;
  }

  /* ---------- ProgressBar ---------- */
  function progressBar(percent, label = 'Progress') {
    const p = Math.round(Utils.clamp(percent, 0, 100));
    return html`<div class="bt-progress"><div class="bt-progress__track" role="progressbar" aria-label="${label}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><div class="bt-progress__bar" style="width:${p}%"></div></div><span class="bt-progress__value">${p}%</span></div>`;
  }

  /* ---------- PageHeader ---------- */
  function pageHeader({ title, subtitle, actions }) {
    return html`<div class="bt-page-header"><div><h1>${title}</h1>${subtitle ? raw(html`<p>${subtitle}</p>`) : ''}</div>${actions ? raw(`<div class="bt-page-header__actions">${actions}</div>`) : ''}</div>`;
  }

  /* ---------- StatCard ---------- */
  function statCard({ label, value, icon, tone, hint, href }) {
    const tag = href ? 'a' : 'div';
    return `<${tag} class="bt-card bt-stat"${href ? ` href="${esc(href)}"` : ''}>` +
      html`<span class="bt-stat__label"><span class="bt-stat__icon ${tone ? 'bt-stat__icon--' + tone : ''}"><i class="bi bi-${icon}" aria-hidden="true"></i></span>${label}</span><span class="bt-stat__value">${value}</span>${hint ? raw(html`<span class="bt-stat__hint">${hint}</span>`) : ''}` +
      `</${tag}>`;
  }

  /* ---------- ProjectCard ---------- */
  function projectCard(p) {
    return html`<article class="bt-card bt-project">
      <div class="bt-project__top">
        <div><h3 class="bt-project__name">${p.name || 'Untitled project'}</h3>
          <div class="bt-project__meta"><span><i class="bi bi-hash" aria-hidden="true"></i>${p.projectNumber || p.projectId}</span>${p.block ? raw(html`<span><i class="bi bi-boxes" aria-hidden="true"></i>${p.block}</span>`) : ''}${p.location ? raw(html`<span><i class="bi bi-geo-alt" aria-hidden="true"></i>${p.location}</span>`) : ''}</div></div>
        ${raw(statusBadge(p.status))}
      </div>
      <div class="bt-project__stage"><span class="text-muted">Current stage:</span> ${p.currentStage || 'Not started'} ${p.currentStageStatus ? raw(statusBadge(p.currentStageStatus)) : ''}</div>
      ${raw(progressBar(p.progress, 'Progress of ' + (p.name || 'project')))}
      <div class="bt-project__foot"><span class="small text-muted">${p.nextAction || ''}</span><a class="btn btn-sm btn-outline-primary" href="#/projects/${encodeURIComponent(p.projectId)}">Open</a></div>
    </article>`;
  }

  return { toast, loadingState, emptyState, errorState, skeletonCards, busy, modal, confirm, statusBadge, progressBar, pageHeader, statCard, projectCard };
})();
