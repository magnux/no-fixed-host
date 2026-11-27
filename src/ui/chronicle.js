import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES } from '../game/content.js';
import { storyExpiryMinute, WORLD_NEWS } from '../game/events.js';
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
  if (event.headline) return event.headline;
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
  dialog.setAttribute('aria-label', title);
  const progress = node('small');
  const h = node('h2');
  const description = node('p');
  const where = node('small');
  const jump = action('Inspect region', () => {
    const page = pages[index];
    dialog.close();
    options.onRegion?.(page.region);
  });
  const section = node('div');
  section.className = 'chronicle-actions';
  let index = Math.min(Math.max(0, start), pages.length - 1);
  function paint() {
    const page = pages[index];
    progress.textContent = title + ' · ' + (index + 1) + ' / ' + pages.length;
    h.textContent = page.title;
    description.textContent = page.text;
    where.textContent = page.meta || '';
    where.hidden = !where.textContent;
    jump.hidden = !page.region || !options.onRegion;
    prev.disabled = index === 0;
    next.disabled = index === pages.length - 1;
  }
  const prev = action('Previous', () => { index--; paint(); });
  const next = action('Next', () => { index++; paint(); });
  const stay = action(story ? 'Skip / close story' : 'Keep paused', () => dialog.close());
  if (pages.length > 1) section.append(prev, next);
  section.append(stay);
  if (options.onContinue) section.append(action('Continue simulation', () => { dialog.close(); options.onContinue(); }));
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
  const chapter = CHAPTERS[key];
  return openPages('Campaign story', chapter.pages.map(text => ({title:chapter.title, text})), options, {story:true});
}

export function openDispatches(state, records, options = {}, start = 0) {
  const events = records ?? (state.events.length ? reportsAt(state.events, state.events.at(-1)) : []);
  return openPages('Dispatches', events.map(event => ({
    title: fullTitle(event),
    text: event.kind === 'research.completed' && Object.hasOwn(researchFindings, event.techId) ?
      event.text + ' ' + researchFindings[event.techId] : event.text,
    region: Object.hasOwn(REGIONS, event.region) ? event.region : null,
    meta: stamp(event.hour, event.minute) + ' · ' + JOURNAL_CATEGORIES[eventCategory(event)] +
      (Object.hasOwn(GROUPS, event.group) ? ' · ' + GROUPS[event.group].name : ''),
  })), options, {start});
}

const same = (list, previous) => list.length === previous.length && list.every((v, i) => v === previous[i]);

function mount(view) {
  view.innerHTML = `<section class="panel chronicle-console" aria-labelledby="journal-title">
    <header class="card-header"><h2 id="journal-title">Activity log</h2><span class="tag" data-field="total"></span></header>
    <section class="chronicle-warnings" data-field="warnings" aria-label="Operational warnings"></section>
    <section class="chronicle-world" data-field="world" aria-label="Active world stories"></section>
    <div class="chronicle-filters">
      <details id="activity-filter"><summary data-field="filterLabel">Event types · All</summary>
        <fieldset data-field="filters"><legend>Show event types</legend></fieldset>
        <button type="button" data-field="all">Select all</button><button type="button" data-field="none">Clear selection</button>
      </details>
      <button type="button" data-field="latest">Read latest dispatches</button>
    </div>
    <ul class="event-list chronicle-list" data-field="list"></ul><p class="chronicle-empty" data-field="empty" hidden></p>
    <div class="chronicle-pager"><button type="button" data-field="newer">Newer</button><small data-field="page"></small><button type="button" data-field="older">Older</button></div>
  </section>`;
  const panel = view.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const saved = { panel, fields, page: 0, warningKeys: [], newsKey: null, lastId: 0, filter: '', renderedPage: -1 };
  for (const [value, name] of Object.entries(JOURNAL_CATEGORIES)) {
    const input = node('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = true;
    const label = node('label');
    label.append(input, document.createTextNode(' ' + name));
    fields.filters.append(label);
  }
  fields.filters.onchange = () => { saved.page = 0; refresh(saved); };
  const selectAll = checked => {
    for (const input of fields.filters.querySelectorAll('input')) input.checked = checked;
    saved.page = 0;
    refresh(saved);
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
  d.append(node('h3', 'Operational warnings'));
  for (const warning of active) {
    const details = node('details');
    details.dataset.warning = warning.id;
    details.open = expanded.has(warning.id);
    const summary = node('summary', warning.title);
    details.append(summary, node('p', warning.text));
    if (v.options.onTab) details.append(action('Open ' + warning.tab, () => v.options.onTab(warning.tab)));
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
  d.append(node('h3', 'Active world stories'));
  const list = node('ul');
  list.className = 'world-stories';
  for (const [id, started] of stories) {
    const entry = WORLD_NEWS[id];
    const expiry = storyExpiryMinute(id, started);
    const end = expiry === null ? 'ongoing' : 'until ' + stamp(expiry / 60, 0);
    const change = (entry.modifier < 0 ? '−' : '+') + Math.abs(entry.modifier / 100) + ' percentage points';
    const row = node('li');
    row.append(node('strong', entry.headline), node('small', GROUPS[entry.group].name + ' discovery multiplier ' + change + ' · ' + end));
    list.append(row);
  }
  d.append(list);
}

function eventIcon(event) {
  const category = eventCategory(event);
  if (category === 'discoveries' && Object.hasOwn(GROUPS, event.group)) return icon(event.group);
  if (category === 'facilities' && Object.hasOwn(SITE_TYPES, event.siteType)) return facilityIcon(event.siteType);
  if (category === 'equipment' && Object.hasOwn(EQUIPMENT, event.itemId)) return equipmentIcon(EQUIPMENT[event.itemId].slot);
  const symbol = { discoveries: 'shield', news: 'news', facilities: 'facilities', equipment: 'cpu', research: 'research' };
  return icon(symbol[category] || 'activity');
}

function refresh(v) {
  const {fields, state} = v;
  refreshWarnings(v);
  refreshWorld(v);
  const selected = new Set([...fields.filters.querySelectorAll('input:checked')].map(input => input.value));
  const filter = [...selected].join('|');
  if (v.lastId === state.nextEventId && v.filter === filter && v.renderedPage === v.page) return;
  fields.filterLabel.textContent = 'Event types · ' +
    (selected.size === Object.keys(JOURNAL_CATEGORIES).length ? 'All' : String(selected.size));
  const filtered = state.events.filter(e => selected.has(eventCategory(e))).reverse();
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
      if (chapter) li.append(action('Read story', () => openStory(chapter, v.options)));
    }
    existing.delete(e.id);
    if (fields.list.children[index] !== li) fields.list.insertBefore(li,fields.list.children[index] || null);
  }
  for (const li of existing.values()) li.remove();
  fields.total.textContent = state.events.length + ' recorded';
  fields.page.textContent = 'Page ' + (v.page + 1) + ' of ' + pages;
  fields.newer.disabled = v.page === 0;
  fields.older.disabled = v.page >= pages - 1;
  fields.latest.disabled = !state.events.length;
  fields.empty.hidden = !!rows.length;
  fields.empty.textContent = rows.length ? '' : selected.size ? 'No events match the selected types.' : 'Select an event type to view its reports.';
}

export function renderChronicle(view, state, options = {}) {
  let v = sessions.get(view);
  if (v?.panel.parentElement !== view) v = mount(view);
  if (v.state !== state) {
    v.lastId = 0; v.page = 0; v.newsKey = null; v.fields.list.replaceChildren();
  }
  v.state = state;
  v.options = options;
  refresh(v);
}
