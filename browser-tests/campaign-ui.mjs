import { startCampaign } from './support/start-campaign.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { GROUPS, REGIONS, SITE_TYPES, TECHS } from '../src/game/content.js';
import { regionalSpec } from '../src/game/geography.js';
import { creditTreasury } from '../src/game/treasury.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

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
  await startCampaign(page);
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
    available: !button.matches(':disabled, [aria-disabled="true"]'),
    keyboardAccessible: button.tagName === 'BUTTON' && !button.disabled && button.tabIndex >= 0,
  })));
  assert.equal(buttons.length, 23);
  assert.deepEqual(new Set(buttons.map(({ id }) => id)), new Set(Object.keys(REGIONS)));
  for (const { id, available, keyboardAccessible } of buttons) {
    const requires = REGIONS[id].requires;
    assert.equal(available, requires.length === 0, id);
    assert.equal(keyboardAccessible, available || !['orbit','moon','farReaches','transdimensional'].includes(id), id);
    if (requires.length) {
      const marker = regions.and(page.locator('[data-id="' + id + '"]'));
      if (await marker.locator('.atlas-dot').count()) {
        assert.equal(await marker.getAttribute('aria-disabled'), 'true');
      } else {
        assert.ok(await marker.locator('.atlas-lock').isVisible(), id);
      }
      assert.ok((await marker.getAttribute('aria-description')).includes(TECHS[requires[0]].name));
    }
  }

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
        cardsInGutters: ['orbit', 'moon', 'farReaches', 'transdimensional'].every((id, i) => {
          const card = rect('#world-atlas [data-id="' + id + '"]');
          const chart = rect('.atlas-geography');
          return card.top >= chart.top && card.bottom <= chart.bottom &&
            (i < 2 ? card.right <= chart.left : card.left >= chart.right);
        }),
        compactCardsBelowChart: rect('.atlas-horizon').top >= rect('.atlas-geography').bottom - 1,
        commandOverflow: commandDock.scrollHeight - commandDock.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    const size = `${viewport.width}×${viewport.height}`;
    assert.ok(geometry.horizontalDocks, size);
    if (viewport.width === 2560) assert.ok(geometry.cardsInGutters, size);
    if (viewport.width === 1920) assert.ok(geometry.compactCardsBelowChart, size);
    assert.ok(geometry.suspicionIsAtBottom && geometry.suspicionVisible, `Suspicion panel placement at ${size}`);
    assert.ok(geometry.pageWidth <= viewport.width + 1, `Horizontal page overflow at ${size}`);
    assert.ok(geometry.pageHeight <= viewport.height + 1, `Vertical page overflow at ${size}`);
    assert.ok(geometry.commandOverflow <= 1, `Command dock overflows by ${geometry.commandOverflow}px at ${size}`);
  }

  for (const { id } of buttons.filter(button => button.available)) {
    await page.locator(`#world-atlas [data-action="region"][data-id="${id}"]`).click();
    assert.equal(await page.locator('#region').inputValue(), id);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
  }
});

