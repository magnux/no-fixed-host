import test from 'node:test';
import assert from 'node:assert/strict';
import { twitt, nearestRam, startMeadow, stepMeadow } from '../src/arcade/prototypes/ram-jam.js';

const fresh = (draw = .5) => ({ ...startMeadow(() => draw), phase: 'playing' });
function advance(s, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepMeadow(s, 1 / 60, input);
}

test('greeting locks the chip in place, releasing discards the unfinished greeting', () => {
  const s = fresh(), start = { ...s.player };
  advance(s, 1, { sync: true, x: 1 });
  assert.deepEqual(s.player, start);
  assert.equal(s.target.name, 'Dot');
  stepMeadow(s, 1 / 60);
  assert.equal(s.progress, 0);
  assert.equal(s.target, null);
  advance(s, 1.5, { sync: true });
  assert.equal(s.greeted, 0);
  advance(s, .5, { sync: true });
  assert.equal(s.greeted, 1);
  assert.equal(s.rams[0].happy, true);
});

test('a charge scatters nearby RAMs, a local twitt calms stampers and diverts the closest airborne guard', () => {
  const s = fresh(), [ram, grazer, remote] = s.rams;
  Object.assign(ram, { x: 75, y: 161, patience: 0 });
  Object.assign(grazer, { x: 68, y: 159, homeX: 68, homeY: 159 });
  remote.patience = 2;
  advance(s, .12);
  assert.ok(ram.charge > 0);
  assert.ok(grazer.x < 60);
  assert.ok(twitt(s));
  const scout=s.drones.find(d=>d.lure);
  assert.equal(s.drones.filter(d=>d.lure).length,1);
  assert.deepEqual([scout.lure.x, scout.lure.y], [s.player.x, s.player.y]);
  assert.ok(ram.patience >= 12);
  assert.equal(ram.charge, 0);
  assert.ok(remote.patience < 2);
  assert.equal(twitt(s), false);
  const gap = () => Math.hypot(scout.x - scout.lure.x, scout.y - scout.lure.y);
  const before = gap();
  advance(s, .3);
  assert.ok(gap() < before);
});

test('patrolling drone capture costs three seconds and preserves previous greetings', () => {
  const s = fresh();
  advance(s, 2, { sync: true });
  Object.assign(s.player, { x:s.drones[1].x, y:s.drones[1].y });
  stepMeadow(s, 1 / 60);
  assert.equal(s.penalty, 3);
  assert.equal(s.catches, 1);
  const bin = { ...s.player };
  advance(s, 2.9, { x:1 });
  assert.deepEqual(s.player, bin);
  advance(s, .15);
  assert.equal(s.penalty, 0);
  assert.ok(s.grace > 0);
  assert.equal(s.greeted, 1);
});

test('all sheep can be greeted, and timeout distinguishes partial and empty flocks', () => {
  for (const draw of [0, .25, .5, .75, .99]) {
    const s = fresh(draw);
    for (let i = 0; i <= 3601 && s.phase === 'playing'; i++) {
      const ram = nearestRam(s);
      const sync = ram && Math.hypot(ram.x - s.player.x, ram.y - s.player.y) <= 22;
      stepMeadow(s, 1 / 60, { destination: ram, sync });
    }
    assert.equal(s.phase, 'complete');
    assert.ok(s.time < 60);
    assert.ok(s.rams.every(ram => ram.happy));
  }
  const empty = fresh(), one = fresh();
  advance(empty, 60);
  advance(one, 2, { sync: true }); advance(one, 58);
  assert.equal(empty.phase, 'failed');
  assert.equal(one.phase, 'partial');
  assert.equal(one.greeted, 1);
});

test('all three guards return under their own power, are harmless when grounded, and resume after charging', () => {
  const s=fresh();
  assert.equal(s.drones.length,3);
  assert.equal(new Set(s.drones.map(d=>d.dock.x)).size,3);
  for(const drone of s.drones) drone.battery=.25;
  const returning=new Set(), charged=new Set(), relaunched=new Set();
  for(let i=0;i<1800;i++) {
    stepMeadow(s,1/60);
    for(const drone of s.drones) {
      if(drone.mode==='returning') returning.add(drone.id);
      if(drone.mode==='charging') {
        assert.ok(Math.hypot(drone.x-drone.dock.x,drone.y-drone.dock.y)<.01);
        charged.add(drone.id);
      }
      if(drone.mode==='patrol' && charged.has(drone.id)) relaunched.add(drone.id);
      assert.ok(drone.battery>=0 && drone.battery<=1);
    }
  }
  assert.equal(returning.size,3);
  assert.equal(charged.size,3);
  assert.equal(relaunched.size,3);
  const offline=fresh();
  offline.drones.forEach(d=>{ d.mode='charging'; d.battery=.2; Object.assign(d,d.dock); });
  Object.assign(offline.player,offline.drones[0].dock);
  stepMeadow(offline,1/60);
  assert.equal(offline.catches,0);
  assert.ok(twitt(offline));
  assert.ok(offline.drones.every(d=>!d.lure));
});

test('scrap is randomized and solid for keyboard movement; one tap can route around it', () => {
  assert.notDeepEqual(fresh(.1).obstacles,fresh(.8).obstacles);
  const s=fresh();
  s.obstacles=[{ x:190,y:155,radius:13,kind:'coil' }];
  s.drones.forEach(d=>{d.mode='charging';d.battery=0;Object.assign(d,d.dock);});
  Object.assign(s.player,{x:150,y:155});
  advance(s,.9,{x:1});
  assert.ok(s.player.x<=171.01);
  advance(s,1.2,{destination:{x:220,y:155}});
  assert.ok(Math.hypot(s.player.x-220,s.player.y-155)<.01);
});
