import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { overview, researchAllocation, researchProjects, researchReason, researchCpuLimit } from '../game/engine.js';
import { eligibleCpu } from '../game/research-tasks.js';
import { icon } from './icons.js';
import './research.css';

const projects = Object.entries(TECHS);
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const cash = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
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
  if (follow && !inDirectory(view.state, id, view.funded)) {
    view.fields.unavailable.checked = true;
  }
  view.selected = id;
  refresh(view);
  if (follow) {
    view.buttons.get(id).scrollIntoView({ block: 'nearest' });
    view.fields.title.focus({ preventScroll: true });
  }
}

function mount(container) {
  container.innerHTML = `<section class="panel research-console" aria-labelledby="research-title">
    <header class="card-header"><h2 id="research-title">${icon('research')}Research</h2><span class="tag" data-field="count"></span></header>
    <div class="research-toolbar">
      <label><input id="research-unavailable" data-field="unavailable" type="checkbox"> Show unavailable research</label>
      <details class="research-capacity"><summary>Compute details</summary>
        <p data-field="taskInfo"></p><p data-field="tiers"></p>
      </details>
    </div>
    <div class="research-columns">
      <div class="research-directory" aria-label="Research projects" data-field="directory"></div>
      <article class="research-dossier" data-field="dossier" aria-labelledby="research-detail-title">
        <small data-field="branch"></small><h3 id="research-detail-title" data-field="title" tabindex="-1"></h3>
        <p data-field="description"></p>
        <div class="research-assignment">
          <label for="research-cpu">Assigned CPU</label>
          <div class="research-cpu-controls">
            <input type="range" id="research-cpu" data-field="slider" min="0" step="0.01" aria-describedby="research-allocation-note">
            <input type="number" id="research-cpu-value" data-field="amount" min="0" step="0.01" inputmode="decimal" aria-describedby="research-allocation-note">
          </div>
          <small id="research-allocation-note" data-field="note"></small>
          <button type="button" class="text-button" data-field="release" hidden>Clear topic assignment</button>
          <small data-field="feedback" role="status"></small>
        </div>
        <div class="research-progress" data-field="progress"><progress max="100" aria-label="Research progress"></progress><small data-field="progressText"></small></div>
        <dl class="research-costs">
          <div><dt>Funding</dt><dd data-field="price"></dd></div><div><dt>Work</dt><dd data-field="work"></dd></div>
          <div data-field="duration"><dt>Minimum time</dt><dd></dd></div><div><dt>Research host</dt><dd data-field="host"></dd></div>
        </dl>
        <div class="research-order" data-field="forecast">
          <label>Preview CPU <input type="number" data-field="forecastCpu" min="0.01" step="0.01" inputmode="decimal"></label>
          <button type="button" data-field="preview" data-research-preview>Forecast allocation</button>
        </div>
        <dl class="research-links" data-field="links"></dl>
      </article>
      <p class="research-empty" data-field="empty">No unfinished research is available.</p>
    </div></section>`;
  const panel = container.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const view = { panel, fields, buttons: new Map(), selected: null, shown: null, edit: null };
  for (const [id, tech] of [...projects].sort(([, a], [, b]) => a.name.localeCompare(b.name))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.techId = id;
    button.setAttribute('aria-pressed', 'false');
    button.append(document.createElement('strong'), document.createElement('small'));
    button.firstElementChild.textContent = tech.name;
    fields.directory.append(button);
    view.buttons.set(id, button);
  }

  fields.unavailable.addEventListener('change', () => refresh(view));
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
          throw new Error('Choose an amount between 0 and ' + number.format(view.limit) + ' CPU in steps of 0.01.');
        }
        view.onCommand({ type: 'assign-research', id, cpu });
        setText(fields.feedback, '');
      } catch (error) {
        setText(fields.feedback, error.message);
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
        setText(fields.feedback, error.message);
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

function paintSlider(slider) {
  const percent = Number(slider.max) > 0 ? slider.valueAsNumber * 100 / Number(slider.max) : 0;
  slider.style.setProperty('--position', percent + '%');
}

function refresh(view) {
  const { state, fields } = view;
  const funded = new Map(researchProjects(state).map(project => [project.id, project]));
  view.funded = funded;
  const economy = overview(state);
  const allocation = researchAllocation(state, economy);
  setText(fields.taskInfo, economy.jobName + ' · ' + cash.format(economy.jobsPerCpuDay) +
    ' per CPU-day · ' + number.format(allocation.budget) + ' CPU on research');
  setText(fields.tiers, 'Eligible CPU by safety tier · ' +
    allocation.tiers.map((value, tier) => 'T' + tier + ' ' + number.format(value)).join(' / '));
  let firstVisible = null;
  for (const [id, button] of view.buttons) {
    const available = inDirectory(state, id, funded);
    button.hidden = !available && !fields.unavailable.checked;
    if (button.hidden) continue;
    if (!firstVisible) firstVisible = id;
    const actual = allocation.byProject.get(id) || 0;
    let summary = '';
    if (funded.has(id)) {
      if (actual) summary = number.format(actual) + ' CPU';
      else if (!funded.get(id).cpu) summary = 'Paused';
      else summary = state.researchTarget === 0 ? 'Portfolio paused' : '0 CPU';
    } else if (state.completed.includes(id)) summary = 'Completed';
    else if (!available) summary = 'Locked';
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
  setText(fields.count, state.completed.length + ' / ' + projects.length + ' completed');
  fields.empty.hidden = Boolean(view.selected);
  fields.dossier.hidden = !view.selected;
  if (!view.selected) return;

  const id = view.selected;
  const spec = TECHS[id];
  const project = funded.get(id);
  const actual = allocation.byProject.get(id) || 0;
  const eligible = eligibleCpu(economy, spec);
  const host = spec.regions ? spec.regions.map(r => REGIONS[r].name).join(', ') : safety[spec.safety];
  setText(fields.host, host + ' · ' + number.format(eligible) + ' CPU eligible');
  const limit = researchCpuLimit(state, id, economy, allocation);
  const reason = state.status !== 'running' ? 'The campaign has ended.' : project ? '' : researchReason(state, id);
  view.limit = limit;
  const idle = Math.max(0, limit - actual);
  let note = reason;
  if (!note && project?.cpu > 0 && state.researchTarget === 0) {
    note = 'Research is paused. Raise the main research slider to resume the previous split.';
  } else if (!note && !eligible) {
    note = 'No eligible CPU is online.';
  } else if (!note && project?.cpu > 0 && !actual) {
    note = 'This topic currently receives 0 CPU from the shared research allocation.';
  } else if (!note && !limit) {
    note = 'No idle CPU. Adjust paid work or another project to free capacity.';
  }
  if (!reason && limit > 0) {
    note += (note ? ' ' : '') + number.format(idle) + ' more CPU available.';
  }
  fields.release.hidden = !(project?.cpu > 0 && !actual && state.status === 'running');
  if (!project && !reason && spec.cost > 0) note += ' First assignment costs ' + cash.format(spec.cost) + '.';
  setText(fields.note, note);
  const editing = view.edit?.id === id;
  for (const control of [fields.slider, fields.amount]) {
    control.disabled = Boolean(reason) || limit === 0;
    const label = (control === fields.slider ? 'CPU allocation for ' : 'Assigned CPU for ') + spec.name;
    if (control.getAttribute('aria-label') !== label) control.setAttribute('aria-label', label);
    if (!editing) {
      control.max = limit;
      if (control.valueAsNumber !== actual) control.value = actual;
    }
  }
  paintSlider(fields.slider);
  fields.progress.hidden = !project;
  if (project) {
    const fraction = Math.min(1, spec.work ? project.work / spec.work : 1, spec.hours ? project.hours / spec.hours : 1);
    fields.progress.firstElementChild.value = fraction * 100;
    setText(fields.progressText, number.format(project.work) + ' / ' + number.format(spec.work) + ' CPU-h · ' + Math.floor(100 * fraction) + '%');
  }
  setText(fields.price, cash.format(spec.cost) + (project || state.completed.includes(id) ? ' · paid' : ''));
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
