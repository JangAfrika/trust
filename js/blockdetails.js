/**
 * Balance Trust — the details each block needs (its own table).
 *
 * The client answers their part once, when requesting the block; staff add
 * theirs (site survey, inspection, plan of work) in the same table. Everyone
 * on the project reads one complete page instead of asking each other. Which
 * details exist, and who may fill each one, comes from the server; the
 * server checks every change again.
 */
const BlockDetails = (() => {
  const { html, raw } = Utils;
  const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp,image/heic';

  /** Fields grouped by section, keeping their order: [[section, [fields]]]. */
  function groups(fields) {
    const out = [];
    fields.forEach((f) => {
      let g = out.find(([s]) => s === f.section);
      if (!g) out.push(g = [f.section, []]);
      g[1].push(f);
    });
    return out;
  }

  const empty = (v) => v === '' || v === null || v === undefined;

  function display(f) {
    if (f.type === 'document') {
      if (!f.value) return '<span class="text-muted">Not added yet</span>';
      return f.document ? html`<button type="button" class="btn btn-link btn-sm p-0" data-doc="${f.document.documentId}"><i class="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>${f.document.name}</button>` : '<span class="text-muted">Document removed</span>';
    }
    if (empty(f.value)) return '<span class="text-muted">Not given yet</span>';
    if (f.type === 'date') return Utils.esc(Utils.formatDate(f.value));
    if (f.type === 'textarea') return html`<span style="white-space:pre-line">${String(f.value)}</span>`;
    return Utils.esc(String(f.value) + (f.unit ? ' ' + f.unit : ''));
  }

  /** One form control for a detail. Names are d_<key>, matching the server's field errors. */
  function input(f, value, opts = {}) {
    const id = 'bd-' + f.key;
    const name = 'd_' + f.key;
    const v = empty(value) ? '' : value;
    const need = f.required && !(f.type === 'document' && value);
    const req = need ? 'data-rules="required"' : '';
    const label = html`<label class="form-label" for="${id}">${f.label}${f.unit ? ' (' + f.unit + ')' : ''}${raw(f.required ? '' : ' <span class="text-muted fw-normal">(optional)</span>')}</label>`;
    const help = f.help ? html`<div class="form-text" id="${id}-help">${f.help}</div>` : '';
    const described = f.help ? `aria-describedby="${id}-help"` : '';
    let control;
    switch (f.type) {
      case 'textarea': control = html`<textarea class="form-control" id="${id}" name="${name}" rows="3" maxlength="3000" ${raw(req)} ${raw(described)}>${String(v)}</textarea>`; break;
      case 'number': control = html`<input class="form-control" id="${id}" name="${name}" type="number" min="0" step="any" inputmode="decimal" value="${String(v)}" ${raw(req)} ${raw(described)}>`; break;
      case 'date': control = html`<input class="form-control" id="${id}" name="${name}" type="date" value="${String(v).substring(0, 10)}" ${raw(req)} ${raw(described)}>`; break;
      case 'select':
      case 'yesno': {
        const options = f.type === 'yesno' ? ['Yes', 'No'] : f.options;
        control = html`<select class="form-select" id="${id}" name="${name}" ${raw(req)} ${raw(described)}><option value="">Choose…</option>${raw(options.map((o) => html`<option ${raw(String(v) === o ? 'selected' : '')}>${o}</option>`).join(''))}</select>`;
        break;
      }
      case 'document':
        control = html`<input class="form-control" id="${id}" name="${name}" type="file" accept="${ACCEPT}" ${raw(req)} ${raw(described)}>${raw(value && opts.current ? html`<div class="form-text">Current: ${opts.current}. Choose a file only to replace it.</div>` : '')}`;
        break;
      default: control = html`<input class="form-control" id="${id}" name="${name}" maxlength="300" value="${String(v)}" ${raw(req)} ${raw(described)}>`;
    }
    const wide = f.type === 'textarea' || f.type === 'document';
    return html`<div class="${wide ? 'col-12' : 'col-sm-6'}">${raw(label)}${raw(control)}${raw(help)}</div>`;
  }

  /** Form sections for a list of fields (used by the request form and the edit dialog). */
  function formSections(fields, values = {}, opts = {}) {
    return groups(fields).map(([section, list]) => html`<fieldset class="bt-fieldset"><legend>${section}</legend><div class="row g-3">${raw(list.map((f) => input(f, values[f.key], { current: opts.currentNames ? opts.currentNames[f.key] : '' })).join(''))}</div></fieldset>`).join('');
  }

  /** Reads answers and chosen files from a form; checks file sizes. Returns null when a file is too large. */
  function collect(form, fields) {
    const values = {};
    const files = [];
    let ok = true;
    fields.forEach((f) => {
      const el = form.elements['d_' + f.key];
      if (!el) return;
      if (f.type === 'document') {
        const file = el.files && el.files[0];
        if (!file) return;
        if (file.size > APP_CONFIG.maxUploadMb * 1024 * 1024) { Validation.setFieldError(el, `The file is larger than ${APP_CONFIG.maxUploadMb} MB.`); ok = false; return; }
        files.push({ field: f, file });
      } else values[f.key] = el.value;
    });
    return ok ? { values, files } : null;
  }

  /** Uploads chosen files one at a time; returns the labels that failed. */
  async function uploadFiles(projectId, files, onProgress) {
    const failed = [];
    for (let i = 0; i < files.length; i++) {
      const { field, file } = files[i];
      if (onProgress) onProgress(i + 1, files.length, field.label);
      try {
        const base64 = await Utils.readFileBase64(file);
        await Api.call('uploadBlockDetailFile', {
          projectId, fieldKey: field.key, quiet: true,
          file: { fileName: file.name, mimeType: file.type || 'application/octet-stream', base64 }
        }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      } catch (err) {
        failed.push(field.label + ' (' + err.message + ')');
      }
    }
    return failed;
  }

  /* ---------- project tab ---------- */

  function editDialog(p, data, panel) {
    const editable = data.fields.filter((f) => f.canEdit);
    const values = Object.fromEntries(editable.map((f) => [f.key, f.value]));
    const currentNames = Object.fromEntries(editable.filter((f) => f.document).map((f) => [f.key, f.document.name]));
    const m = UI.modal({
      title: 'Edit project details',
      size: 'lg',
      body: '<form id="bt-bd-form" novalidate>' + formSections(editable, values, { currentNames }) + '</form>',
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-bd-form">Save details</button>'
    });
    const form = m.el.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(form);
      if (!Validation.validateForm(form)) return;
      const got = collect(form, editable);
      if (!got) return;
      // Only changed answers are sent.
      const changed = {};
      Object.keys(got.values).forEach((k) => { if (String(got.values[k]) !== String(empty(values[k]) ? '' : values[k])) changed[k] = got.values[k]; });
      const btn = m.el.querySelector('[type=submit]');
      const restore = UI.busy(btn, 'Saving…');
      try {
        if (Object.keys(changed).length) await Api.call('saveBlockDetails', { projectId: p.projectId, values: changed });
        const failed = await uploadFiles(p.projectId, got.files, (i, n) => { btn.lastChild.textContent = ` Uploading file ${i} of ${n}…`; });
        m.close();
        if (failed.length) UI.toast('error', 'Saved, but these files did not upload: ' + failed.join('; '), 10000);
        else UI.toast('success', Object.keys(changed).length || got.files.length ? 'Details saved.' : 'Nothing changed.');
        renderProject(panel, p);
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
      }
    });
  }

  async function renderProject(panel, p) {
    panel.innerHTML = UI.loadingState('Loading project details…');
    let data;
    try {
      ({ data } = await Api.call('getBlockDetails', { projectId: p.projectId }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err, 'bt-retry');
      panel.querySelector('#bt-retry').addEventListener('click', () => renderProject(panel, p));
      return;
    }
    if (!data.block || !data.fields.length) {
      panel.innerHTML = '<div class="bt-card">' + UI.emptyState({ icon: 'card-checklist', title: 'No details list for this block', text: 'An administrator can add the details this block needs in Administration → Blocks.' }) + '</div>';
      return;
    }
    const required = data.fields.filter((f) => f.required && f.status !== 'Retired');
    const missing = required.filter((f) => empty(f.value));
    const missingClient = missing.filter((f) => f.filledBy === 'Client');
    // Staff details are listed even when optional, so the client can see what the team has still to record.
    const missingStaff = data.fields.filter((f) => f.filledBy === 'Staff' && f.status !== 'Retired' && empty(f.value));
    const canEdit = data.fields.some((f) => f.canEdit);
    const summary = html`<section class="bt-card mb-4" aria-labelledby="h-bd-sum"><div class="bt-card__header"><h2 id="h-bd-sum">${data.block.name}: project details</h2>
        ${raw(canEdit ? '<button type="button" class="btn btn-sm btn-primary" data-act="edit"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit details</button>' : '')}</div>
      <div class="bt-card__body">
        <p class="mb-2">${required.length - missing.length} of ${required.length} required details given${data.updatedAt ? ' · last updated ' + Utils.formatDate(data.updatedAt) + (data.updatedBy ? ' by ' + data.updatedBy : '') : ''}.</p>
        ${raw(UI.progressBar(required.length ? Math.round(((required.length - missing.length) / required.length) * 100) : 100))}
        ${raw(missingClient.length ? html`<div class="bt-alert bt-alert--info mt-3 mb-0"><i class="bi bi-info-circle" aria-hidden="true"></i><span>Still needed from the client: ${missingClient.map((f) => f.label).join(', ')}.</span></div>` : '')}
        ${raw(missingStaff.length ? html`<div class="bt-alert bt-alert--info mt-3 mb-0"><i class="bi bi-clipboard-check" aria-hidden="true"></i><span>Still to be recorded by our team: ${missingStaff.map((f) => f.label).join(', ')}.</span></div>` : '')}
      </div></section>`;
    const sections = groups(data.fields).map(([section, list], i) => html`<section class="bt-card mb-4" aria-labelledby="h-bd-${i}"><div class="bt-card__header"><h2 id="h-bd-${i}">${section}</h2><span class="small text-muted">${list.every((f) => f.filledBy === 'Staff') ? 'Recorded by our team' : list.every((f) => f.filledBy === 'Client') ? 'From the client' : ''}</span></div>
      <div class="bt-table-wrap"><table class="bt-table bt-table--details"><tbody>${raw(list.map((f) => html`<tr><th scope="row">${f.label}${raw(f.required ? ' <span class="text-danger" title="Required">*</span>' : '')}${raw(f.status === 'Retired' ? ' <span class="small text-muted">(no longer asked)</span>' : '')}</th><td>${raw(display(f))}</td></tr>`).join(''))}</tbody></table></div></section>`).join('');
    panel.innerHTML = summary + sections;
    const edit = panel.querySelector('[data-act="edit"]');
    if (edit) edit.addEventListener('click', () => editDialog(p, data, panel));
    panel.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => Documents.download(b, b.dataset.doc)));
  }

  return { renderProject, formSections, collect, uploadFiles, groups };
})();
