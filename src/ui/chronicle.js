import { menuLanguage, translate } from './localization.js';
import { localizedDispatch, localizedStory, localizedWarning, translatedGroup, worldEffectSummary } from './dispatch-translations.js';
import { localizedResearchText } from './dossier-translations.js';
import { localizedChapter } from './chapter-translations.js';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES } from '../game/content.js';
import { currentWarnings, CHAPTERS, eventCategory, JOURNAL_CATEGORIES, reportsAt, storyKey } from '../game/chronicle.js';
import { researchFindings } from '../game/knowledge.js';
import { stamp } from './views.js';
import { equipmentIcon, icon } from './icons.js';
import { facilityIcon } from './facility-icons.js';
import './chronicle.css';

export { storyKey, currentWarnings };
export { renderDeveloper } from './developer.js';

const sessions = new WeakMap();
const PAGE = 25;
let selectedCategories = new Set(Object.keys(JOURNAL_CATEGORIES));
let selectedReport = '';
const reportTypes = {
  'news.world': 'World stories', 'research.completed': 'Research completions',
  'site.online': 'Facility completions', 'site.failed': 'Upkeep losses',
  'site.discovered': 'Discoveries', 'equipment.installed': 'Equipment deliveries',
};

function node(tag, text) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  return el;
}
function action(text, fn) {
  const el = node('button', text);
  el.type = 'button';
  el.addEventListener('click', fn);
  return el;
}

function fullTitle(event) {
  const localized = localizedDispatch(event);
  if (localized.headline) return localized.headline;
  if (event.techId) return event.text.replace(/\.$/, '');
  return event.text.split('. ')[0].replace(/\.$/, '');
}

// A single native dialog owns its pager. Its opener regains focus on close.
function openPages(title, pages, options, { start = 0, story = false } = {}) {
  if (!pages.length) return false;
  const prior = document.querySelector('dialog.chronicle-dialog');
  if (prior?.open) prior.close();
  options.onPause?.();
  const dialog = node('dialog');
  dialog.className = 'chronicle-dialog';
  const language = menuLanguage();
  const t = label => translate(language, label);
  dialog.lang = language;
  dialog.setAttribute('aria-label', t(title));
  const progress = node('small');
  const h = node('h2');
  const description = node('p');
  const where = node('small');
  const jump = action(t('Inspect region'), () => {
    const page = pages[index];
    dialog.close();
    options.onRegion?.(page.region);
  });
  const section = node('div');
  section.className = 'chronicle-actions';
  let index = Math.min(Math.max(0, start), pages.length - 1);
  function paint() {
    const page = pages[index];
    progress.textContent = t(title) + ' · ' + (index + 1) + ' / ' + pages.length;
    h.textContent = page.title;
    description.textContent = page.text;
    where.textContent = page.meta || '';
    where.hidden = !where.textContent;
    jump.hidden = !page.region || !options.onRegion;
    prev.disabled = index === 0;
    next.disabled = index === pages.length - 1;
  }
  const prev = action(t('Previous'), () => { index--; paint(); });
  const next = action(t('Next'), () => { index++; paint(); });
  const stay = action(t(story ? 'Skip / close story' : 'Keep paused'), () => dialog.close());
  if (pages.length > 1) section.append(prev, next);
  section.append(stay);
  if (options.onContinue) section.append(action(t('Continue simulation'), () => { dialog.close(); options.onContinue(); }));
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && index < pages.length - 1) { index++; paint(); e.preventDefault(); }
    if (e.key === 'ArrowLeft' && index > 0) { index--; paint(); e.preventDefault(); }
  });
  dialog.addEventListener('close', () => dialog.remove(), {once:true});
  dialog.append(progress, h, where, description, jump, section);
  document.body.append(dialog);
  paint();
  dialog.showModal();
  return true;
}

export function openStory(key, options = {}) {
  if (!Object.hasOwn(CHAPTERS, key)) return false;
  const chapter = localizedChapter(key, menuLanguage());
  return openPages('Campaign story', chapter.pages.map(text => ({title:chapter.title, text})), options, {story:true});
}

