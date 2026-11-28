import { regionAvailable } from '../game/geography.js';
import { REGIONS, TECHS } from '../game/content.js';
import { siteHardware } from '../game/equipment.js';
import { icon } from './icons.js';
import { createSunlightRenderer, startingDay, sunAt } from './solar.js';
import coastlines from './world.svg';
import './atlas.css';

// Representative facility locations in degrees east and north, on an equirectangular map.
const ground = {
  coast: [-100, 40], southAmerica: [-57, -15], europe: [13, 51], africa: [20, 8],
  asia: [92, 47], australia: [133, -24], antarctic: [22, -75], atlantic: [-34, 25],
};
// Each chart symbol reads at both sizes: an orbital satellite, cratered moon,
// comet with its icy nucleus, and an impossible pair of concentric gateways.
const orbitalGlyphs = {
  orbit: '<ellipse class="atlas-orbit-line" cx="24" cy="26" rx="21" ry="12" transform="rotate(-23 24 26)"/><g transform="rotate(-30 24 23)"><path class="atlas-glyph-fill" d="M18 16h12v14H18zM3 19h11v8H3zm31 0h11v8H34z"/><path d="M14 23h4m12 0h4M9 19v8m30-8v8M25 16v-5m-5 0q5 6 10 0m-9 19 3 4 3-4"/></g>',
  moon: '<circle class="atlas-glyph-fill" cx="24" cy="24" r="17"/><path class="atlas-orbit-line" d="M26 7q-17 15-4 34"/><ellipse cx="31" cy="18" rx="4" ry="3" transform="rotate(-27 31 18)"/><path d="M24 31q3-4 7-2m-15-9 1-1m15 7 1 1"/><path class="atlas-orbit-line" d="M4 30q-3 11 18 4m12-4q12-5 11-10"/>',
  farReaches: '<path class="atlas-orbit-line" d="m6 22 24-13M9 29l15-9M18 32l9-5"/><path class="atlas-glyph-fill" d="m26 13 9-3 7 5-2 8-8 3-7-5z"/><path d="m27 16 8-3 4 3m-7 5 3-2"/><circle class="atlas-orbit-line" cx="13" cy="38" r="4"/><path class="atlas-orbit-line" d="M4 41q9 1 17-7m17-29v4m-2-2h4"/>',
  transdimensional: '<path class="atlas-glyph-fill" d="m24 3 18 10v21L24 45 6 34V13z"/><path d="m6 13 18 10 18-10M24 23v22"/><path class="atlas-orbit-line" d="m24 10 11 7v13l-11 7-11-7V17zm0 0v13m-11 7 11-7 11 7"/><path d="m19 20 5-3 5 3v6l-5 3-5-3z"/>',
};

function destination(id) {
  const name = REGIONS[id].name;
  const counts = '<small class="atlas-count" aria-hidden="true"></small><b class="atlas-trace" aria-hidden="true"></b>';
  const lock = '<span class="atlas-lock" aria-hidden="true">' + icon('lock') + '</span>';
  const attributes = 'type="button" data-action="region" data-id="' + id + '" aria-label="' + name + ' facilities"';
  if (ground[id]) {
    const [lon, lat] = ground[id];
    const style = '--x:' + ((lon + 180) / 3.6) + '%;--y:' + ((90 - lat) / 1.8) + '%';
    return '<button ' + attributes + ' class="atlas-pin" style="' + style + '">' +
      '<span class="atlas-target" aria-hidden="true"></span><span class="atlas-name">' + lock + name + counts + '</span></button>';
  }
  return '<button ' + attributes + ' class="atlas-outpost">' +
    '<svg class="atlas-glyph" aria-hidden="true" viewBox="0 0 48 48">' + orbitalGlyphs[id] + '</svg>' +
    '<span class="atlas-outpost-name">' + lock + name + counts + '</span></button>';
}

const views = new WeakMap();

function mount(container) {
  const regions = Object.keys(REGIONS);
  container.innerHTML = `<section id="world-atlas" class="navigation-atlas panel" aria-labelledby="atlas-title">
    <header class="card-header"><h2 id="atlas-title">${icon('globe')}Network map</h2><span class="atlas-date"></span></header>
    <div class="atlas-field"><div class="atlas-layout">
    <div class="atlas-planet"><div class="atlas-geography">
      <img src="${coastlines}" alt="" draggable="false">
      <canvas width="480" height="240" aria-hidden="true"></canvas>
      ${regions.filter(id => ground[id]).map(destination).join('')}
    </div></div>
    <div class="atlas-horizon" role="group" aria-label="Off-world sites"><span class="atlas-caption">Off-world sites</span>
      <div class="atlas-outposts">${regions.filter(id => !ground[id]).map(destination).join('')}</div>
    </div>
    </div></div>
    <footer class="atlas-key"><span><i class="atlas-status-light online"></i>Host online</span>
      <span><i class="atlas-status-light building"></i>Under construction</span>
      <span><i class="atlas-status-light asleep"></i>Asleep</span>
      <span class="atlas-pending-key" hidden><i class="atlas-status-light pending"></i>Awaiting CPU</span>
      <span><i class="atlas-status-light"></i>Unoccupied</span><span>Numbers count hosts and builds</span>
      <span data-trace-key="latest" hidden>◆ Latest discovery</span><span data-trace-key="previous" hidden>◇ Previous discovery</span></footer>
  </section>`;
  const atlas = container.querySelector('#world-atlas');
  const view = {
    atlas,
    date: atlas.querySelector('.atlas-date'),
    pendingKey: atlas.querySelector('.atlas-pending-key'),
    latestKey: atlas.querySelector('[data-trace-key="latest"]'),
    previousKey: atlas.querySelector('[data-trace-key="previous"]'),
    paint: createSunlightRenderer(atlas.querySelector('canvas')),
    buttons: [...atlas.querySelectorAll('button[data-id]')],
    minute: null,
  };
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
  if (view.minute !== minute || view.showLight !== showLight || view.regionSeed !== state.regionSeed) {
    const sun = sunAt(state.hour, state.minute, startingDay(state.regionSeed));
    if (showLight) view.paint(sun);
    view.showLight = showLight;
    view.date.textContent = sun.label;
    view.minute = minute;
    view.regionSeed = state.regionSeed;
  }
}

export function updateAtlas(container, state) {
  let view = views.get(container);
  if (!view || view.atlas.parentElement !== container) view = mount(container);
  updateAtlasTime(container, state);
  let hasPending = false;
  const presence = occupancy(state);
  const advanced = state.completed.includes('advancedSocioanalytics');
  const latest = (advanced || state.completed.includes('socioanalytics')) ? state.recentRegions[0] : undefined;
  const previous = advanced ? state.recentRegions[1] : undefined;
  view.latestKey.hidden = !latest;
  view.previousKey.hidden = !previous;
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
    button.dataset.summary = signature;
    button.disabled = !unlocked;
    button.dataset.status = key;
    button.querySelector('.atlas-count').textContent = completed + builds;
    button.querySelector('.atlas-trace').textContent = trace;
    const detail = !unlocked
      ? 'Locked · Requires ' + REGIONS[id].requires.filter(tech => !state.completed.includes(tech)).map(tech => TECHS[tech].name).join(', ')
      : description + ' · ' + completed + ' completed · ' + builds + ' under construction' +
      (latestHere ? ' · Latest discovery' : '') + (previousHere ? ' · Previous discovery' : '');
    button.title = REGIONS[id].name + ' · ' + detail;
    button.setAttribute('aria-description', detail);
  }
  view.pendingKey.hidden = !hasPending;
}
