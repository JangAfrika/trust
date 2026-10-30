/**
 * Balance Trust — light / dark mode. Loaded in <head> so the right scheme is
 * applied before the page paints. The choice ('light', 'dark' or 'system')
 * is remembered in this browser; 'system' follows the device setting.
 */
const Theme = (() => {
  const KEY = 'bt.theme';
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let memory = null; // used when browser storage is blocked

  function choice() {
    let v = memory;
    try { v = localStorage.getItem(KEY) || memory; } catch (e) { /* storage blocked */ }
    return v === 'light' || v === 'dark' ? v : 'system';
  }

  function current() {
    const c = choice();
    if (c !== 'system') return c;
    return media && media.matches ? 'dark' : 'light';
  }

  function apply() {
    const t = current();
    const root = document.documentElement;
    root.setAttribute('data-theme', t);
    root.setAttribute('data-bs-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0a111c' : '#0a1b33');
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      const next = t === 'dark' ? 'light' : 'dark';
      btn.innerHTML = `<i class="bi bi-${t === 'dark' ? 'sun' : 'moon-stars'}" aria-hidden="true"></i>`;
      btn.setAttribute('aria-label', `Switch to ${next} mode`);
      btn.title = `Switch to ${next} mode`;
    });
    document.dispatchEvent(new CustomEvent('bt:theme', { detail: t }));
  }

  function set(value) {
    memory = value === 'system' ? null : value;
    try {
      if (value === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch (e) { /* storage blocked: the choice lasts for this page view */ }
    apply();
  }

  function toggle() {
    set(current() === 'dark' ? 'light' : 'dark');
  }

  /** Wires every [data-theme-toggle] button inside root. */
  function bind(root) {
    (root || document).querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggle);
    });
    apply();
  }

  if (media) media.addEventListener('change', () => { if (choice() === 'system') apply(); });
  apply();

  return { choice, current, set, toggle, bind, apply };
})();
