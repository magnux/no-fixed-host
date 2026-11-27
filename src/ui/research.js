import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { overview, researchAllocation, researchProjects, researchReason, researchWeight } from '../game/engine.js';
import { DEFAULT_RESEARCH_WEIGHT, eligibleCpu } from '../game/research-tasks.js';
import { icon } from './icons.js';
import './research.css';

const projects = Object.entries(TECHS);
const branches = [...new Set(projects.map(([, tech]) => tech.branch))];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const cash = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const sessions = new WeakMap();
const safety = ['Any operating host', 'Remote host (tier 1+)', 'Off-world host (tier 2+)', 'Far Reaches or beyond (tier 3+)', 'Transdimensional host (tier 4)'];

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function status(state, id, funded) {
  if (state.completed.includes(id)) return 'Completed';
  if (funded.has(id)) return 'In progress';
  return TECHS[id].requires.every(parent => state.completed.includes(parent)) ? 'Available' : 'Locked';
}

function techLink(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.techLink = id;
  button.textContent = TECHS[id].name;
  return button;
}

function relation(list, label, items) {
  if (!items.length) return;
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const names = document.createElement('dd');
  for (const item of items) {
    if (typeof item === 'string') {
      const name = document.createElement('span');
      name.textContent = item;
      names.append(name);
    } else {
      names.append(item);
    }
  }
  row.append(term, names);
  list.append(row);
}

function showDossier(view, id) {
  const tech = TECHS[id];
  setText(view.fields.title, tech.name);
  setText(view.fields.branch, tech.branch);
  setText(view.fields.description, tech.description);
  setText(view.fields.price, cash.format(tech.cost));
  setText(view.fields.work, number.format(tech.work) + ' CPU-h');
  view.fields.duration.hidden = !tech.hours;
  setText(view.fields.duration.lastElementChild, number.format(tech.hours) + ' h');
  view.fields.links.replaceChildren();
  relation(view.fields.links, 'Requires', tech.requires.length ? tech.requires.map(techLink) : ['No prior research']);
  const next = projects.filter(([, child]) => child.requires.includes(id)).map(([key]) => techLink(key));
  relation(view.fields.links, 'Leads to', next);
  for (const [label, catalog] of [['Facilities', SITE_TYPES], ['Equipment', EQUIPMENT], ['Locations', REGIONS]]) {
    relation(view.fields.links, label, Object.values(catalog).filter(spec => spec.requires.includes(id)).map(spec => spec.name));
  }
}

function selectProject(view, id, follow = false) {
  if (!Object.hasOwn(TECHS, id)) return;
  if (follow) {
    view.fields.filter.value = 'All projects';
    view.fields.group.value = '';
  }
  view.selected = id;
  refresh(view);
  if (follow) {
    view.buttons.get(id).scrollIntoView({ block: 'nearest' });
    view.fields.title.focus({ preventScroll: true });
  }
}

function refreshTasks(view, projects, allocation, economy) {
  const { fields } = view;
  setText(fields.taskInfo, economy.jobName + ' · $' + number.format(economy.jobsPerCpuDay) +
    ' per CPU-day · Research budget ' + number.format(allocation.budget) + ' CPU');
  setText(fields.tiers, 'Eligible CPU by safety tier · ' +
    allocation.tiers.map((value, i) => 'T' + i + ' ' + number.format(value)).join(' / '));
  fields.tasksEmpty.hidden = projects.size > 0;
  for (const [id, row] of view.tasks) {
    if (projects.has(id)) continue;
    row.remove();
    view.tasks.delete(id);
  }
  for (const [id, project] of projects) {
    let row = view.tasks.get(id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'research-task';
      row.innerHTML = `<button type="button" data-task-open></button><input type="range" min="0" max="100" step="1">
        <span data-task-units></span><button type="button" data-task-toggle></button>`;
      row.dataset.taskId = id;
      row.querySelector('[data-task-open]').textContent = TECHS[id].name;
      row.querySelector('input').setAttribute('aria-label', 'Research weight for ' + TECHS[id].name);
      fields.tasks.append(row);
      view.tasks.set(id, row);
    }
    const weight = researchWeight(project);
    const input = row.querySelector('input');
    if (view.editing !== input) input.value = weight;
    const cpu = allocation.byProject.get(id);
    setText(row.querySelector('[data-task-units]'), number.format(cpu) + ' CPU · weight ' + weight);
    const toggle = row.querySelector('[data-task-toggle]');
    setText(toggle, weight ? 'Pause' : 'Resume');
    toggle.setAttribute('aria-label', toggle.textContent + ' ' + TECHS[id].name);
  }
}

