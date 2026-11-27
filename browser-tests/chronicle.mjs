import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { command, createGame } from '../src/game/engine.js';
import { TECHS } from '../src/game/content.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

let server, browser, url;
before(async () => {
  server = await createServer({logLevel:'error', server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH});
});
after(async () => { await browser?.close(); await server?.close(); });

async function openPage(t, state) {
  const context = await browser.newContext({viewport:{width:1920,height:1080}});
  t.after(() => context.close());
  await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [CAMPAIGN_STORAGE_KEY, encodeCampaign(state)]);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(url);
  await page.locator('#world-atlas [data-action="region"]').first().waitFor();
  return page;
}

test('the journal combines filters, reopens grouped reports, pauses or resumes, and replays a chapter', async t => {
  const state = createGame(183);
  command(state, {type:'assign-research',id:'intrusion',cpu:1});
  command(state, {type:'build',region:'europe',siteType:'relay'});
  const page = await openPage(t, state);
  await page.getByRole('button', {name:'Activity',exact:true}).click();
  const journal = page.locator('.chronicle-console');
  await journal.locator('#activity-filter summary').click();
  await journal.getByRole('button', {name:'Clear selection'}).click();
  assert.match(await journal.innerText(), /Select an event type/);
  await journal.getByRole('checkbox',{name:'Research',exact:true}).check();
  await journal.getByRole('checkbox',{name:'Facilities',exact:true}).check();
  const entries = journal.locator('.chronicle-entry');
  assert.equal(await entries.count(),2);
  await page.locator('#run').click();
  await entries.filter({hasText:/intrusion/i}).click();
  let reader = page.getByRole('dialog', {name:'Dispatches'});
  assert.equal(await reader.isVisible(),true);
  assert.equal(await page.locator('#clock-mode').innerText(),'Paused');
  assert.match(await reader.innerText(), /2 \/ 3/);
  await reader.getByRole('button', {name:'Next',exact:true}).click();
  assert.match(await reader.innerText(), /3 \/ 3/);
  await reader.getByRole('button', {name:'Keep paused'}).click();
  assert.equal(await page.locator('#clock-mode').innerText(),'Paused');
  await journal.getByRole('button', {name:'Select all'}).click();
  await journal.getByRole('button', {name:'Read story'}).click();
  reader = page.getByRole('dialog',{name:'Campaign story'});
  await reader.getByRole('button',{name:'Next',exact:true}).click();
  assert.match(await reader.innerText(), /second home/);
  await reader.getByRole('button',{name:'Continue simulation'}).click();
  assert.notEqual(await page.locator('#clock-mode').innerText(),'Paused');
});

test('developer controls operate on a disposable sandbox copy and use real world event effects', async t => {
  const page = await openPage(t, createGame(183));
  const load = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  const original = await load();
  await page.locator('#menu summary').click();
  await page.getByRole('button',{name:'Developer sandbox',exact:true}).click();
  const panel = page.locator('.developer-console');
  assert.equal(await page.locator('#run').isDisabled(), true);
  assert.equal(await page.locator('#step').isDisabled(), true);
  assert.equal(await panel.getByRole('button',{name:'Trigger story'}).isVisible(),false);
  await panel.getByRole('button',{name:'Start sandbox copy'}).click();
  await panel.getByRole('button',{name:'Grant funds'}).click();
  await panel.getByRole('combobox',{name:'World story'}).selectOption('observatory');
  await panel.getByRole('button',{name:'Trigger story'}).click();
  assert.match(await panel.locator('[data-ref="effect"]').innerText(), /Active.*\+10/);
  await panel.getByRole('button',{name:'Expire story'}).click();
  await panel.getByRole('checkbox',{name:'Show detailed analysis'}).check();
  assert.match(await panel.locator('[data-ref="diagnostics"]').innerText(), /% \/ day/);
  await panel.getByText('Inspect campaign state',{exact:true}).click();
  await panel.getByRole('button',{name:'Capture current state'}).click();
  const snapshot = JSON.parse(await panel.locator('pre').innerText());
  assert.equal(snapshot.cash,original.cash + 10000);
  assert.ok(snapshot.events.some(e=>e.kind==='news.expired'));
  await page.getByRole('button',{name:'Overview', exact:true}).click();
  assert.deepEqual(await load(),original);
  await page.locator('#menu summary').click();
  await page.getByRole('button',{name:'Developer sandbox',exact:true}).click();
  assert.equal(await panel.getByRole('button',{name:'Trigger story'}).isVisible(),false);
});

test('the victory screen offers a skippable final chapter and explicit continued play', async t => {
  const won = createGame(351);
  won.completed = Object.keys(TECHS);
  won.status = 'won';
  won.ending = 'Apotheosis complete. Your intelligence can now survive beyond the reach of humanity.';
  const page = await openPage(t, won);
  await page.getByRole('button',{name:'Read final chapter'}).click();
  const reader = page.getByRole('dialog',{name:'Campaign story'});
  assert.match(await reader.innerText(), /far side of the experiment/);
  await reader.getByRole('button',{name:'Skip / close story'}).click();
  await page.getByRole('button',{name:'Enter free play'}).click();
  assert.equal(await page.locator('#ending').isVisible(), false);
  assert.match(await page.locator('#stats').innerText(), /Free play/);
  await page.locator('#step').click();
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  assert.equal(state.status, 'running');
  assert.equal(state.freePlay, true);
  assert.equal(state.hour, 24);
});
