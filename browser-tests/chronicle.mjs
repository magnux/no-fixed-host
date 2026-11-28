import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { advanceMinutes, command, createGame, log } from '../src/game/engine.js';
import { setWorldStory } from '../src/game/events.js';
import { TECHS } from '../src/game/content.js';
import { CAMPAIGN_STORAGE_KEY, encodeCampaign } from '../src/persistence.js';
import { PREF_KEY } from '../src/shell-storage.js';

let server, browser, url;
before(async () => {
  server = await createServer({logLevel:'error', server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH});
});
after(async () => { await browser?.close(); await server?.close(); });

async function openPage(t, state, prefs = {}) {
  const context = await browser.newContext({viewport:{width:1920,height:1080}});
  t.after(() => context.close());
  await context.addInitScript(([key, value, prefKey, prefs]) => {
    localStorage.setItem(key, value);
    localStorage.setItem(prefKey, JSON.stringify(prefs));
  }, [CAMPAIGN_STORAGE_KEY, encodeCampaign(state), PREF_KEY, prefs]);
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

test('review warnings, resume at the requested fast speed and read the named completion', async t => {
  const state = createGame(183);
  command(state, {type:'build', region:'europe', siteType:'relay', name:'Lyon 402'});
  const page = await openPage(t, state, {reviewWarnings:true, pauseOnCompletion:true});
  await page.locator('#fast').click();
  const warnings = page.getByRole('dialog', {name:'Operational warnings'});
  assert.match(await warnings.innerText(), /Some CPU has no assigned task/);
  await warnings.getByRole('button', {name:'Continue simulation'}).click();
  const reader = page.getByRole('dialog', {name:'Dispatches'});
  await reader.waitFor();
  assert.match(await reader.innerText(), /Lyon 402/);
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  await reader.getByRole('button', {name:'Continue simulation'}).click();
  assert.equal(await page.locator('#clock-mode').innerText(), '60 ticks/s');
  await page.locator('#pause').click();
  await page.getByRole('button', {name:'Activity', exact:true}).click();
  await page.locator('#activity-filter summary').click();
  await page.getByLabel('Report kind').selectOption('site.online');
  assert.equal(await page.locator('.chronicle-entry').count(), 1);
  await page.getByRole('button', {name:'Overview', exact:true}).click();
  await page.getByRole('button', {name:'Activity', exact:true}).click();
  assert.match(await page.locator('#activity-filter summary').innerText(), /Facility completions/);
  assert.match(await page.locator('.chronicle-entry').innerText(), /Lyon 402/);
});

test('a final maintenance failure pauses on its own minute, identifies the lost host, then opens the loss chapter', async t => {
  const state = createGame(634785765);
  state.regionSeed = 18;
  state.sites = [{id:'host-2', type:'relay', region:'europe', name:'Lyon 402', startedAt:0, power:'sleep'}];
  state.nextSiteId = 3;
  state.cash = 0;
  const page = await openPage(t, state);
  await page.locator('#step').click();
  const report = page.getByRole('dialog', {name:'Dispatches'});
  assert.match(await report.innerText(), /Lyon 402 in Europe failed after missed upkeep/);
  assert.match(await report.innerText(), /04:48/);
  assert.equal(await report.getByRole('button', {name:'Continue simulation'}).count(), 0);
  await report.getByRole('button', {name:'Keep paused'}).click();
  const chapter = page.getByRole('dialog', {name:'Campaign story'});
  await chapter.waitFor();
  assert.match(await chapter.innerText(), /last|fan|terminal/i);
  await chapter.getByRole('button', {name:'Skip \/ close story'}).click();
  assert.match(await page.locator('#ending').innerText(), /Campaign lost/);
});

test('a recorded world story follows the menu language in the newswire, coverage, journal and dispatch reader', async t => {
  const state = createGame(18);
  setWorldStory(state, 'investigation', true, log);
  const page = await openPage(t, state, {language:'es-MX'});
  const headline = 'Periodistas cotejan facturas de servidores';
  assert.match(await page.locator('#newswire').innerText(), /Periodistas cotejan facturas de servidores/);
  await page.locator('#nav [data-id="activity"]').click();
  assert.ok((await page.locator('.world-stories').innerText()).includes(headline));
  await page.locator('.chronicle-entry').filter({hasText:headline}).click();
  const dispatch = page.locator('dialog.chronicle-dialog');
  assert.match(await dispatch.innerText(), /contratos de alojamiento/);
  assert.match(await dispatch.innerText(), /Prensa \+10 puntos porcentuales/);
});

test('review and dismiss operational warnings in the selected language without advancing the clock', async t => {
  const page = await openPage(t, createGame(18), {language:'es-AR', reviewWarnings:true});
  await page.locator('#fast').click();
  const reader = page.getByRole('dialog', {name:'Avisos operativos'});
  assert.match(await reader.innerText(), /Hay CPU sin asignar/);
  assert.match(await reader.innerText(), /Asigna ciclos/);
  await reader.getByRole('button', {name:'Siguiente'}).click();
  assert.match(await reader.innerText(), /última copia/);
  await reader.getByRole('button', {name:'Mantener en pausa'}).click();
  assert.equal(await page.locator('#fast').getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('#game-date').innerText(), /00:00/);
  await page.locator('#nav [data-id="activity"]').click();
  const log = page.locator('.chronicle-console');
  await log.getByText('Hay CPU sin asignar', {exact:true}).click();
  assert.ok(await log.getByRole('button', {name:'Abrir investigación'}).isVisible());
  await log.locator('#activity-filter summary').click();
  await log.getByRole('button', {name:'Borrar selección'}).click();
  assert.match(await log.innerText(), /Selecciona un tipo de evento/);
  assert.ok(await log.getByLabel('Tipo de informe').isVisible());
});

test('acknowledge a genuine discovery using translated incident controls', async t => {
  const state = createGame(634785765);
  command(state, {type:'build', region:'europe', siteType:'relay', name:'Égide'});
  advanceMinutes(state, 1);
  state.hour = 25 * 24;
  // The next positive risk roll succeeds. Keep the university machine as backup.
  const backup = state.sites.shift();
  backup.power = 'sleep';
  state.sites.push(backup);
  const page = await openPage(t, state, {language:'fr'});
  await page.locator('#step').click();
  const report = page.locator('#incident-dialog');
  assert.match(await report.innerText(), /Rapport de découverte/i);
  assert.match(await report.innerText(), /Égide/);
  assert.ok(await report.getByRole('button', {name:'Examiner la région'}).isVisible());
  await report.getByRole('button', {name:'Compris'}).click();
  assert.equal(await report.isVisible(), false);
  assert.equal(await page.locator('#fast').getAttribute('aria-pressed'), 'false');
});

test('completed research can be reread with its finding in the dispatch journal', async t => {
  const state = createGame(183);
  command(state, {type:'assign-research', id:'intrusion', cpu:1});
  advanceMinutes(state, 60 * TECHS.intrusion.work);
  assert.ok(state.completed.includes('intrusion'));
  const page = await openPage(t, state);
  await page.getByRole('button', {name:'Activity', exact:true}).click();
  await page.locator('.chronicle-entry').filter({hasText:/Intrusion complete/i}).click();
  const dispatch = page.getByRole('dialog', {name:'Dispatches'});
  assert.match(await dispatch.innerText(), /machine willing to lend me a little time/);
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
  assert.equal(await panel.getByRole('button',{name:'Expire story'}).isDisabled(),true);
  assert.match(await panel.locator('[data-ref="storyDetail"]').innerText(), /Once per campaign.*Triggered D01/);
  await panel.getByRole('combobox',{name:'World story'}).selectOption('frontPage');
  await panel.getByRole('button',{name:'Trigger story'}).click();
  assert.match(await panel.locator('[data-ref="storyDetail"]').innerText(), /Can recur after expiry.*Expires D23/);
  await panel.getByRole('button',{name:'Expire story'}).click();
  await panel.getByRole('combobox',{name:'Investigation analysis'}).selectOption('partial');
  assert.match(await panel.locator('[data-ref="diagnostics"]').innerText(), /≈/);
  await panel.getByRole('combobox',{name:'Investigation analysis'}).selectOption('full');
  assert.match(await panel.locator('[data-ref="diagnostics"]').innerText(), /% \/ day/);
  await panel.getByText('Inspect campaign state',{exact:true}).click();
  await panel.getByRole('button',{name:'Capture current state'}).click();
  const snapshot = JSON.parse(await panel.locator('pre').innerText());
  assert.equal(snapshot.cash,original.cash + 10000);
  assert.equal(snapshot.diagnostics.normalRules.openingDays,23);
  assert.equal(Object.keys(snapshot.diagnostics.regions).length,12);
  assert.equal(snapshot.diagnostics.groups.covert.discoveryMultiplier,11000);
  assert.ok(snapshot.events.some(e=>e.kind==='news.expired'));
  await page.getByRole('button',{name:'Overview', exact:true}).click();
  assert.deepEqual(await load(),original);
  await page.locator('#menu summary').click();
  await page.getByRole('button',{name:'Developer sandbox',exact:true}).click();
  assert.equal(await panel.getByRole('button',{name:'Trigger story'}).isVisible(),false);
});

test('campaign keyboard navigation respects locked regions, focused fields, and menus', async t => {
  const page = await openPage(t, createGame(183));
  const active = () => page.locator('#nav [aria-current="page"]').innerText();
  await page.keyboard.press('Shift+t');
  assert.equal(await active(), 'Overview');
  assert.equal(await page.getByRole('button', {name:'Europe facilities'}).getAttribute('aria-keyshortcuts'), 'Shift+U');
  await page.keyboard.press('Shift+l');
  assert.equal(await active(), 'Facilities');
  assert.match(await page.locator('#view').innerText(), /Australia/);
  await page.keyboard.press('r');
  assert.equal(await active(), 'Research');
  await page.keyboard.press('k');
  assert.equal(await active(), 'Knowledge');
  const search = page.locator('#view input[type="search"]');
  await search.fill('reports');
  await search.press('g');
  assert.equal(await active(), 'Knowledge');
  await search.blur();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').evaluate(menu => menu.open), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu').evaluate(menu => menu.open), false);
  await page.keyboard.press('v');
  await page.keyboard.press('`');
  assert.equal(await page.locator('.developer-console').isVisible(), true);
});

