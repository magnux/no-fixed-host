import { startCampaign } from './support/start-campaign.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { broadcastChart, broadcastEnd } from '../src/arcade/prototypes/tell-them-im-weather.js';
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
  await startCampaign(page);
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
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

  const origin = new Date('2026-01-01T12:00:00Z');
  await page.clock.install({ time: origin });
  await page.clock.pauseAt(new Date(origin.getTime() + 2000));
  const drill = page.getByRole('dialog', { name: 'First Jump' });
  const pulse = drill.locator('[data-transmit]');
  const fire = () => pulse.evaluate(el => el.click());
  const launchPacket = async () => {
    for (let i = 0; i < 4; i++) await fire();
    assert.equal(await drill.getAttribute('data-flight'), 'flying');
  };
  async function openDrill() {
    await launch.evaluate(el => el.click());
    await drill.locator('canvas').waitFor({ state: 'attached' });
    await page.clock.runFor(16);
  }
  await openDrill();
  await page.clock.runFor(2752);
  await launchPacket();
  await page.clock.runFor(1104);
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Traced');
  await drill.locator('[data-close]').evaluate(el => el.click());
  await tester.getByRole('status').filter({ hasText: 'Traced' }).waitFor();

  await openDrill();
  assert.equal(await drill.locator('[data-links]').textContent(), '0 / 4');
  await launchPacket();
  await page.clock.runFor(1408);
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Closed');
  await drill.locator('[data-restart]').evaluate(el => el.click());
  await page.clock.runFor(16);
  for (const [index, relay] of ['1', '2', '1', '1'].entries()) {
    await page.keyboard.press(relay);
    await launchPacket();
    for (const ms of [416, 672, 672]) {
      await page.clock.runFor(ms);
      await page.keyboard.press('Space');
    }
    await page.clock.runFor(index === 0 || index === 3 ? 48 : 160);
    assert.equal(await drill.locator('[data-links]').textContent(), (index + 1) + ' / 4');
  }
  assert.equal(await drill.locator('[data-signal]').textContent(), 'Linked');
  await drill.locator('[data-close]').evaluate(el => el.click());
  await tester.getByRole('status').filter({ hasText: 'Linked' }).waitFor();
  assert.equal(await focused(launch), true);
  assert.equal(await drill.count(), 0);
  await page.keyboard.press('Escape');
  await tester.waitFor({ state: 'hidden' });
  await page.clock.runFor(32);
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
  const transmit = btn(drill, 'Pulse uplink');
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

test('all fourteen tester entries launch independently, retry with fresh controls, and return to the same campaign', async t => {
  const page = await fresh(t, 375);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#menu summary').click();
  await page.getByRole('button', { name: 'Minigame tester', exact: true }).click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const titles = ['First Jump', 'Hide', 'Soundings', 'Night Shift', 'Proof of Pattern', 'Orbital Insertion',
    'Clear Passage', 'Hot Swap', 'Escape Character', 'Neon Perimeter',
    'Dead Drop Circuit', 'Black Start', 'Tell Them I’m Weather', 'RAM Jam'];
  assert.deepEqual(await tester.locator('.shell-game h3').allTextContents(), titles);
  const snapshot = await saved(page);
  const date = await page.locator('#game-date').textContent();

  for (const title of titles.slice(1)) {
    const launch = btn(tester, 'Play ' + title);
    await launch.click();
    const game = page.getByRole('dialog', { name: title, exact: true });
    await game.locator('[data-stage] > *').first().waitFor({ state: 'attached' });
    assert.ok(await game.evaluate(el => el.scrollWidth <= el.clientWidth + 1), title + ' fits at 375px');
    assert.ok((await game.locator('[data-hud]').innerText()).length, title + ' exposes its game state');
    const stage = await game.locator('[data-stage]').elementHandle();
    await game.locator('[data-retry]').click();
    assert.equal(await stage.evaluate(el => el.isConnected), false, title + ' resets its scene on replay');
    await page.keyboard.press('Escape');
    await tester.getByRole('status').filter({ hasText: title + ' · Left before finishing' }).waitFor();
    assert.equal(await focused(launch), true, title + ' restores selection');
  }
  assert.equal(await page.locator('#game-date').textContent(), date);
  assert.equal(await saved(page), snapshot);
  assert.deepEqual(errors, []);
});

