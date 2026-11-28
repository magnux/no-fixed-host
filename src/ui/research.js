import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { overview, previewWork, researchAllocation, researchProjects, researchReason, researchCpuLimit } from '../game/engine.js';
import { eligibleCpu, taskCpuLimit, taskReservations } from '../game/research-tasks.js';
import { researchProgress, SAFETY_GUIDANCE } from '../game/research.js';
import { icon } from './icons.js';
import { navigateDirectory } from './directory-keys.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { dossierFormat, dossierLabel, localizedResearchText } from './dossier-translations.js';
import './research.css';

const projects = Object.entries(TECHS);
const sessions = new WeakMap();
const safety = ['Any operating host', 'Remote host (tier 1+)', 'Off-world host (tier 2+)', 'Far Reaches or beyond (tier 3+)', 'Transdimensional host (tier 4)'];

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function inDirectory(state, id, funded) {
  return funded.has(id) || (!state.completed.includes(id) &&
    TECHS[id].requires.every(parent => state.completed.includes(parent)));
}

function techLink(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.techLink = id;
  button.textContent = catalogLabel(TECHS[id].name);
  return button;
}

function relation(list, label, items) {
  if (!items.length) return;
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = dossierLabel(label, menuLanguage());
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
  const format = dossierFormat(view.language);
  setText(view.fields.title, catalogLabel(tech.name));
  setText(view.fields.branch, format.label(tech.branch));
  setText(view.fields.description, localizedResearchText(id, view.language));
  setText(view.fields.price, format.money(tech.cost));
  setText(view.fields.work, format.number(tech.work) + ' CPU-h');
  // Reserve the wrapped height of each changing counter using the current
  // topic, language and the same three decimal places as the live formatter.
  const longestWork = format.number(tech.work + 0.999);
  const remaining = format.label('Remaining') + ' · ';
  view.fields.workLeft.dataset.measure = remaining + longestWork + ' CPU-h';
  view.fields.cashLeft.dataset.measure = remaining + format.money(tech.cost);
  view.fields.progressText.dataset.measure = longestWork + ' / ' + format.number(tech.work) + ' CPU-h · 100%';
  view.fields.duration.hidden = !tech.hours;
  setText(view.fields.duration.lastElementChild, format.number(tech.hours) + ' h');
  setText(view.fields.guidance, view.language !== 'en' ? format.safety(tech) : tech.regions
    ? 'Run this project on an awake host with installed processors in ' + tech.regions.map(id => catalogLabel(REGIONS[id].name)).join(', ') + '.'
    : SAFETY_GUIDANCE[tech.safety]);
  view.fields.links.replaceChildren();
  relation(view.fields.links, 'Requires', tech.requires.length ? tech.requires.map(techLink) : [format.label('No prior research')]);
  const next = projects.filter(([, child]) => child.requires.includes(id)).map(([key]) => techLink(key));
  relation(view.fields.links, view.language === 'en' ? 'Leads to' : 'Required for', next);
  for (const [label, catalog] of [['Facilities', SITE_TYPES], ['Equipment', EQUIPMENT], ['Locations', REGIONS]]) {
    relation(view.fields.links, label, Object.values(catalog).filter(spec => spec.requires.includes(id)).map(spec => catalogLabel(spec.name)));
  }
}

function selectProject(view, id, follow = false) {
  if (!Object.hasOwn(TECHS, id)) return;
  if (follow && !inDirectory(view.state, id, view.funded)) {
    view.fields.unavailable.checked = true;
  }
  const changed = view.selected !== id;
  view.selected = id;
  refresh(view);
  if (changed) view.fields.dossier.scrollTop = 0;
  if (follow) {
    view.buttons.get(id).scrollIntoView({ block: 'nearest' });
    view.fields.title.focus({ preventScroll: true });
  }
}

