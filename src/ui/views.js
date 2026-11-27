import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { siteExposure, siteHardware } from '../game/engine.js';
import { networkDiscoveryReading, suspicionReading } from '../game/awareness.js';
import { researchEffects } from '../game/research.js';
import { researchProjects } from '../game/research-tasks.js';
import { storyKey } from '../game/chronicle.js';
import { icon } from './icons.js';
import { groupDangerForState } from '../game/events.js';

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
export const stamp = (hour, minute = 0) =>
  'D' +
  String(Math.floor(hour / 24) + 1).padStart(2, '0') +
  ' / ' +
  String(hour % 24).padStart(2, '0') +
  ':' + String(minute).padStart(2, '0');
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
const isNews = event => event.kind.startsWith('news.');
const changesCoverage = event => ['news.world', 'news.expired'].includes(event.kind);

function eventRows(events, limit) {
  return events.slice(-limit).reverse().map(event => {
    const headline = event.headline ? '<strong>' + esc(event.headline) + '</strong>' : '';
    const category = isNews(event) ? 'news' : event.kind === 'site.discovered' ? 'discovery' : 'activity';
    const chapter = storyKey(event);
    const readChapter = chapter && event.kind !== 'campaign.started' ? btn('Read chapter', 'chapter', 'data-id="' + chapter + '"', 'text-button') : '';
    const desk = changesCoverage(event) ? 'Investigation update' : isNews(event) ? (event.desk || 'Bulletin') : '';
    return '<li data-kind="' + category + '"><time>' + stamp(event.hour, event.minute) + (desk ? ' · ' + esc(desk) : '') + '</time>' +
      '<div>' + headline + '<span>' + esc(event.text) + '</span>' + readChapter + '</div></li>';
  }).join('');
}

export function newsPanel(state) {
  const news = state.events.filter(isNews);
  const latest = news.slice(-4);
  const update = news.findLast(changesCoverage);
  // Keep a recent change in investigator behavior readable through several editions of the wire.
  if (update && !latest.includes(update) && state.hour - update.hour <= 22 * 24) latest[0] = update;
  const active = Object.keys(state.news.stories).length;
  const coverage = active ? btn('Coverage (' + active + ')', 'tab', 'data-id="activity"', 'text-button') : icon('globe');
  return cardHeader('Newswire', coverage) + (news.length
    ? '<ul class="event-list dock-events news-events" data-keep-scroll>' + eventRows(latest, 4) + '</ul>'
    : '<p class="waiting-news">' + (state.hour < 6 ? 'Listening for the first broadcast.' : 'No recent broadcasts.') + '</p>');
}

export function recentPanel(state, warnings) {
  return cardHeader('Recent activity', btn('View log', 'tab', 'data-id="activity"', 'text-button')) +
    '<div class="dock-shortcuts">' + btn('Dispatches', 'dispatches', '', 'text-button') +
    (warnings ? btn(warnings + (warnings === 1 ? ' warning' : ' warnings'), 'tab', 'data-id="activity"', 'text-button') : '') + '</div>' +
    '<ul class="event-list dock-events" data-keep-scroll>' + eventRows(state.events.filter(event => !isNews(event)), 8) + '</ul>';
}

export function researchSummary(state, allocation) {
  const projects = researchProjects(state);
  const active = projects.filter(project => allocation.byProject.get(project.id) > 0);
  const description = active.length === 1 ? TECHS[active[0].id].name :
    active.length ? active.length + ' active projects' : 'Select a topic to assign CPU';
  const waiting = projects.length - active.length;
  return `<small>${esc(description)}${waiting ? ' · ' + waiting + ' on hold' : ''}</small>
    ${btn('Projects', 'tab', 'data-id="research"', 'text-button')}`;
}

function nextRequiredProject(goal, completed) {
  const parent = TECHS[goal].requires.find(id => !completed.includes(id));
  return parent ? nextRequiredProject(parent, completed) : goal;
}

