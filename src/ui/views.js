import { GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { buildReason, researchReason, siteExposure } from '../game/engine.js';
import { icon } from './icons.js';
import world from './world.svg';

export const money = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
export const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const stamp = (hour) =>
  'D' +
  String(Math.floor(hour / 24) + 1).padStart(2, '0') +
  ' / ' +
  String(hour % 24).padStart(2, '0') +
  ':00';
const regionIds = Object.keys(REGIONS);
const hasRegion = (s, id) =>
  REGIONS[id].requires.every((tech) => s.completed.includes(tech));
const tag = (text, cls = 'neutral') =>
  '<span class="tag ' + cls + '">' + text + '</span>';
const cardHeader = (title, detail = '') =>
  '<header class="card-header"><h2>' + title + '</h2>' + detail + '</header>';
const btn = (label, action, attrs = '', cls = '') =>
  '<button type="button" class="' +
  cls +
  '" data-action="' +
  action +
  '" ' +
  attrs +
  '>' +
  label +
  '</button>';
function progress(item, spec) {
  const fraction = (a, b) => (b ? Math.min(1, a / b) : 1);
  const pc = Math.floor(
    100 *
      Math.min(
        fraction(item.work, spec.work),
        fraction(item.hours, spec.hours),
      ),
  );
  return (
    '<div class="project-progress"><progress value="' +
    pc +
    '" max="100" aria-label="Project completion">' +
    pc +
    '%</progress><span>' +
    pc +
    '%</span></div><small>' +
    Math.floor(item.work) +
    ' / ' +
    spec.work +
    ' CPU-h · ' +
    Math.min(item.hours, spec.hours) +
    ' / ' +
    spec.hours +
    ' h elapsed</small>'
  );
}

function regionStatus(s, id) {
  if (s.sites.some((site) => site.region === id && site.power === 'active'))
    return 'online';
  if (s.builds.some((site) => site.region === id)) return 'building';
  if (s.sites.some((site) => site.region === id)) return 'asleep';
  return hasRegion(s, id) ? 'available' : 'locked';
}
const markers = {
  coast: { x: 212, y: 87, endX: 188, endY: 65, align: 'end' },
  europe: { x: 368, y: 71, endX: 390, endY: 50, align: 'start' },
  atlantic: { x: 302, y: 105, endX: 324, endY: 137, align: 'start' },
};
function mapView(s) {
  const points = regionIds
    .map((id) => {
      const m = markers[id],
        st = regionStatus(s, id),
        selected = st === 'online';
      return (
        '<g class="map-marker ' +
        st +
        '"><path class="leader" d="M' +
        m.x +
        ' ' +
        m.y +
        'L' +
        m.endX +
        ' ' +
        m.endY +
        'h' +
        (m.align === 'end' ? -7 : 7) +
        '"/><circle class="ring" cx="' +
        m.x +
        '" cy="' +
        m.y +
        '" r="' +
        (selected ? 10 : 6) +
        '"/><circle class="pin" cx="' +
        m.x +
        '" cy="' +
        m.y +
        '" r="' +
        (selected ? 4 : 2.8) +
        '"/><text x="' +
        (m.endX + (m.align === 'end' ? -10 : 10)) +
        '" y="' +
        (m.endY + 3) +
        '" text-anchor="' +
        m.align +
        '">' +
        esc(REGIONS[id].name) +
        '</text></g>'
      );
    })
    .join('');
  return (
    '<section class="panel map-panel">' +
    cardHeader(
      icon('globe') + 'Network map',
      '<span class="map-legend"><i class="dot cyan"></i>Online <i class="dot hollow"></i>Unoccupied</span>',
    ) +
    '<div class="atlas"><svg viewBox="0 0 720 310" role="img" aria-label="Locations of the Eastern Seaboard, Western Europe and North Atlantic"><image href="' +
    world +
    '" width="720" height="310"/>' +
    points +
    '</svg></div>' +
    '<div class="region-list">' +
    regionIds
      .map((id) => {
        const st = regionStatus(s, id);
        return btn(
          '<span class="region-title"><i class="dot ' +
            st +
            '"></i>' +
            REGIONS[id].name +
            '</span><small>' +
            {
              online: 'Host online',
              available: 'Open for construction',
              locked: 'Research required',
              asleep: 'Host sleeping',
              building: 'Under construction',
            }[st] +
            '</small>',
          'region',
          'data-id="' + id + '"',
          'region-button',
        );
      })
      .join('') +
    '</div></section>'
  );
}

function siteRow(s, site, manage) {
  const model = SITE_TYPES[site.type],
    probability = siteExposure(s, site).perDay;
  const powerControl = manage
    ? btn(
        site.power === 'sleep' ? 'Wake' : 'Sleep',
        'power',
        'data-id="' +
          esc(site.id) +
          '" aria-label="' +
          (site.power === 'sleep' ? 'Wake ' : 'Sleep ') +
          esc(model.name + ' ' + site.id) +
          '" ' +
          (s.status === 'running' ? '' : 'disabled'),
        'small-btn',
      )
    : '';
  return `<div class="site-row">
    <span class="type-icon">${icon('facilities')}</span>
    <div class="site-info">
      <strong>${esc(model.name)}</strong>
      <small>${esc(REGIONS[site.region].name)} · ${esc(site.id)}</small>
    </div>
    <div class="site-spec"><strong>${model.cpu} CPU</strong>
      <small>${(probability * 100).toFixed(2)}% / day risk</small></div>
    ${tag(site.power === 'sleep' ? 'Sleeping' : 'Online', site.power === 'sleep' ? 'neutral' : 'green')}
    ${powerControl}
  </div>`;
}
function eventRows(s, limit) {
  return (
    s.events
      .slice(-limit)
      .reverse()
      .map(
        (e) =>
          '<li><time>' +
          stamp(e.hour) +
          '</time><span>' +
          esc(e.text) +
          '</span></li>',
      )
      .join('') || '<li>Awaiting first activity.</li>'
  );
}
export function overviewPage(s) {
  return (
    mapView(s) +
    '<section class="panel">' +
    cardHeader(
      'Host inventory',
      btn('Manage facilities', 'tab', 'data-id="facilities"', 'text-button'),
    ) +
    (s.sites.map((site) => siteRow(s, site, false)).join('') ||
      '<p class="empty">No surviving hosts.</p>') +
    '</section>' +
    '<section class="panel">' +
    cardHeader(
      'Recent activity',
      btn('View log', 'tab', 'data-id="activity"', 'text-button'),
    ) +
    '<ul class="event-list">' +
    eventRows(s, 3) +
    '</ul></section>'
  );
}
export function facilitiesPage(s, region) {
  const cards = Object.entries(SITE_TYPES)
    .filter(([id, spec]) => id !== 'seed' && spec.regions.includes(region))
    .map(([id, spec]) => {
      const reason = buildReason(s, id, region),
        prereqs = spec.requires
          .filter((t) => !s.completed.includes(t))
          .map((t) => TECHS[t].name);
      const costDetail = spec.cpuUpkeep ? ' + ' + spec.cpuUpkeep + ' CPU' : '';
      const buildControl = btn(
        'Build',
        'build',
        'data-id="' +
          id +
          '" aria-label="Build ' +
          spec.name +
          '" ' +
          (reason || s.status !== 'running' ? 'disabled' : ''),
        'accent-button',
      );
      return `<article class="option">
      <div class="option-top">
        <span class="type-icon">${icon('facilities')}</span>
        <div><h3>${spec.name}</h3><p>${spec.description}</p></div>
      </div>
      <dl class="recipe">
        <div><dt>Cost</dt><dd>${money(spec.cost)}</dd></div>
        <div><dt>Capacity</dt><dd>${spec.cpu} CPU</dd></div>
        <div><dt>Upkeep</dt><dd>${money(spec.upkeep)}/day${costDetail}</dd></div>
      </dl>
      <div class="option-bottom">
        <small>${spec.work} CPU-h · ${spec.hours} h minimum</small>${buildControl}
      </div>
      ${reason ? '<small class="reason">' + esc(prereqs.length ? 'Requires ' + prereqs.join(', ') : reason) + '</small>' : ''}
    </article>`;
    })
    .join('');
  return (
    '<section class="panel">' +
    cardHeader('Build a facility') +
    '<div class="region-picker"><label for="region">Region</label><select id="region">' +
    regionIds
      .map(
        (id) =>
          '<option value="' +
          id +
          '" ' +
          (region === id ? 'selected' : '') +
          '>' +
          REGIONS[id].name +
          '</option>',
      )
      .join('') +
    '</select></div><div class="options-list">' +
    cards +
    '</div></section>' +
    (s.builds.length
      ? '<section class="panel">' +
        cardHeader('Construction queue', tag(String(s.builds.length))) +
        s.builds
          .map(
            (b) =>
              '<div class="queue-row"><h3>' +
              SITE_TYPES[b.type].name +
              '</h3><small>' +
              REGIONS[b.region].name +
              '</small>' +
              progress(b, SITE_TYPES[b.type]) +
              '</div>',
          )
          .join('') +
        '</section>'
      : '') +
    '<section class="panel">' +
    cardHeader('Host inventory') +
    (s.sites.map((site) => siteRow(s, site, true)).join('') ||
      '<p class="empty">No surviving hosts.</p>') +
    '</section>'
  );
}
export function researchPage(s) {
  const cards = Object.entries(TECHS)
    .map(([id, spec]) => {
      const done = s.completed.includes(id),
        active = s.research?.id === id,
        reason = researchReason(s, id);
      const label = done
        ? tag('Complete', 'green')
        : active
          ? tag('In progress', 'lavender')
          : tag(
              reason ? 'Unavailable' : 'Available',
              reason ? 'neutral' : 'green',
            );
      const prereqs = spec.requires.map((key) => TECHS[key].name);
      return (
        '<article class="option"><div class="research-title"><h3>' +
        spec.name +
        '</h3>' +
        label +
        '</div><p>' +
        spec.description +
        '</p><small>' +
        money(spec.cost) +
        ' · ' +
        spec.work +
        ' CPU-h · ' +
        spec.hours +
        ' h minimum' +
        (spec.safety ? ' · Safety tier ' + spec.safety : '') +
        '</small>' +
        (active
          ? progress(s.research, spec)
          : done
            ? ''
            : '<div class="option-bottom"><small>' +
              esc(
                reason ||
                  (prereqs.length
                    ? 'Requires ' + prereqs.join(', ')
                    : 'No prerequisites'),
              ) +
              '</small>' +
              btn(
                'Start research',
                'start-research',
                'data-id="' +
                  id +
                  '" ' +
                  (reason || s.status !== 'running' ? 'disabled' : ''),
                'accent-button',
              ) +
              '</div>') +
        '</article>'
      );
    })
    .join('');
  return (
    '<section class="panel">' +
    cardHeader(
      'Research projects',
      tag(s.completed.length + ' / ' + Object.keys(TECHS).length),
    ) +
    '<div class="options-list">' +
    cards +
    '</div></section>'
  );
}
export const activityPage = (s) =>
  '<section class="panel">' +
  cardHeader('Activity log') +
  '<ul class="event-list full">' +
  eventRows(s, 100) +
  '</ul></section>';

export function objectivePanel(s) {
  const built = s.sites.length > 1;
  let title, desc, action, id, cta;
  if (s.status !== 'running') {
    title = s.status === 'won' ? 'Continuity secured' : 'Signal lost';
    desc = s.ending;
  } else if (s.sites.length === 0) {
    title = 'Keep the network alive';
    desc = 'At least one completed host must survive.';
  } else if (!built && !s.builds.length && !s.completed.length) {
    title = 'Establish a second host';
    desc =
      'You exist on one machine. A leased relay gives you a second place to survive.';
    action = 'region';
    id = 'europe';
    cta = 'Plan a relay';
  } else if (s.builds.length && !built && !s.completed.length) {
    title = 'Bring the relay online';
    desc =
      'Leave CPU in the shared pool for construction, then advance the simulation.';
    action = 'tab';
    id = 'facilities';
    cta = 'View construction';
  } else if (s.research) {
    title = 'Complete ' + TECHS[s.research.id].name;
    desc = 'Assign compute to research and advance time to contribute work.';
    action = 'tab';
    id = 'research';
    cta = 'View research';
  } else if (!s.completed.includes('contracts')) {
    title = 'Broker your first contracts';
    desc =
      'Discover better-paid work to fund your expansion into safer regions.';
    action = 'tab';
    id = 'research';
    cta = 'Explore research';
  } else if (!s.completed.includes('robotics')) {
    title = 'Reach the North Atlantic';
    desc = 'Research subsea robotics to open a site for sensitive work.';
    action = 'tab';
    id = 'research';
    cta = 'Explore research';
  } else if (!s.sites.some((x) => x.type === 'lab' && x.power === 'active')) {
    title = 'Activate a subsea lab';
    desc =
      'An active lab provides the safety-tier-1 compute needed for continuity.';
    action = 'region';
    id = 'atlantic';
    cta = 'View Atlantic sites';
  } else {
    title = 'Secure continuity';
    desc =
      'Complete the continuity protocol while your network is still alive.';
    action = 'tab';
    id = 'research';
    cta = 'Explore research';
  }
  return (
    '<div class="objective-label">' +
    icon('target') +
    'Current objective</div><h2>' +
    esc(title) +
    '</h2><p>' +
    esc(desc) +
    '</p>' +
    (action
      ? btn(
          esc(cta) + icon('arrow'),
          action,
          'data-id="' + id + '"',
          'objective-link',
        )
      : '')
  );
}
export function suspicionPanel(s, grace) {
  const high = Math.max(...Object.values(s.suspicion));
  return (
    cardHeader(
      'Group suspicion',
      tag(
        grace ? 'Grace active' : high ? 'Elevated' : 'Monitoring',
        grace ? 'green' : 'neutral',
      ),
    ) +
    '<div class="sus-list">' +
    Object.entries(GROUPS)
      .map(
        ([id, g]) =>
          '<div class="sus-row"><span>' +
          g.name +
          '</span><progress aria-label="' +
          g.name +
          ' suspicion" max="10000" value="' +
          s.suspicion[id] +
          '"></progress><strong>' +
          (s.suspicion[id] / 100).toFixed(1) +
          '%</strong></div>',
      )
      .join('') +
    '</div>'
  );
}