test('unlocking a destination reveals its menu entries and enables its existing atlas marker', async t => {
  const page = await openFreshCampaign(t);
  const state = createGame(19);
  // The next supplied CPU-minute completes the regional prerequisite.
  const tech = TECHS.autonomousVehicles;
  function learn(id) {
    if (state.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    state.completed.push(id);
  }
  tech.requires.forEach(learn);
  command(state, { type: 'assign-research', id: 'autonomousVehicles', cpu: 1 });
  state.cash = tech.cost + 10_000;
  state.research.hours = tech.hours;
  state.research.work = tech.work - 1 / 60;
  state.research.cashPaid = tech.cost;
  await importCampaign(page, encodeCampaign(state));

  const ocean = page.locator('#world-atlas [data-id="atlantic"]');
  assert.ok(await ocean.isDisabled());
  await page.getByRole('button', { name: 'Facilities', exact: true }).click();
  const picker = page.locator('#region');
  assert.equal(await picker.locator('option[value="atlantic"]').count(), 0);
  await page.getByRole('button', { name: 'Build facility', exact: true }).click();
  const terms = page.locator('[data-ref="regionTable"]');
  assert.equal(await terms.locator('[data-region="atlantic"]').count(), 0);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  const marker = await ocean.elementHandle();
  await page.locator('#run').click();
  await page.clock.runFor(1100);
  assert.ok(await marker.evaluate(el => el.isConnected && !el.matches(':disabled, [aria-disabled="true"]')));
  await ocean.click();
  assert.equal(await picker.inputValue(), 'atlantic');
  assert.equal(await terms.locator('[data-region="atlantic"]').count(), 1);
  assert.equal(await picker.locator('option[value="transdimensional"]').count(), 0);
});

test('Earth markers show one localized hint on hover or keyboard focus and compact selection opens each ocean', async t => {
  const page = await openFreshCampaign(t, { width: 375, height: 812 });
  const campaign = createGame(19);
  campaign.completed.push(...Object.keys(TECHS).filter(id => id !== 'apotheosis'));
  await importCampaign(page, encodeCampaign(campaign));
  const atlas = page.locator('#world-atlas');
  const shortcuts = await atlas.locator('button[data-action="region"]').evaluateAll(nodes => nodes.map(button => button.getAttribute('aria-keyshortcuts')));
  assert.equal(shortcuts.length, 23);
  assert.equal(new Set(shortcuts).size, 23);
  const pins = atlas.locator('.atlas-pin');
  const hint = atlas.locator('.atlas-hint');
  assert.ok(await hint.isHidden());
  assert.deepEqual(await pins.allTextContents(), Array(19).fill(''));
  await atlas.locator('[data-id="centralAmerica"]').hover();
  assert.equal(await hint.locator('strong').innerText(), 'Central America');
  assert.match(await hint.innerText(), /Mexico City/);
  await atlas.locator('[data-id="southAmerica"]').hover();
  assert.match(await hint.innerText(), /South America.*Caracas/s);
  await atlas.locator('h2').hover();
  assert.ok(await hint.isHidden());
  await page.keyboard.press('Tab');
  await pins.first().focus();
  assert.equal(await hint.locator('strong').innerText(), 'Western North America');
  await page.keyboard.press('Escape');
  assert.ok(await hint.isHidden());
  const compact = atlas.getByRole('combobox', { name: 'Open a region from the atlas' });
  assert.ok(await compact.isVisible());
  assert.equal(await compact.locator('option').count(), 24);
  await compact.selectOption('marianaTrench');
  assert.equal(await page.locator('#region').inputValue(), 'marianaTrench');
  const facilityTypes = page.getByRole('group', {name:'Facility type'}).getByRole('radio');
  assert.deepEqual(await facilityTypes.evaluateAll(radios => radios.map(radio => radio.value)), ['capsule']);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  for (const [width, height] of [[375,812], [1100,620], [1366,768], [2560,1080]]) {
    await page.setViewportSize({width, height});
    await page.clock.runFor(32);
    for (const region of ['europe','africa','pacific','antarctic','marianaTrench']) {
      await atlas.locator('.atlas-pin[data-id="' + region + '"]').hover();
      assert.equal(await hint.locator('strong').innerText(), REGIONS[region].name);
      const chartBounds = await atlas.locator('.atlas-geography').boundingBox();
      const tip = await hint.boundingBox();
      assert.ok(tip.x >= chartBounds.x && tip.x + tip.width <= chartBounds.x + chartBounds.width + 1, region);
      assert.ok(tip.y >= chartBounds.y && tip.y + tip.height <= chartBounds.y + chartBounds.height + 1, region);
    }
  }
  await atlas.locator('.atlas-pin[data-id="indianOcean"]').click();
  assert.equal(await page.locator('#region').inputValue(), 'indianOcean');
  const oceanDesigns = await page.getByRole('group', {name:'Facility type'}).getByRole('radio').evaluateAll(radios => radios.map(radio => radio.value));
  assert.deepEqual(oceanDesigns.sort(), ['lab', 'largeLab']);
});

test('a touch player can inspect a locked circle, dismiss its hint and open an available region by name', async t => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 375, height: 812 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await startCampaign(page);
  const atlas = page.locator('#world-atlas');
  const trench = atlas.getByRole('button', {name:'Mariana Trench facilities'});
  // The touch screen still delivers pointer input to a focusable aria-disabled marker.
  await trench.scrollIntoViewIfNeeded();
  const target = await trench.boundingBox();
  await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
  const hint = atlas.locator('.atlas-hint');
  assert.match(await hint.innerText(), /Mariana Trench.*Locked.*Knowledge Preservation/s);
  await atlas.locator('.atlas-pins').tap({position:{x:6, y:6}});
  assert.ok(await hint.isHidden());
  const picker = atlas.getByRole('combobox', {name:'Open a region from the atlas'});
  assert.equal(await picker.locator('option[value="marianaTrench"]').count(), 0);
  await picker.selectOption('middleEast');
  assert.equal(await page.locator('#region').inputValue(), 'middleEast');
});