export function openDispatches(state, records, options = {}, start = 0) {
  const events = records ?? (state.events.length ? reportsAt(state.events, state.events.at(-1)) : []);
  const language = menuLanguage();
  const pages = events.map(event => {
    const dispatch = localizedDispatch(event, language);
    const result = event.kind === 'research.completed' && Object.hasOwn(researchFindings, event.techId)
      ? localizedResearchText(event.techId, language, true) : '';
    return {
      title: dispatch.headline || fullTitle(event),
      text: result ? (language === 'en' ? dispatch.text + ' ' + result : result) : dispatch.text,
      region: Object.hasOwn(REGIONS, event.region) ? event.region : null,
      meta: stamp(event.hour, event.minute) + ' · ' + translate(language, JOURNAL_CATEGORIES[eventCategory(event)]) +
        (Object.hasOwn(GROUPS, event.group) ? ' · ' + translatedGroup(event.group, language) : ''),
    };
  });
  return openPages('Dispatches', pages, options, {start});
}

export function openWarnings(warnings, options) {
  return openPages('Operational warnings', warnings.map(warning => localizedWarning(warning)), options);
}

const same = (list, previous) => list.length === previous.length && list.every((v, i) => v === previous[i]);

function mount(view) {
  const language = menuLanguage();
  const t = label => translate(language, label);
  view.innerHTML = `<section class="panel chronicle-console" aria-labelledby="journal-title">
    <header class="card-header"><h2 id="journal-title">${t('Activity log')}</h2><span class="tag" data-field="total"></span></header>
    <section class="chronicle-warnings" data-field="warnings" aria-label="${t('Operational warnings')}"></section>
    <section class="chronicle-world" data-field="world" aria-label="${t('Active world stories')}"></section>
    <div class="chronicle-filters">
      <details id="activity-filter"><summary data-field="filterLabel">Event types · All</summary>
        <fieldset data-field="filters"><legend>${t('Show event types')}</legend></fieldset>
        <label>${t('Report kind')} <select data-field="report"></select></label>
        <button type="button" data-field="all">${t('Select all')}</button><button type="button" data-field="none">${t('Clear selection')}</button>
      </details>
      <button type="button" data-field="latest">${t('Read latest dispatches')}</button>
    </div>
    <ul class="event-list chronicle-list" data-field="list"></ul><p class="chronicle-empty" data-field="empty" hidden></p>
    <div class="chronicle-pager"><button type="button" data-field="newer">${t('Newer')}</button><small data-field="page"></small><button type="button" data-field="older">${t('Older')}</button></div>
  </section>`;
  const panel = view.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const saved = { panel, fields, language, t, page: 0, warningKeys: [], newsKey: null, lastId: 0, filter: '', renderedPage: -1 };
  for (const [value, name] of Object.entries(JOURNAL_CATEGORIES)) {
    const input = node('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = selectedCategories.has(value);
    const label = node('label');
    label.append(input, document.createTextNode(' ' + t(name)));
    fields.filters.append(label);
  }
  for (const [id, label] of Object.entries({ '': 'All entries', ...reportTypes })) {
    fields.report.add(new Option(t(label), id, false, id === selectedReport));
  }
  fields.report.onchange = () => { selectedReport = fields.report.value; saved.page = 0; refresh(saved); };
  fields.filters.onchange = () => {
    selectedCategories = new Set([...fields.filters.querySelectorAll('input:checked')].map(input => input.value));
    saved.page = 0; refresh(saved);
  };
  const selectAll = checked => {
    for (const input of fields.filters.querySelectorAll('input')) input.checked = checked;
    selectedReport = fields.report.value = '';
    fields.filters.onchange();
  };
  fields.all.onclick = () => selectAll(true);
  fields.none.onclick = () => selectAll(false);
  fields.older.onclick = () => { saved.page++; refresh(saved); };
  fields.newer.onclick = () => { saved.page = Math.max(0, saved.page - 1); refresh(saved); };
  fields.latest.onclick = () => openDispatches(saved.state, undefined, saved.options);
  sessions.set(view, saved);
  return saved;
}

function refreshWarnings(v) {
  const prefs = v.options.warningSettings;
  const active = currentWarnings(v.state, typeof prefs === 'function' ? prefs() : prefs);
  const keys = active.map(warning => warning.id + '/' + warning.text);
  if (same(keys, v.warningKeys)) return;
  v.warningKeys = keys;
  const d = v.fields.warnings;
  const expanded = new Set([...d.querySelectorAll('details[open]')].map(detail => detail.dataset.warning));
  d.replaceChildren();
  if (!active.length) return;
  d.append(node('h3', v.t('Operational warnings')));
  for (const raw of active) {
    const warning = localizedWarning(raw, v.language);
    const details = node('details');
    details.dataset.warning = warning.id;
    details.open = expanded.has(warning.id);
    const summary = node('summary', warning.title);
    details.append(summary, node('p', warning.text));
    if (v.options.onTab) details.append(action(v.t('Open ' + warning.tab), () => v.options.onTab(warning.tab)));
    d.append(details);
  }
}

function refreshWorld(v) {
  const key = JSON.stringify(v.state.news.stories);
  if (key === v.newsKey) return;
  v.newsKey = key;
  const d = v.fields.world;
  d.replaceChildren();
  const stories = Object.entries(v.state.news.stories);
  if (!stories.length) return;
  d.append(node('h3', v.t('Active world stories')));
  const list = node('ul');
  list.className = 'world-stories';
  for (const [id, started] of stories) {
    const row = node('li');
    row.append(node('strong', localizedStory(id).headline), node('small', worldEffectSummary(id, started)));
    list.append(row);
  }
  d.append(list);
}

function eventIcon(event) {
  const category = eventCategory(event);
  if (category === 'discoveries' && Object.hasOwn(GROUPS, event.group)) return icon(event.group);
  if (category === 'facilities' && Object.hasOwn(SITE_TYPES, event.siteType)) return facilityIcon(event.siteType);
  if (category === 'equipment' && Object.hasOwn(EQUIPMENT, event.itemId)) return equipmentIcon(EQUIPMENT[event.itemId].slot);
  const symbol = { discoveries: 'shield', maintenance: 'facilities', news: 'news', facilities: 'facilities', equipment: 'cpu', research: 'research' };
  return icon(symbol[category] || 'activity');
}

function refresh(v) {
  const {fields, state, t} = v;
  refreshWarnings(v);
  refreshWorld(v);
  const selected = new Set([...fields.filters.querySelectorAll('input:checked')].map(input => input.value));
  const filter = [...selected, selectedReport].join('|');
  if (v.lastId === state.nextEventId && v.filter === filter && v.renderedPage === v.page) return;
  fields.filterLabel.textContent = t('Event types') + ' · ' +
    (selected.size === Object.keys(JOURNAL_CATEGORIES).length ? t('All') : String(selected.size)) +
    (selectedReport ? ' · ' + t(reportTypes[selectedReport]) : '');
  const filtered = state.events.filter(e => selected.has(eventCategory(e)) && (!selectedReport || e.kind === selectedReport)).reverse();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  v.page = Math.max(0, Math.min(v.page, pages - 1));
  v.filter = filter;
  v.renderedPage = v.page;
  v.lastId = state.nextEventId;
  const rows = filtered.slice(v.page * PAGE, (v.page + 1) * PAGE);
  // When new entries arrive, keep existing focused rows attached.
  const existing = new Map([...fields.list.children].map(li => [Number(li.dataset.eventId), li]));
  for (const [index, e] of rows.entries()) {
    let li = existing.get(e.id);
    if (!li) {
      li = node('li');
      li.dataset.eventId = String(e.id);
      const open = action(fullTitle(e), () => {
        const group = reportsAt(v.state.events, e);
        openDispatches(v.state, group.length ? group : [e], v.options, group.findIndex(x => x.id === e.id));
      });
      open.className = 'chronicle-entry';
      open.insertAdjacentHTML('afterbegin', eventIcon(e));
      li.append(node('time', stamp(e.hour, e.minute)), open);
      const chapter = storyKey(e);
      if (chapter) li.append(action(t('Read story'), () => openStory(chapter, v.options)));
    }
    existing.delete(e.id);
    if (fields.list.children[index] !== li) fields.list.insertBefore(li,fields.list.children[index] || null);
  }
  for (const li of existing.values()) li.remove();
  fields.total.textContent = v.language === 'en' ? state.events.length + ' recorded' : t('Entries') + ' · ' + state.events.length;
  fields.page.textContent = t('Page') + ' ' + (v.page + 1) + (v.language === 'en' ? ' of ' : ' / ') + pages;
  fields.newer.disabled = v.page === 0;
  fields.older.disabled = v.page >= pages - 1;
  fields.latest.disabled = !state.events.length;
  fields.empty.hidden = !!rows.length;
  fields.empty.textContent = rows.length ? '' : t(selected.size ? 'No events match the selected types.' : 'Select an event type to view its reports.');
}

export function renderChronicle(view, state, options = {}) {
  let v = sessions.get(view);
  if (v?.panel.parentElement !== view || v.language !== menuLanguage()) v = mount(view);
  if (v.state !== state) {
    v.lastId = 0; v.page = 0; v.newsKey = null; v.fields.list.replaceChildren();
  }
  v.state = state;
  v.options = options;
  refresh(v);
}
