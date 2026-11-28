import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_NEWS } from '../src/game/events.js';
import { localizedDispatch, localizedStory, localizedWarning } from '../src/ui/dispatch-translations.js';
import { currentWarnings } from '../src/game/chronicle.js';
import { createGame } from '../src/game/engine.js';

const languages = ['de', 'es', 'es-AR', 'es-MX', 'fr', 'gd', 'it', 'pt-BR', 'ru', 'sv'];

test('each reference world story has a translated headline, account and correctly signed effect in every campaign language', () => {
  for (const language of languages) {
    for (const [storyId, rule] of Object.entries(WORLD_NEWS)) {
      const news = {kind:'news.world', storyId, hour:0, minute:1, text:rule.report, headline:rule.headline};
      const {report, headline} = localizedStory(storyId, language);
      assert.notEqual(headline, rule.headline);
      assert.notEqual(report, rule.report);
      const presented = localizedDispatch(news, language);
      assert.equal(presented.headline, headline);
      assert.ok(presented.text.startsWith(report));
      assert.ok(presented.text.includes(rule.modifier > 0 ? '+10' : '−10'));
      if (rule.days) assert.match(presented.text, /23/);
      assert.doesNotMatch(presented.text, /undefined/);
      assert.strictEqual(localizedDispatch(news, 'en'), news);
      if (rule.days) {
        const ended = localizedDispatch({...news, kind:'news.expired'}, language);
        assert.ok(ended.headline.includes(headline));
        assert.doesNotMatch(ended.text, /[+−]10/);
      }
    }
  }
});

test('warning bodies and stalled-order reasons can be read in every campaign language', () => {
  const warn = {id:'stalledBuild', title:'Facility or equipment order paused', text:'Original text',
    orderName:'Proyecto Águila', customName:true, reason:'Waiting for project funds', otherOrders:2};
  for (const language of languages) {
    for (const warning of currentWarnings(createGame())) {
      const localized = localizedWarning(warning, language);
      assert.notEqual(localized.title, warning.title);
      assert.notEqual(localized.text, warning.text);
    }
    const stalled = localizedWarning(warn, language);
    assert.ok(stalled.text.includes('Proyecto Águila'));
    assert.ok(stalled.text.includes('2'));
    assert.ok(!stalled.text.includes(warn.reason));
    assert.notEqual(stalled.title, warn.title);
  }
});

test('native report metadata is localized while player names and unfamiliar expansion entries remain intact', () => {
  const site = {siteType:'relay', siteName:'Leased relay', siteId:'host-3', region:'europe', text:'Original English'};
  const discovery = {...site, kind:'site.discovered', group:'news', suspicionDelta:1000, underConstruction:true};
  for (const language of languages) {
    for (const kind of ['site.online','site.failed','equipment.installed','site.discovered']) {
      const translated = localizedDispatch({...discovery, kind, count:3, itemId:'pc'},language);
      assert.notEqual(translated.text, site.text);
      assert.ok(translated.text.includes(site.siteName));
      assert.doesNotMatch(translated.text, /undefined/);
    }
  }
  assert.match(localizedDispatch(discovery,'es-MX').text,/obras.*clausuradas/);
  assert.match(localizedDispatch({...discovery, underConstruction:false},'es-MX').text,/perdido el servidor/);
  assert.match(localizedDispatch({...discovery, siteName:undefined},'es').text,/Repetidor alquilado/);
  assert.match(localizedDispatch({kind:'research.completed',techId:'intrusion',text:'finding'},'es-AR').text,/Investigación completada/);
  for (const kind of ['sandbox.changed','news.bulletin','facility.custom']) {
    const event = {...site, kind, headline:'A new event'};
    assert.strictEqual(localizedDispatch(event,'pt-BR'),event);
  }
});
