import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser;
let server;
let url;

before(async () => {
  server = await createServer({
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function openFreshCampaign(t, viewport) {
  const context = await browser.newContext({ viewport });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('#world-atlas [data-action="region"]').first().waitFor();
  return page;
}

test('map targets and both docks fit the desktop and ultrawide viewports', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  const regions = page.locator('#world-atlas [data-action="region"]');
  const buttons = await regions.evaluateAll((nodes) => nodes.map((button) => ({
    id: button.dataset.id,
    keyboardAccessible: button.tagName === 'BUTTON' && !button.disabled && button.tabIndex >= 0,
  })));
  assert.equal(buttons.length, 12);
  assert.equal(new Set(buttons.map(({ id }) => id)).size, 12);
  assert.ok(buttons.every(({ keyboardAccessible }) => keyboardAccessible));

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1363, height: 936 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const commandDock = document.querySelector('.command-dock');
      const left = commandDock.getBoundingClientRect();
      const center = rect('.primary');
      const right = rect('.network-dock');
      return {
        horizontalDocks: left.width > 0 && right.width > 0 && left.right <= center.left + 1 && center.right <= right.left + 1,
        commandOverflow: commandDock.scrollHeight - commandDock.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    const size = `${viewport.width}×${viewport.height}`;
    assert.ok(geometry.horizontalDocks, size);
    assert.ok(geometry.pageWidth <= viewport.width + 1, `Horizontal page overflow at ${size}`);
    assert.ok(geometry.pageHeight <= viewport.height + 1, `Vertical page overflow at ${size}`);
    assert.ok(geometry.commandOverflow <= 1, `Command dock overflows by ${geometry.commandOverflow}px at ${size}`);
  }

  for (const { id } of buttons) {
    await page.locator(`#world-atlas [data-action="region"][data-id="${id}"]`).click();
    assert.equal(await page.locator('#region').inputValue(), id);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
  }
});

test('a focused native region picker survives running construction', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  const europe = page.locator('#world-atlas [data-action="region"][data-id="europe"]');
  await europe.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('combobox', { name: 'Region', exact: true });
  assert.equal(await picker.inputValue(), 'europe');

  await page.locator('#facility-type').selectOption('relay');
  await page.getByRole('button', { name: /^build leased relay$/i }).click();
  await page.locator('#run').click();
  await picker.click();

  // A new select can look identical and even regain focus, but its native menu closes.
  const original = await picker.elementHandle();
  const clock = page.locator('#game-date');
  for (let tick = 0; tick < 2; tick++) {
    const previous = await clock.textContent();
    await page.waitForFunction(
      (value) => document.querySelector('#game-date').textContent !== value,
      previous,
      { timeout: 5000 },
    );
  }
  assert.ok(await original.evaluate((select) =>
    select.isConnected && document.activeElement === select && document.getElementById('region') === select,
  ), 'Construction replaced or blurred the open picker');

  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  assert.equal(await picker.inputValue(), 'coast');
  assert.equal(await page.locator('#run').innerText(), 'Pause');
});

test('a player can equip a newly built site from the inventory dock', async (t) => {
  const page = await openFreshCampaign(t, { width: 1920, height: 1080 });
  await page.locator('#world-atlas [data-id="europe"]').click();
  await page.locator('#facility-type').selectOption('storageUnit');
  await page.getByRole('button', { name: /^build storage unit$/i }).click();
  await page.locator('#step').click();

  const storage = page.locator('.network-dock [data-action="host"]').filter({ hasText: 'Storage unit' });
  await storage.click();
  assert.equal(await page.locator('#region').inputValue(), 'europe');
  assert.equal(await page.locator('#facility-host').inputValue(), await storage.getAttribute('data-id'));
  await page.getByLabel('Equipment slot').selectOption('cpu');
  await page.locator('#equipment-item').selectOption('gamingPc');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Install Gaming PC' }).click();
  await page.locator('#step').click();
  await page.locator('#step').click();
  assert.match(await page.locator('.installed-list').innerText(), /Gaming PC × 2/);
  assert.match(await page.locator('.facility-summary').innerText(), /10 CPU/);

  await page.reload();
  await storage.click();
  assert.match(await page.locator('.installed-list').innerText(), /Gaming PC × 2/);
});
