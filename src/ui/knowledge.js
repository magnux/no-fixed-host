import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_ENTRIES, knowledgeAvailable, knowledgeDetail } from '../game/knowledge.js';
import { EQUIPMENT, TECHS } from '../game/content.js';
import { esc } from './views.js';
import { icon, equipmentIcon } from './icons.js';
import { facilityIcon } from './facility-icons.js';
import { navigateDirectory } from './directory-keys.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { localizedConcept } from './concept-translations.js';
import { dossierFormat, dossierLabel, localizedDesignText, localizedResearchText } from './dossier-translations.js';

const sessions = new WeakMap();

function mount(root) {
  root.innerHTML = `<section class="panel research-console knowledge-console">
    <header class="card-header"><h2>${icon('knowledge')}<span data-label="Knowledge"></span></h2></header>
    <div class="research-filters">
      <label><span data-label="Section"></span> <select id="knowledge-category"><option value="">All sections</option></select></label>
      <label><span data-label="Search"></span> <input id="knowledge-search" type="search" placeholder="Name or keyword"></label>
      <label><input id="knowledge-locked" type="checkbox"> <span data-label="Show locked entries"></span></label>
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
    locked: panel.querySelector('#knowledge-locked'), selection: new Map(), section: '', id: 'concepts/areas', filter: null,
  };
  for (const [id, name] of Object.entries(KNOWLEDGE_CATEGORIES)) view.select.add(new Option(catalogLabel(name), id));
  view.select.addEventListener('change', () => updateKnowledge(view));
  view.input.addEventListener('input', () => updateKnowledge(view));
  view.list.addEventListener('keydown', event => navigateDirectory(event, view.list));
  view.locked.addEventListener('change', () => updateKnowledge(view));
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
  const language = menuLanguage();
  const query = view.input.value.trim().toLocaleLowerCase(language);
  if (section !== view.section) {
    view.selection.set(view.section, view.id);
    view.id = view.selection.get(section) || '';
    view.section = section;
  }
  const filter = [language, section, query, view.locked.checked, view.state.completed.join('|')].join('/');
  if (view.filter !== filter) {
    view.filter = filter;
    for (const node of view.panel.querySelectorAll('[data-label]')) {
      node.textContent = dossierLabel(node.dataset.label, language);
    }
    view.input.placeholder = dossierLabel('Name or keyword', language);
    view.list.setAttribute('aria-label', dossierLabel('Knowledge entries',language));
    view.detail.setAttribute('aria-label', dossierLabel('Reference entry',language));
    for (const option of view.select.options) {
      option.textContent = dossierLabel(KNOWLEDGE_CATEGORIES[option.value] || 'All sections', language);
    }
    view.matches = KNOWLEDGE_ENTRIES
      .filter(entry => (!section || entry.category === section) && (view.locked.checked || knowledgeAvailable(entry, view.state)))
      .map(entry => {
        const concept = entry.category === 'concepts' && localizedConcept(entry.id, language);
        const name = concept?.name || catalogLabel(entry.name);
        const description = entry.category === 'concepts' ? concept?.description || entry.description :
          entry.category === 'techs' ? localizedResearchText(entry.id, language) :
            localizedDesignText(entry.category, entry.id, language);
        const keywords = [name, description, entry.name, entry.description].join(' ').toLocaleLowerCase(language);
        return { ...entry, name, description, keywords };
      })
      .filter(entry => entry.keywords.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, language));
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
  const riskKey = view.id.startsWith('bases/')
    ? Object.values(view.state.suspicion).join(',') + '/' + Object.keys(view.state.news.stories).join(',') : '';
  const detailKey = view.id + '/' + view.state.completed.length + '/' + riskKey;
  if (detailKey === view.detailKey) return;
  view.detailKey = detailKey;
  const entry = view.matches.find(candidate => entryKey(candidate) === view.id);
  for (const button of view.list.children) {
    button.setAttribute('aria-pressed', String(button.dataset.entry === view.id));
  }
  if (!entry) {
    view.detail.textContent = dossierLabel('No matching entries.', language);
    return;
  }
  const { requirements, facts, result } = knowledgeDetail(entry, view.state, dossierFormat(language));
  const links = requirements.map(id =>
    `<button type="button" data-project="${esc(id)}">${esc(catalogLabel(TECHS[id].name))}</button>`);
  const rows = facts.map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`);
  view.detail.innerHTML = `<small>${esc(dossierLabel(KNOWLEDGE_CATEGORIES[entry.category],language))}</small>
    <h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p>
    ${rows.length ? '<dl class="research-costs">' + rows.join('') + '</dl>' : ''}
    ${result ? '<h4>' + esc(dossierLabel('Research result', language)) + '</h4><p class="research-result">' + esc(localizedResearchText(entry.id, language, true)) + '</p>' : ''}
    ${links.length ? '<dl class="research-links"><dt>' + esc(dossierLabel('Requires', language)) + '</dt><dd>' + links.join(' ') + '</dd></dl>' : ''}
    ${entry.category === 'techs' ? '<button type="button" class="text-button" data-project="' + esc(entry.id) + '">' + esc(dossierLabel('Open research project', language)) + '</button>' : ''}`;
}
