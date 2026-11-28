import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

test('research funding updates after a discovery preserve the dossier frame and reading position', async t => {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1060, height: 720 } });
  const campaign = createGame(19);
  for (const region of ['europe', 'asia']) command(campaign, { type: 'build', siteType: 'relay', region });
  advanceMinutes(campaign, 34 * 1440);
  command(campaign, { type: 'assign-research', id: 'telepresence', cpu: 10 });
  command(campaign, { type: 'allocate', jobs: 25 });
  campaign.cash = 2;
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [CAMPAIGN_STORAGE_KEY, encodeCampaign(campaign)]);
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);

  await page.locator('#nav [data-id=research]').click();
  await page.locator('[data-tech-id=telepresence]').click();
  await page.locator('#step').click();
  await page.locator('#incident-dialog').getByRole('button', { name: 'Acknowledge' }).click();
  await page.locator('#fast').click();
  await page.locator('#view').evaluate(view => { view.scrollTop = 45; });

  function reading() {
    const view = document.querySelector('#view');
    const rect = selector => {
      const { left, top, width, height } = view.querySelector(selector).getBoundingClientRect();
      return [left, top, width, height];
    };
    return {
      waiting: document.querySelector('#research-allocation-note').innerText.includes('Waiting for project funds'),
      progress: view.querySelector('progress').value,
      geometry: [view.scrollTop, rect('.research-dossier'), rect('.research-progress'), rect('.research-costs'), rect('.research-links')],
    };
  }
  const start = await page.evaluate(reading);
  assert.ok(start.geometry[0] > 0, 'the player is reading partway down the dossier');
  const fundingStates = new Set([start.waiting]);
  let last = start;
  for (let tick = 0; tick < 40 && (fundingStates.size < 2 || last.progress === start.progress); tick++) {
    await page.clock.runFor(256);
    last = await page.evaluate(reading);
    fundingStates.add(last.waiting);
    assert.deepEqual(last.geometry, start.geometry, 'a simulation tick moved the reading position or panel frame');
  }
  assert.equal(fundingStates.size, 2, 'the next dollar restarts research after the stall');
  assert.ok(last.progress > start.progress);
});
