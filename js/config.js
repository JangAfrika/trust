/**
 * Balance Trust — the only frontend configuration file.
 * apiUrl is the public URL of the deployed Apps Script Web App (it ends in
 * /exec). It is not a secret. Never put credentials or keys in this file.
 */
const APP_CONFIG = Object.freeze({
  appName: 'Balance Trust',
  shortName: 'BT',
  version: '1.0.0',
  apiUrl: 'https://script.google.com/macros/s/AKfycbwL_oJ1qqkyWjy72poVP3vaU4AImk6ywX30KuREfNJWC-GVgIl1vPO2baqwh957rDpH_g/exec',
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 180000,
  // Must not exceed MAX_UPLOAD_MB in the backend (Script Properties).
  maxUploadMb: 25,
  // How often an open page checks for changes made by others (seconds; 0 turns live updates off).
  liveSeconds: 15,
  // Lets people install the app on their devices (needs https, which GitHub Pages provides). false turns it off.
  serviceWorker: true,
  sessionStorageKey: 'bt.session'
});
