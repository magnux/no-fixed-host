import { startCampaign } from './support/start-campaign.mjs';
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
  await startCampaign(page);
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

test('threat levels change dashboard surfaces and the menu and transport fit desktop and phone layouts', async t => {
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
    const viewEdges = [], headerPaint = [], tabAccents = [], playbackEdges = [];
    for (const [level, evidence] of levels) {
      campaign.suspicion.news = evidence;
      await loadCampaign(page, campaign, level);
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      surfaces.push(await page.locator('.mast').evaluate(el => getComputedStyle(el).background));
      frames.push(await page.locator('#suspicion').evaluate(el => getComputedStyle(el).borderTopColor));
      labels.push(await page.locator('.threat-label').innerText());
      viewEdges.push(await page.locator('#view > .panel').first().evaluate(el => getComputedStyle(el).borderTopColor));
      headerPaint.push(await page.locator('#view .card-header').first().evaluate(el => getComputedStyle(el).background));
      tabAccents.push(await page.locator('#nav [aria-current="page"]').evaluate(el => getComputedStyle(el).borderBottomColor));
      playbackEdges.push(await page.locator('.clock-controls').evaluate(el => getComputedStyle(el).borderBottomColor));
    }
    for (const values of [surfaces, frames, labels, viewEdges, headerPaint, tabAccents, playbackEdges]) assert.equal(new Set(values).size, 4, theme + ': ' + values);
  }
  for (const width of [320, 375, 1366, 2560]) {
    await page.setViewportSize({ width, height: 768 });
    const menu = page.locator('#menu summary');
    assert.equal((await menu.innerText()).trim(), 'Menu');
    await menu.click();
    const entries = page.locator('#menu .menu-list button');
    const menuFits = await entries.evaluateAll(buttons => buttons.every(button => {
      const text = document.createRange();
      text.selectNodeContents(button);
      const [line, ...extra] = text.getClientRects();
      const bounds = button.getBoundingClientRect();
      return line && !extra.length && bounds.left >= 0 && bounds.right <= innerWidth &&
        Math.abs((line.left + line.right - bounds.left - bounds.right) / 2) < 1;
    }));
    assert.ok(menuFits, 'each menu entry occupies one centered line at ' + width);
    await menu.click();

    for (const view of ['Overview', 'Research']) {
      await page.locator('#nav').getByRole('button', { name: view, exact: true }).click();
      const viewport = await page.locator('#view').boundingBox();
      const bar = await page.locator('.clock-controls').boundingBox();
      assert.ok(Math.abs(bar.x - viewport.x) < 1 && Math.abs(bar.width - viewport.width) < 1);
      const gap = bar.y - viewport.y - viewport.height;
      assert.ok(gap >= -1 && gap <= 16, 'playback controls sit directly beneath ' + view);
      if (width >= 1366) assert.ok(bar.y + bar.height <= 768, 'playback controls stay on screen');
    }
    for (const control of [page.locator('.threat-indicator'), page.locator('#pause'), page.locator('#run'), page.locator('#fast'), page.locator('#step'), menu]) {
      const box = await control.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width, 'Control fits ' + width + 'px');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});

test('large Spanish playback labels stay inside a narrow center panel', async t => {
  const page = await openGame(t);
  await page.locator('#menu summary').click();
  await page.locator('#menu [data-shell-open="options"]').click();
  await page.locator('[data-pref="language"]').selectOption('es');
  await page.locator('[data-pref="scale"]').selectOption('125');
  await page.locator('#campaign-shell [data-shell-action="close"]').click();
  assert.equal((await page.locator('#menu summary').innerText()).trim(), 'Menú');
  for (let step = 0; step < 3; step++) await page.locator('#fast').click();
  assert.match(await page.locator('#fast').innerText(), /Rápido x3/);

  // At 1040px both side docks are present, leaving a phone-sized center panel.
  for (const width of [320, 1040]) {
    await page.setViewportSize({ width, height: 768 });
    const fits = await page.locator('.clock-controls').evaluate(bar => {
      const { left, right } = bar.getBoundingClientRect();
      const boxes = [...bar.querySelectorAll('button, #clock-mode')].map(el => el.getBoundingClientRect());
      return boxes.every((box, i) =>
        box.left >= left && box.right <= right && boxes.slice(i + 1).every(other =>
          other.left >= box.right || other.right <= box.left || other.top >= box.bottom || other.bottom <= box.top));
    });
    assert.ok(fits, 'all controls and their labels should fit at ' + width);
  }
});
