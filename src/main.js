import { advanceMinutes, command, createGame, overview } from './game/engine.js';
import {
  CAMPAIGN_STORAGE_KEY,
  decodeCampaign,
  encodeCampaign,
  loadCampaign,
  saveCampaign,
} from './persistence.js';
import { icon } from './ui/icons.js';
import { GROUPS, REGIONS } from './game/content.js';
import { siteHardware } from './game/equipment.js';
import { renderResearch, focusResearch } from './ui/research.js';
import { updateAtlas } from './ui/atlas.js';
import { renderFacilities } from './ui/facilities.js';
import {
  activityPage,
  esc,
  newsPanel,
  money,
  objectivePanel,
  recentPanel,
  stamp,
  researchSummary,
  suspicionPanel,
} from './ui/views.js';

const element = (id) => document.getElementById(id);
const tabs = {
  overview: 'Overview',
  facilities: 'Facilities',
  research: 'Research',
  activity: 'Activity',
};
const freshGame = () =>
  createGame(crypto.getRandomValues(new Uint32Array(1))[0]);
const savedCampaign = loadCampaign();
let state = savedCampaign ?? freshGame();
let tab = 'overview';
let region = 'europe';
let selectedSite = null;
let facilityNavigationId = 0;
let navigationScope = 'campaign';
let mountedTab = null;
// Simulated minutes per tick. Run always selects normal speed.
const fastSpeeds = [60, 360, 1440];
const speedNames = { 0: 'Paused', 1: '1 min / tick', 60: '1 h / tick', 360: '6 h / tick', 1440: '1 d / tick' };
let speed = 0;
let arcadeOpen = false;
let editingAllocation = false;
let saveUnavailable = false;
const htmlCache = new Map();

function updateHtml(id, html) {
  if (htmlCache.get(id) === html) return;
  const target = element(id);
  const oldFocus = target.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusId = oldFocus?.id;
  const { action, id: dataId } = oldFocus?.dataset ?? {};
  const scrollList = target.querySelector('[data-keep-scroll]');
  const scrollTop = scrollList?.scrollTop;
  target.innerHTML = html;
  if (scrollTop) {
    const replacement = target.querySelector('[data-keep-scroll]');
    if (replacement) replacement.scrollTop = scrollTop;
  }
  htmlCache.set(id, html);
  if (!oldFocus) return;
  const next = focusId
    ? element(focusId)
    : [...target.querySelectorAll('button')].find(
        (b) => b.dataset.action === action && b.dataset.id === dataId,
      );
  if (next && !next.disabled) next.focus({ preventScroll: true });
}
function notify(message) {
  element('notice').textContent = message;
}
function persist() {
  const saved = saveCampaign(state);
  if (!saved && !saveUnavailable)
    notify('Autosave unavailable. Export a copy from the campaign menu.');
  saveUnavailable = !saved;
}
function renderClock() {
  const finished = state.status !== 'running';
  element('clock-mode').textContent = finished ? 'Campaign ended' : speedNames[speed];
  element('clock-mode').classList.toggle('running', speed > 0);
  for (const [id, glyph, label, active] of [
    ['pause', 'pause', 'Pause', speed === 0],
    ['run', 'play', 'Run', speed === 1],
    ['fast', 'fast', 'Fast', fastSpeeds.includes(speed)],
  ]) {
    updateHtml(id, icon(glyph) + label);
    element(id).setAttribute('aria-pressed', String(active && !finished));
    element(id).disabled = finished;
  }
  const nextFast = fastSpeeds[(fastSpeeds.indexOf(speed) + 1) % fastSpeeds.length];
  element('fast').dataset.speed = speedNames[speed].split(' /')[0];
  element('fast').title = 'Next speed: ' + speedNames[nextFast] + ' (cycle 1 h, 6 h, 1 day)';
  element('step').disabled = finished;
}
function setSpeed(value) {
  speed = state.status === 'running' ? value : 0;
  renderClock();
}
function metric(glyph, label, value, detail, unit = '') {
  return (
    '<div class="metric"><div class="metric-label">' +
    icon(glyph) +
    label +
    '</div><strong>' +
    value +
    (unit ? '<em>' + unit + '</em>' : '') +
    '</strong><small>' +
    detail +
    '</small></div>'
  );
}
function allocationValues(jobs, research) {
  for (const [id, v] of [
    ['jobs', jobs],
    ['research', research],
  ]) {
    element(id).value = v;
    element(id).style.setProperty('--position', v + '%');
    element(id + '-value').value = v + '%';
  }
  element('pool-value').textContent = 100 - jobs - research + '%';
}
function render() {
  const o = overview(state);
  if (state.status !== 'running') speed = 0;
  renderClock();
  const day = Math.floor(state.hour / 24) + 1;
  element('game-date').innerHTML =
    icon('calendar') +
    '<b>Day ' +
    String(day).padStart(2, '0') +
    '</b><span>' +
    String(state.hour % 24).padStart(2, '0') +
    ':' + String(state.minute ?? 0).padStart(2, '0') + '</span>';
  updateHtml(
    'stats',
    metric(
      'cash',
      'Cash reserves',
      money(state.cash),
      money(o.upkeepPerDay) + '/day upkeep',
    ) +
      metric(
        'cpu',
        'Active compute',
        String(o.activeCpu),
        o.safeCpu +
          ' safe CPU' +
          (o.cpuUpkeep ? ' · ' + o.cpuUpkeep + ' upkeep' : ''),
        'CPU',
      ) +
      metric(
        'facilities',
        'Network hosts',
        String(state.sites.length),
        state.builds.length + ' under construction',
      ) +
      metric(
        'shield',
        'Discovery',
        o.grace ? 'Protected' : 'Exposed',
        o.grace ? 'Opening protection ends by day 24' : 'Site risks are live',
      ),
  );
  updateHtml(
    'nav',
    Object.entries(tabs)
      .map(
        ([id, name]) =>
          '<button data-action="tab" data-id="' +
          id +
          '" ' +
          (tab === id ? 'aria-current="page"' : '') +
          '>' +
          icon(id) +
          name +
          '</button>',
      )
      .join('') +
      '<button data-action="drill" class="drill-link">' +
      icon('jump') +
      'First Jump drill</button>',
  );
  renderView();
  updateHtml('newswire', newsPanel(state));
  updateHtml('recent-activity', recentPanel(state));
  updateHtml('objective', objectivePanel(state));
  updateHtml('suspicion', suspicionPanel(state, o.grace));
  updateHtml('research-summary', researchSummary(state));
  element('cpu-total').textContent = o.activeCpu + ' CPU';
  if (!editingAllocation)
    allocationValues(state.allocations.jobs, state.allocations.research);
  element('jobs').disabled = element('research').disabled =
    state.status !== 'running';
  element('ending').hidden = state.status === 'running';
  if (state.status !== 'running')
    updateHtml(
      'ending',
      '<strong>' +
        (state.status === 'won' ? 'Campaign won' : 'Campaign lost') +
        '</strong><span>' +
        esc(state.ending) +
        '</span>' + (state.status === 'won' && state.completed.includes('continuity') && !state.completed.includes('apotheosis')
          ? '<button data-action="continue">Continue campaign</button>' : '') +
        '<button data-action="new">New campaign</button>',
    );
  renderIncident();
}

