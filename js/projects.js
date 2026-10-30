/**
 * Balance Trust — project lists. A single project opens in the workspace
 * (js/workspace.js).
 */
const Projects = (() => {
  const { html, raw } = Utils;
  const FILTERS = { all: 'All Projects', active: 'Active', completed: 'Completed', archived: 'Archived' };

  async function renderList(el, filter, heading) {
    filter = FILTERS[filter] ? filter : 'all';
    const header = UI.pageHeader(heading || { title: FILTERS[filter], subtitle: 'Projects you own or are assigned to.' });
    el.innerHTML = header + UI.skeletonCards(3, '12rem');
    let page;
    try {
      ({ data: page } = await Api.call('getProjects', { filter, pageSize: 48 }));
    } catch (err) {
      el.innerHTML = header + UI.errorState(err, 'bt-retry');
      el.querySelector('#bt-retry').addEventListener('click', () => renderList(el, filter, heading));
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

  function renderOne(el, projectId, tab) {
    return Workspace.render(el, projectId, tab);
  }

  return { renderList, renderOne };
})();
