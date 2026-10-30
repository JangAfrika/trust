/**
 * Balance Trust — project workspace: overview, stages and stage
 * authorization, photos and videos, updates, live site and team.
 *
 * What each person sees comes from the `can` flags the server returns for
 * this project. Hiding a button is only convenience: the backend checks
 * every action again.
 */
const Workspace = (() => {
  const { html, raw } = Utils;
  // [key, label, icon, shown for this project?]
  const TABS = [
    ['overview', 'Overview', 'speedometer2'],
    ['details', 'Details', 'card-checklist'],
    ['stages', 'Stages', 'list-check'],
    ['media', 'Photos & Videos', 'images'],
    ['updates', 'Updates', 'journal-text'],
    ['live', 'Live Cameras', 'camera-video'],
    ['documents', 'Documents', 'folder2-open', (p) => p.can.viewDocuments],
    ['finance', 'Finance', 'cash-stack', (p) => p.can.viewFinance],
    ['materials', 'Material Orders', 'truck'],
    ['team', 'Team', 'people']
  ];
  const tabsFor = (p) => TABS.filter((t) => !t[3] || t[3](p));
  const STAFF_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Awaiting Inspection', 'Awaiting Client Authorization', 'Delayed'];
  const AWAITING = 'Awaiting Client Authorization';
  const EXT_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };

  let cache = null; // { id, data, at }: reused while switching tabs of one project
  let view = null; // { el, id, tab }
  const mediaUrls = new Map(); // mediaId → object URL (kept for this page view)

  /* ---------- data ---------- */
  async function load(projectId, force) {
    if (!force && cache && cache.id === projectId && Date.now() - cache.at < 15000) return cache.data;
    const { data } = await Api.call('getProject', { projectId });
    cache = { id: projectId, data, at: Date.now() };
    return data;
  }

  function refresh() {
    cache = null;
    if (view) render(view.el, view.id, view.tab);
  }

  /** Runs an API call from a form or button with busy state, toast and field errors. */
  async function submit(button, form, action, params, done, opts) {
    if (form) Validation.clearErrors(form);
    const restore = UI.busy(button, (opts && opts.busyText) || 'Saving…');
    try {
      const res = await Api.call(action, params, opts);
      UI.toast('success', res.message);
      if (done) done(res.data);
      return res;
    } catch (err) {
      restore();
      if (!(form && Validation.applyServerErrors(form, err.fields))) UI.toast('error', err.message);
      return null;
    }
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function mimeOf(file) {
    return file.type || EXT_MIME[(file.name.split('.').pop() || '').toLowerCase()] || '';
  }

  /** Uploads one photo/video; returns the new mediaId or null (errors shown on the form). */
  async function uploadMedia(form, input, stageId, caption) {
    const file = input.files[0];
    if (!file) return null;
    const mime = mimeOf(file);
    if (!/^(image|video)\//.test(mime)) { Validation.setFieldError(input, 'Choose a photo or a video.'); return null; }
    if (file.size > APP_CONFIG.maxUploadMb * 1024 * 1024) { Validation.setFieldError(input, `The file is larger than ${APP_CONFIG.maxUploadMb} MB.`); return null; }
    const base64 = await readFile(file);
    try {
      const { data } = await Api.call('uploadProjectMedia', { projectId: view.id, stageId, caption, file: { fileName: file.name, mimeType: mime, base64 } }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      return data.mediaId;
    } catch (err) {
      if (!Validation.applyServerErrors(form, err.fields)) UI.toast('error', err.message);
      return null;
    }
  }

  async function mediaUrl(mediaId) {
    if (mediaUrls.has(mediaId)) return mediaUrls.get(mediaId);
    const { data } = await Api.call('getMediaFile', { mediaId }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
    mediaUrls.set(mediaId, url);
    return url;
  }

  /* ---------- shared bits ---------- */
  const stageOptions = (p, selected, emptyLabel = 'Whole project') =>
    html`<option value="">${emptyLabel}</option>` + p.stages.map((s) => html`<option value="${s.stageId}" ${raw(s.stageId === selected ? 'selected' : '')}>${s.number}. ${s.name}</option>`).join('');

  function mediaTile(m) {
    const icon = m.kind === 'video' ? 'play-circle' : 'image';
    return html`<figure class="bt-media" data-media="${m.mediaId}" data-kind="${m.kind}">
      <button type="button" class="bt-media__thumb" aria-label="Open ${m.kind === 'video' ? 'video' : 'photo'} ${m.caption || m.fileName}"><i class="bi bi-${icon}" aria-hidden="true"></i></button>
      <figcaption><span class="bt-media__caption">${m.caption || m.fileName}</span><span class="bt-media__meta">${m.stage || 'Whole project'} · ${Utils.formatDate(m.uploadedAt)}</span></figcaption>
    </figure>`;
  }

  /** Loads image thumbnails one after another and wires every tile to the viewer. */
  async function wireMedia(root, items) {
    const byId = new Map(items.map((m) => [m.mediaId, m]));
    root.querySelectorAll('[data-media]').forEach((fig) => {
      fig.querySelector('button').addEventListener('click', () => openViewer(byId.get(fig.dataset.media)));
    });
    for (const fig of root.querySelectorAll('[data-media][data-kind="image"]')) {
      if (!document.body.contains(fig)) return;
      try {
        const url = await mediaUrl(fig.dataset.media);
        const btn = fig.querySelector('button');
        btn.innerHTML = html`<img src="${url}" alt="">`;
      } catch (e) { /* tile keeps its icon; opening it shows the error */ }
    }
  }

  async function openViewer(m) {
    const m2 = UI.modal({ title: m.caption || m.fileName, size: 'xl', body: UI.loadingState(m.kind === 'video' ? 'Loading video…' : 'Loading photo…') });
    try {
      const url = await mediaUrl(m.mediaId);
      m2.el.querySelector('.modal-body').innerHTML = (m.kind === 'video'
        ? html`<video class="bt-viewer" src="${url}" controls playsinline></video>`
        : html`<img class="bt-viewer" src="${url}" alt="${m.caption || m.fileName}">`) +
        html`<p class="small text-muted mt-2 mb-0">${m.stage || 'Whole project'} · ${m.uploadedBy} · ${Utils.formatDate(m.uploadedAt)}</p>`;
    } catch (err) {
      m2.el.querySelector('.modal-body').innerHTML = UI.errorState(err);
    }
  }

  /* ---------- header ---------- */
  function header(p) {
    const actions = p.can.editProject ? '<button type="button" class="btn btn-outline-primary btn-sm" data-act="edit-project"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit project</button>' : '';
    const waiting = p.stages.filter((s) => s.status === AWAITING);
    let banner = '';
    if (p.can.authorize && waiting.length) {
      banner = html`<div class="bt-alert bt-alert--info mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2"><span><i class="bi bi-hand-index me-2" aria-hidden="true"></i><strong>${waiting[0].name}</strong> is waiting for your authorization. Work continues only after you decide.</span><button type="button" class="btn btn-sm btn-accent" data-authorize="${waiting[0].stageId}">Review and authorize</button></div>`;
    } else if (p.can.editProject && p.status === 'Pending Review') {
      banner = '<div class="bt-alert bt-alert--info mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2"><span><i class="bi bi-inbox me-2" aria-hidden="true"></i>New block request. Confirm scope, price and schedule with the client, then accept it to start the project.</span><button type="button" class="btn btn-sm btn-accent" data-act="accept">Accept request</button></div>';
    }
    return html`<div class="bt-card mb-3"><div class="bt-card__body">
      <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div><p class="small text-muted mb-1">${p.projectNumber || p.projectId}</p><h1 class="mb-1">${p.name}</h1>
          <div class="bt-project__meta"><span><i class="bi bi-person" aria-hidden="true"></i>${p.clientName || '—'}</span><span><i class="bi bi-geo-alt" aria-hidden="true"></i>${p.location || '—'}</span><span><i class="bi bi-boxes" aria-hidden="true"></i>${p.block || '—'}</span></div></div>
        <div class="d-flex flex-column align-items-end gap-2">${raw(UI.statusBadge(p.status))}${raw(actions)}</div>
      </div>
      <dl class="bt-dl mb-3"><dt>Current stage</dt><dd>${p.currentStage || 'Not started'} ${raw(p.currentStageStatus ? UI.statusBadge(p.currentStageStatus) : '')}</dd><dt>Expected completion</dt><dd>${Utils.formatDate(p.expectedEndDate)}</dd></dl>
      ${raw(UI.progressBar(p.progress, 'Overall progress'))}
      ${raw(banner)}
    </div></div>`;
  }

  function tabs(p, active) {
    return '<nav class="bt-tabs mb-4" aria-label="Project sections">' + tabsFor(p).map(([key, label, icon]) => {
      const count = key === 'media' ? p.counts.media : key === 'updates' ? p.counts.updates : key === 'stages' ? p.stages.length : null;
      return html`<a class="bt-tabs__link" href="#/projects/${encodeURIComponent(p.projectId)}/${key}" ${raw(key === active ? 'aria-current="page"' : '')}><i class="bi bi-${icon}" aria-hidden="true"></i>${label}${raw(count ? html`<span class="bt-tabs__count">${count}</span>` : '')}</a>`;
    }).join('') + '</nav>';
  }

  /* ---------- overview: the monitoring story ---------- */
  function overview(p) {
    const current = p.stages.find((s) => s.name === p.currentStage) || p.stages[0];
    const idx = current ? p.stages.indexOf(current) : -1;
    const next = idx >= 0 ? p.stages[idx + 1] : null;
    const done = p.stages.filter((s) => s.status === 'Completed' || s.status === 'Approved').length;
    const delayed = p.stages.filter((s) => s.delayed).length;
    const authText = !current ? '—' : current.status === 'Approved' ? 'Authorized' : current.approvalRequired ? (current.status === AWAITING ? 'Waiting for the client' : 'Needed when the stage is finished') : 'Not required for this stage';
    const step = (icon, label, value, extra = '') => html`<li class="bt-flow__step"><span class="bt-flow__icon"><i class="bi bi-${icon}" aria-hidden="true"></i></span><div><p class="bt-flow__label">${label}</p><p class="bt-flow__value">${raw(value)}</p>${raw(extra)}</div></li>`;
    const flow = '<ol class="bt-flow">' + [
      step('flag', 'Current stage', html`${current ? current.name : 'No stages yet'} ${raw(current ? UI.statusBadge(current.status) : '')}`),
      step('hammer', 'Work completed', current ? html`${current.percent}% of this stage · ${done} of ${p.stages.length} stages finished` : '—', current && current.notes ? html`<p class="small text-muted mb-0">${current.notes}</p>` : ''),
      step('camera', 'Evidence', html`<a href="#/projects/${encodeURIComponent(p.projectId)}/media">${p.counts.media === 1 ? '1 photo or video' : p.counts.media + ' photos & videos'}</a> · <a href="#/projects/${encodeURIComponent(p.projectId)}/updates">${p.counts.updates === 1 ? '1 update' : p.counts.updates + ' updates'}</a> · <a href="#/projects/${encodeURIComponent(p.projectId)}/live">${p.liveStream.cameras ? (p.liveStream.cameras === 1 ? '1 live camera' : p.liveStream.cameras + ' live cameras') : 'no live camera yet'}</a>`),
      p.can.viewFinance ? step('cash-stack', 'Financial status', html`<span id="bt-flow-finance">Loading…</span> · <a href="#/projects/${encodeURIComponent(p.projectId)}/finance">details</a>`) : '',
      step('shield-check', 'Authorization', html`${authText}`, p.can.authorize && current && current.status === AWAITING ? html`<button type="button" class="btn btn-sm btn-accent mt-2" data-authorize="${current.stageId}">Authorize next stage</button>` : ''),
      step('arrow-right-circle', 'Next stage', html`${next ? next.name : 'None planned'}`)
    ].join('') + '</ol>';
    return html`<div class="bt-grid bt-grid--split">
      <section class="bt-card" aria-labelledby="h-flow"><div class="bt-card__header"><h2 id="h-flow">Where the project stands</h2>${raw(delayed ? html`<span class="bt-badge bt-badge--danger"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>${delayed} delayed</span>` : '')}</div><div class="bt-card__body">${raw(flow)}</div></section>
      <div class="d-grid gap-4">
        <section class="bt-card" aria-labelledby="h-details"><div class="bt-card__header"><h2 id="h-details">Details</h2></div><div class="bt-card__body">
          <dl class="bt-dl"><dt>Start</dt><dd>${Utils.formatDate(p.startDate)}</dd><dt>Expected end</dt><dd>${Utils.formatDate(p.expectedEndDate)}</dd><dt>Requested</dt><dd>${Utils.formatDate(p.createdAt)}</dd><dt>Team</dt><dd>${p.team.filter((m) => m.role !== 'Owner').length || 'Not assigned yet'}</dd></dl>
          ${raw(p.description ? html`<p class="small mt-3 mb-0" style="white-space:pre-line">${p.description}</p>` : '')}
        </div></section>
      </div>
    </div>`;
  }

  /* ---------- stages ---------- */
  function stageCard(p, s) {
    const isCurrent = s.name === p.currentStage;
    const history = s.authorizations.length
      ? '<ul class="bt-stage__history">' + s.authorizations.map((a) => html`<li>${raw(UI.statusBadge(a.decision))} by ${a.by}, ${Utils.formatDate(a.at)}${a.comment ? ': “' + a.comment + '”' : ''}</li>`).join('') + '</ul>' : '';
    const buttons = [
      p.can.authorize && s.status === AWAITING ? html`<button type="button" class="btn btn-sm btn-accent" data-authorize="${s.stageId}">Authorize</button>` : '',
      p.can.updateStages && s.status !== 'Approved' ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-edit-stage="${s.stageId}">Update</button>` : ''
    ].join('');
    return html`<article class="bt-card bt-stage ${isCurrent ? 'is-current' : ''}" aria-label="Stage ${s.number}: ${s.name}">
      <div class="bt-stage__head">
        <span class="bt-stage__num" aria-hidden="true">${s.number}</span>
        <div class="flex-grow-1 min-w-0"><h3 class="bt-stage__name">${s.name}${raw(isCurrent ? ' <span class="bt-stage__tag">Current</span>' : '')}</h3>
          <p class="bt-stage__meta">${[s.startDate || s.expectedEndDate ? Utils.formatDate(s.startDate) + ' → ' + Utils.formatDate(s.expectedEndDate) : 'Dates not planned yet', s.actualEndDate ? 'finished ' + Utils.formatDate(s.actualEndDate) : '', s.approvalRequired ? 'client authorization required' : ''].filter(Boolean).join(' · ')}</p></div>
        <div class="d-flex flex-wrap gap-2 align-items-start">${raw(UI.statusBadge(s.status))}${raw(s.delayed && s.status !== 'Delayed' ? UI.statusBadge('Delayed') : '')}</div>
      </div>
      ${raw(UI.progressBar(s.percent, 'Progress of ' + s.name))}
      ${raw(s.description ? html`<p class="small mb-0" style="white-space:pre-line">${s.description}</p>` : '')}
      ${raw(s.notes ? html`<p class="small text-muted mb-0"><i class="bi bi-sticky me-1" aria-hidden="true"></i>${s.notes}</p>` : '')}
      ${raw(s.amountRequired !== null ? html`<p class="small mb-0"><span class="text-muted">Amount for this stage:</span> ${Utils.formatMoney(s.amountRequired)}${s.amountPaid !== null ? ' · paid ' + Utils.formatMoney(s.amountPaid) : ''}</p>` : '')}
      ${raw(history)}
      ${raw(buttons ? `<div class="d-flex flex-wrap gap-2">${buttons}</div>` : '')}
    </article>`;
  }

  function stages(p) {
    const add = p.can.manageStages ? '<button type="button" class="btn btn-primary btn-sm" data-act="add-stage"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add stage</button>' : '';
    if (!p.stages.length) return '<div class="bt-card">' + UI.emptyState({ icon: 'list-check', title: 'No stages yet', text: 'The project team will plan the stages of this project.' }) + (add ? `<div class="text-center pb-4">${add}</div>` : '') + '</div>';
    return (add ? `<div class="d-flex justify-content-end mb-3">${add}</div>` : '') + '<div class="d-grid gap-3">' + p.stages.map((s) => stageCard(p, s)).join('') + '</div>';
  }

  function stageForm(p, s) {
    const plan = p.can.manageStages;
    const v = s || { status: 'Not Started', percent: 0 };
    return html`<form id="bt-stage-form" novalidate>
      ${raw(plan ? html`<div class="mb-3"><label class="form-label" for="sf-name">Stage name</label><input class="form-control" id="sf-name" name="stageName" maxlength="150" data-rules="required" value="${v.name || ''}"></div>
      <div class="mb-3"><label class="form-label" for="sf-desc">Description <span class="text-muted fw-normal">(optional)</span></label><textarea class="form-control" id="sf-desc" name="description" rows="2" maxlength="2000">${v.description || ''}</textarea></div>
      <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="sf-start">Start date</label><input class="form-control" type="date" id="sf-start" name="startDate" value="${(v.startDate || '').substring(0, 10)}"></div>
        <div class="col-sm-6"><label class="form-label" for="sf-end">Expected end date</label><input class="form-control" type="date" id="sf-end" name="expectedEndDate" value="${(v.expectedEndDate || '').substring(0, 10)}"></div></div>
      <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="sf-amount">Amount for this stage <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" type="number" min="0" step="0.01" id="sf-amount" name="amountRequired" value="${v.amountRequired === null || v.amountRequired === undefined ? '' : v.amountRequired}"></div>
        <div class="col-sm-6 d-flex align-items-end"><div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="sf-approval" name="approvalRequired" value="true" ${raw(v.approvalRequired ? 'checked' : '')}><label class="form-check-label" for="sf-approval">Client must authorize this stage</label></div></div></div>` : '')}
      ${raw(s ? html`<div class="row g-3 mb-3"><div class="col-sm-7"><label class="form-label" for="sf-status">Status</label><select class="form-select" id="sf-status" name="status">${raw(STAFF_STATUSES.map((st) => html`<option ${raw(st === v.status ? 'selected' : '')}>${st}</option>`).join(''))}${raw(STAFF_STATUSES.includes(v.status) ? '' : html`<option selected value="">${v.status} (unchanged)</option>`)}</select></div>
        <div class="col-sm-5"><label class="form-label" for="sf-percent">Complete (%)</label><input class="form-control" type="number" min="0" max="100" step="1" id="sf-percent" name="percent" value="${v.percent}"></div></div>
      <div class="mb-0"><label class="form-label" for="sf-notes">Site notes <span class="text-muted fw-normal">(optional)</span></label><textarea class="form-control" id="sf-notes" name="notes" rows="2" maxlength="2000">${v.notes || ''}</textarea><div class="form-text">Marking a stage Completed sends it to the client when their authorization is required.</div></div>` : '')}
    </form>`;
  }

  function openStageForm(p, s) {
    const m = UI.modal({ title: s ? `Update stage ${s.number}: ${s.name}` : 'Add a stage', body: stageForm(p, s), footer: `<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-stage-form">${s ? 'Save stage' : 'Add stage'}</button>` });
    const form = m.el.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Validation.validateForm(form)) return;
      const f = form.elements;
      const params = { projectId: p.projectId };
      if (f.stageName) Object.assign(params, { stageName: f.stageName.value, description: f.description.value, startDate: f.startDate.value, expectedEndDate: f.expectedEndDate.value, amountRequired: f.amountRequired.value, approvalRequired: f.approvalRequired.checked });
      if (s) {
        params.stageId = s.stageId;
        if (f.status.value) params.status = f.status.value;
        params.percent = f.percent.value;
        params.notes = f.notes.value;
      }
      submit(m.el.querySelector('[type=submit]'), form, s ? 'updateStage' : 'addStage', params, () => { m.close(); refresh(); });
    });
  }

  /** Authorize Next Stage: shows the evidence, then records the decision. */
  async function openAuthorize(p, stageId) {
    const s = p.stages.find((x) => x.stageId === stageId);
    if (!s) return;
    const m = UI.modal({ title: 'Authorize next stage', size: 'lg', body: UI.loadingState('Gathering the evidence for this stage…') });
    let media = [];
    let updates = [];
    try {
      const [mr, ur] = await Promise.all([Api.call('getProjectMedia', { projectId: p.projectId, stageId }), Api.call('getProjectUpdates', { projectId: p.projectId })]);
      media = mr.data.items;
      updates = ur.data.items.filter((u) => u.stageId === stageId);
    } catch (err) { /* the decision form still works without the evidence lists */ }
    const next = p.stages[p.stages.indexOf(s) + 1];
    m.el.querySelector('.modal-body').innerHTML = html`
      <p class="mb-3">Stage ${s.number} of ${p.stages.length}: <strong>${s.name}</strong> ${raw(UI.statusBadge(s.status))}</p>
      ${raw(s.description ? html`<p class="small" style="white-space:pre-line">${s.description}</p>` : '')}
      <h3 class="h6">Work completed</h3>
      <dl class="bt-dl mb-3"><dt>Progress</dt><dd>${s.percent}%</dd><dt>Started</dt><dd>${Utils.formatDate(s.startDate)}</dd><dt>Finished</dt><dd>${Utils.formatDate(s.actualEndDate)}</dd>${raw(s.notes ? html`<dt>Site notes</dt><dd>${s.notes}</dd>` : '')}<dt>Next stage</dt><dd>${next ? next.name : 'None planned'}</dd></dl>
      <h3 class="h6">Photos and videos</h3>
      ${raw(media.length ? '<div class="bt-media-grid bt-media-grid--sm mb-3">' + media.slice(0, 8).map(mediaTile).join('') + '</div>' : '<p class="small text-muted">No photos or videos were added to this stage.</p>')}
      <h3 class="h6">Reports and updates</h3>
      ${raw(updates.length ? '<ul class="small ps-3 mb-3">' + updates.map((u) => html`<li><strong>${u.title}</strong>, ${Utils.formatDate(u.createdAt)}: ${u.description}</li>`).join('') + '</ul>' : '<p class="small text-muted">No updates were posted for this stage.</p>')}
      <h3 class="h6">Financial information</h3>
      <p class="small">${s.amountRequired !== null ? html`Amount for this stage: ${Utils.formatMoney(s.amountRequired)}${s.amountPaid !== null ? ' · paid ' + Utils.formatMoney(s.amountPaid) : ''}` : 'No amount has been recorded for this stage.'}</p>
      <hr>
      <form id="bt-authorize" novalidate>
        <fieldset class="mb-3"><legend class="form-label fs-6">Your decision</legend>
          <div class="form-check"><input class="form-check-input" type="radio" name="decision" id="az-approve" value="approved" checked><label class="form-check-label" for="az-approve">Authorize: the work is acceptable, the team may continue</label></div>
          <div class="form-check"><input class="form-check-input" type="radio" name="decision" id="az-reject" value="rejected"><label class="form-check-label" for="az-reject">Do not authorize: something needs to change</label></div>
        </fieldset>
        <div class="mb-3"><label class="form-label" for="az-comment">Comment <span class="text-muted fw-normal" id="az-comment-hint">(optional)</span></label><textarea class="form-control" id="az-comment" name="comment" rows="3" maxlength="1000"></textarea></div>
        <div class="form-check"><input class="form-check-input" type="checkbox" id="az-confirm" name="confirm" value="true" data-rules="required"><label class="form-check-label" for="az-confirm">I have reviewed this stage and confirm my decision.</label></div>
      </form>`;
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-accent" form="bt-authorize">Submit decision</button>';
    m.el.querySelector('.modal-content').appendChild(footer);
    wireMedia(m.el, media);
    const form = m.el.querySelector('#bt-authorize');
    form.addEventListener('change', () => { m.el.querySelector('#az-comment-hint').textContent = form.elements.decision.value === 'rejected' ? '(required)' : '(optional)'; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Validation.validateForm(form)) return;
      const decision = form.elements.decision.value;
      if (decision === 'rejected' && !form.elements.comment.value.trim()) { Validation.setFieldError(form.elements.comment, 'Tell the team what needs to change.'); form.elements.comment.focus(); return; }
      submit(footer.querySelector('[type=submit]'), form, 'authorizeStage', { projectId: p.projectId, stageId, decision, comment: form.elements.comment.value, confirm: true },
        () => { m.close(); refresh(); }, { busyText: 'Authorizing…' });
    });
  }

  /* ---------- photos & videos ---------- */
  async function media(p, panel) {
    const form = p.can.uploadMedia ? html`<section class="bt-card mb-4" aria-labelledby="h-upload"><div class="bt-card__header"><h2 id="h-upload">Add a photo or video</h2></div><div class="bt-card__body">
      <form id="bt-media-form" class="row g-3 align-items-end" novalidate>
        <div class="col-md-4"><label class="form-label" for="mf-file">File</label><input class="form-control" type="file" id="mf-file" name="file" accept="image/*,video/*" data-rules="required"></div>
        <div class="col-md-3"><label class="form-label" for="mf-stage">Stage</label><select class="form-select" id="mf-stage" name="stageId">${raw(stageOptions(p, p.stages.find((s) => s.name === p.currentStage)?.stageId))}</select></div>
        <div class="col-md-3"><label class="form-label" for="mf-caption">Caption</label><input class="form-control" id="mf-caption" name="caption" maxlength="300" placeholder="What does it show?"></div>
        <div class="col-md-2 d-grid"><button class="btn btn-primary" type="submit">Upload</button></div>
        <p class="form-text mb-0">Photos and videos up to ${APP_CONFIG.maxUploadMb} MB. Files are stored privately in the project's folder.</p>
      </form></div></section>` : '';
    panel.innerHTML = form + '<div id="bt-media-list"></div>';
    const listEl = panel.querySelector('#bt-media-list');
    const f = panel.querySelector('#bt-media-form');
    const loadList = async () => {
      listEl.innerHTML = UI.loadingState('Loading photos and videos…');
      let items;
      try {
        ({ data: { items } } = await Api.call('getProjectMedia', { projectId: p.projectId, pageSize: 120 }));
      } catch (err) {
        listEl.innerHTML = UI.errorState(err);
        return;
      }
      listEl.innerHTML = items.length
        ? '<div class="bt-media-grid">' + items.map(mediaTile).join('') + '</div>'
        : '<div class="bt-card">' + UI.emptyState({ icon: 'images', title: 'No photos or videos yet', text: 'Site photos and videos will appear here as the team records the work.' }) + '</div>';
      wireMedia(listEl, items);
    };
    if (f) {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        Validation.clearErrors(f);
        if (!Validation.validateForm(f)) return;
        const restore = UI.busy(f.querySelector('[type=submit]'), 'Uploading…');
        const id = await uploadMedia(f, f.elements.file, f.elements.stageId.value, f.elements.caption.value);
        restore();
        if (id) {
          UI.toast('success', 'Uploaded.');
          if (cache) cache.data.counts.media += 1;
          f.reset();
          loadList();
        }
      });
    }
    loadList();
  }

  /* ---------- updates ---------- */
  async function updates(p, panel) {
    const form = p.can.postUpdates ? html`<section class="bt-card mb-4" aria-labelledby="h-post"><div class="bt-card__header"><h2 id="h-post">Post an update</h2></div><div class="bt-card__body">
      <form id="bt-update-form" novalidate>
        <div class="row g-3 mb-3"><div class="col-md-7"><label class="form-label" for="uf-title">Title</label><input class="form-control" id="uf-title" name="title" maxlength="150" data-rules="required" placeholder="e.g. Foundation poured"></div>
          <div class="col-md-5"><label class="form-label" for="uf-stage">Stage</label><select class="form-select" id="uf-stage" name="stageId">${raw(stageOptions(p, p.stages.find((s) => s.name === p.currentStage)?.stageId))}</select></div></div>
        <div class="mb-3"><label class="form-label" for="uf-desc">Details</label><textarea class="form-control" id="uf-desc" name="description" rows="3" maxlength="4000" data-rules="required"></textarea></div>
        <div class="mb-3"><label class="form-label" for="uf-file">Photo or video <span class="text-muted fw-normal">(optional)</span></label><input class="form-control" type="file" id="uf-file" name="file" accept="image/*,video/*"></div>
        <button class="btn btn-primary" type="submit">Post update</button>
      </form></div></section>` : '';
    panel.innerHTML = form + '<div id="bt-update-list">' + UI.loadingState('Loading updates…') + '</div>';
    const listEl = panel.querySelector('#bt-update-list');
    const f = panel.querySelector('#bt-update-form');
    if (f) {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        Validation.clearErrors(f);
        if (!Validation.validateForm(f)) return;
        const restore = UI.busy(f.querySelector('[type=submit]'), 'Posting…');
        let mediaIds = '';
        if (f.elements.file.files[0]) {
          mediaIds = await uploadMedia(f, f.elements.file, f.elements.stageId.value, f.elements.title.value);
          if (!mediaIds) { restore(); return; }
        }
        try {
          const res = await Api.call('createProjectUpdate', { projectId: p.projectId, stageId: f.elements.stageId.value, title: f.elements.title.value, description: f.elements.description.value, mediaIds });
          UI.toast('success', res.message);
          refresh();
        } catch (err) {
          restore();
          if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
        }
      });
    }
    let items;
    try {
      ({ data: { items } } = await Api.call('getProjectUpdates', { projectId: p.projectId }));
    } catch (err) {
      listEl.innerHTML = UI.errorState(err);
      return;
    }
    const attachments = [];
    listEl.innerHTML = items.length
      ? '<section class="bt-card"><div class="bt-card__body"><ol class="bt-timeline">' + items.map((u) => {
        attachments.push(...u.attachments);
        return html`<li class="bt-timeline__item"><h3 class="h6 mb-1">${u.title}</h3><p class="small text-muted mb-1">${u.author} · ${Utils.formatDate(u.createdAt)}${u.stage ? ' · ' + u.stage : ''}</p><p class="mb-2" style="white-space:pre-line">${u.description}</p>${raw(u.attachments.length ? '<div class="bt-media-grid bt-media-grid--sm">' + u.attachments.map(mediaTile).join('') + '</div>' : '')}</li>`;
      }).join('') + '</ol></div></section>'
      : '<div class="bt-card">' + UI.emptyState({ icon: 'journal-text', title: 'No updates yet', text: 'The project team posts progress reports here.' }) + '</div>';
    wireMedia(listEl, attachments);
  }

  /* ---------- team ---------- */
  function team(p) {
    const rows = p.team.map((m) => html`<li class="bt-list__item"><span class="bt-avatar" aria-hidden="true">${Utils.initials(m.name)}</span><div class="bt-list__body"><p class="bt-list__title">${raw(App.can('user.manage') ? html`<button type="button" class="bt-linkish" data-open-user="${m.userId}">${m.name}</button>` : Utils.esc(m.name))}</p><p class="bt-list__text">${m.role}${m.canAuthorize ? ' · can authorize stages' : ''}</p></div>${raw(p.can.manageTeam && m.role !== 'Owner' ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-remove="${m.memberId}" data-name="${m.name}">Remove</button>` : '')}</li>`).join('');
    const form = p.can.manageTeam ? html`<section class="bt-card" aria-labelledby="h-add"><div class="bt-card__header"><h2 id="h-add">Add to the team</h2></div><div class="bt-card__body">
      <form id="bt-team-form" novalidate>
        <div class="mb-3"><label class="form-label" for="tf-email">Email of the person</label><input class="form-control" id="tf-email" name="email" type="email" list="bt-staff-list" data-rules="required email" autocomplete="off"><datalist id="bt-staff-list"></datalist><div class="form-text">They need an active Balance Trust account.</div></div>
        <div class="mb-3"><label class="form-label" for="tf-role">Role on this project</label><select class="form-select" id="tf-role" name="projectRole">${raw(p.memberRoles.map((r) => html`<option>${r}</option>`).join(''))}</select></div>
        <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="tf-auth" name="canAuthorize" value="true" disabled><label class="form-check-label" for="tf-auth">May authorize stages for the client (decision makers only)</label></div>
        <button class="btn btn-primary" type="submit">Add to team</button>
      </form></div></section>` : '';
    return html`<div class="bt-grid bt-grid--split"><section class="bt-card" aria-labelledby="h-team"><div class="bt-card__header"><h2 id="h-team">Project team</h2></div><ul class="bt-list">${raw(rows)}</ul></section>${raw(form)}</div>`;
  }

  function wireTeam(p, panel) {
    panel.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Remove from team', message: `Remove ${b.dataset.name} from this project? They will lose access to it.`, confirmLabel: 'Remove', danger: true }))) return;
      submit(b, null, 'removeProjectMember', { projectId: p.projectId, memberId: b.dataset.remove }, refresh);
    }));
    const f = panel.querySelector('#bt-team-form');
    if (!f) return;
    const sync = () => { f.elements.canAuthorize.disabled = f.elements.projectRole.value !== 'Decision Maker'; if (f.elements.canAuthorize.disabled) f.elements.canAuthorize.checked = false; };
    f.elements.projectRole.addEventListener('change', sync);
    Api.call('getAssignableStaff').then(({ data }) => {
      const list = panel.querySelector('#bt-staff-list');
      if (list) list.innerHTML = data.map((u) => html`<option value="${u.email}">${u.name} (${u.roles.join(', ')})</option>`).join('');
    }).catch(() => {});
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Validation.validateForm(f)) return;
      submit(f.querySelector('[type=submit]'), f, 'addProjectMember', { projectId: p.projectId, email: f.elements.email.value, projectRole: f.elements.projectRole.value, canAuthorize: f.elements.canAuthorize.checked }, refresh);
    });
  }

  /* ---------- project edit ---------- */
  function openEditProject(p) {
    const d = (v) => (v || '').substring(0, 10);
    const m = UI.modal({
      title: 'Edit project', size: 'lg',
      body: html`<form id="bt-project-form" novalidate>
        <div class="row g-3 mb-3"><div class="col-sm-7"><label class="form-label" for="pf-name">Project name</label><input class="form-control" id="pf-name" name="name" maxlength="150" data-rules="required" value="${p.name}"></div>
          <div class="col-sm-5"><label class="form-label" for="pf-status">Status</label><select class="form-select" id="pf-status" name="status">${raw(p.statuses.map((s) => html`<option ${raw(s === p.status ? 'selected' : '')}>${s}</option>`).join(''))}</select></div></div>
        <div class="mb-3"><label class="form-label" for="pf-location">Location</label><input class="form-control" id="pf-location" name="location" maxlength="200" value="${p.location || ''}"></div>
        <div class="mb-3"><label class="form-label" for="pf-desc">Description</label><textarea class="form-control" id="pf-desc" name="description" rows="3" maxlength="2000">${p.description || ''}</textarea></div>
        <div class="row g-3"><div class="col-sm-4"><label class="form-label" for="pf-start">Start date</label><input class="form-control" type="date" id="pf-start" name="startDate" value="${d(p.startDate)}"></div>
          <div class="col-sm-4"><label class="form-label" for="pf-end">Expected completion</label><input class="form-control" type="date" id="pf-end" name="expectedEndDate" value="${d(p.expectedEndDate)}"></div>
          <div class="col-sm-4"><label class="form-label" for="pf-actual">Actual completion</label><input class="form-control" type="date" id="pf-actual" name="actualEndDate" value="${d(p.actualEndDate)}"></div></div>
      </form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-project-form">Save project</button>'
    });
    const form = m.el.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Validation.validateForm(form)) return;
      const v = Object.fromEntries(new FormData(form).entries());
      submit(m.el.querySelector('[type=submit]'), form, 'updateProject', Object.assign({ projectId: p.projectId }, v), () => { m.close(); refresh(); });
    });
  }

  /* ---------- render ---------- */
  async function render(el, projectId, tab) {
    tab = TABS.some(([k]) => k === tab) ? tab : 'overview';
    view = { el, id: projectId, tab };
    if (!cache || cache.id !== projectId) el.innerHTML = UI.loadingState('Loading project…');
    let p;
    try {
      p = await load(projectId);
    } catch (err) {
      el.innerHTML = err.code === 'NOT_FOUND'
        ? '<div class="bt-card">' + UI.emptyState({ icon: 'search', title: 'Project not found', text: 'This project does not exist or you do not have access to it.', actionHref: '#/projects', actionLabel: 'Back to projects' }) + '</div>'
        : UI.errorState(err);
      return;
    }
    if (view.id !== projectId || view.tab !== tab) return; // the user moved on while loading
    if (!tabsFor(p).some(([k]) => k === tab)) tab = view.tab = 'overview';
    document.getElementById('bt-page-title').textContent = p.name;
    document.title = p.name + ' · ' + APP_CONFIG.appName;
    el.innerHTML = header(p) + tabs(p, tab) + '<div id="bt-ws-panel"></div>';
    const panel = el.querySelector('#bt-ws-panel');

    el.querySelectorAll('[data-act="edit-project"]').forEach((b) => b.addEventListener('click', () => openEditProject(p)));
    el.querySelectorAll('[data-act="accept"]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await UI.confirm({ title: 'Accept request', message: `Start "${p.name}"? The client is told the project is now active.`, confirmLabel: 'Accept and start' }))) return;
      submit(b, null, 'updateProject', { projectId: p.projectId, status: 'Active' }, refresh);
    }));

    if (tab === 'overview') panel.innerHTML = overview(p);
    else if (tab === 'details') BlockDetails.renderProject(panel, p);
    else if (tab === 'stages') panel.innerHTML = stages(p);
    else if (tab === 'live') Cameras.renderPanel(panel, { type: 'Project', id: p.projectId });
    else if (tab === 'team') {
      panel.innerHTML = team(p);
      wireTeam(p, panel);
      panel.querySelectorAll('[data-open-user]').forEach((b) => b.addEventListener('click', () => Admin.openUser(b.dataset.openUser)));
    }
    else if (tab === 'media') media(p, panel);
    else if (tab === 'updates') updates(p, panel);
    else if (tab === 'documents') Documents.renderProject(panel, p);
    else if (tab === 'finance') Finance.renderProject(panel, p);
    else if (tab === 'materials') Materials.renderProject(panel, p);
    if (tab === 'overview' && p.can.viewFinance) {
      Finance.statusText(p.projectId).then((t) => { const x = panel.querySelector('#bt-flow-finance'); if (x) x.textContent = t; })
        .catch(() => { const x = panel.querySelector('#bt-flow-finance'); if (x) x.textContent = 'Not available right now'; });
    }

    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-authorize], [data-edit-stage], [data-act="add-stage"]');
      if (!t || !view || view.id !== projectId) return;
      if (t.dataset.authorize) openAuthorize(p, t.dataset.authorize);
      else if (t.dataset.editStage) openStageForm(p, p.stages.find((s) => s.stageId === t.dataset.editStage));
      else if (t.dataset.act === 'add-stage') openStageForm(p, null);
    }, { once: false, signal: renderSignal() });
  }

  /** One click handler per render: aborting the previous one avoids stacking listeners on #bt-content. */
  let controller = null;
  function renderSignal() {
    if (controller) controller.abort();
    controller = new AbortController();
    return controller.signal;
  }

  /** Called by the router when the user leaves the workspace. */
  function leave() {
    if (controller) controller.abort();
    controller = null;
    view = null;
    cache = null; // coming back always shows fresh data; the cache only serves tab switches
  }

  /** Live updates: the next render loads fresh data. */
  function invalidate() { cache = null; }

  return { render, leave, invalidate };
})();
