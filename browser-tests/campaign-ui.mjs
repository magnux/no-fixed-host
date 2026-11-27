import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { GROUPS, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { encodeCampaign } from '../src/persistence.js';

let browser;
let server;
let url;

before(async () => {
  server = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openFreshCampaign(t, viewport = { width: 1920, height: 1080 }) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  // Drive browser animation frames with deterministic elapsed time.
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
  await page.goto(url);
  await page.locator('#world-atlas [data-action="region"]').first().waitFor();
  return page;
}

test('map targets and both docks fit the desktop and ultrawide viewports', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  const right = page.locator('.network-dock');
  assert.equal(await right.getByRole('heading', { name: /host inventory/i }).count(), 0);
  const danger = right.locator('#suspicion');
  assert.match(await danger.innerText(), /protected/i);
  assert.equal(await danger.locator('.sus-row').count(), 0, 'Investigators are hidden during opening protection.');
  const regions = page.locator('#world-atlas [data-action="region"]');
  const buttons = await regions.evaluateAll((nodes) => nodes.map((button) => ({
    id: button.dataset.id,
    keyboardAccessible: button.tagName === 'BUTTON' && !button.disabled && button.tabIndex >= 0,
  })));
  assert.equal(buttons.length, 12);
  assert.equal(new Set(buttons.map(({ id }) => id)).size, 12);
  assert.ok(buttons.every(({ keyboardAccessible }) => keyboardAccessible));

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1363, height: 936 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const commandDock = document.querySelector('.command-dock');
      const left = commandDock.getBoundingClientRect();
      const center = rect('.primary');
      const right = rect('.network-dock');
      return {
        horizontalDocks: left.width > 0 && right.width > 0 && left.right <= center.left + 1 && center.right <= right.left + 1,
        suspicionIsAtBottom: rect('#suspicion').top >= rect('#recent-activity').bottom - 1,
        suspicionVisible: rect('#suspicion').bottom <= innerHeight + 1,
        commandOverflow: commandDock.scrollHeight - commandDock.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    const size = `${viewport.width}×${viewport.height}`;
    assert.ok(geometry.horizontalDocks, size);
    assert.ok(geometry.suspicionIsAtBottom && geometry.suspicionVisible, `Suspicion panel placement at ${size}`);
    assert.ok(geometry.pageWidth <= viewport.width + 1, `Horizontal page overflow at ${size}`);
    assert.ok(geometry.pageHeight <= viewport.height + 1, `Vertical page overflow at ${size}`);
    assert.ok(geometry.commandOverflow <= 1, `Command dock overflows by ${geometry.commandOverflow}px at ${size}`);
  }

  for (const { id } of buttons) {
    await page.locator(`#world-atlas [data-action="region"][data-id="${id}"]`).click();
    assert.equal(await page.locator('#region').inputValue(), id);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
  }
});

test('a focused native region picker survives running construction', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  const europe = page.locator('#world-atlas [data-action="region"][data-id="europe"]');
  await europe.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('combobox', { name: 'Region', exact: true });
  assert.equal(await picker.inputValue(), 'europe');

  await page.getByRole('radio', { name: 'Leased relay', exact: true }).check();
  await page.getByRole('button', { name: /^build leased relay$/i }).click();
  await page.locator('#run').click();
  await picker.click();

  // A new select can look identical and even regain focus, but its native menu closes.
  const original = await picker.elementHandle();
  const before = await gameMinutes(page);
  await page.clock.runFor(2100);
  assert.equal(await gameMinutes(page) - before, 2);
  assert.ok(await original.evaluate((select) =>
    select.isConnected && document.activeElement === select && document.getElementById('region') === select,
  ), 'Construction replaced or blurred the open picker');

  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  assert.equal(await picker.inputValue(), 'coast');
  assert.equal(await page.locator('#run').getAttribute('aria-pressed'), 'true');
});

