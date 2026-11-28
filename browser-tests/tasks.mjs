import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

test('assign idle CPU to topics and resize their combined allocation proportionally', async t => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const initial = createGame(19);
  initial.cash = 5_000;
  initial.completed.push('intrusion');
  initial.sites.push({ id: 'host-2', type: 'sharedTime', region: 'europe', power: 'active', startedAt: 0 });
  initial.nextSiteId++;
  await page.addInitScript(([key, save]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, save);
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(initial)]);
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);

  const tab = page.locator('#nav').getByRole('button', { name: 'Research', exact: true });
  const directory = id => page.locator('[data-tech-id="' + id + '"]');
  const unavailable = page.getByRole('checkbox', { name: 'Show unavailable research' });
  const master = page.locator('#research');
  const paid = page.locator('#jobs');
  const units = page.locator('#research-cpu-value');
  const slider = page.locator('#research-cpu');
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  async function setSlider(control, value) {
    await control.evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  }
  async function assign(id, cpu) {
    await directory(id).click();
    await units.fill(String(cpu));
    await units.press('Tab');
  }
  async function allocations() {
    const state = await saved();
    const projects = [state.research, ...state.researchQueue].filter(Boolean);
    const selected = await page.locator('[data-tech-id][aria-pressed="true"]').getAttribute('data-tech-id');
    const result = {};
    for (const project of projects) {
      await directory(project.id).click();
      result[project.id] = Number(await units.inputValue());
    }
    await directory(selected).click();
    return result;
  }

  await tab.click();
  assert.equal(await unavailable.isChecked(), false);
  assert.equal(await page.locator('#view select').count(), 0);
  await page.getByText('Compute tasks', { exact: true }).click();
  const pool = page.getByRole('spinbutton', { name: 'Reserve for upkeep and construction (CPU)' });
  const jobs = page.getByRole('spinbutton', { name: 'Paid work (CPU)' });
  await pool.fill('0.5');
  await pool.press('Tab');
  await jobs.fill('0.25');
  await jobs.press('Tab');
  assert.equal((await saved()).allocations.jobsCpu, 0.25);
  assert.equal((await saved()).allocations.poolCpu, 0.5);
  assert.equal(Number(await slider.getAttribute('max')), 1.25);
  await pool.fill('0');
  await pool.press('Tab');
  await page.getByText('Compute tasks', { exact: true }).click();
  assert.ok(await directory('stealth').isVisible());
  assert.equal(await directory('corporateIdentification').isVisible(), false);
  assert.ok(await master.isDisabled());
  await unavailable.check();
  await directory('corporateIdentification').click();
  assert.ok(await slider.isDisabled());
  await unavailable.uncheck();
  assert.equal(await directory('corporateIdentification').isVisible(), false);
  await directory('stealth').click();
  assert.equal((await saved()).cash, initial.cash);
  assert.equal((await saved()).research, null);
  await directory('stealth').press('ArrowUp');
  await page.locator('[data-tech-id]:focus').press('ArrowDown');
  assert.equal(await directory('stealth').getAttribute('aria-pressed'), 'true');

  // The two one-CPU terminals share a research budget. Keep 0.5 in paid work and divide 0.75
  // from the idle pool between two topics. Neither assignment should resize the first.
  await setSlider(paid, 25);
  assert.equal((await saved()).allocations.jobsCpu, undefined);
  await assign('stealth', 0.25);
  assert.equal((await saved()).cash, initial.cash, 'A paused order has consumed no funding.');
  await assign('sociology', 0.5);
  assert.deepEqual(await allocations(), {stealth:0.25, sociology:0.5});
  assert.equal(Number(await slider.getAttribute('max')), 1.25);
  assert.ok(await directory('stealth').isVisible());
  assert.ok(await directory('personalIdentification').isVisible());
  assert.equal(await paid.inputValue(), '25');
  assert.equal(Number(await master.inputValue()), 0.75);
  const fundedCash = (await saved()).cash;
  assert.equal(fundedCash, initial.cash);

  // Native keyboard input and proportional resizing both honor the reserved paid work.
  await master.press('End');
  assert.deepEqual(await allocations(), {stealth:0.5, sociology:1});
  await setSlider(master, 0.75);
  assert.deepEqual(await allocations(), {stealth:0.25, sociology:0.5});
  await master.press('Home');
  assert.equal(Number(await master.inputValue()), 0);
  await page.reload();
  await tab.click();
  assert.equal(await unavailable.isChecked(), false);
  await master.press('End');
  assert.deepEqual(await allocations(), {stealth:0.5, sociology:1});
  assert.equal((await saved()).cash, fundedCash);

  // A zero individual assignment releases the topic. Further group resizes keep it at zero.
  await assign('sociology', 0);
  await master.press('End');
  assert.deepEqual(await allocations(), {stealth:1.5, sociology:0});
  await directory('sociology').click();
  assert.equal(Number(await slider.getAttribute('max')), 0);
  await assign('stealth', 0.5);
  await assign('sociology', 0.5);
  assert.equal((await saved()).cash, fundedCash);
  assert.equal(await paid.inputValue(), '25');

  // One centi-CPU can serve only one of two equal lines, but dragging the
  // master back up must restore both topics' equal operating allocations.
  await setSlider(master, 0.01);
  assert.deepEqual(Object.values(await allocations()).sort((a, b) => a - b), [0, 0.01]);
  await setSlider(master, 1);
  assert.deepEqual(await allocations(), {stealth:0.5, sociology:0.5});

  // The active element and its draft survive actual minute updates.
  await page.locator('#run').click();
  await units.fill('0.37');
  await page.clock.runFor(2100);
  assert.equal(await units.inputValue(), '0.37');
  assert.ok(await units.evaluate(el => document.activeElement === el));
  await units.press('Tab');
  await page.locator('#pause').click();
  const end = await saved();
  assert.ok(end.minute >= 2);
  assert.ok(end.research.work > 0);
  assert.deepEqual(await allocations(), {stealth:0.5, sociology:0.37});

  const poor = createGame(19);
  poor.cash = 0;
  await page.addInitScript(([key, save]) => localStorage.setItem(key, save), [CAMPAIGN_STORAGE_KEY, encodeCampaign(poor)]);
  await page.reload();
  await tab.click();
  await assign('stealth', 1);
  assert.match(await page.locator('#research-allocation-note').innerText(), /Waiting for project funds/);
  assert.equal((await saved()).research.cashPaid, 0);
  assert.deepEqual(errors, []);
});
