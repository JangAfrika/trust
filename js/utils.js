/**
 * Balance Trust — small shared helpers.
 */
const Utils = (() => {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escapes text for insertion into HTML. All server data goes through this. */
  function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  /** Tagged template that escapes every interpolated value unless wrapped in Utils.raw(). */
  function html(strings, ...values) {
    return strings.reduce((out, str, i) => {
      if (i >= values.length) return out + str;
      const v = values[i];
      const rendered = Array.isArray(v) ? v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join('')
        : (v && v.__raw !== undefined ? v.__raw : esc(v));
      return out + str + rendered;
    }, '');
  }

  function raw(markup) {
    return { __raw: String(markup) };
  }

  function formatDate(value, opts) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    return d.toLocaleDateString(undefined, opts || { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function timeAgo(value) {
    const d = new Date(value);
    if (isNaN(d)) return '';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return formatDate(value);
  }

  /** Formats money only when a currency is known; never assumes one. */
  function formatMoney(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return '—';
    const n = Number(amount);
    if (!currency) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try {
      return n.toLocaleString(undefined, { style: 'currency', currency });
    } catch (e) {
      return currency + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  function clamp(n, min, max) {
    return Math.min(Math.max(Number(n) || 0, min), max);
  }

  /** Saves base64 content returned by the API as a file on the user's device. */
  function saveBase64(fileName, mimeType, base64) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function formatBytes(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.round(n / 1024) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  /** Reads a File as base64 (without the data: prefix). */
  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  return { esc, html, raw, formatDate, timeAgo, formatMoney, initials, clamp, saveBase64, formatBytes, readFileBase64 };
})();
