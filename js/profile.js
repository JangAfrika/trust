/**
 * Balance Trust — profile and account settings (password change).
 */
const Profile = (() => {
  const { html } = Utils;

  async function submit(form, action, values, onSuccess) {
    Validation.clearErrors(form);
    if (!Validation.validateForm(form)) return;
    const restore = UI.busy(form.querySelector('[type=submit]'), 'Saving…');
    try {
      const res = await Api.call(action, values);
      UI.toast('success', res.message);
      onSuccess(res.data);
    } catch (err) {
      if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
    } finally {
      restore();
    }
  }

  async function render(el) {
    el.innerHTML = UI.loadingState('Loading profile…');
    let u;
    try {
      ({ data: u } = await Api.call('getUser'));
    } catch (err) {
      el.innerHTML = UI.errorState(err);
      return;
    }
    el.innerHTML = UI.pageHeader({ title: 'Profile', subtitle: 'Your personal details.' }) + html`
      <div class="bt-grid bt-grid--split">
        <section class="bt-card"><div class="bt-card__header"><h2>Personal details</h2></div><div class="bt-card__body">
          <form id="bt-profile" novalidate>
            <div class="mb-3"><label class="form-label" for="p-fullName">Full name</label><input class="form-control" id="p-fullName" name="fullName" value="${u.fullName || ''}" data-rules="required" maxlength="120" autocomplete="name"></div>
            <div class="mb-3"><label class="form-label" for="p-email">Email</label><input class="form-control" id="p-email" value="${u.email}" disabled aria-describedby="p-email-help"><div class="form-text" id="p-email-help">Contact support to change your email address.</div></div>
            <div class="row g-3 mb-4">
              <div class="col-sm-6"><label class="form-label" for="p-phone">Phone</label><input class="form-control" id="p-phone" name="phone" type="tel" value="${u.phone || ''}" maxlength="40" autocomplete="tel"></div>
              <div class="col-sm-6"><label class="form-label" for="p-country">Country</label><input class="form-control" id="p-country" name="country" value="${u.country || ''}" maxlength="80" autocomplete="country-name"></div>
            </div>
            <button class="btn btn-primary" type="submit">Save changes</button>
          </form>
        </div></section>
        <section class="bt-card"><div class="bt-card__header"><h2>Account</h2></div><div class="bt-card__body">
          <dl class="bt-dl"><dt>Status</dt><dd>${Utils.raw(UI.statusBadge(u.status))}</dd><dt>Account type</dt><dd>${u.accountType || '—'}</dd><dt>Roles</dt><dd>${u.roles.map((r) => r.name).join(', ') || '—'}</dd><dt>User ID</dt><dd><code>${u.userId}</code></dd></dl>
        </div></section>
      </div>`;
    const form = el.querySelector('#bt-profile');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      submit(form, 'updateProfile', v, (data) => App.setUser(data));
    });
  }

  function renderSettings(el) {
    el.innerHTML = UI.pageHeader({ title: 'Settings', subtitle: 'Security settings for your account.' }) + `
      <section class="bt-card" style="max-width:36rem"><div class="bt-card__header"><h2>Change password</h2></div><div class="bt-card__body">
        <form id="bt-password" novalidate>
          <div class="mb-3"><label class="form-label" for="s-current">Current password</label><input class="form-control" id="s-current" name="currentPassword" type="password" autocomplete="current-password" data-rules="required"></div>
          <div class="mb-3"><label class="form-label" for="s-new">New password</label><input class="form-control" id="s-new" name="newPassword" type="password" autocomplete="new-password" data-rules="required password"><div class="form-text">At least 10 characters, with letters and numbers. Other devices will be signed out.</div></div>
          <div class="mb-4"><label class="form-label" for="s-confirm">Confirm new password</label><input class="form-control" id="s-confirm" name="confirm" type="password" autocomplete="new-password" data-rules="required" data-match="newPassword"></div>
          <button class="btn btn-primary" type="submit">Change password</button>
        </form>
      </div></section>`;
    const form = el.querySelector('#bt-password');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      submit(form, 'changePassword', { currentPassword: v.currentPassword, newPassword: v.newPassword }, () => form.reset());
    });
  }

  return { render, renderSettings };
})();