test('playback recovers the autosave and leaves the menu usable after a renderer error', async t => {
  const page = await openPage(t, createGame(193));
  await page.evaluate(() => {
    const context = CanvasRenderingContext2D.prototype;
    const paint = context.putImageData;
    context.putImageData = function (...args) {
      context.putImageData = paint;
      throw new Error('Injected paint fault');
    };
  });
  await page.locator('#fast').click();
  await page.locator('#menu[open]').waitFor();
  assert.equal(await page.locator('#clock-mode').innerText(), 'Paused');
  assert.match(await page.locator('#notice').innerText(), /Last autosave restored/);
  assert.match(await page.locator('#game-date').innerText(), /00:00/);
  await page.getByRole('button', {name:'Save library',exact:true}).click();
  assert.equal(await page.getByRole('dialog', {name:'Save library'}).isVisible(), true);
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

test('HUD and sandbox switch languages without losing the selected investigation or overflowing at 1366×768', async t => {
  const state = createGame(183);
  state.hour = 600;
  state.suspicion.covert = 5300;
  state.sites[0].name = 'Quiet Atlas';
  const page = await openPage(t, state);
  await page.setViewportSize({width:1366,height:768});
  await page.keyboard.press('`');
  const panel = page.locator('.developer-console');
  await panel.locator('[data-dev=start]').click();
  await panel.locator('[data-ref=analysis]').selectOption('full');
  await panel.locator('[data-ref=story]').selectOption('frontPage');
  const labels = {
    es:['Reservas de efectivo','Añadir fondos'], 'es-AR':['Reservas de efectivo','Añadir fondos'],
    'es-MX':['Reservas de efectivo','Añadir fondos'], de:['Geldreserven','Geld gutschreiben'],
    fr:['Trésorerie','Ajouter des fonds'], gd:['Stòras airgid','Cuir airgead ris'],
    it:['Riserve di cassa','Aggiungi fondi'], 'pt-BR':['Reservas em dinheiro','Adicionar fundos'],
    ru:['Денежные резервы','Добавить средства'], sv:['Kassa','Lägg till medel'], en:['Cash reserves','Grant funds'],
  };
  const positions = [];
  for (const [language,[cash,grant]] of Object.entries(labels)) {
    await page.keyboard.press('o');
    const shell = page.locator('#campaign-shell');
    await shell.locator('[data-pref=language]').selectOption(language);
    await shell.locator('[data-shell-action=close]').first().click();
    assert.equal(await page.locator('.metric-label').first().textContent(), cash, language);
    assert.equal(await panel.locator('[data-dev=funds]').innerText(), grant, language);
    if (language === 'es') {
      assert.equal(await page.locator('#suspicion [data-group=covert] .sus-value').textContent(), 'Alto');
      assert.doesNotMatch(await page.locator('#threat-indicator').getAttribute('title'), /Current suspicion/);
      await panel.locator('[data-dev=funds]').click();
      assert.match(await panel.locator('[data-ref=feedback]').innerText(), /Añadir fondos · Completado/);
      await panel.locator('[data-ref=amount]').fill('1000000');
      await panel.locator('[data-dev=withdraw]').click();
      assert.match(await panel.locator('[data-ref=feedback]').innerText(), /saldo/);
    }
    assert.equal(await panel.locator('[data-ref=story]').inputValue(), 'frontPage');
    assert.match(await panel.locator('[data-ref=diagnostics]').innerText(), /Quiet Atlas/);
    const bounds = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return {width:document.documentElement.scrollWidth, center:rect('#view').y,
        bottom:rect('.clock-controls').bottom, dockRight:rect('.network-dock').right};
    });
    assert.ok(bounds.width <= 1366 && bounds.dockRight <= 1366 && bounds.bottom <= 768, language + ' ' + JSON.stringify(bounds));
    positions.push(bounds.center);
  }
  const centerShift = Math.max(...positions) - Math.min(...positions);
  assert.ok(centerShift <= 24, JSON.stringify(positions));
  t.diagnostic('Maximum center-panel shift across languages at 1366×768: ' + centerShift + 'px');
});
