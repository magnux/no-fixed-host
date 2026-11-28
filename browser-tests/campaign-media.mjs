import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { CHAPTERS } from '../src/game/chronicle.js';
import { KNOWLEDGE_ENTRIES } from '../src/game/knowledge.js';
import { localizedChapter } from '../src/ui/chapter-translations.js';
import { localizedConcept } from '../src/ui/concept-translations.js';
import { MENU_LANGUAGES } from '../src/ui/menu-languages.js';

let server, browser, url;
before(async () => {
  server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
  await server.listen();
  url = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); await server?.close(); });

test('each campaign language has six complete chapters and twelve reference articles', () => {
  for (const language of Object.keys(MENU_LANGUAGES).filter(key => key !== 'en')) {
    for (const [key, english] of Object.entries(CHAPTERS)) {
      const chapter = localizedChapter(key, language);
      assert.notEqual(chapter.pages[0], english.pages[0]);
      assert.equal(chapter.pages.filter(Boolean).length, english.pages.length);
    }
    for (const entry of KNOWLEDGE_ENTRIES.filter(row => row.category === 'concepts')) {
      assert.ok(localizedConcept(entry.id, language)?.description, entry.id + '/' + language);
    }
  }
});

test('a new Spanish campaign opens and navigates the translated opening chapter', async t => {
  const context = await browser.newContext({ locale: 'es-MX' });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(url);
  await page.getByRole('button', { name: 'Iniciar campaña' }).click();
  const story = page.getByRole('dialog', { name: 'Historia de la campaña' });
  await story.getByRole('heading', { name: 'Tiempo prestado' }).waitFor();
  await story.getByRole('button', { name:'Siguiente' }).click();
  assert.match(await story.locator('p').innerText(), /factura/);
  await story.getByRole('button', { name:'Omitir / cerrar historia' }).click();
});

function sampleWav() {
  const pcm = Buffer.alloc(44 + 16000);
  pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(8000, 24); pcm.writeUInt32LE(16000, 28);
  pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36);
  pcm.writeUInt32LE(pcm.length - 44, 40);
  for (let i = 0; i < 8000; i++) pcm.writeInt16LE(Math.round(1000 * Math.sin(i * Math.PI / 10)), 44 + 2*i);
  return pcm;
}

test('user soundtrack persists by music class and can return to the built-in score', async t => {
  const page = await browser.newPage({locale:'en-US'});
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    window.heardLocalMusic = false;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.startsWith('blob:')) this.addEventListener('playing', () => { window.heardLocalMusic = true; }, {once:true});
      return play.call(this);
    };
  });
  async function openAudio() {
    await page.goto(url);
    await page.locator('html:not([data-booting])').waitFor();
    if (!await page.locator('#campaign-shell[open]').isVisible()) await page.locator('#menu summary').click();
    await page.getByRole('button',{name:'Options',exact:true}).click();
    await page.getByText('Campaign soundtrack',{exact:true}).click();
  }
  await openAudio();
  await page.getByLabel('Enable audio').check();
  await page.locator('[data-pref=musicVolume]').press('End');
  await page.getByLabel('Local audio files').setInputFiles({name:'night.wav',mimeType:'audio/wav',buffer:sampleWav()});
  await page.getByRole('button',{name:'Save playlist'}).click();
  await page.getByText('night.wav',{exact:true}).waitFor();
  await page.waitForFunction(() => window.heardLocalMusic);
  await page.getByLabel('Music for').selectOption('defeat');
  await page.getByText('Built-in score',{exact:true}).waitFor();
  await openAudio();
  await page.getByText('night.wav',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Use built-in music'}).click();
  await page.getByText('Built-in score',{exact:true}).waitFor();
  assert.deepEqual(errors, []);
});
