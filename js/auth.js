/**
 * Balance Trust — signed-out screens: sign in, create account, verify email,
 * forgot password and reset password. All checks that matter happen on the
 * server; this module only collects input and shows results.
 */
const Auth = (() => {
  const { html, raw } = Utils;
  let root;

  const PILLARS = [
    ['eye', 'Visibility', 'Follow every stage of your build with photos, videos and reports.'],
    ['shield-check', 'Accountability', 'Every payment, document and approval is recorded.'],
    ['sliders', 'Control', 'Nothing moves to the next stage without your authorization.']
  ];

  function frame(panel) {
    return html`<button class="bt-icon-btn bt-theme-float" type="button" data-theme-toggle></button><div class="bt-auth">
      <section class="bt-auth__aside">
        <div>
          <span class="bt-brand" data-brand>
            <img class="bt-brand__logo" src="assets/logo.png" alt="">
            <span class="bt-brand__mono" aria-hidden="true">BT</span>
            <span class="bt-brand__name">BALANCE TRUST<small>Build · Supervise · Manage</small></span>
          </span>
          <h1 class="mt-5">Trust through <em>visibility</em>, accountability and control.</h1>
          <ul class="bt-auth__pillars">${PILLARS.map(([icon, title, text]) => raw(html`<li><i class="bi bi-${icon}" aria-hidden="true"></i><span><strong class="text-white">${title}.</strong> ${text}</span></li>`))}</ul>
        </div>
        <p class="small opacity-50 mb-0 bt-auth__aside-foot">${APP_CONFIG.appName} · v${APP_CONFIG.version}</p>
      </section>
      <main class="bt-auth__main" id="bt-auth-main" tabindex="-1"><div class="bt-auth__panel">${raw(panel)}</div></main>
    </div>`;
  }

  function alertBox(type, message) {
    return message ? html`<div class="bt-alert bt-alert--${type}" role="${type === 'error' ? 'alert' : 'status'}"><i class="bi bi-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}" aria-hidden="true"></i><span>${message}</span></div>` : '';
  }

  const VIEWS = {
    login: (o) => html`<h2>Sign in</h2><p class="text-muted mb-4">Welcome back. Sign in to your Balance Trust account.</p>
      ${raw(alertBox(o.alertType || 'error', o.alert))}
      <form id="bt-auth-form" novalidate>
        <div class="mb-3"><label class="form-label" for="f-login">Email or phone</label><input class="form-control" id="f-login" name="login" type="text" autocomplete="username" data-rules="required login" value="${o.login || o.email || ''}"><div class="form-text">Use a phone number with its country code, e.g. +220 700 0000.</div></div>
        <div class="mb-2"><label class="form-label" for="f-password">Password</label><input class="form-control" id="f-password" name="password" type="password" autocomplete="current-password" data-rules="required"></div>
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div class="form-check"><input class="form-check-input" type="checkbox" id="f-remember" name="remember"><label class="form-check-label small" for="f-remember">Keep me signed in</label></div>
          <a href="#" class="small" data-view="forgot">Forgot password?</a>
        </div>
        <button class="btn btn-primary w-100" type="submit">Sign in</button>
      </form>
      <p class="bt-auth__switch">New to Balance Trust? <a href="#" data-view="signup">Create an account</a></p>`,

    signup: (o) => html`<h2>Create your account</h2><p class="text-muted mb-4">Register to buy a block and follow your projects.</p>
      ${raw(alertBox('error', o.alert))}
      <form id="bt-auth-form" novalidate>
        <div class="mb-3"><label class="form-label" for="f-fullName">Full name</label><input class="form-control" id="f-fullName" name="fullName" autocomplete="name" data-rules="required" maxlength="120"></div>
        <div class="mb-3"><label class="form-label" for="f-email">Email</label><input class="form-control" id="f-email" name="email" type="email" autocomplete="email" data-rules="required email"></div>
        <div class="row g-3 mb-3">
          <div class="col-sm-6"><label class="form-label" for="f-phone">Phone <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="f-phone" name="phone" type="tel" autocomplete="tel" maxlength="40"><div class="form-text">With country code. You can sign in with it.</div></div>
          <div class="col-sm-6"><label class="form-label" for="f-accountType">Account type</label><select class="form-select" id="f-accountType" name="accountType"><option>Individual</option><option>Company</option></select></div>
        </div>
        <div class="mb-3"><label class="form-label" for="f-country">Country <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="f-country" name="country" autocomplete="country-name" maxlength="80"></div>
        <div class="mb-3"><label class="form-label" for="f-password">Password</label><input class="form-control" id="f-password" name="password" type="password" autocomplete="new-password" data-rules="required password" aria-describedby="f-password-help"><div class="form-text" id="f-password-help">At least 10 characters, with letters and numbers.</div></div>
        <div class="mb-4"><label class="form-label" for="f-confirm">Confirm password</label><input class="form-control" id="f-confirm" name="confirm" type="password" autocomplete="new-password" data-rules="required" data-match="password"></div>
        <button class="btn btn-accent w-100" type="submit">Create account</button>
      </form>
      <p class="bt-auth__switch">Already registered? <a href="#" data-view="login">Sign in</a></p>`,

    verify: (o) => html`<h2>Verify your email</h2><p class="text-muted mb-4">We sent a 6-digit code to <strong>${o.email || 'your email'}</strong>. Enter it below to activate your account.</p>
      ${raw(alertBox(o.alertType || 'info', o.alert))}
      <form id="bt-auth-form" novalidate>
        <input type="hidden" name="email" value="${o.email || ''}">
        <div class="mb-4"><label class="form-label" for="f-code">Verification code</label><input class="form-control form-control-lg text-center" id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-rules="required code" style="letter-spacing:0.4em"></div>
        <button class="btn btn-primary w-100" type="submit">Verify account</button>
      </form>
      <p class="bt-auth__switch">Didn't get it? <a href="#" id="bt-resend">Send a new code</a> · <a href="#" data-view="login">Back to sign in</a></p>`,

    forgot: (o) => html`<h2>Reset your password</h2><p class="text-muted mb-4">Enter your account email or phone number and we'll email you a reset code.</p>
      ${raw(alertBox('error', o.alert))}
      <form id="bt-auth-form" novalidate>
        <div class="mb-4"><label class="form-label" for="f-login">Email or phone</label><input class="form-control" id="f-login" name="login" type="text" autocomplete="username" data-rules="required login" value="${o.login || o.email || ''}"></div>
        <button class="btn btn-primary w-100" type="submit">Send reset code</button>
      </form>
      <p class="bt-auth__switch">Have a code already? <a href="#" data-view="reset">Enter it</a> · <a href="#" data-view="login">Back to sign in</a></p>`,

    reset: (o) => html`<h2>Choose a new password</h2><p class="text-muted mb-4">Enter the code from your email and a new password.</p>
      ${raw(alertBox(o.alertType || 'info', o.alert))}
      <form id="bt-auth-form" novalidate>
        <div class="mb-3"><label class="form-label" for="f-login">Email or phone</label><input class="form-control" id="f-login" name="login" type="text" autocomplete="username" data-rules="required login" value="${o.login || o.email || ''}"></div>
        <div class="mb-3"><label class="form-label" for="f-code">Reset code</label><input class="form-control" id="f-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-rules="required code"></div>
        <div class="mb-3"><label class="form-label" for="f-newPassword">New password</label><input class="form-control" id="f-newPassword" name="newPassword" type="password" autocomplete="new-password" data-rules="required password"></div>
        <div class="mb-4"><label class="form-label" for="f-confirm">Confirm new password</label><input class="form-control" id="f-confirm" name="confirm" type="password" autocomplete="new-password" data-rules="required" data-match="newPassword"></div>
        <button class="btn btn-primary w-100" type="submit">Change password</button>
      </form>
      <p class="bt-auth__switch"><a href="#" data-view="login">Back to sign in</a></p>`
  };

  const SUBMIT = {
    login: async (v) => {
      const { data } = await Api.call('login', { login: v.login, password: v.password, userAgent: navigator.userAgent });
      Session.set({ token: data.token, expiresAt: data.expiresAt, user: data.user }, !!v.remember);
      App.start();
    },
    signup: async (v) => {
      const { data, message } = await Api.call('signup', { fullName: v.fullName, email: v.email, phone: v.phone, accountType: v.accountType, country: v.country, password: v.password });
      show('verify', { email: data.email, alert: message, alertType: data.verificationEmailSent ? 'success' : 'error' });
    },
    verify: async (v) => {
      const { data, message } = await Api.call('verifyAccount', { email: v.email, code: v.code });
      show('login', { email: v.email, alert: message, alertType: data.status === 'Active' ? 'success' : 'info' });
    },
    forgot: async (v) => {
      const { message } = await Api.call('requestPasswordReset', { login: v.login });
      show('reset', { login: v.login, alert: message });
    },
    reset: async (v) => {
      const { message } = await Api.call('resetPassword', { login: v.login, code: v.code, newPassword: v.newPassword });
      show('login', { login: v.login, alert: message, alertType: 'success' });
    }
  };

  const LOADING = { login: 'Signing in…', signup: 'Creating account…', verify: 'Verifying…', forgot: 'Sending…', reset: 'Saving…' };

  function show(view, opts = {}) {
    root = root || document.getElementById('bt-auth-root');
    document.getElementById('bt-app-root').hidden = true;
    root.hidden = false;
    root.innerHTML = frame(VIEWS[view](opts));
    App.applyBrand(root);
    Theme.bind(root);
    document.title = APP_CONFIG.appName;
    if (!Api.isConfigured()) {
      root.querySelector('.bt-auth__panel').insertAdjacentHTML('afterbegin', alertBox('info', 'Setup required: this site is not connected to its Apps Script backend yet. Set apiUrl in js/config.js.'));
    }

    root.querySelectorAll('[data-view]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const field = root.querySelector('[name=login], [name=email]');
      const v = field ? field.value : '';
      show(a.dataset.view, v.includes('@') ? { email: v, login: v } : { login: v });
    }));

    const resend = root.querySelector('#bt-resend');
    if (resend) resend.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { message } = await Api.call('resendVerification', { email: opts.email });
        UI.toast('success', message);
      } catch (err) { UI.toast('error', err.message); }
    });

    const form = root.querySelector('#bt-auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(form);
      if (!Validation.validateForm(form)) return;
      const values = Object.fromEntries(new FormData(form).entries());
      const restore = UI.busy(form.querySelector('[type=submit]'), LOADING[view]);
      try {
        await SUBMIT[view](values);
      } catch (err) {
        restore();
        if (err.code === 'ACCOUNT_INACTIVE' && err.needsVerification) {
          show('verify', { email: err.email || values.email || values.login, alert: err.message });
          return;
        }
        if (!Validation.applyServerErrors(form, err.fields)) {
          const panel = root.querySelector('.bt-auth__panel');
          const existing = panel.querySelector('.bt-alert--error');
          if (existing) existing.remove();
          form.insertAdjacentHTML('beforebegin', alertBox('error', err.message));
        }
      }
    });

    const first = form.querySelector('input:not([type=hidden]):not([value]), input:not([type=hidden])[value=""]') || form.querySelector('input:not([type=hidden])');
    if (first) first.focus();
  }

  async function logout() {
    Live.stop();
    try { await Api.call('logout'); } catch (e) { /* session may already be gone */ }
    Session.clear();
    show('login', { alert: 'You have been signed out.', alertType: 'info' });
  }

  return { show, logout };
})();