function mount(container) {
  container.innerHTML = `<section class="panel research-console" aria-labelledby="research-title">
    <header class="card-header"><h2 id="research-title">${icon('research')}<span data-label="Research"></span></h2><span class="tag" data-field="count"></span></header>
    <div class="research-toolbar">
      <label><input id="research-unavailable" data-field="unavailable" type="checkbox"> <span data-label="Show unavailable research"></span></label>
      <details class="research-capacity"><summary data-label="Compute tasks"></summary>
        <p data-field="taskInfo"></p><p data-field="tiers"></p>
        <div class="task-reservations">
          <label><span data-label="Paid work (CPU)"></span><input type="number" min="0" step="0.01" inputmode="decimal" data-field="jobsCpu" data-task="jobs"></label>
          <label><span data-label="Reserve for upkeep and construction (CPU)"></span><input type="number" min="0" step="0.01" inputmode="decimal" data-field="poolCpu" data-task="pool"></label>
        </div>
        <p data-label="These counts stay fixed when hosts join. The Paid work slider switches jobs back to a percentage. Unassigned CPU also enters the pool."></p>
        <p data-field="taskFeedback" role="status"></p>
      </details>
    </div>
    <div class="research-columns">
      <div class="research-directory" aria-label="Research projects" data-field="directory"></div>
      <article class="research-dossier" data-field="dossier" aria-labelledby="research-detail-title">
        <small data-field="branch"></small><h3 id="research-detail-title" data-field="title" tabindex="-1"></h3>
        <p data-field="description"></p>
        <div class="research-assignment">
          <label for="research-cpu" data-label="Assigned CPU"></label>
          <div class="research-cpu-controls">
            <input type="range" id="research-cpu" data-field="slider" min="0" step="0.01" aria-describedby="research-allocation-note">
            <input type="number" id="research-cpu-value" data-field="amount" min="0" step="0.01" inputmode="decimal" aria-describedby="research-allocation-note">
          </div>
          <small id="research-allocation-note">
            <span data-field="note"></span>
            <span class="research-funding-note" data-field="funding">
              <span data-label="Funds are drawn as work advances."></span>
              <span data-label="Waiting for project funds."></span>
            </span>
          </small>
          <button type="button" class="text-button" data-field="release" hidden data-label="Clear topic assignment"></button>
          <small data-field="feedback" role="status"></small>
        </div>
        <div class="research-progress" data-field="progress"><progress max="100" aria-label="Research progress"></progress><small data-field="progressText"><span></span></small></div>
        <dl class="research-costs">
          <div><dt>Funding</dt><dd data-field="price"></dd><dd data-field="cashLeft" hidden><span></span></dd></div><div><dt>Work</dt><dd data-field="work"></dd><dd data-field="workLeft" hidden><span></span></dd></div>
          <div data-field="duration"><dt>Minimum time</dt><dd></dd></div><div><dt>Research host</dt><dd data-field="host"></dd></div>
        </dl>
        <details data-field="safetyHelp" hidden><summary data-label="Where can this research run?"></summary><p data-field="guidance"></p></details>
        <div class="research-order" data-field="forecast">
          <label><span data-label="Preview CPU"></span> <input type="number" data-field="forecastCpu" min="0.01" step="0.01" inputmode="decimal"></label>
          <button type="button" data-field="preview" data-research-preview data-label="Forecast allocation"></button>
        </div>
        <dl class="research-links" data-field="links"></dl>
      </article>
      <p class="research-empty" data-field="empty" data-label="No unfinished research is available."></p>
    </div></section>`;
  const panel = container.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const view = { panel, fields, buttons: new Map(), selected: null, shown: null, edit: null, language: menuLanguage() };
  for (const node of panel.querySelectorAll('[data-label]')) node.textContent = dossierLabel(node.dataset.label, view.language);
  fields.directory.setAttribute('aria-label', dossierLabel('Research projects', view.language));
  fields.progress.firstElementChild.setAttribute('aria-label', dossierLabel('Research progress', view.language));
  for (const term of panel.querySelectorAll('.research-costs dt')) {
    term.textContent = dossierLabel(term.textContent === 'Work' && view.language !== 'en' ? 'Compute work' : term.textContent, view.language);
  }
  for (const [id, tech] of [...projects].sort(([, a], [, b]) => catalogLabel(a.name).localeCompare(catalogLabel(b.name), view.language))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.techId = id;
    button.setAttribute('aria-pressed', 'false');
    button.append(document.createElement('strong'), document.createElement('small'));
    button.firstElementChild.textContent = catalogLabel(tech.name);
    fields.directory.append(button);
    view.buttons.set(id, button);
  }

  fields.unavailable.addEventListener('change', () => refresh(view));
  fields.directory.addEventListener('keydown', event => {
    if (navigateDirectory(event, fields.directory)) return;
    const direction = {ArrowLeft: -1, ArrowRight: 1, '+': 1, '-': -1}[event.key];
    const id = event.target.closest('[data-tech-id]')?.dataset.techId;
    if (!direction || !id || event.metaKey || event.altKey) return;
    event.preventDefault();
    selectProject(view, id);
    if (fields.slider.disabled) return;
    const active = overview(view.state).activeCpu;
    const max = Number(fields.slider.max);
    const jump = event.shiftKey ? max / 2 : event.ctrlKey ? max / 100 : active / 10;
    const cpu = Math.round(100 * Math.min(max, Math.max(0,
      fields.slider.valueAsNumber + direction * Math.max(1, Math.floor(jump))))) / 100;
    view.onCommand({type: 'assign-research', id, cpu});
    refresh(view);
  });
  for (const control of [fields.jobsCpu, fields.poolCpu]) {
    control.addEventListener('change', () => {
      try {
        view.onCommand({ type: 'assign-task', task: control.dataset.task, cpu: control.valueAsNumber });
        setText(fields.taskFeedback, '');
      } catch (error) {
        setText(fields.taskFeedback, view.language === 'en' ? error.message : inputRange(view.language, Number(control.max)));
      }
      refresh(view);
    });
    control.addEventListener('blur', () => queueMicrotask(() => refresh(view)));
  }
  fields.forecastCpu.addEventListener('input', () => {
    fields.preview.disabled = !fields.forecastCpu.value || !fields.forecastCpu.validity.valid;
  });
  fields.slider.addEventListener('pointerdown', () => {
    view.edit = { id: view.selected, control: fields.slider, changed: false };
  });
  fields.slider.addEventListener('pointerup', () => {
    if (view.edit?.control === fields.slider && !view.edit.changed) {
      view.edit = null;
      refresh(view);
    }
  });
  fields.slider.addEventListener('pointercancel', () => {
    view.edit = null;
    refresh(view);
  });
  for (const control of [fields.slider, fields.amount]) {
    // Own the edit until the player commits it. A frame can complete a topic
    // or change eligible capacity while text is being typed or a thumb dragged.
    control.addEventListener('input', () => {
      if (!view.edit || view.edit.control !== control) view.edit = { id: view.selected, control };
      if (view.edit.id !== view.selected) return;
      view.edit.changed = true;
      const other = control === fields.amount ? fields.slider : fields.amount;
      if (control.validity.valid && control.value !== '') other.value = control.value;
      paintSlider(fields.slider);
      setText(fields.feedback, '');
    });
    control.addEventListener('change', () => {
      const id = view.edit?.id ?? view.selected;
      view.edit = null;
      if (!id || view.selected !== id || control.disabled) {
        refresh(view);
        return;
      }
      const cpu = control.valueAsNumber;
      try {
        if (!Number.isFinite(cpu) || !control.validity.valid) {
          throw new Error(inputRange(view.language, view.limit));
        }
        view.onCommand({ type: 'assign-research', id, cpu });
        setText(fields.feedback, '');
      } catch (error) {
        setText(fields.feedback, view.language === 'en' ? error.message : inputRange(view.language, view.limit));
      }
      refresh(view);
    });
    control.addEventListener('blur', () => {
      if (view.edit?.control === control) {
        view.edit = null;
        refresh(view);
      }
    });
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === fields.release) {
      try {
        view.onCommand({ type: 'assign-research', id: view.selected, cpu: 0 });
        setText(fields.feedback, '');
      } catch (error) {
        setText(fields.feedback, view.language === 'en' ? error.message : inputRange(view.language, view.limit));
      }
      fields.title.focus({ preventScroll: true });
    } else if (button.dataset.techId) selectProject(view, button.dataset.techId);
    else if (button.dataset.techLink) selectProject(view, button.dataset.techLink, true);
    else if (button === fields.preview && fields.forecastCpu.reportValidity()) {
      view.onPreviewOrder?.({ type: 'assign-research', id: view.selected, cpu: fields.forecastCpu.valueAsNumber });
    }
  });
  sessions.set(container, view);
  return view;
}

