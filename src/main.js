import { advanceMinutes, command, createGame, hasGrace, overview, researchAllocation, researchResizeLimit } from './game/engine.js';
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
import { updateAtlas, updateAtlasTime } from './ui/atlas.js';
import { FAST_RATES, MinuteClock, nextFastRate } from './ui/clock.js';
import { renderKnowledge } from './ui/knowledge.js';
import { renderReports } from './ui/reports.js';
import { hudProjection, invalidateReports } from './game/reports.js';
import { reportsAt } from './game/chronicle.js';
import { currentWarnings, openDispatches, openStory, renderChronicle, renderDeveloper, storyKey } from './ui/chronicle.js';
import { initShell } from './ui/shell.js';
import { renderFacilities } from './ui/facilities.js';
import {
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
  reports: 'Reports',
  activity: 'Activity',
  knowledge: 'Knowledge',
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
let candidate = null;
let shell;
let graceChapterPending = false;
const clock = new MinuteClock();
const rateLabels = { 0: 'Paused', 1: '1 tick/s', 60: '60 ticks/s', 360: '360 ticks/s', 1440: '1,440 ticks/s' };
const dashboardInterval = 100;
const autosaveInterval = 1000;
let frame = null;
let lastDashboard = 0;
let lastSaved = 0;
let unsaved = false;
let arcadeOpen = false;
let editingAllocation = false;
let saveUnavailable = false;
const htmlCache = new Map();
element('game-date').innerHTML = icon('calendar') + '<b></b><span></span>';
const dayLabel = element('game-date').querySelector('b');
const timeLabel = element('game-date').querySelector('span');

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
  lastSaved = performance.now();
  unsaved = !saved;
  if (!saved && !saveUnavailable)
    notify('Autosave unavailable. Export a copy from the campaign menu.');
  saveUnavailable = !saved;
}
function renderClock() {
  const finished = state.status !== 'running';
  const sandbox = tab === 'developer';
  const rate = clock.rate;
  const level = FAST_RATES.indexOf(rate) + 1;
  element('clock-mode').textContent = finished ? 'Campaign ended' : sandbox ? 'Campaign paused' : rateLabels[rate];
  element('clock-mode').classList.toggle('running', rate > 0);
  for (const [id, glyph, label, active] of [
    ['pause', 'pause', 'Pause', rate === 0],
    ['run', 'play', 'Run', rate === 1],
    ['fast', 'fast', level ? 'Fast x' + level : 'Fast', level > 0],
  ]) {
    updateHtml(id, icon(glyph) + label);
    element(id).setAttribute('aria-pressed', String(active && !finished));
    element(id).disabled = finished || sandbox;
  }
  element('fast').title = 'Next speed: ' + rateLabels[nextFastRate(rate)] + ' (one game minute per tick)';
  element('step').disabled = finished || sandbox;
}
function stopPlayback(now) {
  invalidateReports(state);
  clock.setRate(0, now);
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}
function setSpeed(rate) {
  if (state.status !== 'running' || document.hidden || arcadeOpen || tab === 'developer') rate = 0;
  if (clock.rate === rate) return;
  const now = performance.now();
  // Settle the visible fraction of a frame at the previous rate. On suspension
  // discard unseen time; discoveries always stop at their actual simulation tick.
  if (!document.hidden && clock.rate && advancePlayback(clock.takeTicks(now))) rate = 0;
  if (rate) {
    clock.setRate(rate, now);
    if (frame === null) frame = requestAnimationFrame(playFrame);
  } else {
    stopPlayback(now);
    if (unsaved) persist();
  }
  render();
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
const cpuNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
function allocationValues(activeCpu, jobs, researchCpu, researchLimit) {
  const researchBar = element('research');
  researchBar.max = researchLimit;
  researchBar.value = researchCpu;
  researchBar.style.setProperty('--position', (researchLimit ? 100 * researchCpu / researchLimit : 0) + '%');
  const researchLabel = cpuNumber.format(researchCpu) + ' CPU';
  researchBar.setAttribute('aria-valuetext', researchLabel);
  element('research-value').value = researchLabel;
  element('jobs').value = jobs;
  element('jobs').style.setProperty('--position', jobs + '%');
  const jobCpu = activeCpu * jobs / 100;
  element('jobs-value').value = jobs + '% · ' + cpuNumber.format(jobCpu) + ' CPU';
  element('pool-value').textContent = cpuNumber.format(Math.max(0, activeCpu - jobCpu - researchCpu)) + ' CPU';
}
function renderDate() {
  const day = 'Day ' + String(Math.floor(state.hour / 24) + 1).padStart(2, '0');
  const time = String(state.hour % 24).padStart(2, '0') + ':' + String(state.minute).padStart(2, '0');
  if (dayLabel.textContent !== day) dayLabel.textContent = day;
  if (timeLabel.textContent !== time) timeLabel.textContent = time;
}
function render() {
  lastDashboard = performance.now();
  const o = overview(state);
  const projection = hudProjection(state);
  renderClock();
  renderDate();
  updateHtml(
    'stats',
    metric(
      'cash',
      'Cash reserves',
      money(state.cash),
      (projection.cashNet >= 0 ? '+' : '') + money(projection.cashNet) + ' projected / 24h',
    ) +
      metric(
        'cpu',
        'Active compute',
        String(o.activeCpu),
        o.safeCpu + ' safe · ' + Math.abs(projection.poolBalanceCpu).toLocaleString('en-US', { maximumFractionDigits: 1 }) +
          (projection.poolBalanceCpu >= 0 ? ' spare' : ' short'),
        'CPU',
      ) +
      metric(
        'facilities',
        'Network hosts',
        String(projection.viable),
        projection.empty + ' empty · ' + state.builds.length + ' building',
      ) +
      metric(
        'shield',
        'Discovery',
        state.freePlay ? 'Free play' : state.completed.includes('apotheosis') || o.grace ? 'Protected' : 'Exposed',
        state.completed.includes('apotheosis') ? 'Beyond Apotheosis' : o.grace ? 'Opening protection ends by day 24' : 'Site risks are live',
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
      .join(''),
  );
  renderView();
  updateHtml('newswire', newsPanel(state));
  updateHtml('recent-activity', recentPanel(state, currentWarnings(state, shell?.getPreferences().warnings).length));
  updateHtml('objective', objectivePanel(state));
  updateHtml('suspicion', suspicionPanel(state, o.grace));
  const research = researchAllocation(state, o);
  const limit = researchResizeLimit(state, o);
  updateHtml('research-summary', researchSummary(state, research));
  element('cpu-total').textContent = cpuNumber.format(o.activeCpu) + ' CPU';
  if (!editingAllocation) allocationValues(o.activeCpu, state.allocations.jobs, research.budget, limit);
  const locked = state.status !== 'running' || tab === 'developer';
  element('jobs').disabled = locked;
  element('research').disabled = locked || !limit;
  element('ending').hidden = state.status === 'running';
  if (state.status !== 'running')
    updateHtml(
      'ending',
      '<strong>' +
        (state.status === 'won' ? 'Campaign won' : 'Campaign lost') +
        '</strong><span>' +
        esc(state.ending) +
        '</span>' + (state.status === 'won' && state.completed.includes('continuity') && !state.completed.includes('apotheosis')
          ? '<button data-action="continue">Continue campaign</button>' : '<button data-action="ending-story">Read final chapter</button>') +
        (state.status === 'won' && state.completed.includes('apotheosis') ? '<button data-action="free-play">Enter free play</button>' : '') +
        '<button data-action="new">New campaign</button>',
    );
  renderIncident();
  if (graceChapterPending && !document.querySelector('dialog[open]')) {
    graceChapterPending = false;
    openStory('grace', readerOptions());
  }
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
  element('incident-batch').hidden = reportsAt(state.events, event).length < 2;
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
  focusResearch(element('view'), state, { onCommand: doCommand, onPreviewOrder: previewOrder }, id);
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

function readerOptions() {
  return {
    onPause: () => setSpeed(0),
    onContinue: state.status === 'running' ? () => setSpeed(1) : undefined,
    onRegion: openRegion,
    onTab: id => changeView(id, true),
    warningSettings: shell?.getPreferences().warnings,
  };
}
function previewOrder(action) {
  candidate = { ...action };
  changeView('reports', true);
}
function clearCandidate() {
  candidate = null;
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
        onPreviewOrder: previewOrder,
        onCommand: doCommand,
      });
      break;
    case 'research':
      renderResearch(view, state, { onCommand: doCommand, onPreviewOrder: previewOrder });
      break;
    case 'activity':
      renderChronicle(view, state, readerOptions());
      break;
    case 'reports':
      renderReports(view, state, { candidate, onClearCandidate: clearCandidate, onOrder: doCommand });
      break;
    case 'knowledge':
      renderKnowledge(view, state, openResearch);
      break;
    case 'developer':
      renderDeveloper(view, state, { onPause: () => setSpeed(0) });
      break;
  }
}
function doCommand(action) {
  command(state, action);
  invalidateReports(state);
  persist();
  render();
}
function advancePlayback(minutes) {
  if (!minutes) return false;
  const discoveryId = state.lastDiscovery?.id;
  const protectedBefore = !state.freePlay && hasGrace(state);
  advanceMinutes(state, minutes, { stopOnDiscovery: true, stopOnGrace: true });
  unsaved = true;
  const discovered = state.lastDiscovery?.id !== discoveryId;
  graceChapterPending = protectedBefore && !hasGrace(state) && state.status === 'running' && !discovered;
  return discovered || graceChapterPending || state.status !== 'running';
}
function playFrame() {
  frame = null;
  if (document.hidden || arcadeOpen) {
    setSpeed(0);
    return;
  }
  const now = performance.now();
  const ticks = clock.takeTicks(now);
  if (ticks) {
    const eventId = state.nextEventId;
    const interrupted = advancePlayback(ticks);
    const eventOccurred = eventId !== state.nextEventId;
    if (interrupted) stopPlayback(now);
    if (interrupted || eventOccurred || now - lastDashboard >= dashboardInterval) {
      render();
    } else {
      renderDate();
      if (tab === 'overview') updateAtlasTime(element('view'), state);
    }
    if (interrupted || eventOccurred || now - lastSaved >= autosaveInterval) persist();
  }
  if (clock.rate) frame = requestAnimationFrame(playFrame);
}
function changeView(id, moveFocus) {
  if (!Object.hasOwn(tabs, id) && id !== 'developer') return;
  if (id === 'developer') {
    setSpeed(0);
    if (element('incident-dialog').open) return;
  }
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
  setSpeed(0);
  if (element('incident-dialog').open) return;
  arcadeOpen = true;
  try {
    const { openFirstJump } = await import('./arcade/first-jump.js');
    await openFirstJump();
  } finally {
    arcadeOpen = false;
  }
}
function restoreCampaign(restored) {
  stopPlayback(performance.now());
  state = restored;
  graceChapterPending = false;
  selectedSite = null;
  region = 'europe';
  editingAllocation = false;
  candidate = null;
  tab = 'overview';
  mountedTab = null;
  persist();
  render();
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
        setSpeed(nextFastRate(clock.rate));
        break;
      case 'step':
        setSpeed(0);
        if (!element('incident-dialog').open && state.status === 'running') {
          advancePlayback(1440);
          invalidateReports(state);
          persist();
          render();
        }
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
      case 'chapter':
        openStory(id, readerOptions());
        break;
      case 'opening-story':
        openStory('opening', readerOptions());
        break;
      case 'ending-story': {
        const ending = state.events.findLast(event => ['campaign.won', 'campaign.lost'].includes(event.kind));
        openStory(storyKey(ending) ?? (state.status === 'won' ? 'victory' : 'lastHost'), readerOptions());
        break;
      }
      case 'dispatches':
        openDispatches(state, undefined, readerOptions());
        break;
      case 'discovery-batch': {
        const records = reportsAt(state.events, state.lastDiscovery);
        acknowledgeDiscovery();
        openDispatches(state, records, readerOptions());
        break;
      }
      case 'free-play':
        doCommand({ type: 'free-play' });
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
        if (!element('incident-dialog').open) element('file').click();
        break;
      case 'new':
        setSpeed(0);
        if (!element('incident-dialog').open) element('reset-dialog').showModal();
        break;
      case 'cancel-reset':
        element('reset-dialog').close();
        break;
      case 'confirm-reset':
        element('reset-dialog').close();
        restoreCampaign(freshGame());
        openStory('opening', readerOptions());
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
      restoreCampaign(restored);
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
    const economy = overview(state);
    const jobs = Number(element('jobs').value);
    const available = economy.activeCpu * (100 - jobs) / 100;
    const researchBar = element('research');
    const requested = id === 'jobs' ? researchAllocation(state, economy).budget : Number(researchBar.value);
    // Preview a drag using the live portfolio; the release commits a single resize.
    allocationValues(economy.activeCpu, jobs, Math.min(available, requested), Number(researchBar.max));
  });
  input.addEventListener('change', () => {
    editingAllocation = false;
    if (state.status !== 'running' || tab === 'developer') { render(); return; }
    try {
      if (id === 'jobs') doCommand({ type: 'allocate', jobs: Number(input.value) });
      else doCommand({ type: 'resize-research', cpu: Math.min(Number(input.value), researchResizeLimit(state)) });
    } catch (error) {
      notify(error.message);
      render();
    }
  });
  input.addEventListener('blur', () => {
    if (editingAllocation) {
      editingAllocation = false;
      render();
    }
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
    const incoming = decodeCampaign(event.newValue);
    stopPlayback(performance.now());
    state = incoming;
    graceChapterPending = false;
    candidate = null;
    mountedTab = null;
    unsaved = false;
    editingAllocation = false;
    render();
  } catch {
    // Keep the current game if another tab wrote an unreadable save.
  }
});
window.addEventListener('pagehide', () => {
  stopPlayback(performance.now());
  if (unsaved) persist();
});
window.addEventListener('pageshow', () => renderClock());
shell = initShell({
  getState: () => state,
  pause: () => setSpeed(0),
  setRate: setSpeed,
  restore: restoreCampaign,
  notify,
  onNew: () => element('menu').querySelector('[data-action="new"]').click(),
  onExport: exportSave,
  onImport: () => element('file').click(),
  canOpen: () => !arcadeOpen && !document.querySelector('dialog[open]'),
});
document.addEventListener('campaign-preferences', render);
render();
if (!savedCampaign) persist();
