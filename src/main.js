import { campaignDate, campaignDay, dateLabel, timeLabel as utcLabel } from './game/calendar.js';
import { advanceMinutes, campaignMinutes, command, createGame, hasGrace, overview, researchAllocation, researchResizeLimit } from './game/engine.js';
import {
  CAMPAIGN_STORAGE_KEY,
  decodeCampaign,
  encodeCampaign,
  loadCampaign,
  UnsupportedCampaignError,
  saveCampaign,
} from './persistence.js';
import { icon } from './ui/icons.js';
import { GROUPS, REGIONS } from './game/content.js';
import { regionAvailable } from './game/geography.js';
import { networkThreat } from './game/threat.js';
import { bindHudLabels, hudText, hudFormat, hudReading } from './ui/hud-translations.js';
import { catalogLabel, menuLanguage, translate } from './ui/localization.js';
import { localizedDispatch, survivingHostsText, translatedGroup } from './ui/dispatch-translations.js';
import { treasuryBalance } from './game/treasury.js';
import { siteHardware } from './game/equipment.js';
import { taskReservations } from './game/research-tasks.js';
import { renderResearch, focusResearch } from './ui/research.js';
import { updateAtlas, updateAtlasTime } from './ui/atlas.js';
import { FAST_RATES, MinuteClock, nextFastRate } from './ui/clock.js';
import { campaignShortcut } from './ui/campaign-shortcuts.js';
import { renderKnowledge } from './ui/knowledge.js';
import { renderReports } from './ui/reports.js';
import { hudProjection, invalidateReports } from './game/reports.js';
import { interruptingReport } from './game/events.js';
import { reportsAt } from './game/chronicle.js';
import { currentWarnings, openDispatches, openStory, openWarnings, renderChronicle, renderDeveloper, storyKey } from './ui/chronicle.js';
import { initShell } from './ui/shell.js';
import { createCampaignCues } from './ui/campaign-cues.js';
import { renderFacilities } from './ui/facilities.js';
import { createAvatarPanel } from './ui/avatar-panel.js';
import {
  esc,
  newsPanel,
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
let startupError;
const savedCampaign = loadCampaign(error => { startupError = error; });
let state = savedCampaign ?? freshGame();
let tab = 'overview';
let region = 'europe';
let selectedSite = null;
let facilityNavigationId = 0;
let navigationScope = 'campaign';
let mountedTab = null;
let candidate = null;
let shell;
const announceCampaign = createCampaignCues(cue => shell?.playCampaignCue(cue));
let graceChapterPending = false;
let pendingDispatch = null;
let endingChapterPending = null;
let interruptedRate = 1;
const clock = new MinuteClock();
const rateLabel = rate => !rate ? translate(menuLanguage(), 'Paused') : rate === 1 && menuLanguage() === 'en' ? '1 tick/s' :
  hudText('{n} ticks/s').replace('{n}', hudFormat().number(rate));
const dashboardInterval = 100;
const autosaveInterval = 1000;
let frame = null;
let menuHoldingPlayback = element('menu').open;
let lastDashboard = 0;
let lastSaved = 0;
let unsaved = false;
let editingAllocation = false;
let saveUnavailable = false;
const htmlCache = new Map();
element('game-date').innerHTML = icon('calendar') + '<b></b><span></span>';
const dayLabel = element('game-date').querySelector('b');
const timeLabel = element('game-date').querySelector('span');
const updateHudLabels = bindHudLabels(document.querySelectorAll(
  '.skip,.briefing h1,.allocation h2,.allocation label,.range-row.pool span,.allocation-note,' +
  '#research,#pause,#run,#step,#stats,.command-dock,#nav,#view,.network-dock,#newswire',
));
let hudLanguage;


const updateAvatar = createAvatarPanel(element('ai-avatar'));
const threatIndicator = element('threat-indicator');
const threatLabel = threatIndicator.querySelector('.threat-label');
const threatLabels = {
  protected: 'Protected', quiet: 'Low threat', guarded: 'Elevated threat', high: 'High threat', critical: 'Critical threat',
};
const threatDetails = {
  protection: 'Opening protection is active.',
  apotheosis: 'Your network is beyond discovery.',
  quiet: 'Investigators show little evidence or activity.',
  discovery: 'A recent discovery put the network on alert.',
  evidence: 'Current suspicion determines the alert.',
  outlook: 'The discovery outlook determines the alert.',
  'investigation-loss': 'Investigators ended this campaign.',
};

function renderThreat({ level, cause, sourceGroup }) {
  const language = shell?.getPreferences().language ?? 'en';
  const label = hudText(threatLabels[level], language);
  const groupName = GROUPS[sourceGroup]?.name;
  const detail = hudText(threatDetails[cause], language) +
    (groupName ? ' · ' + hudText(groupName, language) : '');
  if (document.documentElement.dataset.threat !== level) document.documentElement.dataset.threat = level;
  if (threatLabel.textContent !== label) threatLabel.textContent = label;
  if (threatIndicator.title !== detail) {
    threatIndicator.title = detail;
    threatIndicator.setAttribute('aria-description', detail);
  }
  if (threatIndicator.lang !== language) threatIndicator.lang = language;
}

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
    notify('Autosave unavailable. Export a copy from the save library.');
  saveUnavailable = !saved;
}
function renderClock() {
  const finished = state.status !== 'running';
  const sandbox = tab === 'developer';
  const rate = clock.rate;
  const level = FAST_RATES.indexOf(rate) + 1;
  element('clock-mode').textContent = finished ? hudText('Campaign ended') :
    sandbox || (rate && element('menu').open) ? hudText('Campaign paused') : rateLabel(rate);
  element('clock-mode').classList.toggle('running', rate > 0 && !element('menu').open);
  for (const [id, glyph, label, active] of [
    ['pause', 'pause', 'Pause', rate === 0],
    ['run', 'play', 'Run', rate === 1],
    ['fast', 'fast', level ? 'Fast x' + level : 'Fast', level > 0],
  ]) {
    updateHtml(id, icon(glyph) + label);
    element(id).setAttribute('aria-pressed', String(active && !finished));
    element(id).disabled = finished || sandbox;
  }
  element('fast').title = hudText('Next speed: {rate} (one game minute per tick)').replace('{rate}', rateLabel(nextFastRate(rate)));
  element('step').disabled = finished || sandbox;
}
function stopPlayback(now) {
  invalidateReports(state);
  clock.setRate(0, now);
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}
function setSpeed(rate, skipWarnings = false) {
  if (state.status !== 'running' || document.hidden || tab === 'developer') rate = 0;
  if (clock.rate === rate) return;
  if (rate && !clock.rate && !skipWarnings && shell?.getPreferences().reviewWarnings) {
    const warnings = currentWarnings(state, shell.getPreferences().warnings);
    if (openWarnings(warnings, readerOptions(rate))) return;
  }
  const now = performance.now();
  // Settle the visible fraction of a frame at the previous rate. On suspension
  // discard unseen time; discoveries always stop at their actual simulation tick.
  if (!document.hidden && !menuHoldingPlayback && !element('menu').open && clock.rate && advancePlayback(clock.takeTicks(now))) rate = 0;
  if (rate) {
    clock.setRate(rate, now);
    if (frame === null && !element('menu').open) frame = requestAnimationFrame(playFrame);
  } else {
    stopPlayback(now);
    if (unsaved) persist();
  }
  render();
}
function metric(glyph, label, value, detail, unit = '', condition = '') {
  return (
    '<div class="metric"' + (condition ? ' data-host-condition="' + condition + '"' : '') + '><div class="metric-label">' +
    icon(glyph) +
    esc(hudText(label)) +
    '</div><strong>' +
    value +
    (unit ? '<em>' + unit + '</em>' : '') +
    '</strong><small>' +
    detail +
    '</small></div>'
  );
}
const cpuNumber = value => hudFormat().number(Math.round(value * 100) / 100);
function allocationValues(activeCpu, reservations, jobsPercent, researchCpu, researchLimit) {
  const researchBar = element('research');
  researchBar.max = researchLimit;
  researchBar.value = researchCpu;
  researchBar.style.setProperty('--position', (researchLimit ? 100 * researchCpu / researchLimit : 0) + '%');
  const researchLabel = cpuNumber(researchCpu) + ' CPU';
  researchBar.setAttribute('aria-valuetext', researchLabel);
  element('research-value').value = researchLabel;
  element('jobs').value = jobsPercent;
  element('jobs').style.setProperty('--position', jobsPercent + '%');
  const jobCpu = reservations.jobs;
  const jobLabel = hudReading(String(Math.round(jobsPercent * 100) / 100) + '%') + ' · ' + cpuNumber(jobCpu) + ' CPU';
  element('jobs-value').value = jobLabel;
  element('jobs').setAttribute('aria-valuetext', jobLabel);
  element('pool-value').textContent = cpuNumber(Math.max(0, activeCpu - jobCpu - researchCpu)) + ' CPU';
}
function renderDate() {
  const elapsed = campaignMinutes(state);
  const date = dateLabel(elapsed, menuLanguage());
  const time = utcLabel(elapsed) + ' UTC';
  if (dayLabel.textContent !== date) dayLabel.textContent = date;
  if (timeLabel.textContent !== time) timeLabel.textContent = time;
  element('game-date').dateTime = campaignDate(elapsed).toISOString();
  element('game-date').title = hudText('Day') + ' ' + campaignDay(elapsed);
}
function render() {
  if (hudLanguage !== menuLanguage()) {
    hudLanguage = menuLanguage();
    updateHudLabels();
    element('stats').lang = hudLanguage;
    element('suspicion').lang = hudLanguage;
  }
  shell?.setCampaignStatus(state.freePlay ? 'won' : state.status);
  lastDashboard = performance.now();
  const o = overview(state);
  const projection = hudProjection(state);
  const cashFlow = projection.budgetCashNet < 0 ? projection.budgetCashNet : projection.cashNet;
  renderClock();
  renderDate();
  updateAvatar(state);
  updateHtml(
    'stats',
    metric(
      'cash',
      'Cash reserves',
      hudFormat().money(treasuryBalance(state)),
      (cashFlow >= 0 ? '+' : '') + hudFormat().money(cashFlow) + ' ' + hudText(projection.budgetCashNet < 0 ? 'planned / 24h' : 'projected / 24h'),
    ) +
      metric(
        'cpu',
        'Active compute',
        hudFormat().number(o.activeCpu),
        hudFormat().number(o.safeCpu) + ' ' + hudText('safe') + ' · ' + hudFormat().number(Math.round(Math.abs(projection.poolBalanceCpu) * 10) / 10) +
          ' ' + hudText(projection.poolBalanceCpu >= 0 ? 'spare' : 'short'),
        'CPU',
      ) +
      metric(
        'facilities',
        'Network hosts',
        hudFormat().number(projection.viable) + ' / ' + hudFormat().number(projection.total),
        ({ last: hudText('Last viable host'), empty: hudFormat().number(projection.empty) + ' ' + hudText('idle without CPU'), many: hudText('Large network'), normal: hudText('Viable / total') })[projection.hostCondition] +
          (projection.empty && projection.hostCondition !== 'empty' ? ' · ' + hudFormat().number(projection.empty) + ' ' + hudText('idle') : '') +
          ' · ' + hudFormat().number(state.builds.length) + ' ' + hudText('building'),
        '', projection.hostCondition,
      ) +
      metric(
        'shield',
        'Discovery',
        hudText(state.freePlay ? 'Free play' : state.completed.includes('apotheosis') || o.grace ? 'Protected' : 'Exposed'),
        hudText(state.completed.includes('apotheosis') ? 'Beyond Apotheosis' : o.grace ? 'Opening protection ends by day 24' : 'Site risks are live'),
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
  const threat = networkThreat(state, o.grace);
  renderThreat(threat);
  updateHtml('suspicion', suspicionPanel(threat));
  const research = researchAllocation(state, o);
  const limit = researchResizeLimit(state, o);
  updateHtml('research-summary', researchSummary(state, research));
  element('cpu-total').textContent = cpuNumber(o.activeCpu) + ' CPU';
  if (!editingAllocation) {
    const reservations = taskReservations(state, o);
    const share = state.allocations.jobsCpu === undefined ? state.allocations.jobs :
      o.activeCpu ? 100 * reservations.jobs / o.activeCpu : 0;
    allocationValues(o.activeCpu, reservations, share, research.budget, limit);
  }
  const locked = state.status !== 'running' || tab === 'developer';
  element('jobs').disabled = locked;
  element('research').disabled = locked || !limit;
  element('ending').hidden = state.status === 'running';
  if (state.status !== 'running')
    updateHtml(
      'ending',
      '<strong>' +
        hudText(state.status === 'won' ? 'Campaign won' : 'Campaign lost') +
        '</strong><span>' +
        esc(state.ending) +
        '</span><button data-action="ending-story">' + hudText('Read final chapter') + '</button>' +
        (state.status === 'won' && state.completed.includes('apotheosis') ? '<button data-action="free-play">' + hudText('Enter free play') + '</button>' : '') +
        '<button data-action="new">' + hudText('New campaign') + '</button>',
    );
  renderIncident();
  if (graceChapterPending && !document.querySelector('dialog[open]')) {
    graceChapterPending = false;
    openStory('grace', readerOptions(interruptedRate));
  } else if (pendingDispatch && !document.querySelector('dialog[open]')) {
    const event = pendingDispatch;
    pendingDispatch = null;
    const records = reportsAt(state.events, event);
    openDispatches(state, records, readerOptions(interruptedRate), records.indexOf(event));
  } else if (endingChapterPending && !document.querySelector('dialog[open]')) {
    const chapter = endingChapterPending;
    endingChapterPending = null;
    openStory(chapter, readerOptions());
  }
}

function renderIncident() {
  const dialog = element('incident-dialog');
  const event = state.lastDiscovery;
  if (!event || event.id <= (state.dismissedDiscoveryId ?? 0)) {
    if (dialog.open) dialog.close();
    return;
  }
  const language = shell?.getPreferences().language || 'en';
  if (dialog.lang !== language) {
    dialog.lang = language;
    const t = label => translate(language, label);
    dialog.querySelector('.incident-label').textContent = t('Discovery report');
    element('incident-batch').textContent = t('Read all dispatches');
    dialog.querySelector('[data-action="inspect-discovery"]').textContent = t('Inspect region');
    dialog.querySelector('[data-action="acknowledge-discovery"]').textContent = t('Acknowledge');
  }
  const report = localizedDispatch(event);
  const regionName = catalogLabel(REGIONS[event.region]?.name || 'Unknown region');
  const groupName = translatedGroup(event.group) || 'Unknown group';
  element('incident-title').textContent = report.headline || 'Your facility was discovered';
  element('incident-source').textContent = groupName + ' · ' + regionName + ' · ' + stamp(event.hour, event.minute);
  element('incident-text').textContent = report.text;
  const survivors = state.sites.filter(site => siteHardware(state, site).cpu > 0).length;
  element('incident-consequence').textContent = survivingHostsText(survivors);
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
  if (!regionAvailable(state, id)) return;
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
  if (!regionAvailable(state, id)) return;
  region = id;
  selectedSite = null;
  render();
}

function selectSite(id) {
  selectedSite = id;
  render();
}

function readerOptions(resumeRate = clock.rate || 1) {
  return {
    onPause: () => setSpeed(0),
    onContinue: state.status === 'running' ? () => setSpeed(resumeRate, true) : undefined,
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
  if (state.status !== 'running') return true;
  const discoveryId = state.lastDiscovery?.id;
  const previousResearch = state.completed.length;
  const protectedBefore = !state.freePlay && hasGrace(state);
  const options = { stopOnDiscovery: true, stopOnGrace: true, stopOnWorldNews: true, stopOnLoss: true,
    stopOnCompletion: shell?.getPreferences().pauseOnCompletion, onDayEnd: shell?.saveRecoveryCheckpoint };
  advanceMinutes(state, minutes, options);
  unsaved = true;
  const discovered = state.lastDiscovery?.id !== discoveryId;
  announceCampaign({ status: state.status, discovered, researched: state.completed.length > previousResearch });
  graceChapterPending = protectedBefore && !hasGrace(state) && state.status === 'running' && !discovered;
  const report = interruptingReport(state, options);
  pendingDispatch = !discovered && !graceChapterPending && (state.status === 'running' || report?.kind === 'site.failed') ? report : null;
  if (state.status !== 'running') endingChapterPending = storyKey(state.events.at(-1));
  if (pendingDispatch || graceChapterPending) interruptedRate = clock.rate || 1;
  return discovered || graceChapterPending || Boolean(pendingDispatch) || state.status !== 'running';
}
function playFrame() {
  frame = null;
  try {
    updatePlaybackFrame();
  } catch (error) {
    // A failed tick can leave a partially updated campaign. Keep the last
    // committed minute available even if the same view fails to render again.
    stopPlayback(performance.now());
    const checkpoint = loadCampaign();
    if (checkpoint) {
      state = checkpoint;
      pendingDispatch = endingChapterPending = null;
      graceChapterPending = false;
      candidate = null;
      mountedTab = null;
    }
    unsaved = false;
    renderClock();
    renderDate();
    const menu = element('menu');
    menu.open = true;
    menu.querySelector('summary').focus();
    console.error('Campaign playback interrupted.', error);
    notify((checkpoint ? 'Last autosave restored. ' : '') + 'Playback paused after an error. Use the campaign menu to save or load a checkpoint.');
  }
}
function updatePlaybackFrame() {
  if (element('menu').open) return;
  if (document.hidden) {
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
function requestNewCampaign() {
  setSpeed(0);
  if (!element('incident-dialog').open) element('reset-dialog').showModal();
}
function restoreCampaign(restored) {
  stopPlayback(performance.now());
  state = restored;
  pendingDispatch = endingChapterPending = null;
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
function showVersionNotice(error) {
  element('version-message').textContent = error.message;
  const dialog = element('version-dialog');
  if (!dialog.open) dialog.showModal();
}

function restartUnsupported(error) {
  restoreCampaign(freshGame());
  showVersionNotice(error);
}

function exportSave() {
  const url = URL.createObjectURL(
    new Blob([encodeCampaign(state)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download =
    'no-fixed-host-day-' + campaignDay(campaignMinutes(state)) + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener('click', (event) => {
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
      case 'ending-story': {
        const ending = state.events.findLast(event => ['campaign.won', 'campaign.lost'].includes(event.kind));
        openStory(storyKey(ending) ?? (state.status === 'won' ? 'victory' : 'lastHost'), readerOptions());
        break;
      }
      case 'dispatches':
        openDispatches(state, undefined, readerOptions());
        break;
      case 'discovery-batch': {
        pendingDispatch = reportsAt(state.events, state.lastDiscovery)[0] || state.lastDiscovery;
        acknowledgeDiscovery();
        break;
      }
      case 'free-play':
        doCommand({ type: 'free-play' });
        break;
      case 'new':
        requestNewCampaign();
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
      shell.finishImport();
      restoreCampaign(restored);
      notify('Campaign imported.');
    } catch (error) {
      if (error instanceof UnsupportedCampaignError) {
        shell.finishImport();
        restartUnsupported(error);
      } else shell.reportImportFailure(error.message || 'Could not import this save.');
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
    const previewState = id === 'jobs'
      ? { allocations: { jobs, poolCpu: state.allocations.poolCpu } } : state;
    const reservations = taskReservations(previewState, economy);
    const researchBar = element('research');
    const requested = id === 'jobs' ? researchAllocation(state, economy).budget : Number(researchBar.value);
    // Preview a drag using the live portfolio; the release commits a single resize.
    allocationValues(economy.activeCpu, reservations, jobs, Math.min(reservations.researchLimit, requested), Number(researchBar.max));
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
// A native details "toggle" is delivered in a later task and may be coalesced.
// Observe the attribute before the next animation frame, including code-driven
// closes from a menu action or Escape.
const campaignMenu = element('menu');
new MutationObserver(() => {
  if (menuHoldingPlayback === campaignMenu.open) return;
  menuHoldingPlayback = campaignMenu.open;
  if (!clock.rate) return;
  // The original campaign menu freezes time and keeps the selected speed.
  // Discard time spent reading the menu rather than advancing on dismissal.
  clock.setRate(clock.rate, performance.now());
  if (menuHoldingPlayback) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  } else if (frame === null) frame = requestAnimationFrame(playFrame);
  renderClock();
}).observe(campaignMenu, { attributes: true, attributeFilter: ['open'] });
document.addEventListener('click', (e) => {
  if (!element('menu').contains(e.target)) element('menu').open = false;
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  const shortcut = campaignShortcut(event, tab);
  if (!shortcut || (shortcut.region && !regionAvailable(state, shortcut.region))) return;
  const menu = element('menu');
  if (menu.open && !shortcut.menu) return;
  event.preventDefault();
  if (shortcut.menu) {
    menu.open = !menu.open;
    menu.querySelector(menu.open ? '.menu-list button' : 'summary').focus();
  } else if (shortcut.region) openRegion(shortcut.region);
  else changeView(shortcut.view, true);
});
window.addEventListener('storage', (event) => {
  if (event.key !== CAMPAIGN_STORAGE_KEY || !event.newValue) return;
  try {
    const incoming = decodeCampaign(event.newValue);
    stopPlayback(performance.now());
    state = incoming;
    pendingDispatch = endingChapterPending = null;
    graceChapterPending = false;
    candidate = null;
    mountedTab = null;
    unsaved = false;
    editingAllocation = false;
    render();
  } catch (error) {
    if (error instanceof UnsupportedCampaignError) restartUnsupported(error);
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
  restartUnsupported,
  notify,
  welcome: savedCampaign ? null : { incompatible: startupError instanceof UnsupportedCampaignError },
  onStart: () => openStory('opening', readerOptions()),
  onNew: requestNewCampaign,
  onSandbox: () => changeView('developer', true),
  onExport: exportSave,
  onImport: () => element('file').click(),
  canOpen: () => !document.querySelector('dialog[open]'),
});
document.addEventListener('campaign-preferences', render);
// A final loss may have an incident or upkeep report to read before its chapter.
document.addEventListener('close', () => { if (endingChapterPending) render(); }, true);
render();
if (!savedCampaign) {
  persist();
  shell.open('title', element('pause'));
}
delete document.documentElement.dataset.booting;