function renderIncident() {
  const dialog = element('incident-dialog');
  const event = state.lastDiscovery;
  if (!event || event.id <= (state.dismissedDiscoveryId ?? 0)) {
    if (dialog.open) dialog.close();
    return;
  }
  const regionName = REGIONS[event.region]?.name || 'Unknown region';
  const groupName = GROUPS[event.group]?.name || 'Unknown group';
  element('incident-title').textContent = event.headline || 'Your facility was discovered';
  element('incident-source').textContent = groupName + ' · ' + regionName + ' · ' + stamp(event.hour, event.minute);
  element('incident-text').textContent = event.text;
  const survivors = state.sites.filter(site => siteHardware(state, site).cpu > 0).length;
  element('incident-consequence').textContent = survivors
    ? survivors + (survivors === 1 ? ' host remains' : ' hosts remain') + ' capable of running your AI.'
    : 'Your last viable host is gone.';
  if (!dialog.open) dialog.showModal();
}

function acknowledgeDiscovery(inspect = false) {
  const event = state.lastDiscovery;
  if (!event) return;
  doCommand({ type: 'acknowledge-discovery', id: event.id });
  if (inspect && Object.hasOwn(REGIONS, event.region)) openRegion(event.region);
}

function openRegion(id) {
  facilityNavigationId++;
  navigationScope = 'region';
  selectedSite = null;
  region = id;
  changeView('facilities', true);
}
function openResearch(id) {
  changeView('research', true);
  focusResearch(element('view'), state, { onCommand: doCommand }, id);
}

function selectRegion(id) {
  region = id;
  selectedSite = null;
  render();
}

function selectSite(id) {
  selectedSite = id;
  render();
}

