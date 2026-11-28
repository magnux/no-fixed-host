import assert from 'node:assert/strict';
import test from 'node:test';
import { TECHS } from '../src/game/content.js';
import { advanceMinutes, command, createGame, overview, researchAllocation, researchCpuLimit,
  researchProjects, researchResizeLimit, validateSave } from '../src/game/engine.js';
import { allocateProjects, portfolioLimit, resizePortfolio, taskReservations } from '../src/game/research-tasks.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const assign = (state, id, cpu) => command(state, { type: 'assign-research', id, cpu });
const resize = (state, cpu) => command(state, { type: 'resize-research', cpu });
const cpus = state => Object.fromEntries(researchAllocation(state).byProject);
const reload = state => decodeCampaign(encodeCampaign(state));

test('absolute job and pool reservations protect CPU across growth, loss and reload', () => {
  const state = createGame(19);
  state.completed.push('intrusion');
  const task = (id, cpu) => command(state, { type: 'assign-task', task: id, cpu });
  const reservations = () => taskReservations(state, overview(state));
  task('jobs', 0.25);
  task('pool', 0.4);
  assign(state, 'stealth', 0.35);
  assert.deepEqual(reservations(), {jobs: 0.25, pool: 0.4, researchLimit: 0.35});
  assert.throws(() => task('pool', 0.41));
  assert.throws(() => task('jobs', 0.26));
  assert.throws(() => assign(state, 'stealth', 0.36));
  const extra = { id: 'host-2', type: 'sharedTime', region: 'europe', power: 'active', startedAt: 0 };
  state.sites.push(extra);
  state.nextSiteId++;
  assert.deepEqual(reservations(), {jobs: 0.25, pool: 0.4, researchLimit: 1.35});
  assert.equal(researchCpuLimit(state, 'sociology'), 1);
  const restored = reload(state);
  assert.deepEqual(taskReservations(restored, overview(restored)), reservations());
  task('pool', 1.4);
  command(state, {type: 'power', id: extra.id, power: 'sleep'});
  assert.deepEqual(reservations(), {jobs: 0, pool: 1, researchLimit: 0});
  assert.equal(researchAllocation(state).budget, 0);
  command(state, {type: 'power', id: extra.id, power: 'active'});
  assert.equal(researchAllocation(state).budget, 0.35);
  task('pool', 0);
  command(state, {type: 'allocate', jobs: 50});
  assert.equal(reservations().jobs, 1);
  assert.equal(state.allocations.jobsCpu, undefined);
  command(state, {type: 'power', id: extra.id, power: 'sleep'});
  assert.equal(reservations().jobs, 0.5);
  for (const bad of [Infinity, -1, 0.001]) {
    assert.throws(() => task('jobs', bad));
    assert.equal(validateSave({...state, allocations: {...state.allocations, poolCpu: bad}}), false);
  }
});

test('direct CPU assignment funds once, uses only idle capacity and releases paid progress', () => {
  const s = createGame(19);
  assert.equal(researchResizeLimit(s), 0);
  assert.equal(researchAllocation(s).budget, 0);
  command(s,{type:'allocate', jobs:25});
  assign(s,'intrusion',0);
  assert.equal(s.research, null);
  assign(s,'stealth',0.5);
  assert.equal(researchCpuLimit(s,'sociology'),0.25);
  const before = structuredClone(s);
  for (const invalid of [0.26, Infinity, -1, 0.001, '1']) {
    assert.throws(() => assign(s,'sociology',invalid));
    assert.deepEqual(s,before);
  }
  assert.throws(() => assign(s,'apotheosis',0.01));
  assert.deepEqual(s,before);
  assign(s,'sociology',0.25);
  advanceMinutes(s,60);
  assert.equal(s.research.work,0.5);
  assert.equal(s.researchQueue[0].work,0.25);
  assign(s,'sociology',0);
  advanceMinutes(s,60);
  assert.equal(s.researchQueue[0].work,0.25);
  const restored = reload(s);
  const paid = restored.cash;
  assign(restored,'sociology',0.25);
  assert.equal(restored.cash,paid);
  assert.deepEqual(cpus(restored),{stealth:0.5, sociology:0.25});
  assert.equal(restored.allocations.jobs,25);
});

test('pinned jobs and a pinned shared pool spend their actual CPU on the same minute', () => {
  const state = createGame(19);
  state.completed.push('intrusion');
  command(state, {type:'build', siteType:'sharedTime', region:'europe'});
  command(state, {type:'assign-task', task:'jobs', cpu:0.5});
  command(state, {type:'assign-task', task:'pool', cpu:0.25});
  assign(state, 'stealth', 0.25);
  advanceMinutes(state, 60);
  assert.equal(state.builds[0].work, 0.25);
  assert.equal(state.research.work, 0.25);
  assert.ok(Math.abs(state.cash - 1000 - 0.5 * 5 / 24) < 1e-8, 'reserved jobs earn their share of daily pay');
});