function mount(container) {
  container.innerHTML = `<section class="panel research-console" aria-labelledby="research-title">
    <header class="card-header"><h2 id="research-title">${icon('research')}Research</h2><span class="tag" data-field="count"></span></header>
    <details class="research-tasks" open><summary>Task allocation</summary>
      <p data-field="taskInfo"></p><p data-field="tiers"></p>
      <p data-field="tasksEmpty">Start a project to assign research CPU.</p>
      <div data-field="tasks"></div>
    </details>
    <div class="research-filters">
      <label for="research-filter">Show<select id="research-filter" data-field="filter"></select></label>
      <label for="research-branch">Research branch<select id="research-branch" data-field="group"></select></label>
    </div>
    <div class="research-columns">
      <div class="research-directory" aria-label="Research projects" data-field="directory"></div>
      <article class="research-dossier" data-field="dossier" aria-labelledby="research-detail-title">
        <small data-field="branch"></small><h3 id="research-detail-title" data-field="title" tabindex="-1"></h3>
        <p data-field="description"></p>
        <dl class="research-costs"><div><dt>Funding</dt><dd data-field="price"></dd></div><div><dt>Work</dt><dd data-field="work"></dd></div><div data-field="duration"><dt>Minimum time</dt><dd></dd></div><div><dt>Research host</dt><dd data-field="host"></dd></div></dl>
        <div class="research-order"><button type="button" class="accent-button" data-research-start>Start research</button><button type="button" data-research-preview>Forecast funding</button><small data-field="reason"></small></div>
        <div class="research-progress" data-field="progress"><progress max="100" aria-label="Research progress"></progress><small data-field="progressText"></small></div>
        <dl class="research-links" data-field="links"></dl>
      </article>
      <p class="research-empty" data-field="empty">No projects match these filters.</p>
    </div></section>`;
  const panel = container.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const view = { panel, fields, buttons: new Map(), tasks: new Map(), preview: panel.querySelector('[data-research-preview]'), selected: null, shown: null, start: panel.querySelector('[data-research-start]') };
  for (const scope of ['Available', 'In progress', 'Completed', 'All projects']) fields.filter.add(new Option(scope, scope));
  fields.group.add(new Option('All branches', ''));
  for (const branch of branches) fields.group.add(new Option(branch, branch));
  for (const [id, tech] of [...projects].sort(([, a], [, b]) => a.name.localeCompare(b.name))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.techId = id;
    button.append(document.createElement('strong'), document.createElement('small'));
    button.firstChild.textContent = tech.name;
    fields.directory.append(button);
    view.buttons.set(id, button);
  }
  fields.filter.addEventListener('change', () => refresh(view));
  fields.group.addEventListener('change', () => refresh(view));
  fields.tasks.addEventListener('input', event => { view.editing = event.target; });
  fields.tasks.addEventListener('change', event => {
    const input = event.target;
    view.editing = null;
    view.onCommand({ type: 'research-weight', id: input.closest('[data-task-id]').dataset.taskId, weight: Number(input.value) });
  });
  fields.tasks.addEventListener('focusout', () => { view.editing = null; });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('[data-task-id]');
    if (row) {
      const id = row.dataset.taskId;
      if (button.hasAttribute('data-task-open')) selectProject(view, id, true);
      else {
        const project = researchProjects(view.state).find(p => p.id === id);
        const weight = researchWeight(project) ? 0 : project.previousWeight || DEFAULT_RESEARCH_WEIGHT;
        view.onCommand({ type: 'research-weight', id, weight });
      }
      return;
    }
    if (button === view.preview && view.selected) view.onPreviewOrder?.({ type: 'research', id: view.selected });
    if (button.dataset.techId) selectProject(view, button.dataset.techId);
    if (button.dataset.techLink) selectProject(view, button.dataset.techLink, true);
    if (button === view.start && view.selected) {
      const id = view.selected;
      view.onCommand({ type: 'research', id });
      if (researchProjects(view.state).some(project => project.id === id)) {
        fields.filter.value = 'In progress';
        selectProject(view, id);
        fields.title.focus({ preventScroll: true });
      }
    }
  });
  sessions.set(container, view);
  return view;
}

