/**
 * Balance Trust — the only frontend configuration file.
 * apiUrl is the public URL of the deployed Apps Script Web App (it ends in
 * /exec). It is not a secret. Never put credentials or keys in this file.
 */
const APP_CONFIG = Object.freeze({
  appName: 'Balance Trust',
  shortName: 'BT',
  version: '1.0.0',
  apiUrl: 'https://script.google.com/macros/s/AKfycbyK2V6_UBEUXsCi8ao3fPMAddTy2BSY0Dy6M8Sl1mBCch93lqeJ8-SfRFrmoP1nV4FEnA/exec',
  requestTimeoutMs: 30000,
  sessionStorageKey: 'bt.session'
});
