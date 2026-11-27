import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT, SITE_TYPES, TECHS } from '../src/game/content.js';
import { KNOWLEDGE_ENTRIES, knowledgeDetail } from '../src/game/knowledge.js';

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