function inputRange(language, max) {
  const format = dossierFormat(language);
  return format.message('Choose an amount between 0 and {max} CPU in steps of {step}.',
    {max: format.number(max), step: format.number(0.01)});
}

function paintSlider(slider) {
  const percent = Number(slider.max) > 0 ? slider.valueAsNumber * 100 / Number(slider.max) : 0;
  slider.style.setProperty('--position', percent + '%');
}

function refresh(view) {
  const { state, fields } = view;
  const format = dossierFormat(view.language);
  const funded = new Map(researchProjects(state).map(project => [project.id, project]));
  view.funded = funded;
  const economy = overview(state);
  const allocation = researchAllocation(state, economy);
  const reservations = taskReservations(state, economy);
  for (const control of [fields.jobsCpu, fields.poolCpu]) {
    const task = control.dataset.task;
    control.max = taskCpuLimit(state, task, economy, allocation);
    control.disabled = state.status !== 'running';
    if (document.activeElement !== control) control.value = state.allocations[task + 'Cpu'] ?? reservations[task];
  }
  const pay = format.message('{pay} per CPU-day', {pay: format.money(economy.jobsPerCpuDay)});
  const taskCounts = format.message('{jobs} CPU on jobs, {pool} reserved for the pool, {research} on research.', {
    jobs: format.number(reservations.jobs), pool: format.number(reservations.pool), research: format.number(allocation.budget),
  });
  setText(fields.taskInfo, format.label(economy.jobName) + ' · ' + pay + '. ' + format.label(economy.jobDescription) + ' ' + taskCounts);
  setText(fields.tiers, format.label('Eligible CPU by safety tier') + ' · ' +
    allocation.tiers.map((value, tier) => 'T' + tier + ' ' + format.number(value)).join(' / '));
  let firstVisible = null;
  for (const [id, button] of view.buttons) {
    const available = inDirectory(state, id, funded);
    button.hidden = !available && !fields.unavailable.checked;
    if (button.hidden) continue;
    if (!firstVisible) firstVisible = id;
    const actual = allocation.byProject.get(id) || 0;
    let summary = '';
    if (funded.has(id)) {
      if (actual) summary = format.number(actual) + ' CPU';
      else if (!funded.get(id).cpu) summary = format.label('Paused');
      else summary = state.researchTarget === 0 ? format.label('Portfolio paused') : '0 CPU';
      const percent = Math.floor(100 * researchProgress(funded.get(id), TECHS[id]));
      summary += ' · ' + percent + '%';
      button.style.setProperty('--completed', percent + '%');
    } else {
      button.style.removeProperty('--completed');
      if (state.completed.includes(id)) summary = format.label('Completed');
      else if (!available) summary = format.label('Locked');
    }
    setText(button.lastChild, summary);
    button.lastChild.hidden = !summary;
  }
  if (!view.selected || view.buttons.get(view.selected).hidden) view.selected = firstVisible;
  if (view.selected !== view.shown) {
    view.buttons.get(view.shown)?.setAttribute('aria-pressed', 'false');
    view.buttons.get(view.selected)?.setAttribute('aria-pressed', 'true');
    setText(fields.feedback, '');
    if (view.selected) showDossier(view, view.selected);
    view.shown = view.selected;
  }
  setText(fields.count, format.message('{n} / {total} completed', {n:state.completed.length,total:projects.length}));
  fields.empty.hidden = Boolean(view.selected);
  fields.dossier.hidden = !view.selected;
  if (!view.selected) return;

  const id = view.selected;
  const spec = TECHS[id];
  const project = funded.get(id);
  const actual = allocation.byProject.get(id) || 0;
  const eligible = eligibleCpu(economy, spec);
  const host = view.language !== 'en' ? format.safety(spec) : spec.regions ? spec.regions.map(r => catalogLabel(REGIONS[r].name)).join(', ') : safety[spec.safety];
  setText(fields.host, host + ' · ' + format.message('{n} CPU eligible', {n: format.number(eligible)}));
  fields.safetyHelp.hidden = !spec.safety || Boolean(eligible);
  const limit = researchCpuLimit(state, id, economy, allocation);
  const reason = state.status !== 'running' ? 'The campaign has ended.' : project ? '' : researchReason(state, id);
  view.limit = limit;
  const idle = Math.max(0, limit - actual);
  let note = reason;
  if (reason && view.language !== 'en') {
    if (state.status !== 'running') note = format.label('The campaign has ended.');
    else if (state.completed.includes(id)) note = format.label('Research complete') + '.';
    else {
      const missing = spec.requires.find(parent => !state.completed.includes(parent));
      note = missing ? format.message('Requires {topic}.', {topic: catalogLabel(TECHS[missing].name)}) :
        format.label('No eligible CPU is online.') + ' ' + format.safety(spec);
    }
  }
  if (!note && project?.cpu > 0 && state.researchTarget === 0) {
    note = format.label('Research is paused. Raise the main research slider to resume the previous split.');
  } else if (!note && !eligible) {
    note = format.label('No eligible CPU is online.');
  } else if (!note && project?.cpu > 0 && !actual) {
    note = format.label('This topic currently receives 0 CPU from the shared research allocation.');
  } else if (!note && !limit) {
    note = format.label('No idle CPU. Adjust paid work or another project to free capacity.');
  }
  const work = project && actual ? previewWork(state, economy).research.get(project) : null;
  const waitingForFunds = work?.stalled && work.reason === 'Waiting for project funds';
  if (!note && work?.stalled && !waitingForFunds) note = format.label(work.reason + '.');
  if (!reason && limit > 0) {
    note += (note ? ' ' : '') + format.message('{n} more CPU available.', {n: format.number(idle)});
  }
  fields.release.hidden = !(project?.cpu > 0 && !actual && state.status === 'running');
  setText(fields.note, note);
  fields.funding.hidden = Boolean(reason || !spec.cost || (work?.stalled && !waitingForFunds));
  fields.funding.classList.toggle('waiting', Boolean(waitingForFunds));
  const editing = view.edit?.id === id;
  for (const control of [fields.slider, fields.amount]) {
    control.disabled = Boolean(reason) || limit === 0;
    const label = format.message(control === fields.slider ? 'CPU allocation for {topic}' : 'Assigned CPU for {topic}',
      {topic: catalogLabel(spec.name)});
    if (control.getAttribute('aria-label') !== label) control.setAttribute('aria-label', label);
    if (!editing) {
      control.max = limit;
      if (control.valueAsNumber !== actual) control.value = actual;
    }
  }
  paintSlider(fields.slider);
  fields.progress.hidden = !project;
  if (project) {
    const fraction = researchProgress(project, spec);
    fields.progress.firstElementChild.value = fraction * 100;
    setText(fields.progressText.firstElementChild, format.number(project.work) + ' / ' + format.number(spec.work) + ' CPU-h · ' + Math.floor(100 * fraction) + '%');
  }
  fields.cashLeft.hidden = fields.workLeft.hidden = !project;
  setText(fields.price, format.money(spec.cost));
  if (project) {
    setText(fields.cashLeft.firstElementChild, format.label('Remaining') + ' · ' + format.money(spec.cost - project.cashPaid));
    setText(fields.workLeft.firstElementChild, format.label('Remaining') + ' · ' + format.number(spec.work - project.work) + ' CPU-h');
  }
  fields.forecast.hidden = Boolean(project || reason || !limit || !view.onPreviewOrder);
  if (!fields.forecast.hidden) {
    fields.forecastCpu.max = limit;
    if (view.forecastId !== id) {
      fields.forecastCpu.value = Math.min(1, limit);
      view.forecastId = id;
    }
    fields.preview.disabled = !fields.forecastCpu.value || !fields.forecastCpu.validity.valid;
  }
}

export function renderResearch(container, state, { onCommand, onPreviewOrder }) {
  let view = sessions.get(container);
  if (view?.panel.parentElement !== container || view.language !== menuLanguage()) {
    const previous = view?.selected;
    const showLocked = view?.fields.unavailable.checked;
    view = mount(container);
    view.selected = previous;
    view.fields.unavailable.checked = Boolean(showLocked);
  }
  view.state = state;
  view.onCommand = onCommand;
  view.onPreviewOrder = onPreviewOrder;
  // A completion can remove a row, unlock several others or select a new
  // dossier. Readers at the end stay there; readers midway keep native scroll.
  const pinned = [];
  if (view.completedCount !== undefined && view.completedCount !== state.completed.length) {
    for (const pane of [view.fields.directory, view.fields.dossier]) {
      if (pane.scrollTop > 0 && pane.scrollHeight - pane.clientHeight - pane.scrollTop <= 1) pinned.push(pane);
    }
  }
  view.completedCount = state.completed.length;
  refresh(view);
  for (const pane of pinned) pane.scrollTop = pane.scrollHeight;
}

export function focusResearch(container, state, options, id) {
  renderResearch(container, state, options);
  selectProject(sessions.get(container), id, true);
}
