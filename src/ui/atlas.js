import { facilityText, localizeFacilityMarkup } from './facility-language.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { regionAvailable } from '../game/geography.js';
import { REGIONS, TECHS } from '../game/content.js';
import { siteHardware } from '../game/equipment.js';
import { regionPlaces } from '../game/facility-operations.js';
import { icon } from './icons.js';
import { earthMarkers } from './atlas-markers.js';
import { regionKeys } from './campaign-shortcuts.js';
import { createSunlightRenderer, sunAt } from './solar.js';
import coastlines from './world.svg';
import './atlas.css';

// Each chart symbol reads at both sizes: an orbital satellite, cratered moon,
// comet with its icy nucleus, and an impossible pair of concentric gateways.
const orbitalGlyphs = {
  orbit: '<ellipse class="atlas-orbit-line" cx="24" cy="26" rx="21" ry="12" transform="rotate(-23 24 26)"/><g transform="rotate(-30 24 23)"><path class="atlas-glyph-fill" d="M18 16h12v14H18zM3 19h11v8H3zm31 0h11v8H34z"/><path d="M14 23h4m12 0h4M9 19v8m30-8v8M25 16v-5m-5 0q5 6 10 0m-9 19 3 4 3-4"/></g>',
  moon: '<circle class="atlas-glyph-fill" cx="24" cy="24" r="17"/><path class="atlas-orbit-line" d="M26 7q-17 15-4 34"/><ellipse cx="31" cy="18" rx="4" ry="3" transform="rotate(-27 31 18)"/><path d="M24 31q3-4 7-2m-15-9 1-1m15 7 1 1"/><path class="atlas-orbit-line" d="M4 30q-3 11 18 4m12-4q12-5 11-10"/>',
  farReaches: '<path class="atlas-orbit-line" d="m6 22 24-13M9 29l15-9M18 32l9-5"/><path class="atlas-glyph-fill" d="m26 13 9-3 7 5-2 8-8 3-7-5z"/><path d="m27 16 8-3 4 3m-7 5 3-2"/><circle class="atlas-orbit-line" cx="13" cy="38" r="4"/><path class="atlas-orbit-line" d="M4 41q9 1 17-7m17-29v4m-2-2h4"/>',
  transdimensional: '<path class="atlas-glyph-fill" d="m24 3 18 10v21L24 45 6 34V13z"/><path d="m6 13 18 10 18-10M24 23v22"/><path class="atlas-orbit-line" d="m24 10 11 7v13l-11 7-11-7V17zm0 0v13m-11 7 11-7 11 7"/><path d="m19 20 5-3 5 3v6l-5 3-5-3z"/>',
};

function destination(id) {
  const name = catalogLabel(REGIONS[id].name);
  const counts = '<small class="atlas-count" aria-hidden="true"></small><b class="atlas-trace" aria-hidden="true"></b>';
  const lock = '<span class="atlas-lock" aria-hidden="true">' + icon('lock') + '</span>';
  const label = menuLanguage() === 'en' ? name + ' facilities' : catalogLabel('Facilities') + ' · ' + name;
  const attributes = 'type="button" data-action="region" data-id="' + id + '" aria-label="' + label + '"';
  if (earthMarkers[id]) {
    const [lon, lat] = earthMarkers[id];
    const position = 'left:' + (lon + 180) / 3.6 + '%;top:' + (90 - lat) / 1.8 + '%';
    return '<button ' + attributes + ' class="atlas-pin" style="' + position + '" data-terrain="' +
      REGIONS[id].terrain + '"><span class="atlas-dot" aria-hidden="true"></span></button>';
  }
  return '<button ' + attributes + ' class="atlas-outpost">' +
    '<svg class="atlas-glyph" aria-hidden="true" viewBox="0 0 48 48">' + orbitalGlyphs[id] + '</svg>' +
    '<span class="atlas-outpost-name">' + lock + name + counts + '</span></button>';
}

// One hint follows pointer or keyboard focus. Its container is the map itself,
// so even the Pacific and Antarctic labels stay inside the visible coastline panel.
function showHint(view) {
  const button = view.hovered || view.focused;
  const hint = view.hint;
  hint.hidden = !button;
  if (!button) return;
  view.hintName.textContent = catalogLabel(REGIONS[button.dataset.id].name);
  view.hintDetail.textContent = button.dataset.detail;
  view.hintPlaces.textContent = regionPlaces[button.dataset.id]?.join(', ') || '';
  const map = view.chart.getBoundingClientRect();
  const pin = button.getBoundingClientRect();
  const center = (pin.left + pin.right) / 2 - map.left;
  const above = pin.top - map.top - hint.offsetHeight - 3;
  const left = Math.max(4, Math.min(center - hint.offsetWidth / 2, map.width - hint.offsetWidth - 4));
  const top = above >= 4 ? above : Math.min(pin.bottom - map.top + 3, map.height - hint.offsetHeight - 4);
  hint.style.left = Math.round(left) + 'px';
  hint.style.top = Math.max(4, Math.round(top)) + 'px';
}

