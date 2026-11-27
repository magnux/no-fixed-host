import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { siteExposure, siteHardware } from '../game/engine.js';
import { icon } from './icons.js';
import { groupDangerForState, WORLD_NEWS } from '../game/events.js';

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

function eventRows(events, limit) {
  return events.slice(-limit).reverse().map(event => {
    const headline = event.headline ? '<strong>' + esc(event.headline) + '</strong>' : '';
    const category = isNews(event) ? 'news' : event.kind === 'site.discovered' ? 'discovery' : 'activity';
    return '<li data-kind="' + category + '"><time>' + stamp(event.hour, event.minute) + '</time>' +
      '<div>' + headline + '<span>' + esc(event.text) + '</span></div></li>';
  }).join('');
}

export function newsPanel(state) {
  const news = state.events.filter(isNews);
  const active = Object.keys(state.news.stories).length;
  const coverage = active ? btn('Coverage (' + active + ')', 'tab', 'data-id="activity"', 'text-button') : icon('globe');
  return cardHeader('Newswire', coverage) + (news.length
    ? '<ul class="event-list dock-events news-events" data-keep-scroll>' + eventRows(news, 4) + '</ul>'
    : '<p class="waiting-news">' + (state.hour < 6 ? 'Listening for the first broadcast.' : 'No recent broadcasts.') + '</p>');
}

export function recentPanel(state) {
  return cardHeader('Recent activity', btn('View log', 'tab', 'data-id="activity"', 'text-button')) +
    '<ul class="event-list dock-events" data-keep-scroll>' + eventRows(state.events.filter(event => !isNews(event)), 8) + '</ul>';
}

export function researchSummary(state) {
  const current = state.research && TECHS[state.research.id];
  const description = current ? esc(current.name) : 'No active project';
  return `<small>${description}</small>
    ${btn('Projects', 'tab', 'data-id="research"', 'text-button')}`;
}

export function activityPage(state) {
  const coverage = Object.entries(state.news.stories).map(([id, started]) => {
    const story = WORLD_NEWS[id];
    const sign = story.modifier > 0 ? '+' : '−';
    const until = story.days ? 'until day ' + (1 + Math.floor(started / 1440) + story.days) : 'ongoing';
    return '<li><strong>' + esc(story.headline) + '</strong><small>' + GROUPS[story.group].name +
      ' discovery multiplier ' + sign + Math.abs(story.modifier / 100) + ' percentage points · ' + until + '</small></li>';
  }).join('');
  const current = coverage ? '<section class="panel">' + cardHeader('Active world stories') +
    '<ul class="world-stories">' + coverage + '</ul></section>' : '';
  return current + '<section class="panel">' + cardHeader('Activity log') +
    '<ul class="event-list full">' + eventRows(state.events, 100) + '</ul></section>';
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
    action = 'technology';
    id = s.research.id;
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
function forecastLabel(chance) {
  if (!chance) return 'No exposure';
  if (chance < 0.01) return 'Very unlikely';
  if (chance < 0.1) return 'Unlikely';
  if (chance < 0.5) return 'Possible';
  return 'Likely';
}

export function suspicionPanel(state, grace) {
  const expose = [...state.sites, ...state.builds].map(site => siteExposure(state, site).rates);
  const insights = state.completed.includes('advancedSocioanalytics') ? 2 :
    state.completed.includes('socioanalytics') ? 1 : 0;
  const rows = Object.entries(GROUPS).map(([id, group]) => {
    let expected = 0;
    let intensity = 0;
    for (const rates of expose) {
      expected += -Math.expm1(-rates[id]);
      intensity += rates[id];
    }
    const danger = groupDangerForState(state, id, expected);
    const suspicion = state.suspicion[id];
    const chance = -Math.expm1(-intensity);
    const chanceLabel = insights === 2 ? (chance * 100).toFixed(2) + '%' : forecastLabel(chance);
    return `<div class="sus-row" data-level="${danger.level}">
      <span class="sus-group"><span class="danger-emoji" aria-hidden="true">${danger.emoji}</span>${group.name}</span>
      <strong>${(suspicion / 100).toFixed(1)}%</strong>
      <span class="danger-label">${esc(danger.label)}</span>
      <progress aria-label="${group.name} suspicion" max="10000" value="${suspicion}"></progress>
      ${insights ? '<small class="danger-forecast">Discovery today · ' + chanceLabel + '</small>' : ''}
    </div>`;
  });
  return cardHeader('Group suspicion', grace ? tag('Protected', 'green') : '') +
    '<div class="sus-list">' + rows.join('') + '</div>';
}
