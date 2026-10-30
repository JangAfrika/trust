/**
 * Balance Trust — accessibility helpers, loaded in <head> so the reader's
 * text size and contrast choices apply before the page is drawn.
 *
 * - Text size (90% to 140%) and stronger contrast, remembered per browser.
 * - Every page change is announced to screen readers and focus moves to the
 *   page heading, so keyboard and screen reader users know where they are.
 * - Clickable table rows and cards work with Enter and Space.
 * - Keyboard shortcuts: "?" lists them; "/" jumps to the page's search box;
 *   "g" then a letter opens a section.
 */
const A11y = (() => {
  const KEY = 'bt.a11y';
  const SIZES = [90, 100, 112, 125, 140];
  const SHORTCUTS = [
    ['g d', 'Dashboard', 'dashboard'], ['g p', 'My Projects', 'projects'], ['g m', 'Project Monitoring', 'monitoring'],
    ['g c', 'Live Cameras', 'cameras'], ['g f', 'Finance', 'finance'], ['g o', 'Documents', 'documents'],
    ['g h', 'Property Management', 'property'], ['g n', 'Notifications', 'notifications'], ['g r', 'Reports', 'reports'],
    ['g a', 'Administration', 'admin'], ['g s', 'Settings', 'settings']
  ];

  function read() {
    try { return Object.assign({ size: 100, contrast: false }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { size: 100, contrast: false }; }
  }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* the choice just is not remembered */ } }

  function apply(p) {
    const root = document.documentElement;
    root.style.fontSize = SIZES.includes(Number(p.size)) && Number(p.size) !== 100 ? p.size + '%' : '';
    if (p.contrast) root.setAttribute('data-contrast', 'more'); else root.removeAttribute('data-contrast');
  }
  apply(read());

  /* ---------- announcements ---------- */
  let region = null;
  function announce(text) {
    if (!region) {
      region = document.createElement('div');
      region.className = 'visually-hidden';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    region.textContent = '';
    setTimeout(() => { region.textContent = text; }, 60);
  }

  /** Called by the router after a page has rendered. */
  function pageChanged(title) {
    announce(title + ' page');
    const h = document.querySelector('#bt-content h1');
    if (h) {
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  /* ---------- keyboard ---------- */
  let pendingG = 0;
  function typing(t) { return t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }

  function showShortcuts() {
    const rows = [['?', 'Show this list'], ['/', 'Jump to the search box on this page'], ['Esc', 'Close a panel or dialog']]
      .concat(SHORTCUTS.map(([k, l]) => [k, 'Open ' + l]))
      .map(([k, l]) => `<tr><td><kbd>${k}</kbd></td><td>${l}</td></tr>`).join('');
    UI.modal({ title: 'Keyboard shortcuts', body: `<table class="table table-sm mb-0"><tbody>${rows}</tbody></table>` });
  }

  document.addEventListener('keydown', (e) => {
    // Enter / Space on a focused clickable row or card acts like a click.
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.bt-row-click, [data-open-user]:not(button), [role="button"]:not(button)')) {
      e.preventDefault();
      e.target.click();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || document.querySelector('.modal.show')) return;
    if (document.getElementById('bt-app-root') && document.getElementById('bt-app-root').hidden) return;
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
    if (e.key === '/') {
      const s = document.querySelector('#bt-content input[type="search"], #bt-content input[id$="search"], .bt-drawer input[type="search"]');
      if (s) { e.preventDefault(); s.focus(); }
      return;
    }
    if (e.key === 'g') { pendingG = Date.now(); return; }
    if (pendingG && Date.now() - pendingG < 1200) {
      pendingG = 0;
      const hit = SHORTCUTS.find(([k]) => k === 'g ' + e.key.toLowerCase());
      const link = hit && document.querySelector(`#bt-nav a[href="#/${hit[2]}"]`);
      if (link) { e.preventDefault(); location.hash = '#/' + hit[2]; }
    }
  });

  // Rows and cards that open something become reachable with Tab.
  function makeFocusable(root) {
    (root || document).querySelectorAll('tr.bt-row-click:not([tabindex])').forEach((r) => r.setAttribute('tabindex', '0'));
  }
  document.addEventListener('DOMContentLoaded', () => {
    makeFocusable();
    new MutationObserver(() => makeFocusable()).observe(document.body, { childList: true, subtree: true });
  });

  /* ---------- settings card ---------- */
  function renderSettings(container) {
    const p = read();
    const card = document.createElement('section');
    card.className = 'bt-card mb-4';
    card.style.maxWidth = '36rem';
    card.setAttribute('aria-labelledby', 'h-a11y');
    card.innerHTML = `<div class="bt-card__header"><h2 id="h-a11y">Accessibility</h2></div><div class="bt-card__body">
      <p class="text-muted small mb-3">Saved on this device.</p>
      <div class="mb-3"><label class="form-label" for="a11y-size">Text size</label>
        <select class="form-select" id="a11y-size">${SIZES.map((s) => `<option value="${s}" ${s === Number(p.size) ? 'selected' : ''}>${s === 100 ? 'Normal (100%)' : s + '%'}</option>`).join('')}</select></div>
      <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" role="switch" id="a11y-contrast" ${p.contrast ? 'checked' : ''}><label class="form-check-label" for="a11y-contrast">Stronger contrast</label></div>
      <p class="small mb-0">Press <kbd>?</kbd> anywhere to see keyboard shortcuts.</p></div>`;
    const first = container.querySelector('.bt-card');
    if (first) first.after(card); else container.appendChild(card);
    const update = () => {
      const next = { size: Number(card.querySelector('#a11y-size').value), contrast: card.querySelector('#a11y-contrast').checked };
      save(next);
      apply(next);
      announce('Accessibility settings saved');
    };
    card.querySelector('#a11y-size').addEventListener('change', update);
    card.querySelector('#a11y-contrast').addEventListener('change', update);
  }

  return { pageChanged, announce, renderSettings, showShortcuts };
})();