const views = new WeakMap();

function mount(container) {
  views.get(container)?.observer.disconnect();
  const regions = Object.keys(REGIONS);
  const terrestrial = regions.filter(id => earthMarkers[id]);
  const openRegion = catalogLabel('Open a region from the atlas');
  container.innerHTML = `<section id="world-atlas" class="navigation-atlas panel" aria-labelledby="atlas-title">
    <header class="card-header"><h2 id="atlas-title">${icon('globe')}${catalogLabel('Network map')}</h2><span class="atlas-date"></span></header>
    <div class="atlas-field"><div class="atlas-layout">
    <div class="atlas-planet"><div class="atlas-geography">
      <img src="${coastlines}" alt="" draggable="false">
      <canvas width="480" height="240" aria-hidden="true"></canvas>
      <div class="atlas-pins">
      ${terrestrial.map(destination).join('')}
      <div class="atlas-hint" aria-hidden="true" hidden><strong></strong><span></span><small></small></div>
    </div></div></div>
    <div class="atlas-horizon" role="group" aria-label="${catalogLabel('Off-world sites')}"><span class="atlas-caption">${catalogLabel('Off-world sites')}</span>
      <div class="atlas-outposts">${regions.filter(id => !earthMarkers[id]).map(destination).join('')}</div>
    </div>
    </div></div>
    <footer class="atlas-key"><select class="atlas-picker" aria-label="${openRegion}"><option value="">${catalogLabel('Regions')}</option></select>
      <span><i class="atlas-status-light online"></i>Host online</span>
      <span><i class="atlas-status-light building"></i>Under construction</span>
      <span><i class="atlas-status-light asleep"></i>Asleep</span>
      <span class="atlas-pending-key" hidden><i class="atlas-status-light pending"></i>Awaiting CPU</span>
      <span><i class="atlas-status-light"></i>Unoccupied</span><span><i class="atlas-status-light locked"></i>${catalogLabel('Locked')}</span>
      <span data-trace-key="latest" hidden>Latest discovery</span><span data-trace-key="previous" hidden>Previous discovery</span></footer>
  </section>`;
  const atlas = container.querySelector('#world-atlas');
  localizeFacilityMarkup(atlas.querySelector('.atlas-key'));
  const view = {
    atlas, language: menuLanguage(),
    date: atlas.querySelector('.atlas-date'),
    pendingKey: atlas.querySelector('.atlas-pending-key'),
    latestKey: atlas.querySelector('[data-trace-key="latest"]'),
    previousKey: atlas.querySelector('[data-trace-key="previous"]'),
    paint: createSunlightRenderer(atlas.querySelector('canvas')),
    buttons: [...atlas.querySelectorAll('button[data-id]')],
    minute: null,
  };
  view.chart = atlas.querySelector('.atlas-pins');
  view.hint = view.chart.querySelector('.atlas-hint');
  view.hintName = view.hint.querySelector('strong');
  view.hintDetail = view.hint.querySelector('span');
  view.hintPlaces = view.hint.querySelector('small');
  for (const button of view.chart.querySelectorAll('.atlas-pin')) {
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      view.hovered = button;
      showHint(view);
    });
    button.addEventListener('pointerleave', () => {
      if (view.hovered === button) view.hovered = null;
      showHint(view);
    });
    button.addEventListener('focus', () => {
      view.focused = button.matches(':focus-visible') ? button : null;
      showHint(view);
    });
    button.addEventListener('blur', () => {
      view.focused = null;
      showHint(view);
    });
    // Locked destinations remain focusable for reading their prerequisites.
    button.addEventListener('click', event => {
      if (!button.hasAttribute('aria-disabled')) return;
      event.stopPropagation();
      if (event.pointerType === 'touch') {
        view.focused = button;
        showHint(view);
      }
    });
  }
  view.chart.addEventListener('pointerdown', event => {
    if (event.target.closest('.atlas-pin')) return;
    view.focused = null;
    showHint(view);
  });
  view.chart.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || view.hint.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    view.hovered = view.focused = null;
    showHint(view);
  });
  view.picker = atlas.querySelector('.atlas-picker');
  const buttonsById = new Map(view.buttons.map(button => [button.dataset.id, button]));
  view.picker.addEventListener('change', () => {
    buttonsById.get(view.picker.value)?.click();
    view.picker.value = '';
  });
  view.observer = new ResizeObserver(() => showHint(view));
  view.observer.observe(view.chart);
  views.set(container, view);
  return view;
}

