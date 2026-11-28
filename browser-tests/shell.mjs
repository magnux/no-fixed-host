import { startCampaign } from './support/start-campaign.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';
import { createGame } from '../src/game/engine.js';
import { PREF_KEY, RECOVERY_SLOT } from '../src/shell-storage.js';
import { chromium } from 'playwright';
import { createServer } from 'vite';

let browser;
let server;
let url;

before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
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
  assert.match(await row.innerText(), /12 Dec 2026 · 04:20 UTC.+Format \d/s);
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
  await shell.getByRole('button', {name:'Back', exact:true}).click();
  await shell.getByRole('button', {name:'Resume campaign'}).click();
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

test('options preview, discard and publish individual preference edits across tabs', async t => {
  const page = await fresh(t);
  const peer = await page.context().newPage();
  await peer.goto(url);
  await page.bringToFront();
  await page.keyboard.press('o');
  const shell = page.locator('#campaign-shell');
  await shell.getByLabel('Theme').selectOption('amber');
  await shell.getByLabel('Audio latency').selectOption('interactive');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'amber');
  assert.notEqual(await peer.locator('html').getAttribute('data-theme'), 'amber');
  await shell.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'night');
  await page.keyboard.press('o');
  assert.equal(await shell.getByLabel('Audio latency').inputValue(), 'balanced');
  await shell.getByLabel('Theme').selectOption('amber');
  await peer.evaluate(key => localStorage.setItem(key, JSON.stringify({theme:'night', daylight:false})), PREF_KEY);
  await shell.getByLabel('Day and night on map').waitFor();
  await page.waitForFunction(() => document.documentElement.dataset.daylight === 'false');
  await shell.getByRole('button', {name:'Apply changes'}).click();
  await peer.waitForFunction(() => document.documentElement.dataset.theme === 'amber');
  assert.equal(await peer.evaluate(key => JSON.parse(localStorage.getItem(key)).daylight, PREF_KEY), false);
});

test('checkpoint chooser accepts unordered words, row shortcuts and the last explicit save name', async t => {
  const page = await fresh(t);
  await page.keyboard.press('l');
  const shell = page.locator('#campaign-shell');
  const name = shell.getByLabel('Name this checkpoint');
  await name.fill('Mars early relay');
  await shell.getByRole('button', {name:'Save checkpoint', exact:true}).click();
  await shell.locator('strong', {hasText:'Mars early relay'}).waitFor();
  await name.fill('Mars final relay');
  await shell.getByRole('button', {name:'Save checkpoint', exact:true}).click();
  const latest = shell.locator('.shell-slots li').filter({hasText:'Mars final relay'});
  await latest.waitFor();
  await shell.locator('.shell-head button').click();
  await page.keyboard.press('l');
  assert.equal(await name.inputValue(), 'Mars final relay');
  const filter = shell.getByLabel('Search saves');
  await filter.fill('relay Mars');
  assert.equal(await shell.locator('[data-slot-key]').count(), 2);
  await filter.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const confirm = shell.locator('.shell-confirm');
  assert.match(await confirm.innerText(), /Mars early relay/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  assert.match(await confirm.innerText(), /Delete the checkpoint.*Mars final relay/);
  await confirm.getByRole('button', {name:'Delete'}).click();
  await latest.waitFor({state:'detached'});
  await shell.locator('.shell-head button').click();
  await page.keyboard.press('F5');
  await page.locator('#notice').filter({hasText:'Saved.'}).waitFor();
  await page.keyboard.press('F9');
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /Quicksave/);
});

test('the three-day midnight is a selectable recovery point independent from the live autosave', async t => {
  const state = createGame(714);
  state.hour = 67;
  state.minute = 39;
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.addInitScript(({key, save}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,save);
  }, {key:CAMPAIGN_STORAGE_KEY, save:encodeCampaign(state)});
  await page.goto(url);
  await page.locator('#step').click();
  await page.keyboard.press('l');
  const shell = page.locator('#campaign-shell');
  const row = shell.locator('.shell-slots li').filter({hasText:'Automatic checkpoint'});
  await row.waitFor();
  assert.match(await row.innerText(), /15 Dec 2026 · 00:00 UTC/);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.campaign.hour, RECOVERY_SLOT),67);
  await row.getByRole('button',{name:'Load'}).click();
  await shell.locator('.shell-confirm').getByRole('button',{name:'Load'}).click();
  await shell.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).campaign.minute, CAMPAIGN_STORAGE_KEY),40);
});

