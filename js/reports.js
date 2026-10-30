/**
 * Balance Trust — Reports. The server decides which reports a person may run
 * and builds each one only from records they may see; this page shows the
 * table, a simple bar chart of one column, and offers CSV export and print.
 */
const Reports = (() => {
  const { html, raw } = Utils;
  const dateOpts = { year: 'numeric', month: 'short', day: 'numeric' };

  function cell(col, row) {
    const v = row[col.key];
    if (v === null || v === undefined || v === '') return '<span class="text-muted">—</span>';
    switch (col.type) {
      case 'money': return Utils.esc(Utils.formatMoney(v, row.currency));
      case 'percent': return Utils.esc(Number(v) + '%');
      case 'number': return Utils.esc(String(v));
      case 'date': return Utils.esc(Utils.formatDate(v, dateOpts));
      case 'datetime': return Utils.esc(Utils.formatDate(v, { ...dateOpts, hour: '2-digit', minute: '2-digit' }));
      case 'status': return UI.statusBadge(v);
      default: return Utils.esc(String(v));
    }
  }

  function chart(report) {
    const c = report.chart;
    if (!c) return '';
    const rows = report.rows.filter((r) => r[c.value] !== '' && r[c.value] !== null && r[c.value] !== undefined);
    if (!rows.length) return '';
    // Money is never added across currencies, so each bar keeps its own currency and bars scale per currency.
    const max = {};
    rows.forEach((r) => { const k = c.money ? r.currency : ''; max[k] = Math.max(max[k] || 0, Number(r[c.value]) || 0); });
    const bars = rows.slice(0, 25).map((r) => {
      const v = Number(r[c.value]) || 0;
      const top = max[c.money ? r.currency : ''] || 0;
      const pct = top > 0 ? Math.round((v / top) * 100) : 0;
      const shown = c.money ? Utils.formatMoney(v, r.currency) : (/%\)$/.test(c.title) ? v + '%' : String(v));
      const label = r[c.label] + (c.money && r.currency ? ' · ' + r.currency : '');
      return html`<li class="bt-bars__row"><span class="bt-bars__label" title="${label}">${label}</span><span class="bt-bars__track"><span class="bt-bars__fill" style="width:${pct}%"></span></span><span class="bt-bars__value">${shown}</span></li>`;
    }).join('');
    return html`<section class="bt-card mb-4" aria-labelledby="h-chart"><div class="bt-card__header"><h2 id="h-chart">${c.title}</h2></div><ul class="bt-bars">${raw(bars)}</ul>${rows.length > 25 ? raw('<p class="small text-muted px-4 pb-3 mb-0">Showing the first 25 rows. The table below has them all.</p>') : ''}</section>`;
  }

  function csv(report) {
    const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };
    const lines = [report.columns.map((c) => q(c.label)).join(',')].concat(report.rows.map((r) => report.columns.map((c) => q(r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'balance-trust-' + report.type + '-' + String(report.generatedAt).substring(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function show(panel, type, days) {
    panel.innerHTML = UI.loadingState('Building the report…');
    let report;
    try {
      ({ data: report } = await Api.call('getReport', type === 'activity' ? { type, days } : { type }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err, 'bt-retry');
      panel.querySelector('#bt-retry').addEventListener('click', () => show(panel, type, days));
      return;
    }
    const table = report.rows.length
      ? html`<div class="bt-table-wrap"><table class="bt-table"><thead><tr>${raw(report.columns.map((c) => html`<th scope="col" class="${['money', 'number', 'percent'].includes(c.type) ? 'num' : ''}">${c.label}</th>`).join(''))}</tr></thead><tbody>${raw(report.rows.map((r) => '<tr>' + report.columns.map((c) => `<td class="${['money', 'number', 'percent'].includes(c.type) ? 'num' : ''}">${cell(c, r)}</td>`).join('') + '</tr>').join(''))}</tbody></table></div>`
      : UI.emptyState({ icon: 'clipboard-data', title: 'Nothing to report yet', text: 'This report has no records you can see.' });
    panel.innerHTML = html`
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3 bt-no-print">
        <p class="small text-muted mb-0 me-auto">${report.rows.length} row${report.rows.length === 1 ? '' : 's'} · generated ${Utils.formatDate(report.generatedAt, { ...dateOpts, hour: '2-digit', minute: '2-digit' })}</p>
        ${raw(type === 'activity' ? html`<label class="small text-muted" for="rp-days">Period</label><select class="form-select form-select-sm w-auto" id="rp-days">${raw([7, 30, 90, 365].map((d) => html`<option value="${d}" ${raw(d === days ? 'selected' : '')}>Last ${d} days</option>`).join(''))}</select>` : '')}
        <button type="button" class="btn btn-sm btn-outline-primary" data-act="csv" ${raw(report.rows.length ? '' : 'disabled')}><i class="bi bi-filetype-csv" aria-hidden="true"></i> Download CSV</button>
        <button type="button" class="btn btn-sm btn-outline-primary" data-act="print"><i class="bi bi-printer" aria-hidden="true"></i> Print or save as PDF</button>
      </div>
      <h2 class="h5 d-none d-print-block">${report.title}</h2>
      ${raw(chart(report))}
      <section class="bt-card" aria-label="${report.title}">${raw(table)}</section>`;
    panel.querySelector('[data-act="csv"]').addEventListener('click', () => csv(report));
    panel.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
    const sel = panel.querySelector('#rp-days');
    if (sel) sel.addEventListener('change', () => show(panel, type, Number(sel.value)));
  }

  async function render(el, type) {
    el.innerHTML = UI.pageHeader({ title: 'Reports', subtitle: 'Reports are built from the records you are allowed to see. Amounts are shown per currency.' }) + UI.loadingState('Loading reports…');
    let available;
    try {
      available = (await Api.call('getReport', {})).data.available;
    } catch (err) {
      el.innerHTML = UI.pageHeader({ title: 'Reports' }) + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => render(el, type));
      return;
    }
    if (!available.length) {
      el.innerHTML = UI.pageHeader({ title: 'Reports' }) + '<div class="bt-card">' + UI.emptyState({ icon: 'lock', title: 'No reports available', text: 'Your role does not include any reports.' }) + '</div>';
      return;
    }
    if (!available.some((r) => r.key === type)) type = available[0].key;
    el.innerHTML = UI.pageHeader({ title: 'Reports', subtitle: 'Reports are built from the records you are allowed to see. Amounts are shown per currency.' }) +
      '<nav class="bt-tabs mb-4 bt-no-print" aria-label="Reports">' + available.map((r) => html`<a class="bt-tabs__link" href="#/reports/${r.key}" ${raw(r.key === type ? 'aria-current="page"' : '')}>${r.title}</a>`).join('') + '</nav><div id="bt-report-panel"></div>';
    show(el.querySelector('#bt-report-panel'), type, 30);
  }

  return { render };
})();
