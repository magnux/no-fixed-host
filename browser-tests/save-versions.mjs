import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { CAMPAIGN_VERSION, createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign, GAME_VERSION } from '../src/persistence.js';
import { QUICK_SLOT, slotKey } from '../src/shell-storage.js';

let browser;
let server;
let url;
before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

function currentSave() {
  const campaign = createGame(91);
  campaign.hour = 42;
  campaign.cash = 75_000;
  return JSON.parse(encodeCampaign(campaign));
}

function olderSave() {
  const save = currentSave();
  delete save.gameVersion;
  save.format--;
  save.campaign.version = save.format;
  return save;
}

async function openCampaign(t, autosave = currentSave()) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.addInitScript(({ key, save }) => {
    if (sessionStorage.getItem('test-initialized')) return;
    sessionStorage.setItem('test-initialized', 'yes');
    localStorage.setItem(key, JSON.stringify(save));
  }, { key: CAMPAIGN_STORAGE_KEY, save: autosave });
  await page.goto(url);
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
  return page;
}

const readAutosave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), CAMPAIGN_STORAGE_KEY);

async function expectRestart(page) {
  const notice = page.getByRole('dialog', { name: 'New campaign started' });
  await notice.waitFor();
  assert.match(await notice.innerText(), /different version/i);
  assert.ok((await notice.innerText()).includes(GAME_VERSION));
  const saved = await readAutosave(page);
  assert.equal(saved.format, CAMPAIGN_VERSION);
  assert.equal(saved.gameVersion, GAME_VERSION);
  assert.equal(saved.campaign.hour, 0);
  assert.equal(saved.campaign.minute, 0);
  assert.equal(saved.campaign.cash, 1000);
  assert.equal(saved.campaign.sites.length, 1);
  assert.deepEqual(saved.campaign.completed, []);
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  await notice.getByRole('button', { name: 'Continue' }).click();
  return saved;
}

test('startup replaces an old autosave once and reloads the resulting current campaign', async t => {
  const page = await openCampaign(t, olderSave());
  const title = page.getByRole('dialog', { name: 'Title screen' });
  await title.waitFor();
  assert.match(await title.innerText(), /different version/i);
  assert.ok((await title.innerText()).includes(GAME_VERSION));
  const fresh = await readAutosave(page);
  assert.equal(fresh.gameVersion, GAME_VERSION);
  assert.equal(fresh.campaign.hour, 0);
  assert.equal(fresh.campaign.cash, 1000);
  await page.reload();
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
  assert.equal(await page.locator('#version-dialog').isVisible(), false);
  assert.deepEqual(await readAutosave(page), fresh);
});

for (const quick of [false, true]) {
  test((quick ? 'Quickload' : 'Named checkpoint load') + ' replaces the active campaign and discards only the incompatible slot', async t => {
    const page = await openCampaign(t);
    const name = quick ? 'Quicksave' : 'Previous release';
    const key = quick ? QUICK_SLOT : slotKey(name);
    const otherKey = slotKey('Current checkpoint');
    const previous = olderSave();
    const current = currentSave();
    await page.evaluate(({ key, name, previous, otherKey, current }) => {
      const slot = (name, data) => JSON.stringify({ name, data, revision: 'checkpoint', savedAt: 1 });
      localStorage.setItem(key, slot(name, previous));
      localStorage.setItem(otherKey, slot('Current checkpoint', current));
    }, { key, name, previous, otherKey, current });
    await page.keyboard.press(quick ? 'Shift+Q' : 'l');
    const shell = page.locator('#campaign-shell');
    if (!quick) {
      await shell.locator('.shell-slots li').filter({ hasText: name }).getByRole('button', { name: 'Load' }).click();
    }
    await shell.locator('.shell-confirm').getByRole('button', { name: 'Load' }).click();
    await expectRestart(page);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data, otherKey), current);
  });
}

const importFile = (page, text) => page.locator('#file').setInputFiles({
  name: 'campaign.json', mimeType: 'application/json', buffer: Buffer.from(text),
});

for (const version of ['0.0.1', '999.0.0']) {
  test('JSON import resets release ' + version + ' even when both schema versions match', async t => {
    const page = await openCampaign(t);
    const mismatch = { ...currentSave(), gameVersion: version };
    await importFile(page, JSON.stringify(mismatch));
    await expectRestart(page);
  });
}

test('damaged current saves, malformed JSON and unrelated files preserve the running campaign', async t => {
  const page = await openCampaign(t);
  const before = await readAutosave(page);
  const damaged = { ...before, campaign: { ...before.campaign, cash: -1 } };
  for (const [text, message] of [
    [JSON.stringify(damaged), /damaged/i],
    [JSON.stringify({ game: 'other-game', format: 1 }), /Choose a No Fixed Host save file/i],
    ['{', /Choose a No Fixed Host JSON save file/i],
  ]) {
    await importFile(page, text);
    await page.locator('#notice').filter({ hasText: message }).waitFor();
    assert.equal(await page.locator('#version-dialog').isVisible(), false);
    assert.deepEqual(await readAutosave(page), before);
  }
});

