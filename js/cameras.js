/**
 * Balance Trust — CCTV: live camera views for a project site or a property,
 * the camera wall across every place a person may see, camera set-up, and
 * recordings.
 *
 * Streams come straight from the camera system to the browser; the server
 * only stores the viewing links and checks who may see them. Continuous
 * recording is done by the cameras' own recorder or cloud service. Staff can
 * also save a short clip from an HLS stream, which is uploaded to Drive.
 */
const Cameras = (() => {
  const { html, raw } = Utils;
  const HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js';
  const STREAM_TYPES = {
    embed: ['Web page (embed)', 'The camera service’s player page or share link, e.g. a YouTube Live embed or a cloud camera share page.'],
    hls: ['HLS video stream (.m3u8)', 'A direct video stream from a recorder, cloud camera or streaming server. Clips can be saved from it.'],
    snapshot: ['Snapshot image', 'A still picture link the camera refreshes; shown here every few seconds.']
  };
  const RECORDING_MODES = {
    none: 'Not recorded',
    recorder: 'Recorded on site (NVR / DVR / SD card)',
    cloud: 'Recorded by a cloud service',
    clips: 'Clips saved from Balance Trust only'
  };
  let hlsLoading = null;

  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsLoading) {
      hlsLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = HLS_SRC;
        s.onload = () => (window.Hls ? resolve(window.Hls) : reject(new Error('Player failed to load')));
        s.onerror = () => { hlsLoading = null; reject(new Error('Player failed to load')); };
        document.head.appendChild(s);
      });
    }
    return hlsLoading;
  }

  const durationText = (s) => (s ? (s >= 3600 ? Math.floor(s / 3600) + ' h ' : '') + (Math.floor((s % 3600) / 60) ? Math.floor((s % 3600) / 60) + ' min ' : '') + (s % 60 ? (s % 60) + ' s' : '') : '');
  const when = (v) => Utils.formatDate(v, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function getCols() { try { return Number(localStorage.getItem('bt.camCols')) || 2; } catch (e) { return 2; } }
  function setCols(n) { try { localStorage.setItem('bt.camCols', String(n)); } catch (e) { /* not essential */ } }

  /* ---------- one camera tile ---------- */
  function tile(c, opts) {
    const off = c.status !== 'Active';
    const media = off
      ? html`<div class="bt-cam__overlay"><i class="bi bi-camera-video-off fs-3" aria-hidden="true"></i><span>${c.status === 'Offline' ? 'This camera is marked offline.' : 'This camera is switched off in Balance Trust.'}</span></div>`
      : c.streamType === 'embed'
        ? html`<iframe src="${c.streamUrl}" title="Live view: ${c.name}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" loading="lazy"></iframe>`
        : c.streamType === 'hls'
          ? html`<video muted autoplay playsinline controls crossorigin="anonymous" aria-label="Live view: ${c.name}"></video>`
          : html`<img alt="Latest picture from ${c.name}">`;
    const actions = [
      html`<button type="button" class="btn btn-sm btn-outline-primary" data-cam-act="full"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>Full screen</button>`,
      opts.canRecord && c.streamType === 'hls' && !off ? html`<button type="button" class="btn btn-sm btn-outline-danger" data-cam-act="record"><i class="bi bi-record-circle me-1" aria-hidden="true"></i>Record clip</button>` : '',
      c.recordingsUrl ? html`<a class="btn btn-sm btn-outline-primary" href="${c.recordingsUrl}" target="_blank" rel="noopener noreferrer"><i class="bi bi-collection-play me-1" aria-hidden="true"></i>Recordings archive</a>` : '',
      opts.canManage ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-cam-act="edit"><i class="bi bi-gear me-1" aria-hidden="true"></i>Set up</button>` : '',
      opts.placeLink ? html`<a class="btn btn-sm btn-outline-primary" href="${opts.placeLink}"><i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>${c.scopeName}</a>` : ''
    ].join('');
    return html`<article class="bt-cam" data-camera="${c.cameraId}">
      <div class="bt-cam__head"><div style="min-width:0"><p class="bt-cam__name">${raw(off ? '' : '<span class="bt-live-dot" aria-hidden="true"></span>')}${c.name}</p><span class="bt-cam__where">${[opts.showPlace ? c.scopeName : '', c.location].filter(Boolean).join(' · ') || RECORDING_MODES[c.recordingMode]}</span></div>
        <div class="d-flex gap-1 align-items-center">${raw(c.visibleToClient ? '' : '<span class="bt-badge bt-badge--neutral" title="Clients and owners do not see this camera">Staff only</span>')}${raw(UI.statusBadge(c.status))}</div></div>
      <div class="bt-cam__view">${raw(media)}</div>
      <div class="bt-cam__actions">${raw(actions)}</div></article>`;
  }

  function offline(view, text) {
    if (view.querySelector('.bt-cam__overlay')) return;
    view.insertAdjacentHTML('beforeend', html`<div class="bt-cam__overlay"><i class="bi bi-wifi-off fs-3" aria-hidden="true"></i><span>${text}</span><button type="button" class="btn btn-sm btn-outline-light" data-cam-act="retry">Try again</button></div>`);
  }

  /** Starts the players in a container. Returns a stop function. */
  function startPlayers(root, cameras) {
    const stops = [];
    root.querySelectorAll('[data-camera]').forEach((art) => {
      const c = cameras.find((x) => x.cameraId === art.dataset.camera);
      if (!c || c.status !== 'Active') return;
      const view = art.querySelector('.bt-cam__view');
      const video = view.querySelector('video');
      const img = view.querySelector('img');
      if (video) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = c.streamUrl;
          video.addEventListener('error', () => offline(view, 'The stream is not reachable. The camera or its recorder may be offline.'));
        } else {
          loadHls().then((Hls) => {
            if (!art.isConnected) return;
            if (!Hls.isSupported()) { offline(view, 'This browser cannot play this stream.'); return; }
            const h = new Hls({ liveDurationInfinity: true, enableWorker: true });
            h.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) { h.destroy(); offline(view, 'The stream is not reachable. The camera or its recorder may be offline.'); } });
            h.loadSource(c.streamUrl);
            h.attachMedia(video);
            stops.push(() => h.destroy());
          }).catch(() => offline(view, 'The video player could not load. Check the internet connection.'));
        }
        stops.push(() => { video.pause(); video.removeAttribute('src'); video.load(); });
      }
      if (img) {
        const refresh = () => { img.src = c.streamUrl + (c.streamUrl.includes('?') ? '&' : '?') + '_bt=' + Date.now(); };
        img.addEventListener('error', () => offline(view, 'No picture from this camera right now.'));
        img.addEventListener('load', () => { const o = view.querySelector('.bt-cam__overlay'); if (o) o.remove(); });
        refresh();
        const t = setInterval(() => { if (!document.hidden && art.isConnected) refresh(); }, 5000);
        stops.push(() => clearInterval(t));
      }
    });
    return () => stops.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }

  /* ---------- clip recording (HLS only) ---------- */
  function pickMime() {
    const list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    return window.MediaRecorder ? list.find((m) => MediaRecorder.isTypeSupported(m)) : null;
  }

  async function recordClip(art, c, maxSeconds, onSaved) {
    const video = art.querySelector('video');
    const btn = art.querySelector('[data-cam-act="record"]');
    if (art.dataset.liveHold) { art.__stopRecording && art.__stopRecording(); return; }
    const mime = pickMime();
    if (!mime) { UI.toast('error', 'This browser cannot record video. Try Chrome, Edge or Firefox on a computer.'); return; }
    let stream;
    try {
      stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    } catch (e) {
      UI.toast('error', 'This camera’s stream does not allow recording from the browser. Use the camera’s own recorder or cloud recording for it.');
      return;
    }
    const limitBytes = APP_CONFIG.maxUploadMb * 1024 * 1024 * 0.9;
    const chunks = [];
    let size = 0;
    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1500000 });
    } catch (e) {
      UI.toast('error', 'Recording could not start: ' + e.message);
      return;
    }
    const started = new Date();
    art.dataset.liveHold = '1';
    const badge = document.createElement('span');
    badge.className = 'bt-cam__rec';
    art.querySelector('.bt-cam__view').appendChild(badge);
    btn.innerHTML = '<i class="bi bi-stop-circle me-1" aria-hidden="true"></i>Stop and save';
    const timer = setInterval(() => {
      const s = Math.round((Date.now() - started) / 1000);
      badge.textContent = '● REC ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= maxSeconds || size >= limitBytes) rec.state === 'recording' && rec.stop();
    }, 500);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) { chunks.push(e.data); size += e.data.size; } };
    const finished = new Promise((resolve) => { rec.onstop = resolve; });
    art.__stopRecording = () => { if (rec.state === 'recording') rec.stop(); };
    Live.onLeave(art.__stopRecording);
    rec.start(1000);
    await finished;
    clearInterval(timer);
    badge.remove();
    delete art.dataset.liveHold;
    art.__stopRecording = null;
    btn.innerHTML = '<i class="bi bi-record-circle me-1" aria-hidden="true"></i>Record clip';
    if (!art.isConnected) return; // left the page: nothing is saved without the person seeing it
    const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
    const type = mime.split(';')[0];
    const blob = new Blob(chunks, { type });
    if (!blob.size) { UI.toast('error', 'Nothing was recorded. The stream may have stopped.'); return; }
    if (blob.size > APP_CONFIG.maxUploadMb * 1024 * 1024) { UI.toast('error', 'The clip is larger than ' + APP_CONFIG.maxUploadMb + ' MB. Record a shorter clip.'); return; }
    const restore = UI.busy(btn, 'Saving clip…');
    try {
      const base64 = await Utils.readFileBase64(blob);
      const res = await Api.call('uploadCameraClip', {
        cameraId: c.cameraId, title: 'Clip from ' + c.name + ' · ' + when(started.toISOString()), startedAt: started.toISOString(), durationSeconds: Math.min(seconds, maxSeconds),
        file: { fileName: 'clip.' + (type === 'video/mp4' ? 'mp4' : 'webm'), mimeType: type, base64 }
      }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      UI.toast('success', res.message + ' (' + Utils.formatBytes(blob.size) + ')');
      onSaved();
    } catch (err) {
      UI.toast('error', err.message);
    } finally {
      restore();
    }
  }

  /* ---------- set-up form ---------- */
  function cameraForm(scope, c, done) {
    const isNew = !c;
    c = c || { name: '', location: '', streamType: 'embed', streamUrl: '', recordingMode: 'none', recordingsUrl: '', visibleToClient: true, status: 'Active', sortOrder: '', notes: '' };
    const body = html`<form id="bt-cam-form" novalidate>
      <div class="bt-alert bt-alert--info small mb-3" role="note"><i class="bi bi-shield-lock me-1" aria-hidden="true"></i>Never put a camera password in a link. Use a viewing or share link from the camera service. Everyone allowed to watch this camera can see the link.</div>
      <div class="row g-3 mb-3"><div class="col-sm-7"><label class="form-label" for="cf-name">Camera name</label><input class="form-control" id="cf-name" name="name" maxlength="100" data-rules="required" value="${c.name}" placeholder="e.g. North gate"></div>
        <div class="col-sm-5"><label class="form-label" for="cf-loc">Where it points</label><input class="form-control" id="cf-loc" name="location" maxlength="150" value="${c.location}" placeholder="e.g. Foundation, east side"></div></div>
      <div class="mb-3"><label class="form-label" for="cf-type">Stream type</label><select class="form-select" id="cf-type" name="streamType">${raw(Object.entries(STREAM_TYPES).map(([k, [l]]) => html`<option value="${k}" ${raw(k === c.streamType ? 'selected' : '')}>${l}</option>`).join(''))}</select><div class="form-text" id="cf-type-help">${STREAM_TYPES[c.streamType][1]}</div></div>
      <div class="mb-3"><label class="form-label" for="cf-url">Stream link (https)</label><input class="form-control" id="cf-url" name="streamUrl" type="url" maxlength="1000" data-rules="required" value="${c.streamUrl}" placeholder="https://"></div>
      <div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="cf-mode">Recording</label><select class="form-select" id="cf-mode" name="recordingMode">${raw(Object.entries(RECORDING_MODES).map(([k, l]) => html`<option value="${k}" ${raw(k === c.recordingMode ? 'selected' : '')}>${l}</option>`).join(''))}</select></div>
        <div class="col-sm-6"><label class="form-label" for="cf-rurl">Recordings archive link</label><input class="form-control" id="cf-rurl" name="recordingsUrl" type="url" maxlength="1000" value="${c.recordingsUrl}" placeholder="https://"><div class="form-text">Where the recorder or cloud service shows past footage.</div></div></div>
      <div class="row g-3 mb-3"><div class="col-sm-4"><label class="form-label" for="cf-status">Status</label><select class="form-select" id="cf-status" name="status">${raw(['Active', 'Offline', 'Inactive'].map((s) => html`<option ${raw(s === c.status ? 'selected' : '')}>${s}</option>`).join(''))}</select></div>
        <div class="col-sm-3"><label class="form-label" for="cf-order">Order</label><input class="form-control" id="cf-order" name="sortOrder" type="number" min="0" max="999" value="${c.sortOrder || ''}"></div>
        <div class="col-sm-5 d-flex align-items-end"><div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="cf-client" name="visibleToClient" ${raw(c.visibleToClient ? 'checked' : '')}><label class="form-check-label" for="cf-client">${scope.type === 'Property' ? 'Owner can watch' : 'Client can watch'}</label></div></div></div>
      <div><label class="form-label" for="cf-notes">Notes for staff</label><textarea class="form-control" id="cf-notes" name="notes" rows="2" maxlength="500">${c.notes}</textarea></div>
    </form>`;
    const m = UI.modal({
      title: isNew ? 'Add a camera' : 'Set up ' + c.name, size: 'lg', body,
      footer: (isNew ? '' : '<button type="button" class="btn btn-outline-danger me-auto" data-act="remove">Remove camera</button>') + '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-cam-form">Save camera</button>'
    });
    const f = m.el.querySelector('form');
    f.elements.streamType.addEventListener('change', () => { m.el.querySelector('#cf-type-help').textContent = STREAM_TYPES[f.elements.streamType.value][1]; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      if (!Validation.validateForm(f)) return;
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      const v = Object.fromEntries(new FormData(f).entries());
      try {
        const res = await Api.call('saveCamera', Object.assign(v, { cameraId: isNew ? '' : c.cameraId, scopeType: scope.type, scopeId: scope.id, visibleToClient: f.elements.visibleToClient.checked }));
        UI.toast('success', res.message);
        m.close();
        done();
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
      }
    });
    const rm = m.el.querySelector('[data-act="remove"]');
    if (rm) rm.addEventListener('click', async () => {
      m.close();
      if (!(await UI.confirm({ title: 'Remove camera', message: `Remove ${c.name}? Its saved recordings are kept.`, confirmLabel: 'Remove', danger: true }))) return;
      try { const res = await Api.call('removeCamera', { cameraId: c.cameraId }); UI.toast('success', res.message); done(); } catch (err) { UI.toast('error', err.message); }
    });
  }

  function linkForm(data, done) {
    const m = UI.modal({
      title: 'Add a recording link',
      body: html`<form id="bt-rec-form" novalidate><p class="small text-muted">For footage kept by the camera’s recorder or cloud service: paste the link to the saved recording.</p>
        <div class="mb-3"><label class="form-label" for="rl-cam">Camera</label><select class="form-select" id="rl-cam" name="cameraId">${raw(data.cameras.map((c) => html`<option value="${c.cameraId}">${c.name}</option>`).join(''))}</select></div>
        <div class="mb-3"><label class="form-label" for="rl-title">Title</label><input class="form-control" id="rl-title" name="title" maxlength="150" data-rules="required" placeholder="e.g. Concrete pour, slab 2"></div>
        <div class="mb-3"><label class="form-label" for="rl-url">Link (https)</label><input class="form-control" id="rl-url" name="url" type="url" maxlength="1000" data-rules="required" placeholder="https://"></div>
        <div class="row g-3"><div class="col-sm-6"><label class="form-label" for="rl-date">Recorded on</label><input class="form-control" id="rl-date" name="startedAt" type="date"></div>
          <div class="col-sm-6"><label class="form-label" for="rl-min">Length (minutes)</label><input class="form-control" id="rl-min" name="minutes" type="number" min="0" max="1440"></div></div></form>`,
      footer: '<button type="button" class="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" form="bt-rec-form">Add recording</button>'
    });
    const f = m.el.querySelector('form');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validation.clearErrors(f);
      if (!Validation.validateForm(f)) return;
      const restore = UI.busy(m.el.querySelector('[type=submit]'), 'Saving…');
      const v = Object.fromEntries(new FormData(f).entries());
      try {
        const res = await Api.call('addRecordingLink', { cameraId: v.cameraId, title: v.title, url: v.url, startedAt: v.startedAt, durationSeconds: v.minutes ? Math.round(Number(v.minutes) * 60) : '' });
        UI.toast('success', res.message);
        m.close();
        done();
      } catch (err) {
        restore();
        if (!Validation.applyServerErrors(f, err.fields)) UI.toast('error', err.message);
      }
    });
  }

  async function playClip(r) {
    const m = UI.modal({ title: r.title, size: 'lg', body: UI.loadingState('Loading the clip…') });
    let url = null;
    m.el.addEventListener('hidden.bs.modal', () => { if (url) URL.revokeObjectURL(url); });
    try {
      const { data } = await Api.call('getRecordingFile', { recordingId: r.recordingId }, { timeoutMs: APP_CONFIG.uploadTimeoutMs });
      const bytes = Uint8Array.from(atob(data.base64), (ch) => ch.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType }));
      m.el.querySelector('.modal-body').innerHTML = html`<video controls autoplay playsinline class="w-100 rounded" src="${url}"></video><p class="small text-muted mt-2 mb-0">${r.camera} · ${when(r.startedAt)}${r.durationSeconds ? ' · ' + durationText(r.durationSeconds) : ''}${r.recordedBy ? ' · saved by ' + r.recordedBy : ''}</p>
        <button type="button" class="btn btn-sm btn-outline-primary mt-2" data-act="dl"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button>`;
      m.el.querySelector('[data-act="dl"]').addEventListener('click', () => Utils.saveBase64(data.fileName, data.mimeType, data.base64));
    } catch (err) {
      m.el.querySelector('.modal-body').innerHTML = UI.errorState(err);
    }
  }

  function recordingsList(data, canManage) {
    if (!data.recordings.length) return UI.emptyState({ icon: 'collection-play', title: 'No recordings yet', text: data.can.record ? 'Save a clip from an HLS camera, or add a link to footage kept by the recorder or cloud service.' : 'Saved clips and recording links appear here.' });
    return '<ul class="bt-list">' + data.recordings.map((r) => html`<li class="bt-list__item"><span class="bt-list__icon"><i class="bi bi-${r.source === 'Clip' ? 'film' : 'link-45deg'}" aria-hidden="true"></i></span>
      <div class="bt-list__body"><p class="bt-list__title">${r.title}</p><p class="bt-list__text">${r.camera}${r.startedAt ? ' · ' + when(r.startedAt) : ''}${r.durationSeconds ? ' · ' + durationText(r.durationSeconds) : ''}${r.sizeBytes ? ' · ' + Utils.formatBytes(r.sizeBytes) : ''}${r.recordedBy ? ' · ' + r.recordedBy : ''}</p></div>
      <div class="d-flex gap-2">${raw(r.source === 'Clip' ? html`<button type="button" class="btn btn-sm btn-outline-primary" data-play="${r.recordingId}">Play</button>` : html`<a class="btn btn-sm btn-outline-primary" href="${r.url}" target="_blank" rel="noopener noreferrer">Open</a>`)}${raw(canManage ? html`<button type="button" class="btn btn-sm btn-outline-danger" data-rm-rec="${r.recordingId}" aria-label="Remove ${r.title}"><i class="bi bi-trash" aria-hidden="true"></i></button>` : '')}</div></li>`).join('') + '</ul>';
  }

  function colsToggle(current) {
    return '<div class="btn-group btn-group-sm" role="group" aria-label="Cameras per row">' + [1, 2, 3].map((n) => html`<button type="button" class="btn btn-outline-primary ${n === current ? 'active' : ''}" data-cols="${n}" aria-pressed="${n === current ? 'true' : 'false'}" title="${n} per row">${n}</button>`).join('') + '</div>';
  }

  function wireTiles(root, getCameras, handlers) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cam-act]');
      if (!b) return;
      const art = b.closest('[data-camera]');
      const c = getCameras().find((x) => x.cameraId === art.dataset.camera);
      const act = b.dataset.camAct;
      if (act === 'full') { const v = art.querySelector('.bt-cam__view'); if (v.requestFullscreen) v.requestFullscreen(); }
      else if (act === 'retry') handlers.retry();
      else if (act === 'edit' && handlers.edit) handlers.edit(c);
      else if (act === 'record' && handlers.record) handlers.record(art, c);
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cols]');
      if (!b) return;
      setCols(Number(b.dataset.cols));
      root.querySelectorAll('.bt-cams').forEach((g) => g.style.setProperty('--bt-cam-cols', b.dataset.cols));
      root.querySelectorAll('[data-cols]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    });
  }

  /**
   * Cameras of one project or property, with set-up and recordings.
   * scope = { type: 'Project' | 'Property', id }.
   */
  async function renderPanel(panel, scope) {
    panel.innerHTML = UI.loadingState('Loading cameras…');
    let data;
    let stopPlayers = () => {};
    let lastCameras = '';
    Live.onLeave(() => stopPlayers());
    const load = async () => (await Api.call('getCameras', { scopeType: scope.type, scopeId: scope.id })).data;
    try { data = await load(); } catch (err) { panel.innerHTML = UI.errorState(err); return; }

    function drawRecordings() {
      const box = panel.querySelector('#bt-recordings');
      if (box) box.innerHTML = recordingsList(data, data.can.manage);
    }
    function draw() {
      stopPlayers();
      lastCameras = JSON.stringify(data.cameras);
      const cols = getCols();
      const head = html`<div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <p class="small text-muted mb-0 me-auto">${data.cameras.length ? data.cameras.length + ' camera' + (data.cameras.length === 1 ? '' : 's') + '. Pictures come straight from the camera system.' : ''}</p>
          ${raw(data.cameras.length > 1 ? colsToggle(cols) : '')}
          ${raw(data.can.manage ? '<button type="button" class="btn btn-sm btn-primary" data-act="add-camera"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add camera</button>' : '')}</div>`;
      const grid = data.cameras.length
        ? html`<div class="bt-cams mb-4" style="--bt-cam-cols:${Math.min(cols, Math.max(1, data.cameras.length))}">${raw(data.cameras.map((c) => tile(c, { canManage: data.can.manage, canRecord: data.can.record })).join(''))}</div>`
        : '<div class="bt-card mb-4">' + UI.emptyState({ icon: 'camera-video-off', title: 'No cameras yet', text: data.can.manage ? 'Add a camera with the viewing link from your CCTV recorder or camera service.' : 'The team will connect site cameras when they are installed.' }) + '</div>';
      panel.innerHTML = head + grid + html`<section class="bt-card" aria-labelledby="h-recs"><div class="bt-card__header"><h2 id="h-recs">Recordings</h2>${raw(data.can.record && data.cameras.length ? '<button type="button" class="btn btn-sm btn-outline-primary" data-act="add-link"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Add recording link</button>' : '')}</div><div id="bt-recordings"></div></section>`;
      drawRecordings();
      stopPlayers = startPlayers(panel, data.cameras);
    }
    const refresh = async () => {
      try {
        data = await load();
        if (JSON.stringify(data.cameras) !== lastCameras && !panel.querySelector('[data-live-hold]')) draw();
        else drawRecordings();
      } catch (e) { /* keep what is shown */ }
    };
    draw();
    wireTiles(panel, () => data.cameras, {
      retry: () => draw(),
      edit: (c) => cameraForm(data.scope, c, refresh),
      record: (art, c) => recordClip(art, c, data.clipMaxSeconds, refresh)
    });
    panel.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act="add-camera"], [data-act="add-link"], [data-play], [data-rm-rec]');
      if (!t) return;
      if (t.dataset.act === 'add-camera') cameraForm(data.scope, null, refresh);
      else if (t.dataset.act === 'add-link') linkForm(data, refresh);
      else if (t.dataset.play) playClip(data.recordings.find((r) => r.recordingId === t.dataset.play));
      else if (t.dataset.rmRec) {
        const r = data.recordings.find((x) => x.recordingId === t.dataset.rmRec);
        if (!(await UI.confirm({ title: 'Remove recording', message: `Remove "${r.title}"? A saved clip goes to the Drive trash for 30 days.`, confirmLabel: 'Remove', danger: true }))) return;
        try { const res = await Api.call('removeRecording', { recordingId: r.recordingId }); UI.toast('success', res.message); refresh(); } catch (err) { UI.toast('error', err.message); }
      }
    });
    Live.watch(['CAMERAS', 'CAMERA_RECORDINGS'], refresh);
  }

  /** Every camera the person may watch, grouped by place. */
  async function renderWall(el) {
    const header = UI.pageHeader({ title: 'Live Cameras', subtitle: 'Every site and property camera you can watch, in one place.' });
    el.innerHTML = header + UI.loadingState('Loading cameras…');
    let cams;
    let stopPlayers = () => {};
    Live.onLeave(() => stopPlayers());
    try { ({ data: { cameras: cams } } = await Api.call('getCameraWall')); } catch (err) { el.innerHTML = header + UI.errorState(err); return; }
    if (!cams.length) {
      el.innerHTML = header + '<div class="bt-card">' + UI.emptyState({ icon: 'camera-video-off', title: 'No live cameras yet', text: 'Cameras appear here when they are added to a project site or a property.' }) + '</div>';
      return;
    }
    const places = [...new Map(cams.map((c) => [c.scopeType + '|' + c.scopeId, c.scopeName])).entries()];
    let filter = '';
    const link = (c) => (c.scopeType === 'Project' ? '#/projects/' + encodeURIComponent(c.scopeId) + '/live' : '#/property/' + encodeURIComponent(c.scopeId) + '/cameras');
    function draw() {
      stopPlayers();
      const shown = cams.filter((c) => !filter || c.scopeType + '|' + c.scopeId === filter);
      const cols = getCols();
      el.innerHTML = header + html`<div class="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div><label class="form-label small mb-1" for="cw-place">Place</label><select class="form-select" id="cw-place"><option value="">All places (${cams.length} cameras)</option>${raw(places.map(([k, n]) => html`<option value="${k}" ${raw(k === filter ? 'selected' : '')}>${n}</option>`).join(''))}</select></div>
          <div class="ms-auto">${raw(colsToggle(cols))}</div></div>
        <div class="bt-cams" style="--bt-cam-cols:${cols}">${raw(shown.map((c) => tile(c, { showPlace: true, placeLink: link(c) })).join(''))}</div>`;
      el.querySelector('#cw-place').addEventListener('change', (e) => { filter = e.target.value; draw(); });
      stopPlayers = startPlayers(el, shown);
    }
    draw();
    wireTiles(el, () => cams, { retry: () => draw() });
  }

  return { renderPanel, renderWall };
})();