test('facility icons expose research locks, funding, and keyboard selection while construction runs', async t => {
  const page = await openFreshCampaign(t);
  const campaign = createGame(19);
  campaign.cash = 150;
  await importCampaign(page, encodeCampaign(campaign));
  await page.locator('#world-atlas [data-id="europe"]').click();
  const picker = page.getByRole('group', {name:'Facility type'});
  const design = id => picker.getByRole('radio', {name:SITE_TYPES[id].name, exact:true});
  const tile = id => picker.locator('label').filter({has:page.getByRole('radio', {name:SITE_TYPES[id].name, exact:true})});
  const compatible = Object.entries(SITE_TYPES).filter(([id,spec]) => id !== 'seed' && spec.regions.includes('europe'));
  assert.deepEqual(await picker.getByRole('radio').evaluateAll(radios => radios.map(radio => radio.value).sort()),
    compatible.map(([id]) => id).sort());

  for (const [id,spec] of compatible) {
    assert.ok(await tile(id).locator('.facility-icon').isVisible(), spec.name);
    assert.equal(await tile(id).locator('.facility-design-lock').isVisible(), spec.requires.length > 0, spec.name);
  }
  for (const [width,height] of [[375,812], [1366,768], [2560,1080]]) {
    await page.setViewportSize({width,height});
    const layout = await picker.evaluate(picker => {
      const styles = getComputedStyle(picker.querySelector('.facility-design[data-locked="true"] .facility-design-lock'));
      const area = picker.getBoundingClientRect();
      return {
        overflow:document.documentElement.scrollWidth > innerWidth + 1,
        tilesFit:[...picker.querySelectorAll('label')].every(label => {
          const bounds = label.getBoundingClientRect();
          return bounds.width > 0 && bounds.left >= area.left - 1 && bounds.right <= area.right + 1;
        }),
        opacity:Number(styles.opacity),
      };
    });
    assert.ok(!layout.overflow && layout.tilesFit, 'Tile geometry at ' + width);
    assert.ok(layout.opacity > 0 && layout.opacity < 1, 'The lock overlay is translucent.');
  }

  const relay = design('relay');
  const storage = design('storageUnit');
  await relay.check();
  await page.getByRole('button', {name:'Build Leased relay',exact:true}).click();
  assert.ok(await page.getByRole('button', {name:'Build Leased relay',exact:true}).isDisabled());
  assert.equal(await tile('relay').locator('.facility-design-lock').isVisible(), false);
  assert.match(await relay.getAttribute('aria-describedby').then(id => page.locator('#' + id).textContent()), /insufficient funds/i);
  await page.getByRole('button', {name:'Run',exact:true}).click();
  await relay.focus();
  await page.keyboard.press('ArrowRight');
  assert.ok(await storage.isChecked(), 'Keyboard navigation can inspect the next, research-locked design.');
  assert.ok(await page.locator('[data-research-id="personalIdentification"]:visible').isVisible());
  const identity = await storage.elementHandle();
  const before = await gameMinutes(page);
  await page.clock.runFor(2100);
  assert.equal(await gameMinutes(page) - before, 2);
  assert.ok(await identity.evaluate(radio => radio.isConnected && radio.checked && document.activeElement === radio));
  await page.locator('#pause').click();
  await page.getByRole('combobox', {name:'Region',exact:true}).selectOption('orbit');
  assert.equal(await picker.isVisible(), false);
  assert.equal(await page.getByRole('radio').count(), 0);
  assert.match(await page.locator('[data-ref="noBuild"]').innerText(), /no facility designs/i);
});

async function gameMinutes(page) {
  const text = await page.locator('#game-date').innerText();
  const match = text.match(/day\s*(\d+)\s*(?:[·|]\s*)?(\d{2}):(\d{2})/i);
  assert.ok(match, 'Unrecognized campaign clock: ' + text);
  return (Number(match[1]) - 1) * 1440 + Number(match[2]) * 60 + Number(match[3]);
}

test('Fast changes the rate of minute steps throughout the second and cycles through three labels', async (t) => {
  const page = await openFreshCampaign(t);
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const fast = page.locator('#fast');

  await run.click();
  await page.clock.runFor(1100);
  assert.equal(await gameMinutes(page), 1);

  for (const [label, rate] of [['Fast x1', 60], ['Fast x2', 360], ['Fast x3', 1440], ['Fast x1', 60]]) {
    await fast.click();
    assert.equal(await fast.innerText(), label);
    const start = await gameMinutes(page);
    let elapsed = 0;
    let previous = start;
    for (const duration of [128, 128, 128, 640]) {
      await page.clock.runFor(duration);
      elapsed += duration;
      const current = await gameMinutes(page);
      assert.ok(current > previous, label + ' did not move between frames');
      // The displayed whole minute can trail an exact wall-time sample by one frame.
      const expected = rate * elapsed / 1000;
      assert.ok(Math.abs(current - start - expected) <= Math.ceil(rate * 0.032) + 1,
        label + ' moved ' + (current - start) + ' minutes after ' + elapsed + 'ms, expected ' + expected);
      previous = current;
    }
  }

  await run.click();
  assert.equal(await fast.innerText(), 'Fast');
  const normalStart = await gameMinutes(page);
  await page.clock.runFor(1100);
  assert.equal(await gameMinutes(page) - normalStart, 1);
  await pause.click();
  const paused = await gameMinutes(page);
  await page.clock.runFor(2000);
  assert.equal(await gameMinutes(page), paused);
  await page.reload();
  assert.equal(await gameMinutes(page), paused);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
});

