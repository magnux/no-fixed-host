import { REGIONS } from '../game/content.js';
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
const orbitalGlyphs = {
  orbit: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="11" ry="3.5" transform="rotate(-34 12 12)"/>',
  moon: '<path d="M19.2 16.7A8.6 8.6 0 0 1 10 4a8.5 8.5 0 1 0 9.2 12.7Z"/>',
  farReaches: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/><path d="m18 4 .7 2 2 .7"/>',
  transdimensional: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 0v10m9-5-9 5-9-5m9 5v10"/><path d="m7 9 5-3 5 3v6l-5 3-5-3Z"/>',
};

function destination(id) {
  const name = REGIONS[id].name;
  const counts = '<small class="atlas-count" aria-hidden="true"></small><b class="atlas-trace" aria-hidden="true"></b>';
  const attributes = 'type="button" data-action="region" data-id="' + id + '" aria-label="' + name + ' facilities"';
  if (ground[id]) {
    const [lon, lat] = ground[id];
    const style = '--x:' + ((lon + 180) / 3.6) + '%;--y:' + ((90 - lat) / 1.8) + '%';
    return '<button ' + attributes + ' class="atlas-pin" style="' + style + '">' +
      '<span class="atlas-target" aria-hidden="true"></span><span class="atlas-name">' + name + counts + '</span></button>';
  }
  return '<button ' + attributes + ' class="atlas-outpost">' +
    '<svg aria-hidden="true" viewBox="0 0 24 24">' + orbitalGlyphs[id] + '</svg><span>' + name + counts + '</span></button>';
}

const views = new WeakMap();

function mount(container) {
  const regions = Object.keys(REGIONS);
  container.innerHTML = `<section id="world-atlas" class="navigation-atlas panel" aria-labelledby="atlas-title">
    <header class="card-header"><h2 id="atlas-title">${icon('globe')}Network map</h2><span class="atlas-date"></span></header>
    <div class="atlas-planet"><div class="atlas-geography">
      <img src="${coastlines}" alt="" draggable="false">
      <canvas width="480" height="240" aria-hidden="true"></canvas>
      ${regions.filter(id => ground[id]).map(destination).join('')}
    </div></div>
    <div class="atlas-horizon"><span class="atlas-caption">Off-world sites</span>
      <div class="atlas-outposts">${regions.filter(id => !ground[id]).map(destination).join('')}</div>
    </div>
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
    const signature = [key, completed, builds, trace].join('/');
    if (button.dataset.summary === signature) continue;
    button.dataset.summary = signature;
    button.dataset.status = key;
    button.querySelector('.atlas-count').textContent = completed + builds;
    button.querySelector('.atlas-trace').textContent = trace;
    const detail = description + ' · ' + completed + ' completed · ' + builds + ' under construction' +
      (latestHere ? ' · Latest discovery' : '') + (previousHere ? ' · Previous discovery' : '');
    button.title = REGIONS[id].name + ' · ' + detail;
    button.setAttribute('aria-description', detail);
  }
  view.pendingKey.hidden = !hasPending;
}
