/**
 * Balance Trust — API client for the Apps Script backend.
 *
 * Requests are POSTed as text/plain JSON so the browser sends a "simple"
 * request without a CORS preflight (Apps Script cannot answer preflights).
 * The session token travels in the body. The frontend only ever calls
 * business-level actions; it has no access to the spreadsheet or Drive.
 */
class ApiError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.code = code;
    Object.assign(this, extra || {});
  }
}

const Session = (() => {
  const KEY = APP_CONFIG.sessionStorageKey;
  let memory = null; // fallback when browser storage is unavailable
  const stores = () => {
    const out = [];
    try { out.push(window.localStorage); } catch (e) { /* blocked */ }
    try { out.push(window.sessionStorage); } catch (e) { /* blocked */ }
    return out.filter(Boolean);
  };

  function get() {
    for (const store of stores()) {
      try {
        const raw = store.getItem(KEY);
        if (!raw) continue;
        const s = JSON.parse(raw);
        if (s && s.token && new Date(s.expiresAt).getTime() > Date.now()) return s;
        store.removeItem(KEY);
      } catch (e) { /* storage unavailable */ }
    }
    return null;
  }

  function set(session, remember) {
    clear();
    try {
      (remember ? window.localStorage : window.sessionStorage).setItem(KEY, JSON.stringify(session));
    } catch (e) { /* storage unavailable: session lasts for this page only */ }
    memory = session;
  }

  function clear() {
    memory = null;
    stores().forEach((s) => { try { s.removeItem(KEY); } catch (e) { /* ignore */ } });
  }

  return {
    get: () => get() || memory,
    set,
    clear,
    token: () => { const s = get() || memory; return s ? s.token : null; }
  };
})();

const Api = (() => {
  const GENERIC = 'We could not complete this request. Please try again or contact support.';

  function isConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(APP_CONFIG.apiUrl);
  }

  /**
   * Calls a backend action. Resolves with { data, message }; rejects with
   * ApiError(code, message, { fields, reference, ... }).
   */
  async function call(action, params = {}, { timeoutMs } = {}) {
    if (!isConfigured()) {
      throw new ApiError('NOT_CONFIGURED', 'The application is not connected to its server yet. Set apiUrl in js/config.js.');
    }
    const body = Object.assign({}, params, { action });
    const token = Session.token();
    if (token) body.token = token;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || APP_CONFIG.requestTimeoutMs);
    let res;
    try {
      res = await fetch(APP_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal
      });
    } catch (e) {
      throw new ApiError('NETWORK', e.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : 'We could not reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    let payload;
    try {
      payload = await res.json();
    } catch (e) {
      throw new ApiError('INTERNAL', GENERIC);
    }
    if (payload && payload.success) return { data: payload.data, message: payload.message };

    const err = (payload && payload.error) || {};
    const { code = 'INTERNAL', message = GENERIC, ...extra } = err;
    if (code === 'UNAUTHENTICATED' && action !== 'login') {
      Session.clear();
      window.dispatchEvent(new CustomEvent('bt:unauthenticated'));
    }
    throw new ApiError(code, message, extra);
  }

  return { call, isConfigured };
})();