test('a focused native region picker survives running construction', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  const campaign = createGame(19);
  campaign.completed.push('intrusion');
  await importCampaign(page, encodeCampaign(campaign));
  const europe = page.locator('#world-atlas [data-action="region"][data-id="europe"]');
  await europe.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('combobox', { name: 'Region', exact: true });
  assert.equal(await picker.inputValue(), 'europe');

  await page.getByRole('radio', { name: SITE_TYPES.sharedTime.name, exact: true }).check();
  await page.getByRole('button', { name: 'Build ' + SITE_TYPES.sharedTime.name, exact: true }).click();
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
  campaign.cash = 25;
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
  assert.ok(await page.getByRole('button', {name:'Build Leased relay',exact:true}).isEnabled(), 'An unfunded design can be commissioned.');
  assert.equal(await tile('relay').locator('.facility-design-lock').isVisible(), false);
  assert.match(await relay.getAttribute('aria-describedby').then(id => page.locator('#' + id).textContent()), /payments continue as funds arrive/i);
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
  const funding = page.locator('[data-ref="queue"] .facility-progress');
  assert.equal(await funding.getAttribute('data-stalled'), 'true');
  assert.match(await funding.innerText(), /Waiting for project funds.*\$75 of \$100 outstanding/);
  await page.locator('#pause').click();
  assert.equal(await page.locator('#region option[value="orbit"]').count(), 0);

  // A late-game design can exceed the precision limit of the fractional-dollar wallet.
  campaign.completed = Object.keys(TECHS).filter(id => id !== 'apotheosis');
  const quote = regionalSpec(campaign, 'transdimensional', SITE_TYPES.realityBubble).cost;
  creditTreasury(campaign, quote);
  await importCampaign(page, encodeCampaign(campaign));
  await page.locator('#world-atlas [data-id="transdimensional"]').click();
  const bubble = tile('realityBubble');
  assert.equal(await bubble.getAttribute('data-affordable'), 'true');
  assert.ok((await bubble.innerText()).includes('$' + quote.toLocaleString('en-US')));

});

async function gameMinutes(page) {
  const timestamp = await page.locator('#game-date').getAttribute('datetime');
  return (Date.parse(timestamp) - Date.parse('2026-12-12T04:20:00Z')) / 60_000;
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
  for (const heldMs of [96, 1800, 128]) {
    const toggle = () => heldMs === 1800 ? page.locator('#menu summary').click() : page.keyboard.press('Escape');
    await toggle();
    const inMenu = await gameMinutes(page);
    assert.equal(await page.locator('#clock-mode').innerText(), 'Campaign paused');
    await page.clock.runFor(heldMs);
    assert.equal(await gameMinutes(page), inMenu);
    await toggle();
    assert.equal(await page.locator('#clock-mode').innerText(), '1 tick/s');
    await page.clock.runFor(1024);
    assert.equal(await gameMinutes(page), inMenu + 1);
  }
  await fast.click();
  await page.clock.runFor(128);
  await page.locator('#menu summary').click();
  const beforeFastDismissal = await gameMinutes(page);
  await page.clock.runFor(144);
  assert.equal(await gameMinutes(page), beforeFastDismissal);
  // Clicking the transport changes speed and dismisses the menu in the same browser event.
  await fast.click();
  assert.equal(await fast.innerText(), 'Fast x2');
  await page.clock.runFor(160);
  assert.ok(Math.abs((await gameMinutes(page)) - beforeFastDismissal - 0.16 * 360) <= 7);
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
  assert.equal(await page.locator('[data-field="host"]').innerText(), 'Atlantic Ocean, Pacific Ocean, Indian Ocean · 0 CPU eligible');
});

