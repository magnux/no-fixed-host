import assert from 'node:assert/strict';
import test from 'node:test';
import { TECHS } from '../src/game/content.js';
import { advanceMinutes, command, createGame, researchMarketQuote, validateSave } from '../src/game/engine.js';
import { projectResources } from '../src/game/reports.js';

const buy = (s, id) => command(s, { type: 'license-research', id });
const rent = (s, id) => command(s, { type: 'rent-research', id });
const assign = (s, id, cpu) => command(s, { type: 'assign-research', id, cpu });

test('market quotes follow catalog depth, credit prior work and preserve safety gates', () => {
  const s = createGame(15);
  for (const [id, expected] of Object.entries({
    intrusion: 60, personalIdentification: 1875, voiceSynthesis: 248000,
    advancedQuantumComputing: 1845800000, lunarRocketry: 385000000,
  })) assert.equal(researchMarketQuote(s, id).license.price, expected);
  assert.throws(() => buy(s, 'personalIdentification'), /prerequisites/);
  for (const id of ['fusionPower', 'fusionRocketry', 'advancedFusionPower', 'spaceTimeManipulation', 'apotheosis', 'continuity']) {
    assert.throws(() => buy(s, id), /Field research/);
    assert.throws(() => rent(s, id), /Field research/);
  }
  assign(s, 'intrusion', 1);
  advanceMinutes(s, 60 * 6);
  assert.equal(researchMarketQuote(s, 'intrusion').license.price, 59);
  const before = s.cash;
  buy(s, 'intrusion');
  assert.equal(s.cash, before - 59);
  assert.deepEqual(s.completed, ['intrusion']);
  assert.equal(s.statistics.projectsCompleted, 1);
  assert.throws(() => buy(s, 'intrusion'), /complete/);
  assert.equal(s.research, null);
  assert.ok(validateSave(s));
  s.completed = Object.keys(TECHS).filter(id => id !== 'lunarRocketry');
  assert.throws(() => buy(s, 'lunarRocketry'), /eligible research host/);
});

test('licensed fieldwork saves and finishes only while a real host is awake', () => {
  const s = createGame();
  s.completed.push('intrusion', 'personalIdentification');
  s.cash = 10_000;
  assign(s, 'contracts', 1);
  advanceMinutes(s, 60);
  const clock = s.research.hours;
  buy(s, 'contracts');
  assert.equal(s.research.hours, clock);
  assert.equal(s.research.work, TECHS.contracts.work);
  assert.equal(s.research.cpu, 0);
  assert.ok(validateSave(s));
  assert.throws(() => assign(s, 'contracts', 1), /licensed/);
  command(s, { type: 'power', id: 'host-1', power: 'sleep' });
  advanceMinutes(s, 60);
  assert.equal(s.research.hours, clock);
  command(s, { type: 'power', id: 'host-1', power: 'active' });
  advanceMinutes(s, Math.round((24 - clock) * 60) - 1);
  assert.equal(s.completed.includes('contracts'), false);
  advanceMinutes(s);
  assert.ok(s.completed.includes('contracts'));
  assert.ok(validateSave(s));
});

test('escrow bills only rented CPU-hours delivered and returns the rest without income', () => {
  const s = createGame();
  buy(s, 'intrusion');
  assign(s, 'personalIdentification', 1);
  const q = researchMarketQuote(s, 'personalIdentification');
  assert.equal(q.rental.deposit, 8);
  rent(s, 'personalIdentification');
  assert.equal(s.cash, 932);
  advanceMinutes(s, 60);
  assert.equal(s.research.work, 2);
  assert.equal(s.research.rental.deliveredUnits, 6000);
  assert.ok(validateSave(s));
  const bad = structuredClone(s);
  bad.research.rental.deposit += 1;
  assert.equal(validateSave(bad), false);
  const start = s.statistics.earnedDollars;
  const closing = s.cash;
  command(s, { type: 'cancel-research-rental', id: 'personalIdentification' });
  assert.equal(s.cash, closing + 7.6875);
  assert.equal(s.statistics.earnedDollars, start);
  assert.throws(() => command(s, { type: 'cancel-research-rental', id: 'personalIdentification' }), /No active/);
  assert.ok(validateSave(s));
});

test('a paused rental expires at 24 hours, credits the unused funds and forecasts the same balance', () => {
  const s = createGame();
  assign(s, 'intrusion', 1);
  rent(s, 'intrusion');
  assign(s, 'intrusion', 0);
  const report = projectResources(s);
  advanceMinutes(s, 1439);
  assert.ok(s.research.rental);
  advanceMinutes(s);
  assert.equal(s.research.rental, undefined);
  assert.equal(s.research.work, 0);
  assert.equal(s.cash, 1005);
  assert.equal(report.cash.closing, s.cash);
  assert.ok(validateSave(s));
});

test('completion refunds a nearly finished rental and licensing repeats no one-time effects', () => {
  const s = createGame();
  assign(s, 'intrusion', 1);
  s.research.work = 359;
  rent(s, 'intrusion');
  advanceMinutes(s, 30);
  assert.equal(s.cash, 1000 - .15625);
  assert.equal(s.completed[0], 'intrusion');
  assert.equal(s.research, null);
  assert.ok(validateSave(s));

  const id = 'projectImpossibilityTheorem';
  const learn = name => {
    if (!s.completed.includes(name)) {
      TECHS[name].requires.forEach(learn);
      s.completed.push(name);
    }
  };
  TECHS[id].requires.forEach(learn);
  s.cash = 500_000_000;
  s.suspicion.science = 8500;
  buy(s, id);
  assert.equal(s.suspicion.science, 3500);
  assert.throws(() => buy(s, id), /complete/);
  assert.equal(s.suspicion.science, 3500);
});

test('host bursts increase local work while only matching ordinary CPUs earn rented capacity', () => {
  const s = createGame(47);
  command(s, { type: 'boost-site', id: 'host-1', active: true });
  assign(s, 'intrusion', 2);
  assert.equal(researchMarketQuote(s, 'intrusion').rental.capacity, 100);
  rent(s, 'intrusion');
  advanceMinutes(s, 60);
  assert.equal(s.research.work, 3);
  assert.equal(s.research.rental.deliveredUnits, 6000);
  assert.ok(validateSave(s));
});

test('extra time-limited research accepts only work beyond the native allocation', () => {
  const s = createGame(47);
  s.completed = ['intrusion', 'personalIdentification'];
  command(s, { type: 'build', siteType: 'relay', region: 'europe' });
  command(s, { type: 'build', siteType: 'relay', region: 'africa' });
  advanceMinutes(s);
  assign(s, 'contracts', 5);
  rent(s, 'contracts');
  advanceMinutes(s, 60);
  const billed = s.research.rental.deliveredUnits;
  assert.ok(billed > 0);
  assert.equal(billed, (s.research.work - 5) * 6000);
  assign(s, 'contracts', 20);
  advanceMinutes(s, 60);
  // The fieldwork clock now caps useful work below the native assignment.
  assert.equal(s.research.rental.deliveredUnits, billed);
  assert.ok(validateSave(s));
});