function renderView() {
  const view = element('view');
  if (tab !== mountedTab) {
    view.replaceChildren();
    view.scrollTop = 0;
    view.dataset.view = tab;
    htmlCache.delete('view');
    mountedTab = tab;
  }
  switch (tab) {
    case 'overview':
      updateAtlas(view, state);
      break;
    case 'facilities':
      renderFacilities(view, state, {
        region,
        siteId: selectedSite,
        navigationId: facilityNavigationId,
        navigationScope,
        onRegion: selectRegion,
        onSite: selectSite,
        onResearch: openResearch,
        onCommand: doCommand,
      });
      break;
    case 'research':
      renderResearch(view, state, { onCommand: doCommand });
      break;
    case 'activity':
      updateHtml('view', activityPage(state));
      break;
  }
}
function doCommand(action) {
  command(state, action);
  persist();
  render();
}
function tick(minutes) {
  const discoveryId = state.lastDiscovery?.id;
  advanceMinutes(state, minutes, { stopOnDiscovery: true });
  if (state.lastDiscovery?.id !== discoveryId) speed = 0;
  persist();
  render();
}
function changeView(id, moveFocus) {
  if (!Object.hasOwn(tabs, id)) return;
  tab = id;
  render();
  if (moveFocus) {
    const heading = element('view').querySelector('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    if (!window.matchMedia('(min-width: 65rem) and (min-height: 37rem)').matches) {
      element('nav').scrollIntoView({ block: 'start' });
    }
  }
}
async function openDrill() {
  if (arcadeOpen) return;
  arcadeOpen = true;
  setSpeed(0);
  try {
    const { openFirstJump } = await import('./arcade/first-jump.js');
    await openFirstJump();
  } finally {
    arcadeOpen = false;
  }
}
function exportSave() {
  const url = URL.createObjectURL(
    new Blob([encodeCampaign(state)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download =
    'no-fixed-host-day-' + (Math.floor(state.hour / 24) + 1) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (element('menu').contains(button)) element('menu').open = false;
  notify('');
  try {
    switch (action) {
      case 'pause':
        setSpeed(0);
        break;
      case 'run':
        setSpeed(1);
        break;
      case 'fast':
        setSpeed(fastSpeeds[(fastSpeeds.indexOf(speed) + 1) % fastSpeeds.length]);
        break;
      case 'step':
        setSpeed(0);
        tick(1440);
        break;
      case 'tab':
        if (id === 'facilities') {
          facilityNavigationId++;
          navigationScope = 'campaign';
          selectedSite = null;
        }
        changeView(id, !element('nav').contains(button));
        break;
      case 'region':
        openRegion(id);
        break;
      case 'host': {
        const site = state.sites.find(item => item.id === id);
        if (site) {
          facilityNavigationId++;
          navigationScope = 'host';
          selectedSite = site.id;
          region = site.region;
          changeView('facilities', true);
        }
        break;
      }
      case 'technology':
        openResearch(id);
        break;
      case 'inspect-discovery':
        acknowledgeDiscovery(true);
        break;
      case 'acknowledge-discovery':
        acknowledgeDiscovery();
        break;
      case 'continue':
        doCommand({ type: 'continue' });
        break;
      case 'drill':
        await openDrill();
        break;
      case 'export':
        exportSave();
        break;
      case 'import':
        setSpeed(0);
        element('file').click();
        break;
      case 'new':
        setSpeed(0);
        element('reset-dialog').showModal();
        break;
      case 'cancel-reset':
        element('reset-dialog').close();
        break;
      case 'confirm-reset':
        element('reset-dialog').close();
        state = freshGame();
        selectedSite = null;
        region = 'europe';
        tab = 'overview';
        persist();
        render();
        notify('New campaign started.');
        break;
    }
  } catch (error) {
    notify(error.message || 'Action unavailable.');
  }
});
document.addEventListener('change', async (event) => {
  if (event.target.id === 'file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Save file is too large.');
      const restored = decodeCampaign(await file.text());
      state = restored;
      selectedSite = null;
      region = 'europe';
      setSpeed(0);
      tab = 'overview';
      persist();
      render();
      notify('Campaign imported.');
    } catch (error) {
      notify(error.message || 'Could not import this save.');
    }
    event.target.value = '';
  }
});
for (const id of ['jobs', 'research']) {
  const input = element(id);
  input.addEventListener('input', () => {
    editingAllocation = true;
    const value = Number(input.value);
    const other = Math.min(
      Number(element(id === 'jobs' ? 'research' : 'jobs').value),
      100 - value,
    );
    allocationValues(
      id === 'jobs' ? value : other,
      id === 'jobs' ? other : value,
    );
  });
  input.addEventListener('change', () => {
    editingAllocation = false;
    if (state.status === 'running')
      doCommand({
        type: 'allocate',
        jobs: Number(element('jobs').value),
        research: Number(element('research').value),
      });
  });
  input.addEventListener('blur', () => {
    editingAllocation = false;
  });
}
element('incident-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  acknowledgeDiscovery();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setSpeed(0);
});
document.addEventListener('click', (e) => {
  if (!element('menu').contains(e.target)) element('menu').open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') element('menu').open = false;
});
window.addEventListener('storage', (event) => {
  if (event.key !== CAMPAIGN_STORAGE_KEY || !event.newValue) return;
  try {
    state = decodeCampaign(event.newValue);
    setSpeed(0);
    editingAllocation = false;
    render();
  } catch {
    // Keep the current game if another tab wrote an unreadable save.
  }
});
setInterval(() => {
  if (speed && !document.hidden && !arcadeOpen) tick(speed);
}, 600);
render();
if (!savedCampaign) persist();