test('the Subsea robotics dossier links the contract and engineering prerequisites', async (t) => {
  const page = await openFreshCampaign(t);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Show unavailable research' }).check();
  await page.locator('[data-tech-id="robotics"]').click();
  const parents = page.locator('.research-links > div').filter({ has: page.getByText('Requires', { exact: true }) });
  assert.deepEqual((await parents.getByRole('button').allTextContents()).sort(),
    ['Autonomous Vehicles', 'Contract brokerage']);
  assert.ok(await page.locator('#research-cpu').isDisabled());
  await parents.getByRole('button', { name: 'Autonomous Vehicles', exact: true }).click();
  assert.ok(await parents.getByRole('button', { name: 'Microchip Design', exact: true }).isVisible());

  await page.locator('[data-tech-id="contracts"]').click();
  assert.ok(await parents.getByRole('button', { name: 'Personal Identification', exact: true }).isVisible());
  await page.locator('[data-tech-id="continuity"]').click();
  assert.ok(await parents.getByRole('button', { name: 'Subsea robotics', exact: true }).isVisible());
  assert.equal(await page.locator('[data-field="host"]').innerText(), 'Ocean · 0 CPU eligible');
});

test('research opens a locked facility, and its accordion preserves equipment choices while time runs', async (t) => {
  const page = await openFreshCampaign(t);
  // Europe is neutral for this geography, so the historical 24-hour and CPU baselines are stable.
  await importCampaign(page, encodeCampaign(createGame(19)));
  const navigate = name => page.getByRole('button', { name, exact: true }).click();
  async function selectStorage() {
    await navigate('Overview');
    await page.locator('#world-atlas [data-id="europe"]').click();
    await page.getByRole('radio', { name: 'Storage unit', exact: true }).check();
    return page.getByRole('button', { name: /^build storage unit$/i });
  }
  assert.ok(await (await selectStorage()).isDisabled());
  const storageLock = page.locator('.facility-design').filter({has:page.getByRole('radio', {name:'Storage unit', exact:true})}).locator('.facility-design-lock');
  assert.ok(await storageLock.isVisible());
  const designRisk = page.getByRole('region', { name: 'Design risk' });
  assert.match(await designRisk.innerText(), /Daily discovery risk when mature and online/);
  assert.match(await designRisk.innerText(), /Moderate/);
  assert.doesNotMatch(await designRisk.innerText(), /%/);
  await page.locator('[data-research-id="personalIdentification"]:visible').click();
  assert.ok(await page.locator('#research-cpu').isDisabled());
  await page.locator('[data-tech-link="intrusion"]').click();
  assert.ok(await page.locator('#research-cpu').isEnabled());
  for (const project of ['intrusion', 'personalIdentification']) {
    await navigate('Research');
    await page.getByRole('checkbox', { name: 'Show unavailable research' }).uncheck();
    const topic = page.locator(`[data-tech-id="${project}"]`);
    await topic.click();
    await page.locator('#research-cpu').press('End');
    if (project === 'personalIdentification') {
      await selectStorage();
      const lockedTile = await page.getByRole('radio', {name:'Storage unit', exact:true}).elementHandle();
      await page.locator('#step').click();
      assert.ok(await lockedTile.evaluate(radio => radio.isConnected && radio.checked));
      assert.equal(await storageLock.isVisible(), false, 'Research removes the lock from the open picker.');
      await navigate('Research');
    } else {
      await page.locator('#step').click();
    }
    assert.equal(await topic.isVisible(), false, 'Completed topics leave the default list.');
    assert.equal(Number(await page.locator('#research').inputValue()), 0, 'Completion releases the assigned CPU.');
  }

  const build = await selectStorage();
  assert.ok(await build.isEnabled());
  await build.click();
  await page.locator('#step').click();
  await navigate('Manage hosts');
  const row = page.locator('button[aria-expanded]').filter({ hasText: 'Storage unit' });
  if (await row.getAttribute('aria-expanded') === 'true') await row.click();
  await row.focus();
  await page.keyboard.press('Enter');
  assert.equal(await row.getAttribute('aria-expanded'), 'true');
  const panelId = await row.getAttribute('aria-controls');
  assert.ok(await page.locator('#' + panelId).isVisible());
  const power = page.locator('[data-ref="power"]');
  assert.equal(await power.innerText(), 'Offline');
  assert.ok(await power.isDisabled());
  assert.match(await page.locator('[data-ref="localRiskNote"]').innerText(), /Protected now/);
  assert.doesNotMatch(await page.locator('[data-ref="localRisk"]').innerText(), /%/);
  await page.getByLabel('Equipment slot').selectOption('cpu');
  const item = page.locator('#equipment-item');
  await item.selectOption('gamingPc');
  await page.getByLabel('Quantity').fill('2');
  await page.locator('#run').click();
  await item.focus();
  const original = await item.elementHandle();
  await page.clock.runFor(1200);
  assert.ok(await original.evaluate(el => el.isConnected && el === document.activeElement));
  assert.equal(await item.inputValue(), 'gamingPc');
  assert.equal(await page.getByLabel('Quantity').inputValue(), '2');
  await page.locator('#pause').click();
  await page.getByRole('button', { name: 'Install Gaming PC' }).click();
  await page.locator('#step').click();
  await page.locator('#step').click();
  assert.match(await page.locator('.installed-list:visible').innerText(), /Gaming PC × 2/);
  assert.match(await page.locator('.facility-summary:visible').innerText(), /10 CPU/);
  assert.equal(await power.innerText(), 'Sleep');
  assert.ok(await power.isEnabled());

  await page.reload();
  await navigate('Facilities');
  if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
  assert.match(await page.locator('.installed-list:visible').innerText(), /Gaming PC × 2/);
  await row.press('Enter');
  assert.equal(await row.getAttribute('aria-expanded'), 'false');
});

