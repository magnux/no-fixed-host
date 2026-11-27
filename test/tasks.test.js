import assert from 'node:assert/strict';
import test from 'node:test';
import { TECHS } from '../src/game/content.js';
import { advanceMinutes, command, createGame, overview, researchAllocation, researchCpuLimit,
  researchProjects, researchResizeLimit, validateSave } from '../src/game/engine.js';
import { allocateProjects, portfolioLimit, resizePortfolio } from '../src/game/research-tasks.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

const assign = (state, id, cpu) => command(state, { type: 'assign-research', id, cpu });
const resize = (state, cpu) => command(state, { type: 'resize-research', cpu });
const cpus = state => Object.fromEntries(researchAllocation(state).byProject);
const reload = state => decodeCampaign(encodeCampaign(state));

test('direct CPU assignment funds once, uses only idle capacity and releases paid progress', () => {
  const s = createGame(19);
  assert.equal(researchResizeLimit(s), 0);
  assert.equal(researchAllocation(s).budget, 0);
  command(s,{type:'allocate', jobs:25});
  assign(s,'intrusion',0);
  assert.equal(s.research, null);
  assign(s,'stealth',1);
  assert.equal(researchCpuLimit(s,'sociology'),0.5);
  const before = structuredClone(s);
  for (const invalid of [0.51, Infinity, -1, 0.001, '1']) {
    assert.throws(() => assign(s,'sociology',invalid));
    assert.deepEqual(s,before);
  }
  assert.throws(() => assign(s,'apotheosis',0.01));
  assert.deepEqual(s,before);
  assign(s,'sociology',0.5);
  advanceMinutes(s,60);
  assert.equal(s.research.work,1);
  assert.equal(s.researchQueue[0].work,0.5);
  const cash = s.cash;
  assign(s,'sociology',0);
  advanceMinutes(s,60);
  assert.equal(s.researchQueue[0].work,0.5);
  const restored = reload(s);
  const paid = restored.cash;
  assign(restored,'sociology',0.25);
  assert.equal(restored.cash,paid);
  assert.ok(paid >= cash);
  assert.deepEqual(cpus(restored),{stealth:1, sociology:0.25});
  assert.equal(restored.allocations.jobs,25);
});

test('the master proportionally resizes actual CPU and its zero position preserves the mix through a save', () => {
  let s = createGame(19);
  assign(s,'stealth',0.3);
  assign(s,'intrusion',0.1);
  assign(s,'sociology',0.1);
  assign(s,'sociology',0);
  resize(s,1.6);
  assert.deepEqual(cpus(s),{stealth:1.2,intrusion:0.4,sociology:0});
  resize(s,0);
  assert.equal(researchAllocation(s).budget,0);
  assert.equal(researchResizeLimit(s),2);
  const paid = s.cash;
  advanceMinutes(s,1440);
  assert.equal(s.cash - paid,overview(s).activeCpu * overview(s).jobsPerCpuDay);
  assert.ok(researchProjects(s).every(p=>p.work === 0));
  s = reload(s);
  resize(s,0.8);
  assert.deepEqual(cpus(s),{stealth:0.6,intrusion:0.2,sociology:0});
  command(s,{type:'allocate',jobs:75});
  assert.equal(researchAllocation(s).budget,0.5);
  const saved = structuredClone(cpus(s));
  command(s,{type:'allocate',jobs:0});
  assert.deepEqual(cpus(s),saved);
  resize(s,0);
  assign(s,'sociology',1.75);
  assert.deepEqual(cpus(s),{stealth:0,intrusion:0,sociology:1.75});
  assert.equal(s.cash,paid + 10);
});

