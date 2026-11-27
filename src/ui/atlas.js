import { REGIONS } from '../game/content.js';
import { siteHardware } from '../game/equipment.js';
import { icon } from './icons.js';
import { createSunlightRenderer, sunAt } from './solar.js';
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
  const attributes = 'type="button" data-action="region" data-id="' + id + '" aria-label="' + name + ' facilities"';
  if (ground[id]) {
    const [lon, lat] = ground[id];
    const style = '--x:' + ((lon + 180) / 3.6) + '%;--y:' + ((90 - lat) / 1.8) + '%';
    return '<button ' + attributes + ' class="atlas-pin" style="' + style + '">' +
      '<span class="atlas-target" aria-hidden="true"></span><span class="atlas-name">' + name + '</span></button>';
  }
  return '<button ' + attributes + ' class="atlas-outpost">' +
    '<svg aria-hidden="true" viewBox="0 0 24 24">' + orbitalGlyphs[id] + '</svg><span>' + name + '</span></button>';
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
      <span><i class="atlas-status-light"></i>Unoccupied</span></footer>
  </section>`;
  const atlas = container.querySelector('#world-atlas');
  const view = {
    atlas,
    date: atlas.querySelector('.atlas-date'),
    pendingKey: atlas.querySelector('.atlas-pending-key'),
    paint: createSunlightRenderer(atlas.querySelector('canvas')),
    buttons: [...atlas.querySelectorAll('button[data-id]')],
    hour: null,
  };
  views.set(container, view);
  return view;
}

function status(state, region) {
  const hosts = state.sites.filter(site => site.region === region);
  const viableHosts = hosts.filter(host => siteHardware(state, host).cpu > 0);
  if (viableHosts.some(host => host.power === 'active')) return ['online', 'Host online'];
  if (state.builds.some(build => build.region === region)) return ['building', 'Under construction'];
  if (viableHosts.length) return ['asleep', 'Host asleep'];
  if (hosts.length) return ['pending', 'Awaiting CPU'];
  return ['empty', 'Unoccupied'];
}

export function updateAtlas(container, state) {
  let view = views.get(container);
  if (!view || view.atlas.parentElement !== container) view = mount(container);
  if (view.hour !== state.hour) {
    const sun = sunAt(state.hour);
    view.paint(sun);
    view.date.textContent = sun.label;
    view.hour = state.hour;
  }
  let hasPending = false;
  for (const button of view.buttons) {
    const id = button.dataset.id;
    const [key, description] = status(state, id);
    if (key === 'pending') hasPending = true;
    if (button.dataset.status === key) continue;
    button.dataset.status = key;
    button.title = REGIONS[id].name + ' · ' + description;
    button.setAttribute('aria-description', description);
  }
  view.pendingKey.hidden = !hasPending;
}