test('an incompatible autosave written in another tab resets the receiving tab', async t => {
  const page = await openCampaign(t);
  const peer = await page.context().newPage();
  await peer.goto(url);
  await peer.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key: CAMPAIGN_STORAGE_KEY, save: olderSave() });
  await expectRestart(page);
});

test('an active 0.5.1 tab and a newly opened release can each save without resetting the other', async t => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const oldTab = await context.newPage();
  // Recreate the old listener on the same origin. It resets on unsupported writes
  // to the original key and publishes its replacement there, as 0.5.1 did.
  await oldTab.route('**/old-client', route => route.fulfill({ contentType: 'text/html', body: '<title>Old client</title>' }));
  await oldTab.goto(url + '/old-client');
  const oldSave = { ...currentSave(), gameVersion: '0.5.1' };
  const oldKey = 'no-fixed-host.campaign';
  const checkpoint = slotKey('Keep this checkpoint');
  await oldTab.evaluate(({ oldKey, oldSave, currentKey, checkpoint }) => {
    const oldData = JSON.stringify(oldSave);
    localStorage.setItem(oldKey, oldData);
    localStorage.setItem(oldKey + '.0.4.0', oldData);
    localStorage.setItem(oldKey + '.9.0.0', 'future release');
    localStorage.setItem(oldKey + '.notes', 'unrelated');
    localStorage.setItem(checkpoint, 'preserved');
    window.legacyResets = 0;
    window.currentWritesSeen = 0;
    window.currentHourSeen = -1;
    window.addEventListener('storage', event => {
      if (event.key === currentKey && event.newValue) {
        window.currentWritesSeen++;
        window.currentHourSeen = JSON.parse(event.newValue).campaign.hour;
      }
      if (event.key !== oldKey || !event.newValue) return;
      if (JSON.parse(event.newValue).gameVersion === oldSave.gameVersion) return;
      window.legacyResets++;
      localStorage.setItem(oldKey, oldData);
    });
  }, { oldKey, oldSave, currentKey: CAMPAIGN_STORAGE_KEY, checkpoint });

  const game = await context.newPage();
  await game.goto(url);
  const title = game.getByRole('dialog', { name: 'Title screen' });
  await title.waitFor();
  assert.match(await title.getByRole('note').innerText(), /different version/);
  await oldTab.waitForFunction(() => window.currentWritesSeen > 0);
  assert.deepEqual(await oldTab.evaluate(({ oldKey, checkpoint }) => [
    localStorage.getItem(oldKey), localStorage.getItem(oldKey + '.0.4.0'),
    localStorage.getItem(oldKey + '.9.0.0'), localStorage.getItem(oldKey + '.notes'), localStorage.getItem(checkpoint),
  ], { oldKey, checkpoint }), [null, null, 'future release', 'unrelated', 'preserved']);
  await title.getByRole('button', { name: 'Start campaign' }).click();
  await game.getByRole('button', { name: 'Skip / close story' }).click();
  await game.locator('#step').click();
  const progress = await readAutosave(game);
  assert.ok(progress.campaign.hour > 0);
  await oldTab.waitForFunction(hour => window.currentHourSeen === hour, progress.campaign.hour);
  assert.equal(await oldTab.evaluate(() => window.legacyResets), 0);

  await game.evaluate(oldKey => {
    window.addEventListener('storage', e => { if (e.key === oldKey) window.observedOldSave = true; });
  }, oldKey);
  await oldTab.evaluate(([key, data]) => localStorage.setItem(key, JSON.stringify(data)), [oldKey, oldSave]);
  await game.waitForFunction(() => window.observedOldSave);
  assert.equal(await game.locator('dialog[open]').count(), 0);
  assert.deepEqual(await readAutosave(game), progress);
});

test('two tabs running the current release follow each other’s campaign moves', async t => {
  const first = await openCampaign(t);
  const second = await first.context().newPage();
  await second.goto(url);
  await second.locator('html:not([data-booting]) #campaign-shell').waitFor({ state: 'attached' });
  const date = page => page.locator('#game-date').innerText();
  const waitForTime = (page, time) => page.waitForFunction(value => document.querySelector('#game-date').innerText === value, time);
  const initial = await date(first);
  await first.locator('#step').click();
  const next = await date(first);
  assert.notEqual(next, initial);
  await waitForTime(second, next);
  await second.locator('#step').click();
  const last = await date(second);
  assert.notEqual(last, next);
  await waitForTime(first, last);
  assert.equal(await first.locator('dialog[open]').count(), 0);
  assert.equal(await second.locator('dialog[open]').count(), 0);
});
