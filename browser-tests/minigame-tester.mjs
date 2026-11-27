import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { CAMPAIGN_STORAGE_KEY } from '../src/persistence.js';

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

async function fresh(t, width = 1366) {
  const context = await browser.newContext({ viewport: { width, height: 768 }, reducedMotion: 'reduce' });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
  const story = page.getByRole('button', { name: 'Skip / close story' });
  if (await story.isVisible()) await story.click();
  return page;
}

const saved = page => page.evaluate(key => localStorage.getItem(key), CAMPAIGN_STORAGE_KEY);
const focused = control => control.evaluate(el => el === document.activeElement);
const btn = (scope, name) => scope.getByRole('button', { name, exact: true });

test('practice pauses the live clock and supports all three First Jump outcomes without changing the campaign', async t => {
  const page = await fresh(t);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const menu = page.locator('#menu');
  await page.locator('#fast').click();
  await page.waitForFunction(() => document.querySelector('#game-date span').textContent !== '00:00');
  await menu.locator('summary').click();
  await menu.getByRole('button', { name: /minigame tester/i }).click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const launch = tester.getByRole('button', { name: /play first jump/i });
  await launch.waitFor();
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  const saveAtEntry = await saved(page);
  const timeAtEntry = await page.locator('#game-date').textContent();
  const { hour, minute } = JSON.parse(saveAtEntry).campaign;
  assert.ok(hour * 60 + minute > 0);

  await launch.click();
  const drill = page.getByRole('dialog', { name: 'First Jump' });
  const transmit = btn(drill, 'Transmit block');
  const hold = btn(drill, 'Hold signal');
  const replay = btn(drill, 'Restart jump');
  await drill.locator('canvas').waitFor();
  await transmit.click();
  await transmit.click();
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Traced');
  await btn(drill, 'Back to tester').click();
  await tester.getByRole('status').filter({ hasText: 'Traced' }).waitFor();
  await launch.click();
  assert.equal(await drill.locator('[data-copied]').textContent(), '0 / 3');
  for (let i = 0; i < 6; i++) await hold.click();
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Closed');
  await replay.click();
  await transmit.click();
  await hold.click();
  await transmit.click();
  await transmit.click();
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Linked');
  await btn(drill, 'Back to tester').click();
  await tester.getByRole('status').filter({ hasText: 'Linked' }).waitFor();
  assert.equal(await focused(launch), true);
  assert.equal(await drill.count(), 0);
  await page.keyboard.press('Escape');
  await tester.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  assert.equal(await focused(menu.locator('summary')), true);
  assert.equal(await page.locator('#game-date').textContent(), timeAtEntry);
  assert.equal(await saved(page), saveAtEntry);
  assert.deepEqual(errors, []);
});

test('the title screen opens the tester on a narrow display and keyboard exit returns through the menu', async t => {
  const page = await fresh(t, 375);
  await page.locator('#pause').focus();
  await page.keyboard.press('m');
  const hub = page.getByRole('dialog', { name: 'Title screen' });
  const entry = hub.getByRole('button', { name: /minigame tester/i });
  await entry.focus();
  await page.keyboard.press('Enter');
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const launch = tester.getByRole('button', { name: /play first jump/i });
  await launch.waitFor();
  assert.ok(await tester.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  const saveAtEntry = await saved(page);
  await launch.focus();
  await page.keyboard.press('Enter');
  const drill = page.getByRole('dialog', { name: 'First Jump' });
  const transmit = btn(drill, 'Transmit block');
  await transmit.waitFor();
  assert.equal(await focused(transmit), true);
  await page.keyboard.press('Enter');
  await page.keyboard.press('4');
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await tester.getByRole('status').filter({ hasText: 'Left before finishing' }).waitFor();
  assert.equal(await focused(launch), true);
  await page.keyboard.press('Escape');
  await hub.waitFor();
  assert.equal(await focused(entry), true);
  await page.keyboard.press('Escape');
  await hub.waitFor({ state: 'hidden' });
  assert.equal(await focused(page.locator('#pause')), true);
  assert.equal(await saved(page), saveAtEntry);
});