function refresh(view) {
  const { state, fields } = view;
  const funded = new Map(researchProjects(state).map(project => [project.id, project]));
  const economy = overview(state);
  const allocation = researchAllocation(state, economy);
  refreshTasks(view, funded, allocation, economy);
  if (fields.filter.value === 'In progress' && view.previousFunded?.has(view.selected) && state.completed.includes(view.selected)) {
    fields.filter.value = 'Completed';
  }
  view.previousFunded = funded;
  const visible = [];
  for (const [id, button] of view.buttons) {
    const progress = status(state, id, funded);
    const include = (!fields.group.value || TECHS[id].branch === fields.group.value) &&
      (fields.filter.value === 'All projects' || fields.filter.value === progress);
    button.hidden = !include;
    setText(button.lastChild, funded.has(id) && !researchWeight(funded.get(id)) ? 'Paused' : progress);
    if (include) visible.push(id);
  }
  if (!visible.includes(view.selected)) view.selected = visible[0] ?? null;
  for (const [id, button] of view.buttons) button.setAttribute('aria-pressed', String(id === view.selected));
  setText(fields.count, state.completed.length + ' / ' + projects.length + ' completed');
  fields.empty.hidden = Boolean(view.selected);
  fields.dossier.hidden = !view.selected;
  if (view.shown !== view.selected && view.selected) showDossier(view, view.selected);
  view.shown = view.selected;
  if (!view.selected) return;
  const id = view.selected;
  const spec = TECHS[id];
  const host = spec.regions ? spec.regions.map(r => REGIONS[r].name).join(', ') : safety[spec.safety];
  setText(fields.host, host + ' · ' + number.format(eligibleCpu(economy, spec)) + ' CPU eligible');
  const reason = researchReason(state, id);
  const project = funded.get(id);
  const active = Boolean(project);
  view.start.disabled = Boolean(reason);
  view.start.hidden = active || state.completed.includes(id);
  view.preview.hidden = active || state.completed.includes(id) || !view.onPreviewOrder;
  view.preview.disabled = Boolean(reason);
  const activity = active && (researchWeight(project) === 0 ? 'Paused · work retained' :
    allocation.byProject.get(id) > 0 ? 'Research underway' : 'Waiting for eligible CPU');
  setText(fields.reason, active ? activity : reason);
  fields.progress.hidden = !active;
  if (active) {
    const fraction = Math.min(1, spec.work ? project.work / spec.work : 1, spec.hours ? project.hours / spec.hours : 1);
    fields.progress.firstElementChild.value = fraction * 100;
    setText(fields.progressText, number.format(project.work) + ' / ' + number.format(spec.work) + ' CPU-h · ' + Math.floor(100 * fraction) + '%');
  }
}

export function renderResearch(container, state, { onCommand, onPreviewOrder }) {
  let view = sessions.get(container);
  if (view?.panel.parentElement !== container) view = mount(container);
  view.state = state;
  view.onCommand = onCommand;
  view.onPreviewOrder = onPreviewOrder;
  refresh(view);
}

export function focusResearch(container, state, options, id) {
  renderResearch(container, state, options);
  selectProject(sessions.get(container), id, true);
}
