import { advance, command, createGame, overview } from './game/engine.js';
import {
  CAMPAIGN_STORAGE_KEY,
  decodeCampaign,
  encodeCampaign,
  loadCampaign,
  saveCampaign,
} from './persistence.js';
import { icon } from './ui/icons.js';
import {
  activityPage,
  esc,
  facilitiesPage,
  money,
  objectivePanel,
  overviewPage,
  researchPage,
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
  target.innerHTML = html;
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
  element('clock-mode').textContent = finished
    ? 'Campaign ended'
    : speed === 0
      ? 'Paused'
      : speed === 1
        ? 'Running'
        : 'Fast forward';
  element('clock-mode').classList.toggle('running', speed > 0);
  updateHtml(
    'run',
    (speed ? icon('pause') : icon('play')) + (speed ? 'Pause' : 'Run'),
  );
  updateHtml('fast', icon('fast') + 'Fast');
  element('fast').setAttribute('aria-pressed', String(speed === 6));
  for (const id of ['run', 'fast', 'step']) element(id).disabled = finished;
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
    ':00</span>';
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
        o.grace ? 'Opening grace active' : 'Site risks are live',
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
  const pages = {
    overview: overviewPage,
    facilities: facilitiesPage,
    research: researchPage,
    activity: activityPage,
  };
  updateHtml('view', pages[tab](state, region));
  updateHtml('objective', objectivePanel(state));
  updateHtml('suspicion', suspicionPanel(state, o.grace));
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
        '</span><button data-action="new">New campaign</button>',
    );
}
function doCommand(action) {
  command(state, action);
  persist();
  render();
}
function tick(hours) {
  advance(state, hours);
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
    element('nav').scrollIntoView({ block: 'nearest' });
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
      case 'run':
        setSpeed(speed ? 0 : 1);
        break;
      case 'fast':
        setSpeed(speed === 6 ? 0 : 6);
        break;
      case 'step':
        setSpeed(0);
        tick(24);
        break;
      case 'tab':
        changeView(id, !element('nav').contains(button));
        break;
      case 'region':
        region = id;
        changeView('facilities', true);
        break;
      case 'build':
        doCommand({ type: 'build', siteType: id, region });
        notify('Facility added to the construction queue.');
        break;
      case 'start-research':
        doCommand({ type: 'research', id });
        notify('Research started. Assign compute and advance time.');
        break;
      case 'power': {
        const site = state.sites.find((item) => item.id === id);
        if (site)
          doCommand({
            type: 'power',
            id,
            power: site.power === 'active' ? 'sleep' : 'active',
          });
        break;
      }
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
  if (event.target.id === 'region') {
    region = event.target.value;
    render();
    return;
  }
  if (event.target.id === 'file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Save file is too large.');
      const restored = decodeCampaign(await file.text());
      state = restored;
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