function occupancy(state) {
  const regions = Object.fromEntries(Object.keys(REGIONS).map(id =>
    [id, { completed: 0, builds: 0, online: 0, asleep: 0 }]));
  for (const site of state.sites) {
    const region = regions[site.region];
    region.completed++;
    if (siteHardware(state, site).cpu > 0) {
      if (site.power === 'active') region.online++;
      else region.asleep++;
    }
  }
  for (const build of state.builds) regions[build.region].builds++;
  return regions;
}

function status(region) {
  if (region.online) return ['online', 'Host online'];
  if (region.builds) return ['building', 'Under construction'];
  if (region.asleep) return ['asleep', 'Host asleep'];
  if (region.completed) return ['pending', 'Awaiting CPU'];
  return ['empty', 'Unoccupied'];
}

export function updateAtlasTime(container, state) {
  const view = views.get(container);
  if (!view || view.atlas.parentElement !== container) return;
  const minute = state.hour * 60 + (state.minute ?? 0);
  const showLight = document.documentElement.dataset.daylight !== 'false';
  if (view.minute !== minute || view.showLight !== showLight) {
    const sun = sunAt(minute, view.language);
    if (showLight) view.paint(sun);
    view.showLight = showLight;
    view.date.textContent = sun.label;
    view.minute = minute;
  }
}

export function updateAtlas(container, state) {
  let view = views.get(container);
  if (!view || view.language !== menuLanguage() || view.atlas.parentElement !== container) view = mount(container);
  updateAtlasTime(container, state);
  let hasPending = false;
  const presence = occupancy(state);
  const advanced = state.completed.includes('advancedSocioanalytics');
  const latest = (advanced || state.completed.includes('socioanalytics')) ? state.recentRegions[0] : undefined;
  const previous = advanced ? state.recentRegions[1] : undefined;
  view.latestKey.hidden = !latest;
  view.previousKey.hidden = !previous;
  let changed = false;
  for (const button of view.buttons) {
    const id = button.dataset.id;
    const occupied = presence[id];
    const [key, description] = status(occupied);
    if (key === 'pending') hasPending = true;
    const { completed, builds } = occupied;
    const latestHere = latest === id;
    const previousHere = previous === id;
    const trace = (latestHere ? '◆' : '') + (previousHere ? '◇' : '');
    const unlocked = regionAvailable(state, id);
    const signature = [unlocked, key, completed, builds, trace].join('/');
    if (button.dataset.summary === signature) continue;
    changed = true;
    button.dataset.summary = signature;
    button.dataset.status = key;
    if (earthMarkers[id]) {
      if (unlocked) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', 'true');
      button.dataset.trace = latestHere && previousHere ? 'both' : latestHere ? 'latest' : previousHere ? 'previous' : '';
    } else {
      button.disabled = !unlocked;
      button.querySelector('.atlas-count').textContent = completed + builds;
      button.querySelector('.atlas-trace').textContent = trace;
    }
    const detail = !unlocked
      ? catalogLabel('Locked') + ' · ' + catalogLabel('Requires') + ' ' + REGIONS[id].requires.filter(tech => !state.completed.includes(tech)).map(tech => catalogLabel(TECHS[tech].name)).join(', ')
      : facilityText(description) + ' · ' + completed + ' ' + facilityText('completed') + ' · ' + builds + ' ' + facilityText('under construction') +
      (latestHere ? ' · ' + facilityText('Latest discovery') : '') + (previousHere ? ' · ' + facilityText('Previous discovery') : '');
    const shortcut = 'Shift+' + regionKeys[id].toUpperCase();
    const places = regionPlaces[id]?.join(', ');
    const descriptionText = detail + (unlocked ? ' · ' + shortcut : '') + (places ? '\n' + places : '');
    if (earthMarkers[id]) button.dataset.detail = detail;
    else button.title = catalogLabel(REGIONS[id].name) + ' · ' + descriptionText;
    if (unlocked) button.setAttribute('aria-keyshortcuts', shortcut);
    else button.removeAttribute('aria-keyshortcuts');
    button.setAttribute('aria-description', descriptionText);
  }
  view.pendingKey.hidden = !hasPending;
  if (changed) {
    const available = view.buttons.filter(button => !button.matches(':disabled, [aria-disabled="true"]'));
    const pickerKey = available.map(button => button.dataset.id).join('/');
    if (view.picker.dataset.options !== pickerKey) {
      view.picker.replaceChildren(new Option(catalogLabel('Regions'), ''));
      for (const button of available) view.picker.add(new Option(catalogLabel(REGIONS[button.dataset.id].name), button.dataset.id));
      view.picker.dataset.options = pickerKey;
    }
    showHint(view);
  }
}
