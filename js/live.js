/**
 * Balance Trust — live updates.
 *
 * Apps Script cannot push to the browser, so while the app is open and the
 * tab visible it asks the server every few seconds whether any list on the
 * current page changed (livePing). The answer holds only change stamps and
 * the unread notification count. A page whose lists changed reloads itself
 * quietly, but never while someone is typing or has a dialog open: the
 * reload waits until they finish.
 *
 * config.js: liveSeconds (default 15; 0 turns live updates off).
 */
const Live = (() => {
  const subs = new Set();
  let stamps = {};
  let timer = null;
  let busy = false;
  let lastUnread = null;
  let notifStamp = '';
  let lastInput = Date.now();
  let lastTick = 0;
  const pending = new Set();
  const leaving = new Set();

  const seconds = () => (APP_CONFIG.liveSeconds === 0 ? 0 : Math.max(5, Number(APP_CONFIG.liveSeconds) || 15));

  /** Someone is in the middle of something on the page: typing, a dialog, a drawer form, a recording. */
  function userIsBusy() {
    if (document.querySelector('.modal.show, [data-live-hold]')) return true;
    const a = document.activeElement;
    return !!(a && a.closest('#bt-content, .bt-drawer') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio');
  }

  function watched() {
    const keys = new Set();
    subs.forEach((s) => s.keys.forEach((k) => keys.add(k)));
    return [...keys];
  }

  function runPending() {
    if (!pending.size || userIsBusy()) return;
    const due = [...pending];
    pending.clear();
    due.forEach((s) => { if (subs.has(s)) s.cb(); });
  }

  /**
   * Someone who has not touched the page for 5 minutes is checked for less
   * often (every 60 s), which keeps the server load down when many people
   * leave the app open.
   */
  function due(force) {
    if (force) return true;
    const idle = Date.now() - lastInput > 5 * 60 * 1000;
    return Date.now() - lastTick >= (idle ? 60000 : seconds() * 1000) - 500;
  }

  async function tick(force) {
    if (busy || document.hidden || !Session.get() || !due(force === true)) return;
    busy = true;
    lastTick = Date.now();
    try {
      const { data } = await Api.call('livePing', { watch: watched(), notifStamp });
      notifStamp = data.notifStamp;
      const moved = new Set(Object.keys(data.v).filter((k) => k in stamps && stamps[k] !== data.v[k]));
      stamps = Object.assign({}, stamps, data.v);
      subs.forEach((s) => { if (s.keys.some((k) => moved.has(k))) pending.add(s); });
      runPending();
      if (data.unread !== null) {
        App.setUnread(data.unread);
        if (lastUnread !== null && data.unread > lastUnread && data.latest) UI.toast('info', 'New notification: ' + data.latest.title);
        lastUnread = data.unread;
      }
    } catch (e) {
      // A missed ping is harmless; the next one catches up.
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer || !seconds()) return;
    // A small random offset spreads many open pages over time instead of all asking at once.
    timer = window.setInterval(tick, (seconds() * 1000) + Math.floor(Math.random() * 3000));
    tick(true);
  }

  function stop() {
    window.clearInterval(timer);
    timer = null;
    resetPage();
    stamps = {};
    lastUnread = null;
    notifStamp = '';
  }

  /**
   * Called by the router on every navigation: the old page's watches end and
   * its clean-up runs (stopping camera players and timers).
   */
  function resetPage() {
    subs.clear();
    pending.clear();
    leaving.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    leaving.clear();
  }

  /** Runs fn when the user leaves the current page. */
  function onLeave(fn) { leaving.add(fn); }

  /**
   * Calls cb when any of these tables changes on the server (keys as in the
   * backend SCHEMA, e.g. 'PROJECT_STAGES'). Returns a function that stops it.
   */
  function watch(keys, cb) {
    const s = { keys, cb };
    subs.add(s);
    // New tables get their starting stamp right away, so the first change is not missed.
    if (timer && keys.some((k) => !(k in stamps))) window.setTimeout(() => tick(true), 300);
    return () => { subs.delete(s); pending.delete(s); };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && timer) tick(true); });
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  // A reload that waited for someone to finish typing runs once they leave the field or close the dialog.
  document.addEventListener('focusout', () => window.setTimeout(runPending, 200));
  document.addEventListener('hidden.bs.modal', () => window.setTimeout(runPending, 200));
  window.addEventListener('bt:unauthenticated', stop);

  return { start, stop, watch, tick, resetPage, onLeave };
})();