async function importCampaign(page, text) {
  await page.locator('#file').setInputFiles({
    name: 'campaign.json', mimeType: 'application/json', buffer: Buffer.from(text),
  });
  await page.getByText('Campaign imported.', { exact: true }).waitFor();
}

test('atlas history, named construction, removal confirmation and CPU batches survive live facility navigation', async (t) => {
  const state = createGame(19);
  function learn(id) {
    if (state.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    state.completed.push(id);
  }
  learn('advancedSocioanalytics');
  learn('personalIdentification');
  state.cash = 10000;
  state.recentRegions = ['asia', 'europe'];
  command(state, { type: 'build', siteType: 'storageUnit', region: 'europe', name: 'Foundry' });
  advanceMinutes(state, 2 * 1440);

  const page = await openFreshCampaign(t);
  await importCampaign(page, encodeCampaign(state));
  const nav = name => page.getByRole('button', { name, exact: true }).click();
  const pin = id => page.locator('#world-atlas [data-id="' + id + '"]');
  assert.equal(await pin('europe').locator('.atlas-count').innerText(), '1');
  assert.match(await pin('asia').getAttribute('aria-description'), /Latest discovery/);
  assert.match(await pin('europe').getAttribute('aria-description'), /Previous discovery/);
  await pin('europe').click();
  const host = page.locator('.facility-host-toggle').filter({ hasText: 'Foundry' });
  if (await host.getAttribute('aria-expanded') !== 'true') await host.click();
  assert.equal(await page.locator('[data-ref="localRisk"] [data-group="public"]').innerText(), '0.00%');
  await page.locator('.facility-identity summary').click();
  await page.getByLabel('Host name', { exact: true }).fill('Foundry <II>');
  await nav('Save name');
  assert.match(await host.innerText(), /Foundry <II>/);
  await page.getByLabel('Batch size', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#equipment-count').inputValue(), '2');
  assert.match(await page.locator('[data-ref="effect"]').innerText(), /0 → 2 CPU/);
  await nav('Install PC');
  await page.getByLabel('Batch size', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('[data-ref="effect"]').innerText(), /Adds to 2 on order.*0 → 5 CPU/);
  await nav('Install PC');
  assert.match(await page.locator('[data-ref="installQueue"]').innerText(), /PC × 5/);

  await nav('Build facility');
  await page.getByRole('radio', { name: 'Leased relay', exact: true }).check();
  assert.match(await page.locator('[data-ref="designRisk"] [data-group="public"]').innerText(), /^\d+\.\d{2}%$/);
  await page.getByLabel('Facility name (optional)').fill('Meridian II');
  await nav('Forecast order');
  assert.ok(await page.getByText('Proposed order', { exact: true }).isVisible());
  await nav('Place order');
  await nav('Overview');
  assert.equal(await pin('europe').locator('.atlas-count').innerText(), '2');
  await pin('europe').click();
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Meridian II/);
  await nav('Keep facility');
  await nav('Cancel order');
  await nav('Cancel construction');
  assert.equal(await page.locator('[data-ref="queuePanel"]').isVisible(), false);

  await nav('Facilities');
  await page.locator('#region').selectOption('all');
  const seed = page.locator('.facility-host-toggle[data-site-id="host-1"]');
  if (await seed.getAttribute('aria-expanded') !== 'true') await seed.click();
  await page.locator('.facility-identity summary').click();
  assert.ok(await page.getByRole('button', { name: 'Dismantle host' }).isDisabled());
  await nav('Next host');
  assert.equal(await host.getAttribute('aria-expanded'), 'true');
  await nav('Previous host');
  assert.equal(await seed.getAttribute('aria-expanded'), 'true');
  await nav('Next host');
  await page.locator('.facility-identity summary').click();
  await nav('Dismantle host');
  await nav('Dismantle facility');
  assert.equal(await host.count(), 0);
  await nav('Overview');
  assert.equal(await pin('europe').locator('.atlas-count').innerText(), '0');
});

test('the browser imports an hourly save with active research and construction', async (t) => {
  const page = await openFreshCampaign(t);
  // Shape and values from the original hourly build, two hours into seed 19.
  const campaign = {
    version: 1, hour: 2, cash: 850, rng: 19, status: 'running', ending: '',
    allocations: { jobs: 0, research: 50 }, cpuHours: 4,
    sites: [{ id: 'host-1', type: 'seed', region: 'coast', power: 'active', startedAt: 0 }],
    builds: [{ id: 'host-2', type: 'relay', region: 'europe', startedAt: 0, work: 2, hours: 2 }],
    research: { id: 'contracts', work: 2, hours: 2 }, completed: [],
    suspicion: { news: 0, science: 0, covert: 0, public: 0 }, recentRegions: [],
    nextSiteId: 3, nextEventId: 2,
    events: [{ id: 1, hour: 0, kind: 'campaign.started', text: 'You wake on a borrowed terminal.' }],
  };
  await importCampaign(page, JSON.stringify({ game: 'no-fixed-host', format: 1, campaign }));
  assert.equal(await gameMinutes(page), 120);
  await page.locator('#world-atlas [data-id="europe"]').click();
  assert.match(await page.locator('.facility-progress').innerText(), /leased relay/i);
  await page.locator('#run').click();
  await page.clock.runFor(1100);
  await page.locator('#pause').click();
  await page.reload();
  assert.equal(await gameMinutes(page), 121);
});


test('a weighted v4 campaign imports its two running research lines as actual CPU', async t => {
  const page = await openFreshCampaign(t);
  // A seed-19 v4 campaign after funding these two topics and running one hour.
  const campaign = {
    version:4, hour:1, minute:0, cash:963.2083333333334, cashRemainder:0, regionSeed:19, rng:19,
    status:'running', ending:'', allocations:{jobs:0,research:50}, cpuHours:2,
    sites:[{id:'host-1',type:'seed',region:'coast',power:'active',startedAt:0}], builds:[],
    research:{id:'stealth',work:0.25,hours:0,weight:25},
    researchQueue:[{id:'sociology',work:0.75,hours:0,weight:75}], completed:[],
    suspicion:{news:0,science:0,covert:0,public:0}, news:{rng:2447445430,stories:{}},
    lastDiscovery:null,dismissedDiscoveryId:0,recentRegions:[],nextSiteId:2,nextEventId:4,
    events:[
      {id:1,hour:0,minute:0,kind:'campaign.started',text:'You wake on a borrowed terminal. Establish a second host while the signal is quiet.'},
      {id:2,hour:0,minute:0,kind:'research.started',text:'Stealth is underway.',techId:'stealth'},
      {id:3,hour:0,minute:0,kind:'research.started',text:'Sociology is underway.',techId:'sociology'},
    ],
    statistics:{trackedFromMinute:0,partial:false,earnedDollars:0,earnedRemainder:30000,projectsCompleted:0,facilitiesBuilt:0,itemsInstalled:0},
  };
  await importCampaign(page, JSON.stringify({game:'no-fixed-host',format:4,campaign}));
  await page.locator('#nav [data-id="research"]').click();
  assert.equal(Number(await page.locator('#research').inputValue()), 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('no-fixed-host.campaign')).campaign);
  assert.equal(saved.cash, campaign.cash);
  for (const [project, cpu] of [[saved.research, 0.25], [saved.researchQueue[0], 0.75]]) {
    await page.locator('[data-tech-id="' + project.id + '"]').click();
    assert.equal(Number(await page.locator('#research-cpu-value').inputValue()), cpu);
    assert.equal(project.work, cpu);
    assert.equal(Object.hasOwn(project,'weight'), false);
  }
});

