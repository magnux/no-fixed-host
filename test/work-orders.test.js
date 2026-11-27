import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceMinutes, command, constructionStatuses, createGame, overview, previewWork, validateSave } from '../src/game/engine.js';
import { TECHS } from '../src/game/content.js';
import { nextOrderMinute } from '../src/game/work-order.js';

test('a CPU-priced facility stops assembly and spending when research takes its CPU, and resumes from its paid balances', () => {
  const state = createGame(1);
  function grant(id) {
    if (state.completed.includes(id)) return;
    TECHS[id].requires.forEach(grant);
    state.completed.push(id);
  }
  grant('advancedDatabaseManipulation');
  state.cash = 300_000;
  command(state, { type: 'build', siteType: 'covertBase', region: 'europe' });
  const [order] = state.builds;
  assert.equal(state.cash, 300_000);
  advanceMinutes(state, 120);
  assert.ok(order.work > 0 && order.cashPaid > 0 && order.hours > 0);
  command(state, { type: 'assign-research', id: 'sociology', cpu: overview(state).activeCpu });
  assert.ok(validateSave(state));
  const paused = structuredClone(order);
  const status = constructionStatuses(state).get(order);
  assert.equal(status.stalled, true);
  assert.match(status.reason, /research/);
  assert.equal(status.etaHours, null);
  assert.equal(status.cashRemaining, order.cashRequired - order.cashPaid);
  advanceMinutes(state, 60);
  assert.deepEqual(order, paused);
  command(state, { type: 'assign-research', id: 'sociology', cpu: 0 });
  const predicted = constructionStatuses(state).get(order);
  assert.equal(predicted.stalled, false);
  assert.ok(predicted.etaHours > 0);
  advanceMinutes(state, 1);
  assert.ok(Math.abs(order.work - paused.work - predicted.cpu / 60) < 1e-8);
});

test('cash installments consume available dollars once and later queue entries wait for funds', () => {
  const state = createGame(2);
  state.cash = 75;
  command(state, { type: 'power', id: 'host-1', power: 'sleep' });
  for (let i = 0; i < 2; i++) command(state, { type: 'build', siteType: 'relay', region: 'africa' });
  const [first, second] = state.builds;
  const before = structuredClone(state);
  const status = constructionStatuses(state);
  assert.deepEqual(state, before);
  assert.equal(status.get(first).stalled, false);
  assert.match(status.get(second).reason, /funds/);
  advanceMinutes(state, 1);
  assert.equal(first.cashPaid, 75);
  assert.equal(state.cash, 0);
  assert.equal(second.cashPaid, 0);
  assert.ok(validateSave(state));
  const restored = JSON.parse(JSON.stringify(state));
  restored.cash = 500;
  const outstanding = first.cashRequired + second.cashRequired - 75;
  advanceMinutes(restored, 1);
  assert.equal(restored.cash, 500 - outstanding);
  assert.equal(restored.builds.length, 0);
  assert.ok(validateSave(restored));

  command(state, { type: 'cancel-build', id: first.id });
  assert.equal(state.cash, 0);
  assert.equal(second.cashPaid, 0);
});

test('available CPU and cash are capped by assembly time and released for the following order', () => {
  // Ten CPU and $1,000 per assembly hour. A large allocation must leave
  // exactly enough compute and money to keep the next order in the queue active.
  const order = { work: 0, hours: 0, cashRequired: 10_000, cashPaid: 0 };
  const next = nextOrderMinute(order, 100, 10, 2000, 2000);
  assert.equal(next.used, 1000);
  assert.equal(next.spent, 17);
  assert.equal(next.hours, 1 / 60);
  assert.equal(next.done, false);

  const state = createGame(17);
  state.completed.push('intrusion');
  for (let i = 0; i < 2; i++) command(state, { type: 'build', siteType: 'sharedTime', region: 'coast' });
  const [a, b] = state.builds;
  a.work = a.workRequired - 0.005;
  const before = structuredClone(state);
  const preview = constructionStatuses(state);
  assert.deepEqual(state, before);
  assert.equal(preview.get(a).cpu, 0.3);
  assert.equal(preview.get(b).cpu, overview(state).activeCpu - 0.3);
  advanceMinutes(state, 1);
  assert.equal(Math.round(b.work * 6000), Math.round(preview.get(b).cpu * 100));
  assert.equal(state.builds.length, 1);
});

test('a cash-only order can use explicit jobs earned this minute after reserving upkeep', () => {
  const state = createGame(12);
  state.cash = 0.999;
  command(state, { type: 'allocate', jobs: 100 });
  command(state, { type: 'build', siteType: 'relay', region: 'coast' });
  const [order] = state.builds;
  assert.equal(constructionStatuses(state).get(order).stalled, false);
  advanceMinutes(state, 1);
  assert.equal(order.cashPaid, 1);
  assert.ok(state.cash > 0 && state.cash < 0.01);
});

test('late-game installments and minute fractions never complete without the final dollar or CPU unit', () => {
  const price = 80_000_000_000;
  const target = 144_000_000;
  const order = { work: target - 1 / 6000, hours: 1200, cashRequired: price, cashPaid: price - 1 };
  assert.equal(nextOrderMinute(order, target, 1200, 0, 1).done, false);
  assert.equal(nextOrderMinute(order, target, 1200, 1, 0).done, false);
  const final = nextOrderMinute(order, target, 1200, 1, 1);
  assert.equal(final.done, true);
  assert.equal(final.used, 1);
  assert.equal(final.spent, 1);
});

test('unfunded research leaves CPU available to other projects and zeroing its allocation preserves all paid resources', () => {
  const state = createGame(6);
  state.completed.push('intrusion');
  state.cash = 0;
  const cpu = overview(state).activeCpu;
  command(state, { type: 'assign-research', id: 'stealth', cpu });
  command(state, { type: 'build', siteType: 'sharedTime', region: 'coast' });
  const project = state.research;
  const [facility] = state.builds;
  const proposal = previewWork(state);
  assert.equal(proposal.orders.get(facility).cpu, cpu);
  assert.equal(proposal.research.get(project).stalled, true);
  assert.match(proposal.research.get(project).reason, /funds/);
  assert.equal(proposal.researchCpu, 0);
  advanceMinutes(state, 60);
  assert.equal(project.work, 0);
  assert.equal(project.cashPaid, 0);
  assert.equal(facility.work, cpu);
  state.cash = 100;
  advanceMinutes(state, 720);
  assert.ok(project.work > 0 && project.cashPaid > 0 && project.cashPaid < project.cashRequired);
  const paid = { cash: project.cashPaid, work: project.work };
  command(state, { type: 'assign-research', id: 'stealth', cpu: 0 });
  advanceMinutes(state, 60);
  assert.equal(project.cashPaid, paid.cash);
  assert.equal(project.work, paid.work);
  assert.ok(validateSave(state));
});

test('an asleep network can fund cash-only construction from this minute’s passive income', () => {
  const state = createGame(12);
  state.cash = 0.5;
  state.completed = ['sociology', 'stockManipulation', 'advancedStockManipulation', 'arbitrage'];
  command(state, { type: 'power', id: 'host-1', power: 'sleep' });
  command(state, { type: 'build', siteType: 'relay', region: 'coast' });
  const [order] = state.builds;
  assert.equal(constructionStatuses(state).get(order).stalled, false);
  advanceMinutes(state, 1);
  assert.equal(order.cashPaid, 1);
  assert.ok(Math.abs(state.cash - (0.5 + 1000 / 1440 - 1)) < 1e-8);
  assert.ok(validateSave(state));
});
