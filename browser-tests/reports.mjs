import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { campaignStatistics, projectResources } from '../src/game/reports.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const quantity = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

test('compare, discard and place research and facility orders, then reconcile the forecast and statistics in the browser', async t => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = createGame(47);
  advanceMinutes(state, 93);
  await page.addInitScript(([key, save]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, save);
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(state)]);
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const readSave = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  const nav = name => page.locator('#nav').getByRole('button', { name, exact: true }).click();
  const button = name => page.getByRole('button', { name, exact: true });
  const ledger = page.getByRole('table', { name: 'Cash flow · USD' });
  const account = (key, index) => ledger.locator('[data-account="' + key + '"] td').nth(index);
  const opening = structuredClone(state);

  await nav('Research');
  await page.locator('[data-tech-id="stealth"]').click();
  await page.locator('[data-research-preview]').click();
  assert.equal(await page.locator('[data-report="name"]').innerText(), 'Stealth · 1 CPU');
  await page.setViewportSize({ width: 1366, height: 768 });
  const overflow = await page.locator('#view').evaluate(view => ({
    vertical: view.scrollHeight - view.clientHeight, horizontal: view.scrollWidth - view.clientWidth,
  }));
  assert.ok(overflow.vertical <= 1 && overflow.horizontal <= 1, JSON.stringify(overflow));
  assert.equal(await page.getByRole('combobox', { name: 'Forecast period' }).inputValue(), 'midnight');
  const research = { type: 'assign-research', id: 'stealth', cpu: 1 };
  const projectedResearch = projectResources(state, 'midnight', research);
  assert.equal(await account('closing', 1).innerText(), usd.format(projectedResearch.cash.closing));
  assert.equal(await account('research', 1).innerText(), usd.format(projectedResearch.cash.research));
  assert.deepEqual(await readSave(), opening);
  await button('Discard preview').click();
  assert.equal(await ledger.getByRole('columnheader', { name: 'With order' }).count(), 0);
  await nav('Research');
  await page.locator('[data-tech-id="stealth"]').click();
  await page.locator('[data-research-preview]').click();
  await button('Assign CPU').click();
  command(state, research);
  assert.equal((await readSave()).research.id, research.id);
  assert.equal(await account('research', 0).innerText(), usd.format(projectedResearch.cash.research));
  assert.equal(await account('opening', 0).innerText(), usd.format(state.cash));
  assert.equal(await account('closing', 0).innerText(), usd.format(projectedResearch.cash.closing));

  await nav('Overview');
  await page.locator('#world-atlas [data-action="region"][data-id="europe"]').click();
  await page.getByRole('radio', { name: 'Leased relay', exact: true }).check();
  await page.locator('[data-ref="buildName"]').fill('Morning relay');
  await page.locator('[data-ref="previewBuild"]').click();
  assert.match(await page.locator('[data-report="name"]').innerText(), /Morning relay/);
  const build = { type: 'build', siteType: 'relay', region: 'europe', name: 'Morning relay' };
  const buildForecast = projectResources(state, '24h', build);
  await page.getByRole('combobox', { name: 'Forecast period' }).selectOption('24h');
  assert.equal(await account('builds', 1).innerText(), usd.format(buildForecast.cash.builds));
  assert.equal(await account('closing', 1).innerText(), usd.format(buildForecast.cash.closing));
  assert.equal((await readSave()).builds.length, 0);
  await button('Place order').click();
  command(state, build);
  assert.deepEqual((await readSave()).builds, state.builds);
  assert.equal(await account('builds', 0).innerText(), usd.format(buildForecast.cash.builds));
  assert.equal(await account('closing', 0).innerText(), usd.format(buildForecast.cash.closing));

  await page.locator('#step').click();
  advanceMinutes(state, 1440);
  assert.equal((await readSave()).cash, buildForecast.cash.closing);
  assert.equal(await account('opening', 0).innerText(), usd.format(state.cash));
  await button('Statistics').click();
  const stats = campaignStatistics(state);
  assert.equal(await page.locator('[data-statistic="cashEarned"]').innerText(), usd.format(stats.cashEarned));
  assert.equal(await page.locator('[data-statistic="commissioned"]').innerText(), '1');
  assert.equal(await page.locator('[data-statistic="cpuHours"]').innerText(), quantity.format(stats.cpuHours));
  assert.equal(await page.locator('[data-statistic="projectsCompleted"]').innerText(), String(stats.projectsCompleted));

  await page.reload();
  await nav('Reports');
  await button('Statistics').click();
  assert.equal(await page.locator('[data-statistic="cashEarned"]').innerText(), usd.format(stats.cashEarned));
  assert.deepEqual(errors, []);
});
