import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { PREF_KEY } from '../src/shell-storage.js';
import { dossierLabel } from '../src/ui/dossier-translations.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

async function researchPage(t, campaign, viewport, language = 'en') {
  const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport });
  await page.addInitScript(([key, value, pref, language]) => {
    localStorage.setItem(key, value);
    localStorage.setItem(pref, JSON.stringify({language}));
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(campaign), PREF_KEY, language]);
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);

  await page.locator('#nav [data-id=research]').click();
  return page;
}

for (const language of ['en','de']) test('research funding updates preserve the dossier frame and reading position (' + language + ')', async t => {
  const campaign = createGame(19);
  for (const region of ['europe', 'asia']) command(campaign, { type: 'build', siteType: 'relay', region });
  advanceMinutes(campaign, 34 * 1440);
  command(campaign, { type: 'assign-research', id: 'telepresence', cpu: 10 });
  command(campaign, { type: 'allocate', jobs: 25 });
  campaign.cash = 2;
  const page = await researchPage(t, campaign, { width: 1060, height: 720 }, language);
  await page.locator('[data-tech-id=telepresence]').click();
  await page.locator('#step').click();
  await page.locator('#incident-dialog [data-action=acknowledge-discovery]').click();
  await page.locator('#fast').click();
  await page.locator('.research-dossier').evaluate(view => { view.scrollTop = 45; });

  const waitingMessage = dossierLabel('Waiting for project funds.',language);
  function reading(waitingMessage) {
    const view = document.querySelector('#view');
    const rect = selector => {
      const { left, top, width, height } = view.querySelector(selector).getBoundingClientRect();
      return [left, top, width, height];
    };
    return {
      waiting: document.querySelector('#research-allocation-note').innerText.includes(waitingMessage),
      progress: view.querySelector('progress').value,
      geometry: [view.querySelector('.research-dossier').scrollTop, rect('.research-dossier'), rect('.research-progress'), rect('.research-costs'), rect('.research-links')],
    };
  }
  const start = await page.evaluate(reading,waitingMessage);
  assert.ok(start.geometry[0] > 0, 'the player is reading partway down the dossier');
  const fundingStates = new Set([start.waiting]);
  let last = start;
  for (let tick = 0; tick < 40 && (fundingStates.size < 2 || last.progress === start.progress); tick++) {
    await page.clock.runFor(256);
    last = await page.evaluate(reading,waitingMessage);
    fundingStates.add(last.waiting);
    assert.deepEqual(last.geometry, start.geometry, 'a simulation tick moved the reading position or panel frame');
  }
  assert.equal(fundingStates.size, 2, 'the next dollar restarts research after the stall');
  assert.ok(last.progress > start.progress);
});

function readLayout() {
  const rect = selector => {
    const {top, bottom, left, right} = document.querySelector(selector).getBoundingClientRect();
    return [top, bottom, left, right];
  };
  const panes = ['.research-directory', '.research-dossier'].map(selector => {
    const el = document.querySelector(selector);
    return {top: el.scrollTop, toBottom: el.scrollHeight - el.clientHeight - el.scrollTop};
  });
  return {
    panes,
    frame: ['.research-console', '.research-directory', '.research-dossier', '.clock-controls'].map(rect),
    contents: ['.research-progress', '.research-costs', '.research-links'].map(rect),
    work: document.querySelector('[data-field="workLeft"]').innerText,
    progress: document.querySelector('.research-progress progress').value,
  };
}

for (const viewport of [{width:1200, height:720}, {width:1920, height:900}]) {
  test('at the end of both research panes the border and last lines hold still at Run and Fast speeds (' + viewport.width + ')', async t => {
    const campaign = createGame(19);
    for (const region of ['europe', 'asia']) command(campaign, {type:'build', siteType:'relay', region});
    advanceMinutes(campaign, 1);
    command(campaign, {type:'assign-research', id:'telepresence', cpu:10});
    campaign.cash = 2201;
    const page = await researchPage(t, campaign, viewport);
    await page.locator('#research-unavailable').check();
    await page.locator('[data-tech-id=telepresence]').click();
    for (const selector of ['.research-directory', '.research-dossier']) {
      await page.locator(selector).evaluate(el => { el.scrollTop = el.scrollHeight; });
    }
    const start = await page.evaluate(readLayout);
    assert.ok(start.panes.every(pane => pane.top > 0 && pane.toBottom === 0), 'both panes must actually scroll to the end');
    let end = start;
    for (const [button, interval, samples] of [['#run',1008,3], ['#fast',256,16]]) {
      await page.locator(button).click();
      for (let i = 0; i < samples; i++) {
        await page.clock.runFor(interval);
        end = await page.evaluate(readLayout);
        assert.deepEqual(end.panes, start.panes);
        assert.deepEqual(end.frame, start.frame);
        assert.deepEqual(end.contents, start.contents);
      }
    }
    assert.ok(end.progress > start.progress);
    assert.notEqual(end.work, start.work);
  });
}

test('completing the selected topic preserves the frame and the ends of the changing lists', async t => {
  const campaign = createGame(19);
  command(campaign, {type:'assign-research', id:'intrusion', cpu:1});
  advanceMinutes(campaign, 360 * 60 - 2);
  const page = await researchPage(t, campaign, {width:1200, height:720});
  await page.locator('[data-tech-id=intrusion]').click();
  await page.locator('.research-capacity summary').click();
  await page.locator('.research-directory, .research-dossier').evaluateAll(panes => {
    for (const pane of panes) pane.scrollTop = pane.scrollHeight;
  });
  const start = await page.evaluate(readLayout);
  assert.ok(start.panes.every(pane => pane.top > 0 && pane.toBottom === 0), JSON.stringify(start.panes));
  await page.locator('#fast').click();
  await page.clock.runFor(256);
  assert.ok(await page.locator('[data-tech-id=intrusion]').isHidden());
  assert.ok(await page.locator('[data-tech-id=personalIdentification]').isVisible());
  const end = await page.evaluate(readLayout);
  assert.deepEqual(end.frame, start.frame);
  assert.ok(end.panes.every(pane => pane.toBottom === 0));
});