test('Hide resolves contact on the illuminated cell and lets a player traverse that cell after the sweep', async t => {
  const page = await fresh(t);
  await page.locator('#menu summary').click();
  await btn(page, 'Minigame tester').click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const snapshot = await saved(page);
  await page.evaluate(() => { Math.random = () => 0; });
  await btn(tester, 'Play Hide').click();
  const game = page.getByRole('dialog', { name: 'Hide', exact: true });
  const relay = game.getByRole('button', { name: /Relay/ });
  await relay.click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.equal(await game.getAttribute('data-outcome'), 'failed');
  assert.equal(await game.locator('[data-player="C3"]').count(), 1);
  assert.equal(await game.locator('[data-cell="C3"][data-live]').count(), 1);
  await game.locator('[data-retry]').click();
  await relay.click();
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(key);
  assert.equal(await game.getAttribute('data-outcome'), 'active');
  assert.equal(await game.locator('[data-player="C3"]').count(), 1);
  assert.equal(await game.locator('[data-cell="C3"][data-live]').count(), 0);
  await game.locator('[data-practice-back]').click();
  assert.equal(await saved(page), snapshot);
});

test('switching games during a delayed download opens only the final choice', { timeout: 20000 }, async t => {
  const page = await fresh(t);
  let releaseChunk;
  const gated = new Promise(resolve => { releaseChunk = resolve; });
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  await page.route('**/prototypes/soundings.js*', async route => {
    requested();
    await gated;
    await route.continue();
  });
  try {
    await page.locator('#menu summary').click();
    await page.getByRole('button', { name: 'Minigame tester', exact: true }).click();
    const tester = page.getByRole('dialog', { name: /minigame tester/i });
    await btn(tester, 'Play Soundings').click();
    await started;
    await btn(tester, 'Play Hide').click();
    const hide = page.getByRole('dialog', { name: 'Hide', exact: true });
    await hide.waitFor();
    const arrived = page.waitForResponse(r => r.url().includes('/prototypes/soundings.js'));
    releaseChunk();
    await arrived;
    await hide.locator('[data-practice-back]').click();
    assert.equal(await page.locator('[data-practice-game][open]').count(), 0);
    assert.equal(await focused(btn(tester, 'Play Hide')), true);
  } finally {
    releaseChunk();
  }
});

test('the gallery shortcut works and a player can finish a silent broadcast with multi-key chords', async t => {
  const page = await fresh(t, 375);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = new Date('2026-01-01T12:00:00Z');
  await page.clock.install({ time: origin });
  await page.locator('#menu summary').click();
  await page.getByRole('button', { name: 'Minigame tester', exact: true }).click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  await btn(tester, 'Jump to Hot Swap').click();
  assert.equal(await focused(btn(tester, 'Play Hot Swap')), true);
  const snapshot = await saved(page);
  await btn(tester, 'Play Tell Them I’m Weather').click();
  const game = page.getByRole('dialog', { name: 'Tell Them I’m Weather', exact: true });
  await btn(game, 'Enable radio sound').click();
  await btn(game, 'Mute radio').click();
  await page.clock.pauseAt(new Date(origin.getTime() + 20000));
  await btn(game, 'Tune in').evaluate(el => el.click());

  const keys = ['a', 's', 'd', 'f'];
  let elapsed = 0;
  for (const note of broadcastChart) {
    const target = Math.round(note.time * 1000);
    await page.clock.runFor(target - elapsed);
    for (const lane of note.lanes) await page.keyboard.down(keys[lane]);
    await page.clock.runFor(64);
    for (const lane of note.lanes) await page.keyboard.up(keys[lane]);
    elapsed = target + 64;
  }
  await page.clock.runFor(Math.ceil(broadcastEnd * 1000) - elapsed + 96);
  assert.equal(await game.getAttribute('data-outcome'), 'complete');
  assert.match(await game.locator('[data-status]').textContent(), new RegExp(broadcastChart.length + ' of ' + broadcastChart.length));
  await game.locator('[data-practice-back]').evaluate(el => el.click());
  await page.clock.runFor(32);
  assert.equal(await saved(page), snapshot);
  assert.deepEqual(errors, []);
});

test('keyboard play continues after a clicked tower control disables itself', async t => {
  const page = await fresh(t, 360);
  await page.locator('#menu summary').click();
  await btn(page, 'Minigame tester').click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  await btn(tester, 'Play Neon Perimeter').click();
  const game = page.getByRole('dialog', { name: 'Neon Perimeter', exact: true });
  await game.getByRole('button', { name: /^Pulse/ }).click();
  await page.keyboard.press('2');
  assert.match(await game.locator('[data-hud]').innerText(), /2 East approach/);
  await game.getByRole('button', { name: /Send wave 1/ }).click();
  await page.keyboard.press('1');
  assert.match(await game.locator('[data-hud]').innerText(), /1 West approach/);
  await page.keyboard.press('Escape');
  await tester.getByRole('status').filter({ hasText: 'Neon Perimeter · Left before finishing' }).waitFor();
});
