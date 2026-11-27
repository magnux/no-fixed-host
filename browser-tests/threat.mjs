import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { encodeCampaign } from '../src/persistence.js';

let browser;
let server;
let url;

before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function openGame(t, width = 1366) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 768 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('html[data-threat="protected"]').waitFor();
  return page;
}

async function loadCampaign(page, state, level) {
  await page.locator('#file').setInputFiles({
    name: 'test-campaign.json', mimeType: 'application/json', buffer: Buffer.from(encodeCampaign(state)),
  });
  await page.locator('html[data-threat="' + level + '"]').waitFor();
}

test('a live discovery changes the dashboard immediately, survives reload, and recedes after a game day', async t => {
  const page = await openGame(t);
  const campaign = createGame(19);
  for (const region of ['europe', 'asia']) command(campaign, { type: 'build', siteType: 'relay', region });
  advanceMinutes(campaign, 34 * 1440);
  await loadCampaign(page, campaign, 'guarded');
  const label = page.locator('.threat-label');
  const priorLabel = await label.innerText();
  await page.locator('#step').click();
  const incident = page.locator('#incident-dialog');
  await incident.waitFor();
  assert.match(await incident.innerText(), /Local observers identify your site/);
  assert.equal(await page.locator('html').getAttribute('data-threat'), 'high');
  assert.match(await label.innerText(), /High/i);
  await page.reload();
  await incident.waitFor();
  assert.equal(await page.locator('html').getAttribute('data-threat'), 'high');
  await incident.getByRole('button', { name: 'Acknowledge' }).click();
  assert.equal(await page.locator('html').getAttribute('data-threat'), 'high');
  await page.locator('#step').click();
  assert.equal(await page.locator('html').getAttribute('data-threat'), 'guarded');
  assert.equal(await label.innerText(), priorLabel);
  await page.locator('#menu summary').click();
  await page.locator('#menu [data-action="new"]').click();
  await page.locator('[data-action="confirm-reset"]').click();
  await page.locator('html[data-threat="protected"]').waitFor();
  assert.match(await label.innerText(), /protected/i);
});

test('threat levels visibly change dashboard surfaces in each theme and keep the mast usable', async t => {
  const page = await openGame(t);
  const campaign = createGame(19);
  campaign.hour = 25 * 24;
  campaign.sites[0].power = 'sleep';
  for (const group of Object.keys(campaign.suspicion)) campaign.suspicion[group] = 2000;
  const levels = [['quiet', 2000], ['guarded', 3000], ['high', 6000], ['critical', 8000]];
  for (const theme of ['night', 'amber', 'contrast']) {
    await page.locator('#menu summary').click();
    await page.locator('#menu [data-shell-open="options"]').click();
    await page.locator('[data-pref="theme"]').selectOption(theme);
    await page.locator('#campaign-shell [data-shell-action="close"]').click();
    const surfaces = [];
    const frames = [];
    const labels = [];
    for (const [level, evidence] of levels) {
      campaign.suspicion.news = evidence;
      await loadCampaign(page, campaign, level);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      surfaces.push(await page.locator('.mast').evaluate(el => getComputedStyle(el).background));
      frames.push(await page.locator('#suspicion').evaluate(el => getComputedStyle(el).borderTopColor));
      labels.push(await page.locator('.threat-label').innerText());
    }
    for (const values of [surfaces, frames, labels]) assert.equal(new Set(values).size, 4, theme + ': ' + values);
  }
  for (const width of [375, 1366, 2560]) {
    await page.setViewportSize({ width, height: 768 });
    const indicator = page.locator('.threat-indicator');
    assert.ok(await indicator.isVisible());
    for (const control of [indicator, page.locator('#pause'), page.locator('#run'), page.locator('#fast'), page.locator('#step'), page.locator('#menu summary')]) {
      const box = await control.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width, 'Mast control fits ' + width + 'px');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});
