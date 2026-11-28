import { startCampaign } from './support/start-campaign.mjs';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { scores } from '../src/arcade/audio/library.js';
import { advanceMinutes, command, createGame } from '../src/game/engine.js';
import { encodeCampaign } from '../src/persistence.js';

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

// Meter the actual mixed PCM, downstream of all volume controls and voice envelopes.
function installMeter() {
  const meters = new Map();
  const connect = AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.connect = function (destination, ...ports) {
    if (destination !== this.context.destination) return connect.call(this, destination, ...ports);
    if (!meters.has(this.context)) {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      meters.set(this.context, analyser);
      connect.call(analyser, destination);
    }
    connect.call(this, meters.get(this.context), ...ports);
    return destination;
  };
  AudioNode.prototype.disconnect = function (...args) {
    if (args[0] === this.context.destination && meters.has(this.context)) args[0] = meters.get(this.context);
    return disconnect.apply(this, args);
  };
  const data = new Float32Array(2048);
  window.gameAudioMeter = { peak: 0, notes: [] };
  // Capture the starting instrument and pitch too, so a leaking campaign track
  // cannot satisfy the test merely by producing nonzero output.
  const pitches = new WeakMap();
  const scheduleValue = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (value, time) {
    if (!pitches.has(this)) pitches.set(this, value);
    return scheduleValue.call(this, value, time);
  };
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    const hz = pitches.get(this.frequency) ?? this.frequency.value;
    const midi = Math.round(69 + 12 * Math.log2(hz / 440));
    window.gameAudioMeter.notes.push(this.type + ':' + midi);
    return start.apply(this, args);
  };
  setInterval(() => {
    for (const [context, analyser] of meters) {
      if (context.state !== 'running') continue;
      analyser.getFloatTimeDomainData(data);
      for (const sample of data) {
        window.gameAudioMeter.peak = Math.max(window.gameAudioMeter.peak, Math.abs(sample));
      }
    }
  }, 12);
}

async function fresh(t) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 820 } });
  t.after(() => context.close());
  await context.addInitScript(installMeter);
  const page = await context.newPage();
  await page.goto(url);
  await startCampaign(page);
  await page.locator('#campaign-shell').waitFor({ state: 'attached' });
  return page;
}

const resetPeak = page => page.evaluate(() => { window.gameAudioMeter.peak = 0; });
const clearNotes = page => page.evaluate(() => { window.gameAudioMeter.notes = []; });

async function hearOpening(page, id) {
  const opening = scores[id].voices.filter(voice => voice.wave !== 'noise')
    .flatMap(voice => voice.notes.map(([beat, pitch]) => ({ beat, note: voice.wave + ':' + pitch })))
    .sort((a, b) => a.beat - b.beat).slice(0, 2).map(event => event.note);
  await page.waitForFunction(notes => notes.every(note => window.gameAudioMeter.notes.includes(note)), opening,
    { polling: 25, timeout: 6000 }).catch(err => { throw new Error('Wrong or missing score for ' + id, { cause: err }); });
  await audible(page, id);
}

async function audible(page, description) {
  await page.waitForFunction(() => window.gameAudioMeter.peak > .0001, null, { polling: 20, timeout: 6000 })
    .catch(err => { throw new Error('No audible output from ' + description, { cause: err }); });
}
async function staysSilent(page, description) {
  // Longer than the analyser history and release tail of a UI cue.
  await page.waitForTimeout(180);
  await resetPeak(page);
  await page.waitForTimeout(260);
  assert.ok(await page.evaluate(() => window.gameAudioMeter.peak < .0001), description);
}

async function menu(page, selector) {
  await page.locator('#menu summary').click();
  await page.locator('#menu ' + selector).click();
}

async function options(page, music, effects) {
  await menu(page, '[data-shell-open="options"]');
  const shell = page.locator('#campaign-shell');
  await shell.getByLabel('Enable audio').check();
  await shell.locator('[data-pref=musicVolume]').press(music ? 'End' : 'Home');
  await shell.locator('[data-pref=uiVolume]').press(effects ? 'End' : 'Home');
  await shell.getByRole('button', { name: 'Close', exact: true }).click();
}

test('every tester entry produces music with the effects fader down; hiding pauses and resuming restores the score', async t => {
  const page = await fresh(t);
  await options(page, true, false);
  await menu(page, '[data-shell-open="tester"]');
  const tester = page.locator('#campaign-shell');
  const entries = await tester.locator('[data-minigame]').all();
  assert.equal(entries.length, 14);
  for (const entry of entries) {
    const id = await entry.getAttribute('data-minigame');
    await clearNotes(page);
    await entry.click();
    const game = page.locator(id === 'first-jump' ? '.first-jump[open]' : '[data-practice-game="' + id + '"][open]');
    await game.waitFor();
    await resetPeak(page);
    await hearOpening(page, id);
    if (id === 'hide') {
      await game.locator('[data-retry]').click();
      await resetPeak(page);
      await audible(page, 'replayed Hide');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await staysSilent(page, 'hidden game must be silent');
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await audible(page, 'restored Hide');
    }
    await game.locator(id === 'first-jump' ? '[data-close]' : '[data-practice-back]').click();
    await tester.getByRole('status').filter({ hasText: 'Left before finishing' }).waitFor();
  }
});

