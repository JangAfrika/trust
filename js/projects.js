/**
 * Balance Trust — project lists and the project header. The full workspace
 * (stages, media, authorization, documents, finance) builds on this module.
 */
const Projects = (() => {
  const { html, raw } = Utils;
  const FILTERS = { all: 'All Projects', active: 'Active', completed: 'Completed', archived: 'Archived' };

  async function renderList(el, filter) {
    filter = FILTERS[filter] ? filter : 'all';
    const header = UI.pageHeader({ title: FILTERS[filter], subtitle: 'Projects you own or are assigned to.' });
    el.innerHTML = header + UI.skeletonCards(3, '12rem');
    let page;
    try {
      ({ data: page } = await Api.call('getProjects', { filter, pageSize: 48 }));
    } catch (err) {
      el.innerHTML = header + UI.errorState(err, 'bt-retry');
      document.getElementById('bt-retry').addEventListener('click', () => renderList(el, filter));
      return;
    }
    if (!page.items.length) {
      el.innerHTML = header + '<div class="bt-card">' + UI.emptyState(filter === 'all'
        ? { icon: 'buildings', title: 'No projects yet', text: 'You have not created or purchased a project block.', actionHref: App.can('block.purchase') ? '#/blocks' : '', actionLabel: 'Buy a Block' }
        : { icon: 'funnel', title: 'Nothing here', text: `You have no ${FILTERS[filter].toLowerCase()} projects.`, actionHref: '#/projects', actionLabel: 'View all projects' }) + '</div>';
      return;
    }
    el.innerHTML = header + '<div class="bt-grid bt-grid--cards">' + page.items.map(UI.projectCard).join('') + '</div>' +
      (page.pages > 1 ? html`<p class="text-muted small mt-3">Showing ${page.items.length} of ${page.total} projects.</p>` : '');
  }

  async function renderOne(el, projectId) {
    el.innerHTML = UI.loadingState('Loading project…');
    let p;
    try {
      ({ data: p } = await Api.call('getProject', { projectId }));
    } catch (err) {
      el.innerHTML = err.code === 'NOT_FOUND'
        ? '<div class="bt-card">' + UI.emptyState({ icon: 'search', title: 'Project not found', text: 'This project does not exist or you do not have access to it.', actionHref: '#/projects', actionLabel: 'Back to projects' }) + '</div>'
        : UI.errorState(err);
      return;
    }
    document.getElementById('bt-page-title').textContent = p.name;
    el.innerHTML = html`
      <div class="bt-card mb-4"><div class="bt-card__body">
        <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
          <div><p class="small text-muted mb-1">${p.projectNumber || p.projectId}</p><h1 class="mb-1">${p.name}</h1>
            <div class="bt-project__meta"><span><i class="bi bi-person" aria-hidden="true"></i>${p.clientName || '—'}</span><span><i class="bi bi-geo-alt" aria-hidden="true"></i>${p.location || '—'}</span><span><i class="bi bi-boxes" aria-hidden="true"></i>${p.block || '—'}</span></div></div>
          <div>${raw(UI.statusBadge(p.status))}</div>
        </div>
        <dl class="bt-dl mb-3"><dt>Current stage</dt><dd>${p.currentStage || 'Not started'}</dd><dt>Expected completion</dt><dd>${Utils.formatDate(p.expectedEndDate)}</dd></dl>
        ${raw(UI.progressBar(p.progress, 'Overall progress'))}
      </div></div>
      <div class="bt-card">${raw(UI.emptyState({ icon: 'layers', title: 'Project workspace is being built', text: 'Stages, photos and videos, live site, documents, finance, material orders, reports, approvals and updates will appear here in the next release.' }))}</div>`;
  }

  return { renderList, renderOne };
})();
