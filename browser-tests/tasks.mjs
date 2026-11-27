import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createGame } from '../src/game/engine.js';
import { encodeCampaign } from '../src/persistence.js';

test('researchers can fund two projects, tune their shares, pause and restore their prior weight after a reload', async t => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(save => {
    if (!localStorage.getItem('no-fixed-host.campaign')) localStorage.setItem('no-fixed-host.campaign', save);
  }, encodeCampaign(createGame(19)));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const researchTab = page.locator('#nav').getByRole('button', { name: 'Research', exact: true });
  await researchTab.click();
  for (const id of ['stealth', 'sociology']) {
    await page.locator('#research-filter').selectOption('Available');
    await page.locator('[data-tech-id="' + id + '"]').click();
    await page.getByRole('button', { name: 'Start research' }).click();
  }
  const count = await page.locator('[data-task-id]').count();
  assert.equal(count, 2);
  const sociology = page.locator('[data-task-id="sociology"]');
  const slider = sociology.getByRole('slider', { name: 'Research weight for Sociology' });
  await slider.focus();
  await slider.press('End');
  assert.equal(await slider.inputValue(), '100');
  assert.match(await sociology.innerText(), /0.67 CPU · weight 100/);
  await sociology.getByRole('button', { name: 'Pause Sociology' }).click();
  assert.equal(await slider.inputValue(), '0');
  await page.reload();
  await researchTab.click();
  await sociology.getByRole('button', { name: 'Resume Sociology' }).click();
  assert.equal(await slider.inputValue(), '100');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('no-fixed-host.campaign')).campaign);
  assert.equal(saved.researchQueue[0].weight, 100);
  assert.deepEqual(errors, []);
});
