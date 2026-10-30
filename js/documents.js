/**
 * Balance Trust — documents: the Documents page (every project the user can
 * see) and the Documents tab of a project. Files are fetched through the
 * API, which checks access on every download.
 */
const Documents = (() => {
  const { html, raw } = Utils;
  const ICONS = { 'application/pdf': 'file-earmark-pdf', 'image/': 'file-earmark-image', 'sheet': 'file-earmark-spreadsheet', 'excel': 'file-earmark-spreadsheet', 'word': 'file-earmark-word', 'text/': 'file-earmark-text' };
  const icon = (mime) => ICONS[Object.keys(ICONS).find((k) => String(mime || '').includes(k))] || 'file-earmark';

  async function download(button, documentId) {
    const restore = UI.busy(button, 'Downloading…');
    try {
      const { data } = await Api.call('downloadDocument', { documentId }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      Utils.saveBase64(data.fileName, data.mimeType, data.base64);
    } catch (err) {
      UI.toast('error', err.message);
    } finally {
      restore();
    }
  }

  function table(items, { showProject, canDelete }) {
    if (!items.length) return '<div class="bt-card">' + UI.emptyState({ icon: 'folder2-open', title: 'No documents yet', text: 'Contracts, plans, reports, invoices and receipts appear here once they are added.' }) + '</div>';
    return '<div class="bt-card bt-table-wrap"><table class="bt-table"><thead><tr><th>Document</th><th>Type</th>' + (showProject ? '<th>Project</th>' : '') + '<th>Added</th><th class="num">Actions</th></tr></thead><tbody>' +
      items.map((d) => html`<tr>
        <td><div class="bt-file p-0"><i class="bi bi-${icon(d.mimeType)} bt-file__icon" aria-hidden="true"></i><div class="min-w-0"><strong>${d.name}</strong>${raw(d.version > 1 ? html` <span class="bt-badge bt-badge--neutral">v${d.version}</span>` : '')}${raw(d.description ? html`<div class="small text-muted">${d.description}</div>` : '')}</div></div></td>
        <td>${d.type}</td>
        ${raw(showProject ? html`<td><a href="#/projects/${encodeURIComponent(d.projectId)}/documents">${d.project || d.projectId}</a></td>` : '')}
        <td class="small">${Utils.formatDate(d.uploadedAt)}<div class="text-muted">${d.uploadedBy}${d.sizeBytes ? ' · ' + Utils.formatBytes(d.sizeBytes) : ''}</div></td>
        <td class="num text-nowrap"><button type="button" class="btn btn-sm btn-outline-primary" data-download="${d.documentId}"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button>${raw(canDelete && d.type !== 'Invoices' && d.type !== 'Receipts' ? html` <button type="button" class="btn btn-sm btn-outline-primary" data-delete="${d.documentId}" data-name="${d.name}" aria-label="Remove ${d.name}"><i class="bi bi-trash" aria-hidden="true"></i></button>` : '')}</td>
      </tr>`).join('') + '</tbody></table></div>';
  }

  function wireTable(root, onChange) {
    root.querySelectorAll('[data-download]').forEach((b) => b.addEventListener('click', () => download(b, b.dataset.download)));
    root.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Remove document', message: `Remove "${b.dataset.name}" from this project? The file stays in Drive for the record.`, confirmLabel: 'Remove', danger: true }))) return;
      const restore = UI.busy(b, '');
      try {
        const res = await Api.call('deleteDocument', { documentId: b.dataset.delete });
        UI.toast('success', res.message);
        onChange();
      } catch (err) {
        restore();
        UI.toast('error', err.message);
      }
    }));
  }

  /** Documents page: everything the user can see, filterable by type. */
  async function renderPage(el, type) {
    const header = UI.pageHeader({ title: 'Documents', subtitle: 'Contracts, plans, reports, invoices and receipts for your projects.' });
    el.innerHTML = header + UI.loadingState('Loading documents…');
    let page;
    try {
      ({ data: page } = await Api.call('getDocuments', { type: type || '', pageSize: 200 }));
    } catch (err) {
      el.innerHTML = header + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => renderPage(el, type));
      return;
    }
    const filter = html`<div class="d-flex flex-wrap gap-2 align-items-center mb-3"><label class="form-label mb-0" for="dc-type">Type</label><select class="form-select w-auto" id="dc-type"><option value="">All types</option>${raw(page.types.map((t) => html`<option ${raw(t === type ? 'selected' : '')}>${t}</option>`).join(''))}</select><span class="small text-muted">${page.total} document${page.total === 1 ? '' : 's'}</span></div>`;
    el.innerHTML = header + filter + table(page.items, { showProject: true });
    el.querySelector('#dc-type').addEventListener('change', (e) => renderPage(el, e.target.value));
    wireTable(el, () => renderPage(el, type));
  }

  /** Documents tab of one project: upload (for those allowed) and the list. */
  async function renderProject(panel, p) {
    panel.innerHTML = UI.loadingState('Loading documents…');
    let page;
    try {
      ({ data: page } = await Api.call('getDocuments', { projectId: p.projectId, pageSize: 200 }));
    } catch (err) {
      panel.innerHTML = UI.errorState(err);
      return;
    }
    const form = page.uploadTypes.length ? html`<section class="bt-card mb-4" aria-labelledby="h-doc-up"><div class="bt-card__header"><h2 id="h-doc-up">Add a document</h2></div><div class="bt-card__body">
      <form id="bt-doc-form" class="row g-3 align-items-end" novalidate>
        <div class="col-md-3"><label class="form-label" for="df-type">Type</label><select class="form-select" id="df-type" name="documentType">${raw(page.uploadTypes.map((t) => html`<option>${t}</option>`).join(''))}</select></div>
        <div class="col-md-3"><label class="form-label" for="df-name">Name <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="df-name" name="name" maxlength="150" placeholder="Uses the file name"></div>
        <div class="col-md-4"><label class="form-label" for="df-file">File</label><input class="form-control" type="file" id="df-file" name="file" data-rules="required" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"></div>
        <div class="col-md-2 d-grid"><button class="btn btn-primary" type="submit">Upload</button></div>
        <div class="col-12"><label class="form-label" for="df-desc">Description <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" id="df-desc" name="description" maxlength="1000"></div>
        <p class="form-text mb-0">PDF, Word, Excel, text or images up to ${APP_CONFIG.maxUploadMb} MB. Uploading a file with the same name and type adds a new version.</p>
      </form></div></section>` : '';
    panel.innerHTML = form + '<div id="bt-doc-list">' + table(page.items, { canDelete: p.can.manageDocuments }) + '</div>';
    wireTable(panel, () => renderProject(panel, p));
    const f = panel.querySelector('#bt-doc-form');
    if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      if (!Validation.validateForm(f)) return;
      const file = f.elements.file.files[0];
      if (file.size > APP_CONFIG.maxUploadMb * 1024 * 1024) { Validation.setFieldError(f.elements.file, `The file is larger than ${APP_CONFIG.maxUploadMb} MB.`); return; }
      const restore = UI.busy(f.querySelector('[type=submit]'), 'Uploading…');
      try {
        const base64 = await Utils.readFileBase64(file);
        const res = await Api.call('uploadDocument', {
          projectId: p.projectId, documentType: f.elements.documentType.value, name: f.elements.name.value, description: f.elements.description.value,
          file: { fileName: file.name, mimeType: file.type || 'application/octet-stream', base64 }
        }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
        UI.toast('success', res.message);
        renderProject(panel, p);
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
      }
    });
  }

  return { renderPage, renderProject, download };
})();
