import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_ENTRIES, knowledgeDetail } from '../game/knowledge.js';
import { EQUIPMENT, TECHS } from '../game/content.js';
import { esc } from './views.js';
import { icon, equipmentIcon } from './icons.js';
import { facilityIcon } from './facility-icons.js';

const sessions = new WeakMap();

function mount(root) {
  root.innerHTML = `<section class="panel research-console knowledge-console">
    <header class="card-header"><h2>${icon('knowledge')}Knowledge</h2></header>
    <div class="research-filters">
      <label>Section <select id="knowledge-category"><option value="">All sections</option></select></label>
      <label>Search <input id="knowledge-search" type="search" placeholder="Name or keyword"></label>
    </div>
    <div class="research-columns">
      <div class="research-directory" aria-label="Knowledge entries"></div>
      <article class="research-dossier" aria-label="Reference entry"></article>
    </div>
  </section>`;
  const panel = root.firstElementChild;
  const view = {
    panel, select: panel.querySelector('select'), input: panel.querySelector('input'),
    list: panel.querySelector('.research-directory'), detail: panel.querySelector('article'),
    id: 'concepts/areas', filter: null,
  };
  for (const [id, name] of Object.entries(KNOWLEDGE_CATEGORIES)) view.select.add(new Option(name, id));
  view.select.addEventListener('change', () => updateKnowledge(view));
  view.input.addEventListener('input', () => updateKnowledge(view));
  view.list.addEventListener('click', event => {
    const button = event.target.closest('[data-entry]');
    if (button) {
      view.id = button.dataset.entry;
      updateKnowledge(view);
    }
  });
  view.detail.addEventListener('click', event => {
    const button = event.target.closest('[data-project]');
    if (button) view.onResearch(button.dataset.project);
  });
  sessions.set(root, view);
  return view;
}

export function renderKnowledge(root, state, onResearch) {
  let view = sessions.get(root);
  if (view?.panel.parentElement !== root) view = mount(root);
  if (view.state !== state) view.detailKey = null;
  view.state = state;
  view.onResearch = onResearch;
  updateKnowledge(view);
}

function entryKey(entry) {
  return entry.category + '/' + entry.id;
}

function entryIcon(entry) {
  if (entry.category === 'bases') return facilityIcon(entry.id);
  if (entry.category === 'items') return equipmentIcon(EQUIPMENT[entry.id].slot);
  return icon(entry.category === 'techs' ? 'research' : 'knowledge');
}

function updateKnowledge(view) {
  const section = view.select.value;
  const query = view.input.value.trim().toLowerCase();
  const filter = section + '/' + query;
  if (view.filter !== filter) {
    view.filter = filter;
    view.matches = KNOWLEDGE_ENTRIES.filter(entry =>
      (!section || entry.category === section) && (entry.name + ' ' + entry.description).toLowerCase().includes(query));
    view.list.replaceChildren(...view.matches.map(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.entry = entryKey(entry);
      button.innerHTML = entryIcon(entry);
      button.append(document.createTextNode(entry.name));
      return button;
    }));
    if (!view.matches.some(entry => entryKey(entry) === view.id)) {
      view.id = view.matches.length ? entryKey(view.matches[0]) : '';
    }
    view.detailKey = null;
  }
  const detailKey = view.id + '/' + view.state.completed.length;
  if (detailKey === view.detailKey) return;
  view.detailKey = detailKey;
  const entry = view.matches.find(candidate => entryKey(candidate) === view.id);
  for (const button of view.list.children) {
    button.setAttribute('aria-pressed', String(button.dataset.entry === view.id));
  }
  if (!entry) {
    view.detail.textContent = 'No matching entries.';
    return;
  }
  const { requirements, facts, result } = knowledgeDetail(entry, view.state);
  const links = requirements.map(id =>
    `<button type="button" data-project="${esc(id)}">${esc(TECHS[id].name)}</button>`);
  const rows = facts.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`);
  view.detail.innerHTML = `<small>${esc(KNOWLEDGE_CATEGORIES[entry.category])}</small>
    <h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p>
    ${rows.length ? '<dl class="research-costs">' + rows.join('') + '</dl>' : ''}
    ${result ? '<h4>Research result</h4><p class="research-result">' + esc(result) + '</p>' : ''}
    ${links.length ? '<dl class="research-links"><dt>Requires</dt><dd>' + links.join(' ') + '</dd></dl>' : ''}
    ${entry.category === 'techs' ? '<button type="button" class="text-button" data-project="' + esc(entry.id) + '">Open research project</button>' : ''}`;
}
