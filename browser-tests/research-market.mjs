import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

test('buy a finding and reserve and release compute through the dossier, then review Finance after reload', async t => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(([key, save]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, save);
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(createGame(47))]);
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const save = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  const market = page.locator('details[data-field="market"]');
  await page.locator('#nav [data-id="research"]').click();
  await page.locator('[data-tech-id="intrusion"]').click();
  await market.locator('summary').click();
  await market.locator('[data-field="license"]').click();
  assert.ok((await save()).completed.includes('intrusion'));
  assert.equal((await save()).cash, 940);

  await page.locator('[data-tech-id="personalIdentification"]').click();
  const allocation = page.locator('#research-cpu-value');
  await allocation.fill('1');
  await allocation.press('Tab');
  if (!await market.evaluate(el => el.open)) await market.locator('summary').click();
  await market.locator('[data-field="rental"]').click();
  assert.equal((await save()).cash, 932);
  await page.reload();
  await page.locator('#nav [data-id="research"]').click();
  await page.locator('[data-tech-id="personalIdentification"]').click();
  if (!await market.evaluate(el => el.open)) await market.locator('summary').click();
  await market.locator('[data-field="cancelRental"]').click();
  assert.equal((await save()).cash, 940);
  await page.locator('#nav [data-id="reports"]').click();
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  assert.deepEqual(await page.locator('[data-commercial-account="license"] td').allTextContents(), ['$60.00', '$0.00']);
  assert.deepEqual(await page.locator('[data-commercial-account="rental"] td').allTextContents(), ['$8.00', '$8.00']);
  assert.deepEqual(errors, []);
});