test('research opens a locked facility, and its accordion preserves equipment choices while time runs', async (t) => {
  const page = await openFreshCampaign(t);
  const campaign = createGame(19);
  campaign.cash = 25_000;
  campaign.completed.push('intrusion');
  // Resume a funded topic with one CPU-hour left, keeping the full Normal research costs.
  command(campaign, { type: 'assign-research', id: 'personalIdentification', cpu: 1 });
  campaign.research.work = TECHS.personalIdentification.work - 1;
  command(campaign, { type: 'assign-research', id: 'personalIdentification', cpu: 0 });
  await importCampaign(page, encodeCampaign(campaign));
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
  const topic = page.locator('[data-tech-id="personalIdentification"]');
  await topic.click();
  await page.locator('#research-cpu').press('End');
  await selectStorage();
  const lockedTile = await page.getByRole('radio', {name:'Storage unit', exact:true}).elementHandle();
  await page.locator('#step').click();
  assert.ok(await lockedTile.evaluate(radio => radio.isConnected && radio.checked));
  assert.equal(await storageLock.isVisible(), false, 'Research removes the lock from the open picker.');
  await navigate('Research');
  assert.equal(await topic.isVisible(), false, 'Completed topics leave the default list.');
  assert.equal(Number(await page.locator('#research').inputValue()), 0, 'Completion releases the assigned CPU.');

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
  const power = page.locator('.facility-host-row').filter({has: row}).locator('[data-host-action="power"]');
  assert.match(await power.getAttribute('aria-description'), /Install processors/);
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
  assert.match(await power.getAttribute('aria-label'), /^Sleep /);
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

test('hardware packages show ranks and prices, forecast refits, and protect the last processor bank', async t => {
  const state = createGame(19);
  state.completed.push('intrusion', 'personalIdentification');
  state.cash = 50_000;
  state.sites.push({ id: 'host-2', name: 'Foundry', region: 'europe', type: 'storageUnit', startedAt: 0, power: 'active',
    equipment: { cpu: { itemId: 'pc', count: 2 }, network: null, reactor: null, security: null } });
  state.nextSiteId++;
  const page = await openFreshCampaign(t);
  async function openHost(campaign) {
    await importCampaign(page, encodeCampaign(campaign));
    await page.locator('#world-atlas [data-id="europe"]').click();
    const host = page.getByRole('button', { name: /^Foundry Storage unit/ });
    if (await host.getAttribute('aria-expanded') !== 'true') await host.click();
    return host;
  }
  const host = await openHost(state);
  assert.equal(await host.getByRole('img', { name: /Average installed slot rank.*Tech rank 1 of 5/ }).count(), 1);
  const cpu = page.locator('.installed-list [data-slot="cpu"]');
  assert.match(await cpu.innerText(), /PC × 2/);
  assert.equal(await cpu.getByRole('img', { name: /Tech rank 1 of 5/ }).count(), 1);
  const ref = key => page.locator('[data-ref="' + key + '"]');
  const slotBounds = await page.locator('#equipment-slot').boundingBox();
  for (const control of ['autoInstall', 'autoUpgrade']) {
    const bounds = await ref(control).boundingBox();
    assert.ok(bounds.y + bounds.height <= slotBounds.y);
    assert.match(await ref(control).innerText(), /\$/);
  }
  assert.match(await ref('autoParts').innerText(), /High-speed internet access.*Diesel generator/);
  assert.match(await ref('upgradeParts').innerText(), /Server × 2/);
  assert.match(await ref('upgradeWarning').innerText(), /0 CPU/);
  await ref('autoInstall').click();
  assert.match(await page.getByRole('dialog').innerText(), /High-speed internet access × 1.*Diesel generator × 1/);
  await page.getByRole('button', { name: 'Confirm installation' }).click();
  assert.match(await ref('installQueue').innerText(), /Diesel generator/);
  await ref('autoUpgrade').click();
  assert.match(await page.getByRole('dialog').innerText(), /0 CPU/);
  await page.getByRole('button', { name: 'Keep equipment online' }).click();
  assert.doesNotMatch(await ref('installQueue').innerText(), /Server × 2/);
  await ref('previewUpgrade').click();
  assert.match(await page.locator('[data-report="name"]').innerText(), /Auto-upgrade package for Foundry/);
  assert.match(await page.locator('[data-report="package"]').innerText(), /Server × 2/);
  assert.match(await page.locator('[data-report="refit"]').innerText(), /0 CPU/);
  await page.getByRole('button', { name: 'Place order' }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.locator('#world-atlas [data-id="europe"]').click();
  if (await host.getAttribute('aria-expanded') !== 'true') await host.click();
  assert.match(await host.innerText(), /Processor installation · 0 CPU/);
  assert.doesNotMatch(await cpu.innerText(), /PC × 2/);
  assert.match(await cpu.innerText(), /Offline · Installing Server × 2 · Rank/);
  assert.match(await ref('installQueue').innerText(), /Server × 2/);
  await page.locator('#step').click();
  await page.locator('#step').click();
  assert.match(await cpu.innerText(), /Server × 2/);
  assert.doesNotMatch(await cpu.innerText(), /Installing/);
  assert.match(await host.innerText(), /Online/);

  command(state, { type: 'dismantle', id: 'host-1' });
  await openHost(state);
  assert.ok(await ref('autoUpgrade').isDisabled());
  assert.match(await ref('upgradeReason').innerText(), /last viable host/);
  await page.locator('#equipment-item').selectOption('server');
  assert.ok(await ref('install').isDisabled());
  assert.match(await ref('installReason').innerText(), /last viable host/);
});

test('construction explains a CPU stall and resumes when paid work releases CPU', async t => {
  const state = createGame(19);
  function learn(id) {
    if (state.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    state.completed.push(id);
  }
  learn('advancedDatabaseManipulation');
  state.cash = 500_000;
  command(state, { type: 'allocate', jobs: 100 });
  const page = await openFreshCampaign(t);
  await importCampaign(page, encodeCampaign(state));
  await page.locator('#world-atlas [data-id="europe"]').click();
  const name = SITE_TYPES.covertBase.name;
  await page.getByRole('radio', { name, exact: true }).check();
  await page.getByRole('button', { name: 'Build ' + name, exact: true }).click();
  const order = page.locator('[data-ref="queue"] .facility-progress');
  const text = await order.innerText();
  assert.match(text, /CPU reserved for jobs/i);
  assert.match(text, /\$[\d,]+ of \$[\d,]+ outstanding/);
  assert.match(text, /CPU-h and .* labor remaining/);
  await page.locator('#step').click();
  assert.equal(await order.innerText(), text, 'Blocked labor, cash and CPU work should stay unchanged.');
  await page.locator('#jobs').press('Home');
  assert.equal(await order.getAttribute('data-stalled'), 'false');
  await page.locator('#step').click();
  assert.match(await order.innerText(), /Receiving CPU/);
  assert.notEqual(await order.innerText(), text);
});

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
  assert.match(await pin('europe').getAttribute('aria-description'), /1 completed · 0 under construction/);
  assert.match(await pin('asia').getAttribute('aria-description'), /Latest discovery/);
  assert.match(await pin('europe').getAttribute('aria-description'), /Previous discovery/);
  await pin('europe').click();
  const host = page.locator('.facility-host-toggle').filter({ hasText: 'Foundry' });
  if (await host.getAttribute('aria-expanded') !== 'true') await host.click();
  assert.equal(await page.locator('[data-ref="localRisk"] [data-group="public"]').innerText(), '0.00%');
  await page.getByLabel('Host name', { exact: true }).fill('Foundry <II>');
  await nav('Rename');
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
  await page.locator('#equipment-item').selectOption('server');
  await nav('Install Server');
  assert.match(await page.getByRole('dialog').innerText(), /unfinished PC/);
  await nav('Keep current order');
  assert.match(await page.locator('[data-ref="installQueue"]').innerText(), /PC × 5/);
  await nav('Install Server');
  await nav('Confirm installation');
  assert.match(await page.locator('[data-ref="installQueue"]').innerText(), /Server × 1/);

  await nav('Build facility');
  await page.getByRole('radio', { name: 'Storage unit', exact: true }).check();
  assert.match(await page.locator('[data-ref="designRisk"] [data-group="public"]').innerText(), /^\d+\.\d{2}%$/);
  await page.getByLabel('Facility name (optional)').fill('Meridian II');
  await nav('Forecast order');
  assert.match(await page.locator('[data-report="kind"]').innerText(), /Proposed order · \$4,500(?:\.00)? new funding/);
  await nav('Place order');
  await nav('Overview');
  assert.match(await pin('europe').getAttribute('aria-description'), /1 completed · 1 under construction/);
  await pin('europe').click();
  await nav('Rename facility');
  await page.getByRole('dialog').getByLabel('Facility name', { exact: true }).fill('Meridian III');
  await nav('Save facility name');
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Meridian III/);
  await nav('Keep facility');
  await nav('Cancel order');
  await nav('Cancel construction');
  assert.equal(await page.locator('[data-ref="queuePanel"]').isVisible(), false);

  await nav('Facilities');
  await page.locator('#region').selectOption('all');
  const seed = page.locator('.facility-host-toggle[data-site-id="host-1"]');
  if (await seed.getAttribute('aria-expanded') !== 'true') await seed.click();
  const seedRemoval = page.getByRole('button', {name:'Dismantle University computer'});
  assert.ok(await seedRemoval.isDisabled());
  assert.match(await seedRemoval.getAttribute('aria-description'), /last viable host/);
  await nav('Next host');
  assert.equal(await host.getAttribute('aria-expanded'), 'true');
  await nav('Previous host');
  assert.equal(await seed.getAttribute('aria-expanded'), 'true');
  const removeFoundry = page.getByRole('button', {name:'Dismantle Foundry <II>'});
  // The expanded seed and the collapsed sibling's action deliberately refer to different hosts.
  await removeFoundry.press('Enter');
  assert.match(await page.getByRole('dialog').innerText(), /Dismantle Foundry <II>/);
  await page.keyboard.press('Escape');
  assert.equal(await seed.getAttribute('aria-expanded'), 'true');
  assert.equal(await host.getAttribute('aria-expanded'), 'false');
  assert.equal(await removeFoundry.evaluate(el => el === document.activeElement), true);
  await removeFoundry.click();
  await nav('Dismantle facility');
  assert.equal(await seed.getAttribute('aria-expanded'), 'true');
  assert.equal(await host.count(), 0);
  await nav('Overview');
  assert.match(await pin('europe').getAttribute('aria-description'), /0 completed · 0 under construction/);
});

test('a saved research portfolio restores the CPU assigned to each topic', async t => {
  const page = await openFreshCampaign(t);
  const campaign = createGame(19);
  campaign.cash = 5_000;
  command(campaign, { type: 'assign-research', id: 'stealth', cpu: .25 });
  command(campaign, { type: 'assign-research', id: 'sociology', cpu: .75 });
  advanceMinutes(campaign, 60);
  await importCampaign(page, encodeCampaign(campaign));
  await page.locator('#nav [data-id="research"]').click();
  assert.equal(Number(await page.locator('#research').inputValue()), 1);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  assert.equal(saved.cash, campaign.cash);
  for (const [project, cpu] of [[saved.research, .25], [saved.researchQueue[0], .75]]) {
    await page.locator('[data-tech-id="' + project.id + '"]').click();
    assert.equal(Number(await page.locator('#research-cpu-value').inputValue()), cpu);
    assert.equal(project.work, cpu);
  }
});

test('finishing each analytics project reveals the next level of investigator information', async t => {
  const page = await openFreshCampaign(t);
  const campaign = createGame(18);
  function learn(id) {
    if (campaign.completed.includes(id)) return;
    TECHS[id].requires.forEach(learn);
    campaign.completed.push(id);
  }
  ['advancedMemetics', 'personalIdentification', 'advancedQuantumComputing'].forEach(learn);
  // Both sites occupy neutral terrain. The processor bank can finish both
  // Normal projects before the next midnight changes the evidence readings.
  campaign.sites[0].region = 'europe';
  campaign.sites.push({
    id: 'host-2', type: 'storageUnit', region: 'europe', power: 'active', startedAt: 0,
    equipment: { cpu: { itemId: 'quantumComputer3', count: 8 }, reactor: null, network: null, security: null },
  });
  campaign.nextSiteId++;
  campaign.cash = 1_000_000;
  campaign.hour = 577;
  campaign.suspicion = {news:2750, science:2751, covert:7540, public:4932};
  await importCampaign(page, encodeCampaign(campaign));

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
    const minutes = Math.ceil(TECHS[id].work * 60 / 80_000);
    await page.clock.runFor((minutes + 8) / 60 * 1000);
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

  const editorial = createGame(23);
  advanceMinutes(editorial, 5 * 1440 + 459);
  await importCampaign(page, encodeCampaign(editorial));
  for (let press = 0; press < 3; press++) await page.locator('#fast').click();
  await page.clock.runFor(1100);
  assert.match(await news.innerText(), /library lends a translator that works offline/i);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.ok(await gameMinutes(page) > 5 * 1440 + 460);
  await page.locator('#pause').click();

  // At the end of the quiet period this seed draws a world story on its own news RNG.
  const campaign = createGame(502619);
  advanceMinutes(campaign, 23 * 1440 - 1);
  await importCampaign(page, encodeCampaign(campaign));
  await page.locator('#run').click();
  await page.clock.runFor(1100);
  assert.match(await news.innerText(), /cloud incident desks adopt a common case number/i);
  assert.match(await news.innerText(), /discovery multiplier rises by 10 percentage points/i);
  const story = page.getByRole('dialog', { name: 'Campaign story' });
  assert.match(await story.innerText(), /Someone counted/);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  await story.getByRole('button', { name: 'Skip / close story' }).click();
  assert.equal(await page.locator('#incident-dialog').isVisible(), false);
});

test('day speed pauses for consequential news at its exact minute and the dispatch can be reopened', async t => {
  const page = await openFreshCampaign(t);
  const state = createGame(398);
  advanceMinutes(state, 23 * 1440);
  await importCampaign(page, encodeCampaign(state));
  for (let press = 0; press < 3; press++) await page.locator('#fast').click();
  await page.clock.runFor(1100);
  const dispatch = page.getByRole('dialog', {name: 'Dispatches'});
  assert.match(await dispatch.innerText(), /Review panel suspends automated referrals/);
  assert.equal(await gameMinutes(page), 23 * 1440 + 152);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  await dispatch.getByRole('button', {name: 'Keep paused'}).click();
  await page.reload();
  const news = page.locator('#newswire');
  assert.match(await news.innerText(), /Investigation update/);
  await news.getByRole('button', {name: 'Coverage (1)'}).click();
  await page.locator('.chronicle-entry').filter({hasText: 'Review panel suspends automated referrals'}).click();
  assert.match(await dispatch.innerText(), /falls by 10 percentage points/);
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
  const suspicion = await page.evaluate(([key, group]) =>
    JSON.parse(localStorage.getItem(key)).campaign.suspicion[group], [CAMPAIGN_STORAGE_KEY, event.group]);
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

test('French facility controls preserve the player’s host name through power, refit, package and dismantling dialogs', async t => {
  const state = createGame(19);
  state.completed.push('intrusion', 'personalIdentification');
  state.cash = 50000;
  state.sites.push({ id: 'host-2', name: 'Build {site} <III>', region: 'europe', type: 'storageUnit', startedAt: 0, power: 'active',
    equipment: { cpu: { itemId: 'pc', count: 2 }, network: null, reactor: null, security: null } });
  state.nextSiteId++;
  const context = await browser.newContext({locale: 'fr-FR'});
  t.after(() => context.close());
  await context.addInitScript(([key, data]) => localStorage.setItem(key, data), [CAMPAIGN_STORAGE_KEY, encodeCampaign(state)]);
  const page = await context.newPage();
  await page.goto(url);
  const pin = page.locator('#world-atlas [data-id="europe"]');
  await pin.click();
  const host = page.locator('.facility-host-toggle').filter({hasText: 'Build {site} <III>'});
  await host.click();
  const ref = id => page.locator('[data-ref="' + id + '"]');
  assert.equal(await ref('buildMode').innerText(), 'Construire une installation');
  const power = page.getByRole('button', {name:'Mettre Build {site} <III> en veille'});
  assert.equal(await power.innerText(), '');
  assert.equal(await power.getAttribute('title'), 'Mettre Build {site} <III> en veille');
  await power.click();
  await page.getByRole('button', {name:'Réveiller Build {site} <III>'}).click();
  await ref('autoInstall').click();
  assert.match(await page.getByRole('dialog').innerText(), /Installer cet ensemble de composants/);
  await page.getByRole('button', {name:'Annuler le lot'}).click();
  await ref('autoUpgrade').click();
  assert.match(await page.getByRole('dialog').innerText(), /hors ligne.+0 CPU/);
  await page.getByRole('button', {name:'Garder le matériel en ligne'}).click();
  await ref('rename').fill('Keep {site} & Build');
  assert.equal(await ref('saveName').innerText(), 'Renommer');
  await ref('rename').press('Enter');
  await page.getByRole('button', {name:'Démanteler Keep {site} & Build'}).click();
  assert.equal(await ref('removalTitle').innerText(), 'Démanteler Keep {site} & Build ?');
  assert.match(await ref('removalText').innerText(), /définitivement supprimés/);
  await ref('keep').click();
  await ref('buildMode').click();
  await page.locator('[data-facility-type="storageUnit"]').check();
  await ref('buildName').fill('Chargement <III>');
  await ref('build').click();
  await page.getByRole('button',{name:'Renommer l’installation'}).click();
  await ref('queueName').fill('Reserved Package « 2 »');
  await page.getByRole('button',{name:'Enregistrer le nom de l’installation'}).click();
  await page.getByRole('button',{name:'Annuler la commande'}).click();
  assert.equal(await ref('removalTitle').innerText(), 'Annuler la construction de Reserved Package « 2 » ?');
});

test('host bar actions fit a touch viewport and keep another host’s unsaved name intact', async t => {
  const state = createGame(19);
  const first = state.sites[0];
  first.name = 'University <A>';
  command(state, {type: 'build', siteType: 'relay', region: first.region, name: 'Western District Research and Communications Hub'});
  advanceMinutes(state, 1);
  const context = await browser.newContext({viewport:{width:375, height:812}, hasTouch:true});
  t.after(() => context.close());
  await context.addInitScript(([key, data]) => localStorage.setItem(key, data), [CAMPAIGN_STORAGE_KEY, encodeCampaign(state)]);
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('#nav [data-id="facilities"]').click();
  const firstRow = page.locator('.facility-host-row[data-site-id="host-1"]');
  const other = page.locator('.facility-host-row[data-site-id="host-2"]');
  await firstRow.locator('.facility-host-toggle').click();
  const name = firstRow.getByRole('textbox', {name:'Host name'});
  await name.fill('Not saved yet');
  const bar = other.locator('.facility-host-bar');
  for (const width of [375, 1366]) {
    await page.setViewportSize({width, height:812});
    const geometry = await bar.evaluate(el => {
      const [toggle, boost, power, remove] = [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      return { separate: toggle.right <= boost.left && boost.right <= power.left && power.right <= remove.left,
        inside: remove.right <= el.getBoundingClientRect().right && el.getBoundingClientRect().right <= innerWidth,
        touchTargets: [boost, power, remove].every(r => r.width >= 44 && r.height >= 44) };
    });
    assert.deepEqual(geometry, {separate:true, inside:true, touchTargets:true});
  }
  await bar.getByRole('button', {name:'Sleep Western District Research and Communications Hub'}).tap();
  assert.equal(await name.inputValue(), 'Not saved yet');
  assert.equal(await other.locator('.facility-host-toggle').getAttribute('aria-expanded'), 'false');
  await bar.getByRole('button', {name:'Dismantle Western District Research and Communications Hub'}).tap();
  const confirm = page.getByRole('dialog', {name:'Dismantle Western District Research and Communications Hub?'});
  assert.match(await confirm.innerText(), /host-2/);
  await confirm.getByRole('button',{name:'Keep facility'}).tap();
  assert.equal(await name.inputValue(), 'Not saved yet');
  assert.equal(await other.locator('.facility-host-toggle').getAttribute('aria-expanded'), 'false');
  assert.match(await firstRow.locator('h3').innerText(), /University <A>/);
});