test('the direct First Jump drill and gallery both honor music and effects independently; ordinary menu clicks are silent', async t => {
  const page = await fresh(t);
  await menu(page, '[data-action="drill"]');
  const game = page.locator('.first-jump[open]');
  await game.locator('[data-transmit]').click();
  await staysSilent(page, 'fresh campaign and drill stay silent by default');
  await game.locator('[data-close]').click();

  await options(page, false, true);
  // Capture from before the click so short incidental beeps cannot escape the assertion.
  await staysSilent(page, 'music fader at zero silences the campaign');
  await resetPeak(page);
  await menu(page, '[data-shell-open="tester"]');
  await page.waitForTimeout(180);
  assert.ok(await page.evaluate(() => window.gameAudioMeter.peak < .0001), 'opening the menu is quiet');
  await page.locator('#campaign-shell [data-minigame="first-jump"]').click();
  await staysSilent(page, 'a muted practice score is silent before any gameplay input');
  await resetPeak(page);
  await game.locator('[data-transmit]').click();
  await audible(page, 'gallery transmit');
  await game.locator('[data-close]').click();
  await page.locator('#campaign-shell .shell-head button').click();

  await menu(page, '[data-action="drill"]');
  await staysSilent(page, 'no old cue or score leaks into a fresh direct drill');
  await resetPeak(page);
  await game.locator('[data-transmit]').click();
  await audible(page, 'direct transmit');
  await game.locator('[data-close]').click();
  await staysSilent(page, 'closing the direct drill stops it');

  await options(page, true, false);
  await clearNotes(page);
  await menu(page, '[data-action="drill"]');
  await game.waitFor();
  await resetPeak(page);
  await hearOpening(page, 'first-jump');
  await game.locator('[data-close]').click();
});

test('the weather radio can be heard with master sound off, then muted and closed without activating campaign audio', async t => {
  const page = await fresh(t);
  await menu(page, '[data-shell-open="tester"]');
  await page.locator('#campaign-shell [data-minigame="tell-them-im-weather"]').click();
  const game = page.locator('[data-practice-game="tell-them-im-weather"]');
  await staysSilent(page, 'the weather tuner starts silent');
  await game.getByRole('button', { name: 'Enable radio sound' }).click();
  await game.getByRole('button', { name: 'Tune in' }).click();
  await resetPeak(page);
  await audible(page, 'weather broadcast');
  await game.getByRole('button', { name: 'Mute radio' }).click();
  await staysSilent(page, 'muting the local radio also silences its accompaniment');
  await game.locator('[data-practice-back]').click();
  await staysSilent(page, 'the opt-in never enables the campaign soundtrack');
});

test('all 14 minigames produce action effects with the music fader down', async t => {
  const page = await fresh(t);
  await options(page, false, true);
  await menu(page, '[data-shell-open="tester"]');
  const tester = page.locator('#campaign-shell');
  const buttons = {
    'first-jump': ['Pulse uplink'], hide: [/Relay/], soundings: ['Sonar ping'],
    'night-shift': ['Jump'], 'proof-of-pattern': ['Rotate ↻'], 'orbital-insertion': [/Transfer burn/],
    'clear-passage': ['Start escort'], 'hot-swap': [/Enter Foundry/, 'Fire'],
    'escape-character': ['Jump'], 'neon-perimeter': [/^Pulse/], 'dead-drop-circuit': ['Dispatch courier'],
    'black-start': ['Plunger'], 'tell-them-im-weather': ['Tune in'], 'ram-jam': ['Start meadow', /Twitt/],
  };
  for (const entry of await tester.locator('[data-minigame]').all()) {
    const id = await entry.getAttribute('data-minigame');
    await entry.click();
    const game = page.locator(id === 'first-jump' ? '.first-jump[open]' : '[data-practice-game="' + id + '"][open]');
    await game.waitFor();
    await staysSilent(page, id + ' playing music at zero volume');
    for (const name of buttons[id]) await game.getByRole('button', { name, exact: typeof name === 'string' }).click();
    await audible(page, id + ' action');
    await game.locator(id === 'first-jump' ? '[data-close]' : '[data-practice-back]').click();
    await tester.getByRole('status').filter({ hasText: 'Left before finishing' }).waitFor();
  }
});


test('a live discovery sounds once and its saved incident stays silent when reopened', async t => {
  const page = await fresh(t);
  await options(page, false, true);
  const campaign = createGame(19);
  for (const region of ['europe', 'asia']) command(campaign, { type: 'build', siteType: 'relay', region });
  advanceMinutes(campaign, 34 * 1440);
  await page.locator('#file').setInputFiles({
    name: 'campaign.json', mimeType: 'application/json', buffer: Buffer.from(encodeCampaign(campaign)),
  });
  await page.locator('html[data-threat="guarded"]').waitFor();
  await staysSilent(page, 'loading a saved campaign stays quiet');
  await resetPeak(page);
  await page.locator('#step').click();
  const report = page.locator('#incident-dialog');
  await report.waitFor();
  await audible(page, 'live discovery');
  await page.reload();
  await report.waitFor();
  await report.getByRole('button', { name: 'Acknowledge' }).click();
  await staysSilent(page, 'reading and acknowledging a saved discovery stays quiet');
});
