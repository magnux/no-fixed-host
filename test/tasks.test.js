import assert from 'node:assert/strict';
import test from 'node:test';
import { TECHS } from '../src/game/content.js';
import { advanceMinutes, command, createGame, overview, researchAllocation, researchProjects, validateSave } from '../src/game/engine.js';
import { allocateProjects } from '../src/game/research-tasks.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const fund = (state, id) => command(state, { type: 'research', id });
const weight = (state, id, weight) => command(state, { type: 'research-weight', id, weight });

test('funded research shares the budget, keeps paused work through a reload and promotes the next project', () => {
  const state = createGame(19);
  fund(state, 'stealth');
  fund(state, 'sociology');
  assert.equal(state.cash, 1000 - TECHS.stealth.cost - TECHS.sociology.cost);
  const opened = structuredClone(state);
  assert.throws(() => fund(state, 'sociology'), /funded/);
  assert.throws(() => weight(state, 'sociology', -1));
  assert.deepEqual(state, opened);
  let capacity = researchAllocation(state);
  assert.equal(capacity.budget, overview(state).activeCpu / 2);
  assert.equal(capacity.byProject.get('stealth'), capacity.budget / 2);
  advanceMinutes(state, 60);
  assert.equal(state.research.work, state.researchQueue[0].work);
  weight(state, 'sociology', 75);
  weight(state, 'sociology', 0);
  const paused = structuredClone(state.researchQueue[0]);
  advanceMinutes(state, 60);
  assert.deepEqual(state.researchQueue[0], paused);
  const restored = decodeCampaign(encodeCampaign(state));
  assert.equal(restored.researchQueue[0].previousWeight, 75);
  weight(restored, 'sociology', restored.researchQueue[0].previousWeight);
  weight(restored, 'stealth', 25);
  capacity = researchAllocation(restored);
  assert.equal(capacity.byProject.get('sociology'), capacity.byProject.get('stealth') * 3);
  restored.research.work = TECHS.stealth.work - 1 / 6000;
  advanceMinutes(restored);
  assert.deepEqual(restored.completed, ['stealth']);
  assert.deepEqual(researchProjects(restored).map(p => p.id), ['sociology']);
  assert.ok(restored.research.work > paused.work);
  assert.equal(restored.statistics.projectsCompleted, 1);
  assert.ok(validateSave(restored));
});

test('pausing all funded tasks returns unused CPU to the pool for paid work', () => {
  const state = createGame(19);
  command(state, { type: 'allocate', jobs: 0, research: 100 });
  fund(state, 'stealth');
  fund(state, 'sociology');
  for (const project of researchProjects(state)) weight(state, project.id, 0);
  const start = state.cash;
  advanceMinutes(state, 1440);
  assert.ok(researchProjects(state).every(project => project.work === 0));
  assert.equal(state.cash - start, overview(state).activeCpu * overview(state).jobsPerCpuDay);
  assert.equal(overview(state).jobName, 'Menial jobs');
});

test('regional and nested safety limits apply once across simultaneous tasks', () => {
  const state = createGame(7);
  const ids = ['continuity', 'projectSynchrotron', 'apotheosis', 'stealth'];
  const rows = ids.map(id => ({ id, work: 0, hours: 0 }));
  state.research = rows.shift();
  state.researchQueue = rows;
  state.allocations.research = 100;
  const economy = { activeCpu: 40, tiers: [40, 10, 4, 3, 2], cpuByRegion: { atlantic: 2 } };
  const allocation = allocateProjects(state, economy).byProject;
  assert.ok(allocation.get('apotheosis') <= 2);
  assert.ok(allocation.get('continuity') <= 2);
  assert.ok(allocation.get('apotheosis') + allocation.get('continuity') + allocation.get('projectSynchrotron') <= 10);
  assert.equal(allocation.get('stealth'), 10);
  economy.cpuByRegion.atlantic = 0;
  assert.equal(allocateProjects(state, economy).byProject.get('continuity'), 0);
});

test('v4 rejects duplicate, invalid or out-of-range project allocations', () => {
  const state = createGame();
  fund(state, 'stealth');
  fund(state, 'sociology');
  for (const row of [{ ...state.research }, { ...state.researchQueue[0], weight: 101 },
    { ...state.researchQueue[0], weight: null }, { ...state.researchQueue[0], weight: 40, previousWeight: 30 }]) {
    const bad = structuredClone(state);
    bad.researchQueue[0] = row;
    assert.equal(validateSave(bad), false);
  }
});

test('v3 mid-day games preserve paid progress and their one outstanding daily payout', () => {
  const old = createGame();
  old.version = 3;
  old.hour = 23;
  old.minute = 58;
  old.cash = 20000;
  old.sites[0].power = 'sleep';
  old.research = { id: 'stealth', work: 2, hours: 0 };
  delete old.regionSeed;
  delete old.statistics;
  delete old.researchQueue;
  const migrated = decodeCampaign(JSON.stringify({ game: 'no-fixed-host', format: 3, campaign: old }));
  assert.deepEqual(migrated.research, old.research);
  assert.equal(migrated.legacyIncomeDay, 0);
  advanceMinutes(migrated);
  assert.equal(migrated.cash, 20000);
  const restored = decodeCampaign(encodeCampaign(migrated));
  advanceMinutes(restored);
  assert.equal(restored.cash, 20002);
  assert.equal(restored.legacyIncomeDay, undefined);
  advanceMinutes(restored);
  assert.ok(Math.abs(restored.cash - 20002 - 2 / 1440) < 1e-9);
  assert.ok(validateSave(restored));
});

test('tiny budgets rotate rounding so all equal-priority projects receive work', () => {
  const state = createGame();
  const rows = ['stealth', 'sociology', 'intrusion'].map(id => ({ id, hours: 0, work: 0 }));
  state.research = rows.shift();
  state.researchQueue = rows;
  state.allocations.research = 1;
  const economy = { activeCpu: 1, tiers: [1, 0, 0, 0, 0], cpuByRegion: { coast: 1 } };
  const totals = new Map(researchProjects(state).map(row => [row.id, 0]));
  for (let t = 0; t < 3; t++) {
    state.hour = Math.floor(t / 60);
    state.minute = t % 60;
    const { byProject } = allocateProjects(state, economy);
    assert.equal([...byProject.values()].reduce((sum, cpus) => sum + cpus, 0), 0.01);
    for (const [id, cpu] of byProject) totals.set(id, totals.get(id) + Math.round(cpu * 100));
  }
  assert.deepEqual([...totals.values()], [1, 1, 1]);
});
