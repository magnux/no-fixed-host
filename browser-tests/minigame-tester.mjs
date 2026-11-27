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

test('all ten tester entries launch independently, retry with fresh controls, and return to the same campaign', async t => {
  const page = await fresh(t, 375);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#menu summary').click();
  await page.getByRole('button', { name: 'Minigame tester', exact: true }).click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const titles = ['First Jump', 'Hide', 'Soundings', 'Night Shift', 'Proof of Pattern', 'Orbital Insertion',
    'Clear Passage', 'Crosscheck', 'Witness', 'Clearing House'];
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

test('an evidence brief, witness interview and currency settlement each produce their own tester result', async t => {
  const page = await fresh(t);
  await page.locator('#menu summary').click();
  await page.getByRole('button', { name: 'Minigame tester', exact: true }).click();
  const tester = page.getByRole('dialog', { name: /minigame tester/i });
  const snapshot = await saved(page);
  for (const title of ['Crosscheck', 'Witness', 'Clearing House']) {
    const launch = btn(tester, 'Play ' + title);
    await launch.click();
    const game = page.getByRole('dialog', { name: title, exact: true });
    if (title === 'Crosscheck') {
      const pins = game.getByRole('checkbox');
      await pins.nth(0).check();
      await pins.nth(1).check();
      await game.getByRole('radio').first().check();
      await btn(game, 'File the brief').click();
    } else if (title === 'Witness') {
      const choices = game.locator('[data-controls] button');
      await choices.first().click();
      await choices.first().click();
      await choices.first().click();
    } else {
      for (let leg = 0; leg < 3; leg++) await game.locator('.ch-stop[data-state="next"]').first().click();
      await btn(game, 'Settle payout').click();
    }
    const outcome = await game.getAttribute('data-outcome');
    const label = { complete: 'Complete', partial: 'Partial success', failed: 'Unsuccessful' }[outcome];
    assert.ok(label, title + ' produced a scored ending');
    assert.ok((await game.locator('[data-status]').innerText()).length > 20);
    await btn(game, 'Back to tester').click();
    const result = tester.locator('.shell-game').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).locator('[data-practice-result]');
    await result.filter({ hasText: label }).waitFor();
    assert.equal(await result.textContent(), label);
  }
  assert.equal(await saved(page), snapshot);
});
