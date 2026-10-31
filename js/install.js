/**
 * Balance Trust — install the app on a phone, tablet or computer.
 *
 * - Registers the service worker (sw.js), which makes the app installable.
 * - Shows a small pop-up offering to install it. Android, Chrome and Edge
 *   install with one tap; iPhone and iPad Safari have no install button, so
 *   the pop-up shows the two steps (Share, then Add to Home Screen).
 * - "Not now" hides the pop-up on this device for 14 days. It never shows
 *   inside the installed app.
 * - Settings has an "Install the app" card at any time.
 * - Tells the person when the connection drops and comes back.
 */
const Install = (() => {
  const KEY = 'bt.installDismissed';
  const SNOOZE_DAYS = 14;
  let deferred = null;
  let banner = null;

  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isIosSafari = isIos && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

  function installed() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function snoozed() {
    try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_DAYS * 864e5; } catch (e) { return false; }
  }
  function snooze() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* not remembered */ } }

  const iosSteps = '<ol class="bt-install__steps"><li>Tap <i class="bi bi-box-arrow-up" aria-hidden="true"></i> <strong>Share</strong> in Safari.</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>';

  function hide() {
    if (!banner) return;
    banner.remove();
    banner = null;
  }

  function show() {
    if (banner || installed() || snoozed()) return;
    if (!deferred && !isIosSafari) return;
    banner = document.createElement('section');
    banner.className = 'bt-install';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'bt-install-title');
    banner.innerHTML = `<img src="${Pages.url('assets/icon-192.png')}" alt="" class="bt-install__icon" width="48" height="48">
      <div class="bt-install__text">
        <h2 id="bt-install-title" class="bt-install__title">Install Balance Trust</h2>
        <p class="bt-install__desc">${deferred ? 'Add the app to your device. It opens in its own window, straight from your home screen or desktop.' : 'Add the app to your home screen:'}</p>
        ${deferred ? '' : iosSteps}
      </div>
      <div class="bt-install__actions">
        ${deferred ? '<button type="button" class="btn btn-sm btn-success" data-act="install"><i class="bi bi-download" aria-hidden="true"></i> Install</button>' : ''}
        <button type="button" class="btn btn-sm btn-outline-light" data-act="later">${deferred ? 'Not now' : 'Got it'}</button>
      </div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-act="later"]').addEventListener('click', () => { snooze(); hide(); });
    const btn = banner.querySelector('[data-act="install"]');
    if (btn) btn.addEventListener('click', () => prompt());
    window.setTimeout(() => banner && banner.classList.add('is-in'), 20);
  }

  /** Opens the browser's own install dialog. */
  async function prompt() {
    if (!deferred) return false;
    const ev = deferred;
    deferred = null;
    hide();
    ev.prompt();
    let outcome = 'dismissed';
    try { ({ outcome } = await ev.userChoice); } catch (e) { /* ignore */ }
    if (outcome !== 'accepted') snooze();
    refreshSettings();
    return outcome === 'accepted';
  }

  /* ---------- settings card ---------- */
  let settingsCard = null;
  function settingsBody() {
    if (installed()) return '<p class="mb-0"><i class="bi bi-check-circle text-success" aria-hidden="true"></i> You are using the installed app.</p>';
    if (deferred) return '<p class="text-muted small mb-3">Opens in its own window, straight from your home screen or desktop.</p><button type="button" class="btn btn-primary" data-act="install"><i class="bi bi-download" aria-hidden="true"></i> Install the app</button>';
    if (isIos) return '<p class="text-muted small mb-2">' + (isIosSafari ? 'On iPhone and iPad:' : 'Open this page in Safari, then:') + '</p>' + iosSteps;
    return '<p class="text-muted small mb-0">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If neither is shown, the app may already be installed, or this browser does not support installing apps.</p>';
  }
  function refreshSettings() {
    if (!settingsCard || !settingsCard.isConnected) return;
    settingsCard.querySelector('.bt-card__body').innerHTML = settingsBody();
    const b = settingsCard.querySelector('[data-act="install"]');
    if (b) b.addEventListener('click', () => prompt());
  }
  function renderSettings(container) {
    settingsCard = document.createElement('section');
    settingsCard.className = 'bt-card mb-4';
    settingsCard.style.maxWidth = '36rem';
    settingsCard.setAttribute('aria-labelledby', 'h-install');
    settingsCard.innerHTML = '<div class="bt-card__header"><h2 id="h-install">Install the app</h2></div><div class="bt-card__body"></div>';
    container.appendChild(settingsCard);
    refreshSettings();
  }

  /* ---------- events ---------- */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    refreshSettings();
    window.setTimeout(show, 3000);
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    hide();
    refreshSettings();
    if (window.UI) UI.toast('success', 'Balance Trust is installed. You can open it from your home screen or desktop.');
  });
  window.addEventListener('offline', () => { if (window.UI) UI.toast('error', 'You are offline. Changes cannot be saved until the connection is back.', 8000); });
  window.addEventListener('online', () => { if (window.UI) UI.toast('success', 'You are back online.'); });

  window.addEventListener('load', () => {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure && APP_CONFIG.serviceWorker !== false) {
      navigator.serviceWorker.register(Pages.url('sw.js')).catch(() => { /* the app works without it, it just is not installable */ });
    }
    if (isIosSafari) window.setTimeout(show, 3000);
  });

  return { prompt, renderSettings, installed };
})();
