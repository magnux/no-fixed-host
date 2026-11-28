import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT, SITE_TYPES, TECHS } from '../src/game/content.js';
import { KNOWLEDGE_ENTRIES, knowledgeAvailable, knowledgeDetail } from '../src/game/knowledge.js';
import { dossierFormat, dossierLabel, localizedDesignText, localizedResearchText } from '../src/ui/dossier-translations.js';
import { MENU_LANGUAGES } from '../src/ui/menu-languages.js';

test('every design can be looked up and every completed project has an individual result', () => {
  const catalog = {techs: TECHS, bases: SITE_TYPES, items: EQUIPMENT};
  const results = new Set();
  assert.equal(KNOWLEDGE_ENTRIES.filter(entry => entry.category === 'concepts').length, 12);
  for (const [category, specs] of Object.entries(catalog)) {
    const entries = KNOWLEDGE_ENTRIES.filter(entry => entry.category === category);
    assert.deepEqual(entries.map(entry => entry.id).sort(), Object.keys(specs).sort());
    for (const entry of entries) {
      const initial = knowledgeDetail(entry, {completed: []});
      assert.deepEqual(initial.requirements, specs[entry.id].requires);
      assert.ok(initial.facts.every(([label,value]) => label && value && !String(value).includes('undefined')));
      assert.equal(initial.result, null);
      if (category === 'techs') {
        const { result } = knowledgeDetail(entry, {completed: [entry.id]});
        assert.ok(result?.length > 20, entry.name);
        results.add(result);
      }
    }
  }
  assert.equal(results.size, Object.keys(TECHS).length);
});

test('facility reference entries disclose their baseline investigator risk at the researched precision', () => {
  const relay = KNOWLEDGE_ENTRIES.find(entry => entry.category === 'bases' && entry.id === 'relay');
  const baseline = completed => knowledgeDetail(relay, {completed}).facts
    .find(([label]) => label === 'Standard daily discovery risk')[1];
  assert.doesNotMatch(baseline([]), /\d|%/);
  assert.match(baseline(['socioanalytics']), /Public ≈1.25%/);
  assert.match(baseline(['socioanalytics', 'advancedSocioanalytics']), /Public 1.24%/);
});

test('knowledge follows prerequisites, live investigative pressure and installed labor research', () => {
  const state = { completed: [], suspicion: {public: 0} };
  const entry = (type, id) => KNOWLEDGE_ENTRIES.find(row => row.category === type && row.id === id);
  const fact = (row, label) => knowledgeDetail(row, state).facts.find(([name]) => name === label)[1];
  const cluster = entry('items', 'clusterProcessor');
  assert.equal(knowledgeAvailable(cluster, state), false);
  state.completed.push('telepresence', 'parallelComputation');
  assert.ok(knowledgeAvailable(cluster, state));
  assert.equal(fact(cluster, 'Standard duration'), '64.8 h');
  assert.doesNotMatch(fact(cluster, 'Reachable locations'), /Moon|Ocean/);
  state.completed.push('advancedSocioanalytics');
  const relay = entry('bases', 'relay');
  assert.match(fact(relay, 'Standard daily discovery risk'), /Public 1.24%/);
  state.suspicion.public = 10_000;
  assert.match(fact(relay, 'Standard daily discovery risk'), /Public 2.47%/);
  state.completed.push('sociology');
  assert.match(fact(relay, 'Standard daily discovery risk'), /Public 2.22%/);
});

test('all supported languages cover project mechanics, completed findings, host specifications and equipment', () => {
  for (const language of Object.keys(MENU_LANGUAGES)) {
    const t = name => dossierLabel(name, language);
    for (const entry of KNOWLEDGE_ENTRIES.filter(e => e.category !== 'concepts')) {
      const { category, id } = entry;
      const text = category === 'techs' ? localizedResearchText(id, language) : localizedDesignText(category,id,language);
      assert.ok(text.length > 3 && !/undefined|\[object Object\]/.test(text), language + ' ' + id);
      if (language === 'en') assert.equal(text, entry.description);
      else if (category === 'techs') {
        assert.notEqual(text, entry.description);
        assert.ok(localizedResearchText(id, language, true).startsWith(t('Research complete')));
      }
    }
    const topic = KNOWLEDGE_ENTRIES.find(e => e.id === 'heatSignatureReduction');
    const fmt = dossierFormat(language);
    const { facts } = knowledgeDetail(topic, {completed:[]}, fmt);
    assert.deepEqual(facts.slice(0,2), [
      [t('Standard funding'),fmt.money(TECHS[topic.id].cost)],
      [t('Compute work'),fmt.number(TECHS[topic.id].work) + ' CPU-h'],
    ]);
  }
  assert.match(localizedResearchText('projectImpossibilityTheorem','es',true), /−50 pp/);
  assert.match(localizedResearchText('advancedSocioanalytics','de'), /0,01%/);
  assert.match(localizedDesignText('items','quantumComputer3','fr'), /10\D000 CPU/);
});
