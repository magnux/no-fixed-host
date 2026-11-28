import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { TECHS } from '../src/game/content.js';
import { creditTreasury } from '../src/game/treasury.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';

async function openFacilities(t, state, locale = 'en-US') {
  const server = await createServer({logLevel: 'error', server: {host: '127.0.0.1', port: 0, hmr: false, watch: null}});
  t.after(() => server.close());
  await server.listen();
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH});
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: {width: 1440, height: 900}, locale });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(([key, save]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, save);
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(state)]);
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  await page.locator('#nav [data-id="facilities"]').click();
  return {page, errors};
}

test('host bar boost, standby, crew and turnkey orders are accessible through Facilities', async t => {
  const state = createGame(47);
  const region = state.sites[0].region;
  function learn(id) {
    if (!state.completed.includes(id)) {
      TECHS[id].requires.forEach(learn);
      state.completed.push(id);
    }
  }
  learn('lunarRocketry');
  state.frontierOperated = true;
  creditTreasury(state, 500_000_000);
  command(state, {type: 'build', siteType: 'relay', region, name: 'Harbor relay'});
  advanceMinutes(state, 1);

  const {page, errors} = await openFacilities(t, state);
  const ref = id => page.locator('[data-ref="' + id + '"]');
  const row = page.locator('.facility-host-row[data-site-id="host-2"]');
  await row.getByRole('button', {name:'Boost Harbor relay', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Boost Harbor relay'});
  assert.match(await dialog.innerText(), /for seven days/);
  await dialog.getByRole('button', {name:'Activate boost'}).click();
  await row.getByRole('button', {name:'End boost for Harbor relay'}).click();
  assert.equal(await row.getByRole('button', {name:'Boost Harbor relay', exact:true}).isDisabled(), true);
  await row.locator('.facility-host-toggle').click();
  assert.match(await ref('boostTerms').innerText(), /recharges/);

  await ref('standbyPanel').locator('summary').click();
  await ref('primary').selectOption('host-1');
  const tech = await ref('standbyTopic').locator('option').nth(1).getAttribute('value');
  await ref('standbyTopic').selectOption(tech);
  await ref('standby').click();
  assert.match(await ref('standbyTerms').innerText(), /reserved/);
  assert.match(await row.locator('.facility-host-state').innerText(), /Asleep/);
  await ref('standby').click();
  assert.equal(await ref('standby').innerText(), 'Designate standby');

  await ref('buildMode').click();
  await ref('region').selectOption(region);
  await page.locator('[data-facility-type="storageUnit"]').check();
  const normal = await ref('cost').innerText();
  await ref('useCrew').check();
  assert.notEqual(await ref('cost').innerText(), normal);
  await ref('build').click();
  assert.equal(await ref('queue').getByRole('button', {name:'Crew hired'}).count(), 1);
  await ref('useCrew').uncheck();
  await ref('build').click();
  await ref('queue').getByRole('button', {name:'Hire ground contractors'}).click();
  await page.getByRole('dialog', {name:'Hire ground contractors'}).getByRole('button', {name:'Hire crew', exact:true}).click();
  assert.equal(await ref('queue').getByRole('button', {name:'Crew hired'}).count(), 2);

  await ref('acquisition').locator('summary').click();
  const district = await ref('acquireDistrict').locator('option').nth(1).getAttribute('value');
  await ref('acquireDistrict').selectOption(district);
  assert.match(await ref('acquirePrice').innerText(), /450[,\s]?000[,\s]?000/);
  await ref('acquire').click();
  assert.equal(await ref('acquire').isDisabled(), true);
  await ref('manageMode').click();
  await page.locator('[data-vendor-center="true"] .facility-host-toggle').click();
  await ref('retainerPanel').locator('summary').click();
  assert.match(await ref('retainerTerms').innerText(), /Covered in/);
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign, CAMPAIGN_STORAGE_KEY);
  assert.equal(save.sites.find(site => site.vendorCenter)?.replacementRegion, district);
  assert.equal(save.builds.filter(build => build.crew).length, 2);
  assert.deepEqual(errors, []);
});

test('buy an existing datacenter a separate replacement in the Spanish Facilities inspector', async t => {
  const state = createGame(19);
  for (const id of Object.keys(TECHS)) if (id !== 'apotheosis') state.completed.push(id);
  state.frontierOperated = true;
  creditTreasury(state, 500_000_000);
  const region = state.sites[0].region;
  command(state, { type: 'acquire-datacenter', region });
  const {page, errors} = await openFacilities(t, state, 'es-ES');
  const row = page.locator('.facility-host-row[data-site-id="host-2"]');
  await row.locator('.facility-host-toggle').click();
  assert.match(await row.locator('[data-host-action="boost"]').getAttribute('aria-label'), /Acelerar/);
  await page.getByText('Sustitución del centro de datos', {exact:true}).click();
  const district = page.getByRole('combobox', {name:'Distrito de sustitución', exact:true});
  const regionId = await district.locator('option').nth(1).getAttribute('value');
  await district.selectOption(regionId);
  await page.getByRole('button', {name:'Pagar la sustitución por adelantado'}).click();
  assert.match(await page.locator('[data-ref="retainerTerms"]').innerText(), /Sustitución reservada en/);
  assert.equal(await page.evaluate(([key, id]) =>
    JSON.parse(localStorage.getItem(key)).campaign.sites.some(site => site.replacementRegion === id),
    [CAMPAIGN_STORAGE_KEY, regionId]), true);
  assert.deepEqual(errors, []);
});
