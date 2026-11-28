import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

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

async function openCampaign(t, state) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, { key: CAMPAIGN_STORAGE_KEY, save: encodeCampaign(state) });
  await page.goto(url);
  await page.locator('#ai-avatar[data-form]').waitFor();
  return page;
}

test('completing research evolves the portrait in place from Terminal to Face to Presence', async t => {
  const state = createGame(0);
  command(state, { type: 'assign-research', id: 'intrusion', cpu: .5 });
  command(state, { type: 'assign-research', id: 'telepresence', cpu: .5 });
  command(state, { type: 'assign-research', id: 'telepresence', cpu: 0 });
  // Resume just before each completion. Telepresence stays paused until the player assigns CPU.
  state.research.work = state.research.workRequired - 1;
  const telepresence = state.researchQueue[0];
  telepresence.work = telepresence.workRequired - 1;
  telepresence.cashPaid = telepresence.cashRequired - 2;

  const page = await openCampaign(t, state);
  const portrait = page.locator('#ai-avatar');
  assert.equal(await portrait.getAttribute('data-form'), 'terminal');
  assert.match(await portrait.textContent(), /\^-\^/);
  assert.equal(await portrait.locator('.avatar-link').count(), 0);
  await page.locator('#step').click();
  // A university bulletin also arrives during the step, after Intrusion finishes.
  await page.locator('#ai-avatar[data-form="face"][data-reaction="message"]').waitFor();
  await page.locator('#nav [data-id="research"]').click();
  await page.locator('[data-tech-id="telepresence"]').click();
  await page.locator('#research-cpu').press('End');
  await page.locator('#step').click();
  await page.locator('#ai-avatar[data-form="presence"]').waitFor();
  await page.reload();
  await page.locator('#ai-avatar[data-form="presence"]').waitFor();
  assert.equal(await portrait.getAttribute('data-reaction'), null);

  for (const width of [375, 1366, 2560]) {
    await page.setViewportSize({ width, height: 768 });
    const box = await portrait.boundingBox();
    assert.ok(box && box.width > 0 && box.x >= 0 && box.x + box.width <= width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});

test('two hosts in one region share their light, which dims only when both sleep', async t => {
  const state = createGame(0);
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  command(state, { type: 'build', siteType: 'relay', region: 'europe' });
  advanceMinutes(state, 1);
  const page = await openCampaign(t, state);
  const portrait = page.locator('#ai-avatar');
  const europe = portrait.locator('.avatar-node[data-region="europe"]');
  assert.equal(await portrait.locator('.avatar-node').count(), 2);
  assert.equal(await europe.count(), 1);
  assert.equal(await europe.getAttribute('data-status'), 'online');
  assert.equal(await portrait.locator('.avatar-links > .avatar-link').count(), 1);

  await page.locator('#nav [data-id="facilities"]').click();
  await page.locator('#facility-toggle-host-2').click();
  await page.locator('[data-ref="power"]').click();
  assert.equal(await europe.getAttribute('data-status'), 'online');
  await page.locator('#facility-toggle-host-3').click();
  await page.locator('[data-ref="power"]').click();
  assert.equal(await europe.getAttribute('data-status'), 'sleeping');
  assert.equal(await portrait.getAttribute('data-reaction'), null);
  await page.locator('[data-ref="power"]').click();
  assert.equal(await europe.getAttribute('data-status'), 'online');
  assert.equal(await portrait.getAttribute('data-reaction'), null);
});

test('a discovered region disappears and attracts the gaze once, even when its report is restored', async t => {
  const state = createGame(19);
  state.completed.push('intrusion');
  for (const region of ['europe', 'asia']) command(state, { type: 'build', siteType: 'relay', region });
  advanceMinutes(state, 34 * 1440);
  const page = await openCampaign(t, state);
  const portrait = page.locator('#ai-avatar');
  const asia = portrait.locator('.avatar-node[data-region="asia"]');
  assert.equal(await asia.getAttribute('data-status'), 'online');
  assert.equal(await portrait.getAttribute('data-reaction'), null);
  await page.locator('#step').click();
  await page.locator('#incident-dialog[open]').waitFor();
  assert.equal(await asia.count(), 0);
  assert.equal(await portrait.getAttribute('data-form'), 'face');
  assert.equal(await portrait.getAttribute('data-reaction'), 'loss');
  assert.equal(await portrait.getAttribute('data-reaction-region'), 'asia');
  await page.clock.install();
  await page.clock.fastForward(4000);
  assert.equal(await portrait.getAttribute('data-reaction'), 'loss', 'the glance holds while the report is open');
  const reportSave = await page.evaluate(key => localStorage.getItem(key), CAMPAIGN_STORAGE_KEY);
  await page.locator('#incident-dialog').getByRole('button', { name: 'Acknowledge' }).click();
  await page.clock.fastForward(3000);
  assert.equal(await portrait.getAttribute('data-reaction'), null, 'the paused avatar settles after acknowledgement');
  await page.evaluate(([key, save]) => localStorage.setItem(key, save), [CAMPAIGN_STORAGE_KEY, reportSave]);
  await page.reload();
  await page.locator('#incident-dialog[open]').waitFor();
  assert.equal(await portrait.getAttribute('data-reaction'), null);
  assert.equal(await asia.count(), 0);
  await page.locator('#incident-dialog').getByRole('button', { name: 'Acknowledge' }).click();
  assert.equal(await portrait.getAttribute('data-reaction'), null);
});
