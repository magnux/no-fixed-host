import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign, GAME_VERSION } from '../src/persistence.js';

let browser;
let server;
let url;
before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function visit(t, { width = 1280, save = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 780 } });
  t.after(() => context.close());
  const page = await context.newPage();
  if (save) {
    await page.addInitScript(({ key, initial }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, initial);
    }, { key: CAMPAIGN_STORAGE_KEY, initial: JSON.stringify(save) });
  }
  await page.goto(url);
  await page.locator('html:not([data-booting]) #campaign-shell').waitFor({ state: 'attached' });
  return page;
}
const titleScreen = page => page.getByRole('dialog', { name: 'Title screen' });

test('the first visit opens the illustrated title and a tester trip still leads into the opening chapter', async t => {
  const page = await visit(t, { width: 375 });
  const title = titleScreen(page);
  const start = title.getByRole('button', { name: 'Start campaign' });
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.equal(await start.evaluate(el => el === document.activeElement), true);
  assert.equal(await title.getByRole('button', { name: 'New campaign' }).count(), 0);
  assert.equal(await title.getByRole('button', { name: 'Close' }).count(), 0);
  const banner = title.locator('.shell-title-art img');
  await banner.evaluate(img => img.decode());
  assert.ok(await banner.evaluate(img => img.naturalWidth > img.naturalHeight));
  assert.equal(await title.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  await title.getByRole('button', { name: 'Minigame tester' }).click();
  const tester = page.getByRole('dialog', { name: 'Minigame tester' });
  await tester.getByRole('button', { name: 'Play Hide' }).click();
  await page.getByRole('button', { name: 'Back to tester' }).click();
  await tester.getByRole('button', { name: 'Back', exact: true }).click();
  await start.click();
  assert.equal(await page.getByRole('heading', { name: 'Borrowed time' }).isVisible(), true);
  await page.getByRole('button', { name: 'Skip / close story' }).click();
  await page.locator('#step').click();
  const date = await page.locator('#game-date').innerText();
  await page.reload();
  await page.locator('html:not([data-booting]) #campaign-shell').waitFor({ state: 'attached' });
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.locator('#game-date').innerText(), date);
  await page.keyboard.press('m');
  assert.equal(await title.getByRole('button', { name: 'Resume campaign' }).isVisible(), true);
  assert.equal(await title.getByRole('button', { name: 'New campaign' }).isVisible(), true);
});

test('an update opens the title with its release warning and a fresh paused campaign', async t => {
  const old = JSON.parse(encodeCampaign(createGame(32)));
  old.gameVersion = 'previous-release';
  old.campaign.cash = 85000;
  const page = await visit(t, { save: old });
  const title = titleScreen(page);
  assert.equal(await page.locator('dialog[open]').count(), 1);
  const warning = await title.getByRole('note').innerText();
  assert.match(warning, /different version/);
  assert.ok(warning.includes(GAME_VERSION));
  const fresh = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), CAMPAIGN_STORAGE_KEY);
  assert.equal(fresh.gameVersion, GAME_VERSION);
  assert.equal(fresh.campaign.cash, 1000);
  await title.getByRole('button', { name: 'Start campaign' }).click();
  await page.getByRole('button', { name: 'Skip / close story' }).click();
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
});