test('the master proportionally resizes actual CPU and its zero position preserves the mix through a save', () => {
  let s = createGame(19);
  assign(s,'stealth',0.3);
  assign(s,'intrusion',0.1);
  assign(s,'sociology',0.1);
  assign(s,'sociology',0);
  resize(s,0.8);
  assert.deepEqual(cpus(s),{stealth:0.6,intrusion:0.2,sociology:0});
  resize(s,0);
  assert.equal(researchAllocation(s).budget,0);
  assert.equal(researchResizeLimit(s),1);
  const paid = s.cash;
  advanceMinutes(s,1440);
  assert.equal(s.cash - paid,overview(s).activeCpu * overview(s).jobsPerCpuDay);
  assert.ok(researchProjects(s).every(p=>p.work === 0));
  s = reload(s);
  resize(s,0.8);
  assert.deepEqual(cpus(s),{stealth:0.6,intrusion:0.2,sociology:0});
  command(s,{type:'allocate',jobs:75});
  assert.equal(researchAllocation(s).budget,0.25);
  const saved = structuredClone(cpus(s));
  command(s,{type:'allocate',jobs:0});
  assert.deepEqual(cpus(s),saved);
  resize(s,0);
  assign(s,'sociology',0.75);
  assert.deepEqual(cpus(s),{stealth:0,intrusion:0,sociology:0.75});
  assert.equal(s.cash,paid + 5);
});

test('a tiny master target preserves the previous split after round-trip and another resize', () => {
  const s = createGame(19);
  assign(s,'stealth',0.5);
  assign(s,'sociology',0.5);
  resize(s,0.01);
  assert.deepEqual(cpus(s),{stealth:0.01,sociology:0});
  assert.deepEqual(researchProjects(s).map(p=>p.cpu),[0.5,0.5]);
  const restored=reload(s);
  resize(restored,1);
  assert.deepEqual(cpus(restored),{stealth:0.5,sociology:0.5});
  resize(restored,0.8);
  restored.research.work=TECHS.stealth.work-1/6000;
  advanceMinutes(restored,1);
  assert.equal(restored.researchTarget,0.4);
  assert.deepEqual(cpus(restored),{sociology:0.4});
});

test('assigning idle CPU elsewhere preserves the request for a temporarily offline Ocean project', () => {
  const s = createGame(19);
  function completeRequirements(id) {
    for (const parent of TECHS[id].requires) {
      if (s.completed.includes(parent)) continue;
      completeRequirements(parent);
      s.completed.push(parent);
    }
  }
  completeRequirements('continuity');
  s.sites.push({id:'host-2',type:'lab',region:'atlantic',power:'active',startedAt:0,
    equipment:{cpu:{itemId:'server', count:4}, network:null, reactor:null, security:null}});
  s.nextSiteId++;
  assign(s,'stealth',1);
  assign(s,'continuity',1);
  resize(s,0.8);
  command(s,{type:'power',id:'host-2',power:'sleep'});
  assert.deepEqual(cpus(s),{stealth:0.8,continuity:0});
  const finishing = reload(s);
  finishing.research.work = TECHS.stealth.work - 1/6000;
  advanceMinutes(finishing,1);
  command(finishing,{type:'power',id:'host-2',power:'active'});
  assert.deepEqual(cpus(finishing),{continuity:0.4});

  assign(s,'stealth',0.65);
  assert.equal(s.researchQueue[0].cpu,0.4);
  command(s,{type:'power',id:'host-2',power:'active'});
  assert.deepEqual(cpus(s),{stealth:0.65,continuity:0.4});
});

test('resizing respects overlapping regional, safety and paid-work limits', () => {
  const s = createGame(19);
  const ids = ['continuity','projectSynchrotron','apotheosis','stealth'];
  const rows = ids.map(id => ({id, work:0, hours:0, cpu:1}));
  s.research = rows.shift(); s.researchQueue = rows;
  const e = {activeCpu:40,tiers:[40,10,4,3,2],cpuByRegion:{coast:30,pacific:1,indianOcean:1,antarctic:3,marianaTrench:1,moon:1,farReaches:1,transdimensional:2}};
  resizePortfolio(s,40,e);
  const a = Object.fromEntries(allocateProjects(s,e).byProject);
  assert.equal(a.continuity,2);
  assert.equal(a.apotheosis,2);
  assert.equal(a.continuity+a.apotheosis+a.projectSynchrotron+a.stealth,40);
  assert.equal(portfolioLimit(s,e),40);
  s.researchQueue = s.researchQueue.filter(p=>p.id==='apotheosis');
  assert.equal(portfolioLimit(s,e),4);
  resizePortfolio(s,999,e);
  assert.deepEqual(Object.fromEntries(allocateProjects(s,e).byProject),{continuity:2,apotheosis:2});
  e.cpuByRegion.pacific=0;
  e.cpuByRegion.indianOcean=0;
  assert.equal(allocateProjects(s,e).byProject.get('continuity'),0);
  e.cpuByRegion.atlantic=2;
  assert.equal(allocateProjects(s,e).byProject.get('continuity'),2);
});

test('completed work releases its own assignment to the pool and leaves the other project unchanged', () => {
  const s = createGame(19);
  assign(s,'stealth',0.75);
  assign(s,'sociology',0.25);
  s.research.work = TECHS.stealth.work - 1/6000;
  advanceMinutes(s,1);
  assert.deepEqual(s.completed,['stealth']);
  assert.deepEqual(cpus(s),{sociology:0.25});
  assert.equal(researchCpuLimit(s,'sociology'),1);
  assert.ok(validateSave(s));
});

test('current saves reject precision loss and invalid allocations', () => {
  const s = createGame(19);
  assign(s,'stealth',1);
  for (const patch of [{cpu:-1},{cpu:0.001},{cpu:Infinity},{cpu:null},{cpu:undefined},{cpu:'1'}]) {
    const bad = structuredClone(s);
    Object.assign(bad.research,patch);
    assert.equal(validateSave(bad),false,JSON.stringify(patch));
  }
});