test('a tiny master target preserves the previous split after round-trip and another resize', () => {
  const s = createGame(19);
  assign(s,'stealth',1);
  assign(s,'sociology',1);
  resize(s,0.01);
  assert.deepEqual(cpus(s),{stealth:0.01,sociology:0});
  assert.deepEqual(researchProjects(s).map(p=>p.cpu),[1,1]);
  const restored=reload(s);
  resize(restored,2);
  assert.deepEqual(cpus(restored),{stealth:1,sociology:1});
  resize(restored,1.4);
  restored.research.work=TECHS.stealth.work-1/6000;
  advanceMinutes(restored,1);
  assert.equal(restored.researchTarget,0.7);
  assert.deepEqual(cpus(restored),{sociology:0.7});
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
  s.sites.push({id:'host-2',type:'lab',region:'atlantic',power:'active',startedAt:0});
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
  const e = {activeCpu:40,tiers:[40,10,4,3,2],cpuByRegion:{coast:30,atlantic:2,antarctic:4,moon:1,farReaches:1,transdimensional:2}};
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
  e.cpuByRegion.atlantic=0;
  assert.equal(allocateProjects(s,e).byProject.get('continuity'),0);
  e.cpuByRegion.atlantic=2;
  assert.equal(allocateProjects(s,e).byProject.get('continuity'),2);
});

test('completed work releases its own assignment to the pool and leaves the other project unchanged', () => {
  const s = createGame(19);
  assign(s,'stealth',1.5);
  assign(s,'sociology',0.5);
  s.research.work = TECHS.stealth.work - 1/6000;
  advanceMinutes(s,1);
  assert.deepEqual(s.completed,['stealth']);
  assert.deepEqual(cpus(s),{sociology:0.5});
  assert.equal(researchCpuLimit(s,'sociology'),2);
  assert.ok(validateSave(s));
});

test('v5 rejects precision loss, invalid allocations and legacy weight fields', () => {
  const s = createGame(19);
  assign(s,'stealth',1);
  for (const patch of [{cpu:-1},{cpu:0.001},{cpu:Infinity},{cpu:null},{cpu:undefined},{cpu:'1'},{weight:1},{previousWeight:50}]) {
    const bad = structuredClone(s);
    Object.assign(bad.research,patch);
    assert.equal(validateSave(bad),false,JSON.stringify(patch));
  }
});

test('v4 weights migrate to concrete CPU without a second charge or changed progress', () => {
  const old = createGame(19);
  old.version = 4;
  old.minute = 12;
  old.allocations.research = 100;
  old.research = {id:'stealth',hours:0,work:3,weight:17};
  old.researchQueue = [
    {id:'sociology',hours:0,work:4,weight:4},
    {id:'intrusion',hours:0,work:1,weight:39},
  ];
  const read = () => decodeCampaign(JSON.stringify({game:'no-fixed-host',format:4,campaign:old}));
  assert.deepEqual(cpus(read()),{stealth:0.56,sociology:0.14,intrusion:1.3});
  old.researchQueue[1].weight=0;
  old.researchQueue[1].previousWeight=39;
  const migrated = read();
  assert.equal(migrated.researchQueue[1].cpu,0);
  assert.equal(migrated.research.work,3);
  assert.equal(migrated.cash,old.cash);
  assert.equal(migrated.regionSeed,old.regionSeed);
  assert.deepEqual(migrated.statistics,old.statistics);
  assert.ok(!researchProjects(migrated).some(p=>'weight' in p || 'previousWeight' in p));
  assert.deepEqual(reload(migrated),migrated);
  old.allocations.research=0;
  const quiet=read();
  assert.equal(researchAllocation(quiet).budget,0);
  resize(quiet,1);
  assert.equal(researchAllocation(quiet).budget,1);
  assert.equal(quiet.researchQueue[1].cpu,0);
});

test('v3 mid-day games preserve paid work and their one outstanding daily payout', () => {
  const old = createGame(19);
  old.version=3; old.hour=23; old.minute=58; old.cash=20000;
  old.allocations.research=50;
  old.sites[0].power='sleep';
  old.research={id:'stealth',work:2,hours:0};
  delete old.regionSeed; delete old.statistics; delete old.researchQueue;
  const migrated=decodeCampaign(JSON.stringify({game:'no-fixed-host',format:3,campaign:old}));
  assert.deepEqual(migrated.research,{...old.research,cpu:1});
  assert.equal(researchAllocation(migrated).budget,0);
  advanceMinutes(migrated);
  assert.equal(migrated.cash,20000);
  const restored=reload(migrated);
  advanceMinutes(restored);
  assert.equal(restored.cash,20002);
  assert.equal(restored.legacyIncomeDay,undefined);
  advanceMinutes(restored);
  assert.ok(Math.abs(restored.cash-20002-2/1440)<1e-9);
});
