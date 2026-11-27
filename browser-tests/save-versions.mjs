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
  const fresh = await expectRestart(page);
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
