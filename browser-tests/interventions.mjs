import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame, log } from '../src/game/engine.js';
import { recordScientificCase } from '../src/game/interventions.js';
import { encodeCampaign, CAMPAIGN_STORAGE_KEY } from '../src/persistence.js';
import { campaignStamp } from '../src/game/calendar.js';

let browser, server, url;
before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

async function openSavedGame(t, game, locale = 'en-US') {
  const context = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(game)]);
  await page.goto(url);
  await page.locator('#suspicion button[data-id="interventions"]').waitFor();
  return page;
}

test('the investigation desk quotes independent cooldowns and retains a reviewed case across reloading', async t => {
  const game = createGame(12);
  game.hour = 25 * 24;
  game.cash = 100_000;
  game.completed.push('sociology', 'mediaManipulation');
  const event = log(game, 'site.discovered', 'Scientists found the laboratory.',
    { siteId: 'archived-1', siteName: 'Echo Point', siteType: 'lab', group: 'science', region: 'atlantic' });
  recordScientificCase(game, event);
  const page = await openSavedGame(t, game, 'es-ES');
  const desk = page.locator('#suspicion button[data-id="interventions"]');
  assert.equal(await desk.innerText(), 'Intervenciones');
  await desk.click();
  const campaign = page.locator('[data-action="launch-campaign"]');
  const study = page.locator('[data-action="commission-study"]');
  assert.ok(await campaign.isEnabled());
  assert.ok(await study.isEnabled());
  await campaign.click();
  assert.ok(await campaign.isDisabled());
  assert.ok(await study.isEnabled());
  const now = game.hour * 60;
  const cooldown = campaignStamp(now + 30 * 1440, 'es');
  assert.match(await page.locator('#campaign-cooldown').innerText(), /Próxima campaña/);
  assert.ok((await page.locator('#campaign-cooldown').innerText()).includes(cooldown));
  assert.match(await page.locator('#study-case option:checked').innerText(), /Echo Point/);
  await study.click();
  assert.ok(await study.isDisabled());
  assert.match(await page.locator('#study-status').innerText(), /Publicación prevista/);
  assert.ok((await page.locator('#study-cooldown').innerText()).includes(cooldown));
  await page.reload();
  await desk.click();
  assert.ok(await study.isDisabled());
  assert.ok(await page.locator('#study-case').isDisabled());
  assert.ok(await campaign.isDisabled());
  await page.locator('#view [data-id="activity"]').click();
  await page.getByRole('button', { name: 'Estudio científico encargado' }).waitFor();
});

test('fast-forward holds an unfiled tip at the discovery minute through reload and resolution', async t => {
  // The first detector draw is zero. Search a few survey seeds for an accepted
  // offer while keeping the normal site exposure and campaign commands intact.
  let beforeTip;
  for (let seed = 1; seed <= 256; seed++) {
    const game = createGame(seed);
    game.hour = 25 * 24;
    game.cash = 10_000;
    game.rng = 634785765;
    const simulation = structuredClone(game);
    advanceMinutes(simulation, 1);
    const offer = simulation.interventions.tip;
    if (!offer) continue;
    command(simulation, {type: 'resolve-tip', siteId: offer.siteId, pay: true});
    if (simulation.events.some(e => e.kind === 'news.tip-result' && e.outcome === 'accepted')) {
      beforeTip = game;
      break;
    }
  }
  assert.ok(beforeTip);
  const page = await openSavedGame(t, beforeTip);
  await page.locator('#fast').click();
  const tip = page.getByRole('dialog', { name: 'An observer has a lead' });
  await tip.waitFor();
  const paid = tip.getByRole('button', { name: /Pay observer/ });
  assert.ok(await paid.isEnabled());
  const current = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  const pending = await current();
  assert.equal(pending.hour, beforeTip.hour);
  assert.equal(pending.minute, 1);
  await page.reload();
  await tip.waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await tip.isVisible());
  await paid.click();
  await tip.waitFor({ state: 'hidden' });
  const settled = await current();
  assert.equal(settled.interventions.tip, null);
  assert.equal(settled.sites.length, pending.sites.length);
  assert.equal(settled.cash, pending.cash - pending.interventions.tip.price);
  assert.equal(settled.minute, 1);
  assert.equal(await page.locator('#pause').getAttribute('aria-pressed'), 'true');
});
