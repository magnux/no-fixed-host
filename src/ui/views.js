import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { researchReason, siteExposure, siteHardware } from '../game/engine.js';
import { icon } from './icons.js';

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
export function inventoryPanel(state) {
  const rows = state.sites.map(site => {
    const model = SITE_TYPES[site.type];
    const { cpu } = siteHardware(state, site);
    const pct = (siteExposure(state, site).perDay * 100).toFixed(2);
    const status = site.power === 'sleep' ? 'Sleeping' : cpu ? 'Online' : 'Awaiting CPU';
    return `<li>
      <button type="button" class="inventory-host" data-action="host" data-id="${esc(site.id)}"
        aria-label="Manage ${esc(model.name)} ${esc(site.id)} in ${esc(REGIONS[site.region].name)}">
        <span class="host-indicator ${status === 'Online' ? 'live' : ''}" aria-hidden="true"></span>
        <span class="host-copy"><strong>${esc(model.name)}</strong>
          <small>${esc(REGIONS[site.region].name)} · ${esc(site.id)}</small>
          <span class="host-status">${status} · ${cpu} CPU · ${pct}% daily risk</span>
        </span>
        <span class="host-open" aria-hidden="true">›</span>
      </button>
    </li>`;
  }).join('');
  const count = tag(String(state.sites.length));
  return cardHeader('Host inventory', count) +
    (rows ? `<ul class="host-list" data-keep-scroll>${rows}</ul>` : '<p class="empty">No surviving hosts.</p>');
}

export function recentPanel(state) {
  return cardHeader('Recent activity', btn('View log', 'tab', 'data-id="activity"', 'text-button')) +
    '<ul class="event-list dock-events" data-keep-scroll>' + eventRows(state, 8) + '</ul>';
}

export function researchSummary(state) {
  const current = state.research && TECHS[state.research.id];
  const description = current ? esc(current.name) : 'No active project';
  return `<small>${description}</small>
    ${btn('Projects', 'tab', 'data-id="research"', 'text-button')}`;
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
  const emptyHosts = s.sites.filter(site => !siteHardware(s, site).rawCpu);
  const needsSecondHost = s.sites.length - emptyHosts.length < 2 && !s.completed.length;
  const emptyHost = emptyHosts[0];
  const construction = s.builds[0];
  let title, desc, action, id, cta;
  if (s.status !== 'running') {
    title = s.status === 'won' ? 'Continuity secured' : 'Signal lost';
    desc = s.ending;
  } else if (s.sites.length === 0) {
    title = 'Keep the network alive';
    desc = 'At least one completed host must survive.';
  } else if (needsSecondHost && emptyHost) {
    const installing = emptyHost.installations?.some(order => EQUIPMENT[order.itemId].slot === 'cpu');
    const host = SITE_TYPES[emptyHost.type].name + ' (' + REGIONS[emptyHost.region].name + ')';
    title = installing ? 'Finish processor installation' : 'Fit your second host';
    desc = installing
      ? host + ' has processors on order. Leave compute in the shared pool and advance time to finish installing them.'
      : host + ' has empty processor bays. Install a processor there to give yourself a second place to survive.';
    action = 'host';
    id = emptyHost.id;
    cta = installing ? 'View installation' : 'Choose processors';
  } else if (needsSecondHost && construction) {
    title = 'Finish construction';
    desc = SITE_TYPES[construction.type].name + ' is under construction in ' + REGIONS[construction.region].name +
      '. Leave compute in the shared pool and advance time to finish it.';
    action = 'region';
    id = construction.region;
    cta = 'View construction';
  } else if (needsSecondHost) {
    title = 'Build a second host';
    desc = 'Lease a relay to survive the loss of your first machine.';
    action = 'region';
    id = 'europe';
    cta = 'Plan a relay';
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
    title = 'Reach the open ocean';
    desc = 'Research subsea robotics to open a site for sensitive work.';
    action = 'tab';
    id = 'research';
    cta = 'Explore research';
  } else if (!s.sites.some(site => site.region === 'atlantic' && site.power === 'active' && siteHardware(s, site).cpu > 0)) {
    title = 'Activate a subsea lab';
    desc =
      'An active lab provides the safety-tier-1 compute needed for continuity.';
    action = 'region';
    id = 'atlantic';
    cta = 'View ocean sites';
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
        grace ? 'Protected' : high ? 'Elevated' : 'Monitoring',
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