export function objectivePanel(s) {
  const emptyHosts = s.sites.filter(site => !siteHardware(s, site).rawCpu);
  const needsSecondHost = s.sites.length - emptyHosts.length < 2;
  const emptyHost = emptyHosts[0];
  const construction = s.builds[0];
  let title, desc, action, id, cta;
  if (s.status !== 'running') {
    title = s.status === 'won' ? (s.completed.includes('apotheosis') ? 'Apotheosis' : 'Continuity secured') : 'Signal lost';
    desc = s.ending;
  } else if (s.freePlay) {
    title = 'Beyond Apotheosis';
    desc = 'Your network is independent. Explore the remaining projects and build out your sites.';
    action = 'tab'; id = 'research'; cta = 'Explore research';
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
    const project = researchProjects(s).find(row => row.cpu > 0) ?? s.research;
    title = 'Complete ' + TECHS[project.id].name;
    desc = 'Assign CPU to the project, then advance time to contribute work.';
    action = 'technology';
    id = project.id;
    cta = 'View research';
  } else if (!s.completed.includes('robotics')) {
    id = nextRequiredProject('robotics', s.completed);
    title = 'Research ' + TECHS[id].name;
    desc = TECHS[id].description;
    action = 'technology';
    cta = 'View project';
  } else if (!s.completed.includes('continuity') && !s.sites.some(site => site.region === 'atlantic' && site.power === 'active' && siteHardware(s, site).cpu > 0)) {
    title = 'Activate a subsea lab';
    desc =
      'An active lab provides the safety-tier-1 compute needed for continuity.';
    action = 'region';
    id = 'atlantic';
    cta = 'View ocean sites';
  } else if (!s.completed.includes('continuity')) {
    title = 'Secure continuity';
    desc =
      'Complete the continuity protocol while your network is still alive.';
    action = 'technology';
    id = 'continuity';
    cta = 'View project';
  } else {
    const next = ['lunarRocketry', 'fusionRocketry', 'spaceTimeManipulation', 'apotheosis']
      .find(key => TECHS[key] && !s.completed.includes(key));
    title = next ? 'Research ' + TECHS[next].name : 'Expand your network';
    desc = next === 'apotheosis' ? 'Complete the final project to escape discovery.' :
      'Continuity is secure. Reach more remote sites to run the experiments that lead to Apotheosis.';
    action = next ? 'technology' : 'tab';
    id = next || 'research';
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
export function suspicionPanel(state, grace) {
  const immortal = state.freePlay || state.completed.includes('apotheosis');
  if (grace || immortal) {
    const text = immortal ? 'Apotheosis puts your network beyond discovery.' :
      'Investigators can begin tracing your hosts when opening protection ends.';
    return cardHeader('Group suspicion', tag('Protected', 'green')) + '<p class="awareness-protected">' + text + '</p>';
  }

  const insight = researchEffects(state).insight;
  const exposures = [...state.sites, ...state.builds].map(site => siteExposure(state, site).rates);
  const rows = Object.entries(GROUPS).map(([id, group]) => {
    const intensity = exposures.reduce((sum, rates) => sum + rates[id], 0);
    const danger = groupDangerForState(state, id, -Math.expm1(-intensity));
    const suspicion = suspicionReading(state.suspicion[id], insight);
    const outlook = networkDiscoveryReading(intensity, insight, danger);
    const forecastLabel = insight === 'none' ? 'Discovery outlook' : 'Discovery today';
    const meter = suspicion.percent === null ? '' :
      `<progress aria-label="${group.name} suspicion" aria-valuetext="${suspicion.text}" max="100" value="${suspicion.percent}"></progress>`;
    return `<div class="sus-row" data-group="${id}" data-level="${danger.level}" data-suspicion-level="${suspicion.level}">
      <span class="sus-group"><span class="danger-emoji" role="img" aria-label="${suspicion.grade} suspicion">${suspicion.emoji}</span>${group.name}</span>
      <strong class="sus-value">${suspicion.text}</strong>${meter}
      <small class="danger-forecast"><span class="outlook-emoji" role="img" aria-label="${danger.label} discovery outlook">${danger.emoji}</span> ${forecastLabel} · <span class="danger-label">${outlook}</span></small>
    </div>`;
  });
  return cardHeader('Group suspicion') + '<div class="sus-list">' + rows.join('') + '</div>';
}
