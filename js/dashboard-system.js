/**
 * Balance Trust — the system administrator's dashboard
 * (system-admin-dashboard.html): is the system set up, healthy, backed up
 * and secure. The full health check is in Administration → System.
 */
const SystemDashboard = (() => {
  const { html, raw } = Utils;
  const ok = (good, yes, no) => html`<li><span>${raw(good ? '<i class="bi bi-check-circle text-success me-2" aria-hidden="true"></i>' : '<i class="bi bi-x-circle text-danger me-2" aria-hidden="true"></i>')}${good ? yes : no}</span></li>`;

  async function render(el) {
    el.innerHTML = UI.loadingState('Loading the system dashboard…');
    let d;
    try {
      ({ data: d } = await Api.call('getSystemDashboard'));
    } catch (err) {
      el.innerHTML = UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el));
      return;
    }
    const dbOk = d.database.stored === d.database.expected;
    const missing = d.expectedTriggers.filter((t) => !d.triggers.includes(t));
    const lastBackup = d.backups.latest;
    const backupAge = lastBackup ? Math.floor((Date.now() - new Date(lastBackup.at).getTime()) / 864e5) : null;
    const stats = [
      UI.statCard({ label: 'Database version', value: d.database.stored + ' / ' + d.database.expected, icon: 'database', tone: dbOk ? 'green' : 'red', hint: dbOk ? 'Up to date' : 'Run migrateDatabase', href: '#/admin/system' }),
      UI.statCard({ label: 'Errors this week', value: d.errors.lastWeek, icon: 'bug', tone: d.errors.lastWeek ? 'red' : 'green' }),
      UI.statCard({ label: 'Last backup', value: lastBackup ? (backupAge === 0 ? 'Today' : backupAge + ' day' + (backupAge === 1 ? '' : 's') + ' ago') : 'None', icon: 'cloud-check', tone: lastBackup && backupAge <= 1 ? 'green' : 'gold', href: '#/admin/system' }),
      UI.statCard({ label: 'Signed-in sessions', value: d.sessions.active, icon: 'person-lock' }),
      UI.statCard({ label: 'Failed sign-ins this week', value: d.security.failedLoginsLastWeek, icon: 'shield-exclamation', tone: d.security.failedLoginsLastWeek > 20 ? 'red' : '', href: App.can('audit.view') ? '#/admin/audit' : '' }),
      UI.statCard({ label: 'Emails left today', value: d.mailQuotaRemaining === null ? '—' : d.mailQuotaRemaining, icon: 'envelope' })
    ].join('');
    el.innerHTML = html`
      ${raw(Pages.switcher(App.user(), 'system-dashboard'))}
      ${raw(UI.pageHeader({ title: 'System admin dashboard', subtitle: 'Set-up, health, backups and security.', actions: '<a class="btn btn-primary" href="#/admin/system"><i class="bi bi-heart-pulse me-2" aria-hidden="true"></i>Full health check</a>' }))}
      <section class="bt-grid bt-grid--stats mb-4" aria-label="Summary">${raw(stats)}</section>
      <div class="bt-grid bt-grid--split">
        <div class="bt-grid">
          <section class="bt-card" aria-labelledby="h-sy-err"><div class="bt-card__header"><h2 id="h-sy-err">Latest errors</h2></div>
            ${raw(d.errors.latest.length ? '<div class="bt-table-wrap"><table class="bt-table"><thead><tr><th>When</th><th>Action</th><th>Message</th></tr></thead><tbody>' + d.errors.latest.map((e) => html`<tr><td class="small">${Utils.formatDate(e.at)}</td><td><code>${e.action}</code></td><td class="small">${e.message}</td></tr>`).join('') + '</tbody></table></div>' : '<p class="text-muted px-4 py-3 mb-0">No errors recorded.</p>')}</section>
          <section class="bt-card" aria-labelledby="h-sy-roles"><div class="bt-card__header"><h2 id="h-sy-roles">People by role</h2><a class="small" href="#/admin/roles">Roles</a></div><div class="bt-card__body">
            ${raw(Object.keys(d.roles).length ? '<ul class="bt-kv">' + Object.keys(d.roles).sort().map((k) => html`<li><span>${k}</span><strong>${d.roles[k]}</strong></li>`).join('') + '</ul>' : '<p class="text-muted mb-0">None.</p>')}</div></section>
        </div>
        <div class="bt-grid">
          <section class="bt-card" aria-labelledby="h-sy-setup"><div class="bt-card__header"><h2 id="h-sy-setup">Set-up</h2><a class="small" href="#/admin/system">Settings</a></div><div class="bt-card__body"><ul class="bt-kv">
            ${raw(ok(dbOk, 'Database is up to date', 'Database needs migrateDatabase'))}
            ${raw(ok(!missing.length, 'Scheduled jobs installed', 'Run installTriggers (missing: ' + missing.join(', ') + ')'))}
            ${raw(ok(d.setup.frontendUrl, 'Site address (FRONTEND_URL) set', 'Set FRONTEND_URL'))}
            ${raw(ok(d.setup.company, 'Company details entered', 'Enter COMPANY_NAME and contact details'))}
            ${raw(ok(d.setup.wave, 'Wave payments connected', 'Add WAVE_API_KEY in Script Properties'))}
            ${raw(ok(d.setup.cards, 'Visa card payments connected (Modem Pay)', 'Add MODEM_PAY_SECRET_KEY in Script Properties'))}
            <li><span><i class="bi bi-patch-check me-2" aria-hidden="true"></i>Pay before sign-in is ${d.setup.subscriptionRequired ? 'on' : 'off'}</span></li>
          </ul></div></section>
          <section class="bt-card" aria-labelledby="h-sy-bk"><div class="bt-card__header"><h2 id="h-sy-bk">Backups</h2></div><div class="bt-card__body">
            ${raw(lastBackup ? html`<p class="mb-1"><strong>${lastBackup.fileName}</strong></p><p class="small text-muted mb-0">${lastBackup.status} · ${Utils.formatDate(lastBackup.at)} · ${d.backups.count} kept</p>` : '<p class="text-muted mb-0">No backup yet. Run one from Administration → System, or install the daily job with installTriggers.</p>')}</div></section>
        </div>
      </div>`;
  }

  return { render };
})();
