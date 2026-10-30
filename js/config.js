/**
 * Balance Trust — the only frontend configuration file.
 * apiUrl is the public URL of the deployed Apps Script Web App (it ends in
 * /exec). It is not a secret. Never put credentials or keys in this file.
 */
const APP_CONFIG = Object.freeze({
  appName: 'Balance Trust',
  shortName: 'BT',
  version: '1.0.0',
  apiUrl: 'https://script.google.com/macros/s/AKfycbxuzk-9bFQrVS4-mpCoxGSwr6VAqz-a_Ep7i9gRXC4MbR29x4ciWHOzYqzyOJJYldW9kQ/exec',
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 180000,
  // Must not exceed MAX_UPLOAD_MB in the backend (Script Properties).
  maxUploadMb: 25,
  // How often an open page checks for changes made by others (seconds; 0 turns live updates off).
  liveSeconds: 15,
  sessionStorageKey: 'bt.session'
});