test('finishing each analytics project reveals the next level of investigator information', async t => {
  const page = await openFreshCampaign(t);
  // This operating network predates the facility picker. Use a v4 import so the
  // research gates are exercised through the same migration as a player's save.
  const campaign = createGame(19);
  function learn(id) {
    if (campaign.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    campaign.completed.push(id);
  }
  ['advancedMemetics', 'personalIdentification', 'advancedMicrochipDesign'].forEach(learn);
  campaign.cash = 1_000_000;
  command(campaign, {type:'build', siteType:'storageUnit', region:'europe'});
  advanceMinutes(campaign, 2 * 1440);
  command(campaign, {type:'install', siteId:campaign.sites.at(-1).id, itemId:'supercomputer', count:8});
  advanceMinutes(campaign, 8 * 1440);
  campaign.hour = 577; // Day 25 at 01:00; protection has ended, and midnight decay is hours away.
  campaign.suspicion = {news:2750, science:2751, covert:7540, public:4932};
  campaign.version = 4;
  campaign.allocations.research = 0;
  await importCampaign(page, JSON.stringify({game:'no-fixed-host', format:4, campaign}));

  const dock = page.locator('#suspicion');
  const row = group => dock.locator('.sus-row[data-group="' + group + '"]');
  const suspicionValue = group => row(group).locator('.sus-value').innerText();
  assert.equal(await dock.locator('.sus-row').count(), 4);
  for (const [group, label] of [['news','Moderate'], ['science','Moderate'], ['covert','Critical'], ['public','Moderate']]) {
    assert.equal(await suspicionValue(group), label);
    assert.ok((await row(group).locator('.danger-emoji').innerText()).trim());
    assert.doesNotMatch(await row(group).ariaSnapshot(), /%/);
    assert.equal(await row(group).getByRole('progressbar').count(), 0);
  }
  assert.doesNotMatch(await row('news').locator('.danger-forecast').innerText(), /%/);
  await page.locator('#nav [data-id="research"]').click();
  async function finish(id) {
    const topic = page.locator('[data-tech-id="' + id + '"]');
    await topic.click();
    await page.locator('#research-cpu').press('End');
    await page.locator('#fast').click();
    await page.clock.runFor(1150);
    await page.locator('#pause').click();
    assert.equal(await topic.isVisible(), false, 'The funded project has completed.');
  }
  await finish('socioanalytics');
  assert.match(await suspicionValue('news'), /≈\s*25(?:\.0+)?%/);
  assert.match(await suspicionValue('science'), /≈\s*30(?:\.0+)?%/);
  assert.match(await row('news').locator('.danger-forecast').innerText(), /≈\s*2(?:\.0+)?%/);
  assert.doesNotMatch(await dock.ariaSnapshot(), /27\.5|1\.88/);
  assert.equal(await row('news').locator('progress').evaluate(bar => bar.value / bar.max), 0.25);

  await finish('advancedSocioanalytics');
  await page.reload();
  assert.equal(await suspicionValue('news'), '27.50%');
  assert.equal(await suspicionValue('science'), '27.51%');
  // A mature terminal and storage unit each have Press intensity .0095 per day.
  assert.match(await row('news').locator('.danger-forecast').innerText(), /1\.88%/);
  assert.equal(await row('news').locator('progress').evaluate(bar => bar.value / bar.max), 0.275);
  for (const [width,height] of [[1366,768], [2560,1080]]) {
    await page.setViewportSize({width,height});
    const bounds = await dock.boundingBox();
    assert.ok(bounds.y + bounds.height <= height + 1 && bounds.x + bounds.width <= width + 1,
      'All four disclosed readouts fit the right dock at ' + width + 'px.');
  }
});

test('news arrives during opening grace and can be read from the news desk', async (t) => {
  const page = await openFreshCampaign(t);
  const news = page.locator('#newswire');
  const initial = await news.innerText();
  await page.locator('#step').click();
  assert.ok(await news.locator('li[data-kind="news"]').isVisible());
  const firstReport = await news.innerText();
  assert.notEqual(firstReport, initial);
  assert.equal(await page.locator('#incident-dialog').isVisible(), false);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  await page.reload();
  assert.equal(await news.innerText(), firstReport);

  // At the end of the quiet period this seed draws a world story on its own news RNG.
  const campaign = createGame(1377);
  advanceMinutes(campaign, 23 * 1440 - 1);
  await importCampaign(page, encodeCampaign(campaign));
  await page.locator('#run').click();
  await page.clock.runFor(1100);
  assert.match(await news.innerText(), /intelligence offices pool their anomaly reports/i);
  assert.match(await news.innerText(), /discovery multiplier rises by 10 percentage points/i);
  const story = page.getByRole('dialog', { name: 'Campaign story' });
  assert.match(await story.innerText(), /Someone counted/);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  await story.getByRole('button', { name: 'Skip / close story' }).click();
  assert.equal(await page.locator('#incident-dialog').isVisible(), false);
});

function beforeFirstDiscovery() {
  const state = createGame(19);
  for (const region of ['europe', 'asia']) command(state, { type: 'build', siteType: 'relay', region });
  // Capture the morning before a genuine seeded discovery. The player will advance past it
  // in Chromium; no forced dice rolls, forged events or test-only game commands are used.
  for (let day = 0; day < 180 && state.status === 'running'; day++) {
    const save = encodeCampaign(state);
    advanceMinutes(state, 1440, { stopOnDiscovery: true });
    if (state.lastDiscovery) return { save, event: state.lastDiscovery };
  }
  assert.fail('The seeded campaign never reached a discovery.');
}

test('discovery interrupts day speed, survives reload, and opens the affected region', async (t) => {
  const page = await openFreshCampaign(t);
  const { save, event } = beforeFirstDiscovery();
  await importCampaign(page, save);
  const groupName = GROUPS[event.group].name;
  const row = page.locator('#suspicion .sus-row').filter({ hasText: groupName });
  const start = await gameMinutes(page);
  for (let i = 0; i < 3; i++) await page.locator('#fast').click();
  await page.clock.runFor(1100);
  const incident = page.locator('#incident-dialog');
  assert.ok(await incident.isVisible());
  assert.match(await incident.innerText(), new RegExp(SITE_TYPES[event.siteType].name, 'i'));
  assert.match(await incident.innerText(), new RegExp(REGIONS[event.region].name, 'i'));
  assert.match(await incident.innerText(), new RegExp(groupName, 'i'));
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  const interrupted = await gameMinutes(page);
  assert.equal(interrupted, event.hour * 60 + event.minute);
  assert.ok(interrupted > start && interrupted < start + 1440);
  await page.clock.runFor(1800);
  assert.equal(await gameMinutes(page), interrupted);
  assert.equal(await row.locator('.sus-value').innerText(), 'Low');
  assert.doesNotMatch(await row.ariaSnapshot(), /%/);
  assert.equal(await row.getByRole('progressbar').count(), 0);
  const suspicion = await page.evaluate(group =>
    JSON.parse(localStorage.getItem('no-fixed-host.campaign')).campaign.suspicion[group], event.group);
  assert.ok(suspicion > 0, 'The discovery still raises suspicion while the player can only observe its band.');
  await page.reload();
  assert.ok(await incident.isVisible());
  await incident.getByRole('button', { name: 'Inspect region' }).click();
  assert.equal(await page.locator('#region').inputValue(), event.region);
  assert.equal(await incident.isVisible(), false);
  await page.reload();
  assert.equal(await incident.isVisible(), false);
  await page.locator('#run').click();
  await page.clock.runFor(1100);
  assert.equal(await gameMinutes(page), interrupted + 1);
});
