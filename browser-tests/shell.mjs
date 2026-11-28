import { startCampaign } from './support/start-campaign.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser;
let server;
let url;

before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function fresh(t) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await startCampaign(page);
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
  return page;
}

test('named saves and quickload work through the campaign menu and keyboard', async t => {
  const page = await fresh(t);
  const shell = page.locator('#campaign-shell');
  await page.locator('#menu summary').click();
  await page.locator('#menu [data-shell-open="title"]').click();
  assert.equal(await shell.getByRole('button', { name: 'Resume campaign' }).isVisible(), true);
  await shell.getByRole('button', { name: 'Save library' }).click();
  const name = shell.getByLabel('Name this checkpoint');
  const save = shell.getByRole('button', { name: 'Save checkpoint', exact: true });
  await name.fill('Alpha <relay>');
  await save.click();
  const row = shell.locator('.shell-slots li').filter({ hasText: 'Alpha <relay>' });
  await row.waitFor();
  assert.match(await row.innerText(), /Day 1 · 00:00.+Format \d/s);
  await save.click();
  await shell.getByRole('button', { name: 'Cancel' }).click();
  await save.click();
  await shell.getByRole('button', { name: 'Overwrite' }).click();
  await shell.locator('.shell-confirm').waitFor({ state: 'hidden' });
  await shell.getByLabel('Search saves').fill('missing');
  assert.equal(await row.count(), 0);
  await shell.getByLabel('Search saves').fill('ALPHA');
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await row.isVisible(), true);
  await shell.locator('.shell-head button').click();
  await page.locator('#jobs').focus();
  await page.keyboard.press('2');
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
  await page.locator('#pause').focus();
  await page.keyboard.press('q');
  await page.locator('#notice').filter({ hasText: /^Saved\.$/ }).waitFor();
  const initialTime = await page.locator('#game-date span').innerText();
  await page.keyboard.press('2');
  await page.waitForFunction(initial => document.querySelector('#game-date span').textContent !== initial, initialTime);
  await page.keyboard.press('0');
  await page.keyboard.press('Shift+Q');
  await shell.locator('.shell-confirm').waitFor();
  assert.match(await shell.locator('.shell-confirm').innerText(), /Quicksave.+autosave/s);
  await shell.locator('.shell-confirm').getByRole('button', { name: 'Load' }).click();
  await shell.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#game-date span').innerText(), initialTime);
  await page.keyboard.press('l');
  await row.getByRole('button', { name: 'Delete' }).click();
  await shell.locator('.shell-confirm').getByRole('button', { name: 'Delete' }).click();
  await row.waitFor({ state: 'detached' });
  assert.equal(await shell.locator('.shell-slots strong').innerText(), 'Quicksave');
});

test('options translate the shell, change map lighting and persist independently of the campaign', async t => {
  const page = await fresh(t);
  const shell = page.locator('#campaign-shell');
  const warningCount = async () => {
    const link = page.locator('#recent-activity button').filter({ hasText: /^\d+ warnings?$/ });
    return await link.count() ? Number.parseInt(await link.innerText()) : 0;
  };
  const initialWarnings = await warningCount();
  assert.ok(initialWarnings >= 1);
  await page.keyboard.press('o');
  await shell.getByLabel('Day and night on map').uncheck();
  await shell.getByLabel('Theme').selectOption('amber');
  await shell.getByLabel('Interface size').selectOption('110');
  assert.equal(await shell.getByRole('button', { name: 'Preview sound' }).isDisabled(), true);
  await shell.getByLabel('Enable audio').check();
  await shell.getByRole('button', { name: 'Preview sound' }).click();
  await shell.getByLabel('Only one viable host').uncheck();
  assert.equal(await warningCount(), initialWarnings - 1);
  await shell.getByLabel('Menu language').selectOption('es');
  assert.equal(await shell.getByRole('heading', { name: 'Opciones' }).isVisible(), true);
  await shell.getByRole('button', { name: 'Cerrar' }).click();
  await page.reload();
  const lighting = page.locator('.atlas-geography > canvas');
  await lighting.waitFor({ state: 'attached' });
  assert.equal(await lighting.evaluate(el => getComputedStyle(el).visibility), 'hidden');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'amber');
  await page.keyboard.press('h');
  assert.equal(await shell.getByRole('heading', { name: 'Acerca de' }).isVisible(), true);
  await shell.getByRole('button', { name: 'Cerrar' }).click();
  await page.keyboard.press('o');
  assert.equal(await shell.getByLabel('Solo queda un servidor viable').isChecked(), false);
  await shell.getByLabel('Idioma de los menús').selectOption('en');
  assert.equal(await shell.getByRole('heading', { name: 'Options' }).isVisible(), true);
});