test('system locale initializes the title, atlas and facility catalog in the same language', async t => {
  const context = await browser.newContext({locale:'fr-FR'});
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  const shell = page.locator('#campaign-shell');
  await shell.getByRole('button',{name:'Commencer la campagne'}).waitFor();
  await page.keyboard.press('n');
  await page.getByRole('button',{name:/Skip \/ close story|Passer/}).click();
  await page.keyboard.press('l');
  await shell.getByLabel('Nom de la sauvegarde').fill('Relais « 1 »');
  await shell.getByRole('button',{name:'Enregistrer', exact:true}).click();
  await shell.locator('.shell-slots [data-shell-action="load"]').click();
  assert.equal(await shell.locator('.shell-confirm p').innerText(), 'Restaurer la sauvegarde « Relais « 1 » » et remplacer la sauvegarde automatique actuelle ?');
  await page.keyboard.press('Escape');
  await page.locator('#file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('broken')});
  await shell.locator('.shell-notice').filter({hasText:'Choisissez une sauvegarde JSON de No Fixed Host.'}).waitFor();
  await shell.locator('.shell-head button').click();
  const region = page.locator('#world-atlas [data-id="coast"]');
  assert.match(await region.getAttribute('aria-label'), /Amérique du Nord/i);
  await region.hover();
  assert.match(await page.locator('.atlas-hint strong').innerText(), /Amérique du Nord/i);
  await region.click();
  await page.locator('[data-ref="buildMode"]').click();
  assert.match(await page.locator('.facility-design-name').first().innerText(), /Relais loué|Box de stockage/);
});

test('a damaged checkpoint stays visible and can be deleted without losing another checkpoint', async t => {
  const page = await fresh(t);
  const key = 'no-fixed-host.checkpoint.named.broken';
  await page.evaluate(key => localStorage.setItem(key, '{'), key);
  await page.locator('#pause').focus();
  await page.keyboard.press('F5');
  await page.locator('#notice').filter({hasText:'Saved.'}).waitFor();
  await page.keyboard.press('l');
  const shell = page.locator('#campaign-shell');
  const broken = shell.locator('[data-slot-key]').filter({hasText:'Damaged checkpoint'});
  assert.equal(await broken.getByRole('button',{name:'Load'}).isDisabled(), true);
  await broken.getByRole('button',{name:'Delete'}).click();
  await shell.locator('.shell-confirm').getByRole('button',{name:'Delete'}).click();
  await broken.waitFor({state:'detached'});
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
  assert.equal(await shell.locator('.shell-slots strong').innerText(), 'Quicksave');
});

test('campaign menu exposes four destinations and About routes back through the tester', async t => {
  const page = await fresh(t);
  const menu = page.locator('#menu');
  const shell = page.locator('#campaign-shell');
  await menu.locator('summary').click();
  assert.deepEqual(await menu.getByRole('button').allTextContents(), ['Title screen', 'Save library', 'Options', 'About']);
  await menu.getByRole('button', { name: 'About' }).click();
  await shell.getByRole('button', { name: 'Minigame tester' }).click();
  assert.equal(await shell.getByRole('button', { name: 'Play First Jump' }).count(), 1);
  await shell.getByRole('button', { name: 'Back', exact: true }).click();
  assert.equal(await shell.getByRole('heading', { name: 'About' }).isVisible(), true);
  await shell.getByRole('button', { name: 'Developer sandbox' }).click();
  assert.equal(await shell.isVisible(), false);
  assert.equal(await page.locator('.developer-console').isVisible(), true);
});

test('volume sliders paint both sides of the thumb at every theme and track keyboard edits', async t => {
  const page = await fresh(t);
  await page.keyboard.press('o');
  const shell = page.locator('#campaign-shell');
  const volume = shell.locator('[data-pref="musicVolume"]');
  const meters = async () => {
    const bitmap = await volume.screenshot();
    return page.evaluate(async encoded => {
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const image = await createImageBitmap(new Blob([bytes], {type:'image/png'}));
      const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
      context.drawImage(image, 0, 0);
      const sample = (x, y) => [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data].slice(0, 3);
      const left = sample(image.width * .25, image.height / 2);
      const right = sample(image.width * .75, image.height / 2);
      const panel = sample(image.width * .25, 1);
      image.close();
      return {left, right, panel};
    }, bitmap.toString('base64'));
  };
  const closeColor = (a, b) => a.every((channel, index) => Math.abs(channel - b[index]) <= 2);
  function luminance(rgb) {
    const linear = rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  }
  for (const theme of ['night', 'amber', 'contrast']) {
    await shell.getByLabel('Theme').selectOption(theme);
    await volume.press('Home');
    const empty = await meters();
    assert.ok(closeColor(empty.left, empty.right), theme + ' empty rail');
    assert.ok((luminance(empty.right) + .05) / (luminance(empty.panel) + .05) >= 3, theme + ' visible rail');
    await volume.press('End');
    const full = await meters();
    assert.ok(closeColor(full.left, full.right), theme + ' filled rail');
    assert.ok(!closeColor(full.left, empty.left), theme + ' distinct fill');
    await volume.press('Home');
    const bounds = await volume.boundingBox();
    assert.ok(bounds.height >= 24);
    await volume.click({position:{x:Math.round(bounds.width / 2), y:Math.floor(bounds.height / 2)}});
    const half = await meters();
    assert.ok(closeColor(half.left, full.left), theme + ' half-filled rail starts in the active color');
    assert.ok(closeColor(half.right, empty.right), theme + ' half-filled rail ends in the rail color');
    assert.match(await shell.locator('output[for="shell-musicVolume"]').innerText(), /^(49|50|51)%$/);
  }
});
