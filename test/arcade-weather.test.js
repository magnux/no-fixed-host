import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBroadcast, broadcastChart, broadcastEnd, newBroadcast, pressBand, reception, releaseBand } from '../src/arcade/prototypes/tell-them-im-weather.js';

function fresh() {
  return { ...newBroadcast(), running: true };
}

function perform(s, lanes) {
  for (const lane of lanes) pressBand(s,lane);
  for (const lane of lanes) releaseBand(s,lane);
  advanceBroadcast(s,.04);
}

test('the four-front score is playable, including every syncopation, double and triple stop', () => {
  const s=fresh();
  assert.equal(broadcastChart[0].time,2);
  assert.ok(broadcastChart.some(n=>n.lanes.length===3));
  assert.ok(broadcastChart.some(n=>n.time%0.5===.25));
  broadcastChart.forEach(note=>{
    advanceBroadcast(s,note.time-s.time);
    perform(s,note.lanes);
  });
  advanceBroadcast(s,broadcastEnd-s.time);
  assert.equal(s.hits,broadcastChart.length);
  assert.equal(s.perfect,s.hits);
  assert.equal(s.best,s.hits);
  assert.equal(s.noise,0);
  assert.equal(reception(s),'complete');
});

test('chord components must overlap, be fresh key edges, and land within the spread', () => {
  const atChord=()=>{
    const s=fresh();
    const note=broadcastChart.find(n=>n.lanes.length===2);
    advanceBroadcast(s,note.time);
    return [s,note.lanes];
  };
  let [s,[a,b]]=atChord();
  pressBand(s,a);pressBand(s,a);
  advanceBroadcast(s,.05);
  pressBand(s,b);
  advanceBroadcast(s,.04);
  assert.equal(s.hits,1);
  assert.equal(s.flash.text,'Perfect');
  [s,[a,b]]=atChord();
  pressBand(s,a);releaseBand(s,a);pressBand(s,b);
  assert.equal(s.flash.text,'Split chord');
  assert.equal(s.hits,0);
  [s,[a,b]]=atChord();
  pressBand(s,a);advanceBroadcast(s,.09);pressBand(s,b);
  assert.equal(s.flash.text,'Crossed signal');
  assert.equal(s.hits,0);
});

test('radio rejects wrong bands, extra keys, early taps and an idle transmission', () => {
  const s=fresh();
  pressBand(s,0);releaseBand(s,0);
  assert.equal(s.noise,0,'the count-in does not penalize a warm-up');
  broadcastChart.forEach(note=>{
    advanceBroadcast(s,note.time-s.time);
    perform(s,[0,1,2,3]);
  });
  assert.equal(s.hits,0);
  assert.equal(reception(s),'failed');
  const idle=fresh();
  advanceBroadcast(idle,broadcastEnd);
  assert.equal(idle.misses,broadcastChart.length);
  assert.equal(reception(idle),'failed');
  const offbeat=fresh();
  advanceBroadcast(offbeat,broadcastChart[0].time+.1);
  perform(offbeat,[0]);
  assert.equal(offbeat.hits,1);
  assert.equal(offbeat.perfect,0);
  advanceBroadcast(offbeat,.1);perform(offbeat,[1]);
  assert.equal(offbeat.noise,1);
});

test('partial reception is scored separately, with rhythm timing independent of frame rate', () => {
  const s=fresh();
  for(const note of broadcastChart.slice(0,18)) {
    while(note.time-s.time>.031) advanceBroadcast(s,.031);
    advanceBroadcast(s,note.time-s.time);perform(s,note.lanes);
  }
  advanceBroadcast(s,broadcastEnd);
  assert.equal(s.hits,18);
  assert.equal(reception(s),'partial');
});
