import test from 'node:test';
import assert from 'node:assert/strict';
import { newBroadcast, dialAt, sendPulse, reception } from '../src/arcade/prototypes/tell-them-im-weather.js';

test('the receiver separates count-in, call, reply and the final rest', () => {
  assert.equal(dialAt(3.99).phase,'count');
  assert.equal(dialAt(4).phase,'listen');
  assert.equal(dialAt(12).phase,'reply');
  assert.deepEqual(dialAt(67.5),{phase:'reply',round:3,column:7});
  assert.equal(dialAt(68).phase,'end');
  const state=newBroadcast();
  state.running=true;
  state.beat=4.5;
  assert.equal(sendPulse(state),'Listen');
  assert.equal(state.errors.size,0);
});

test('a clean transmission survives the rival; tapping through every beat does not', () => {
  const state=newBroadcast(); state.running=true;
  const quietBeats=[[1,3,5,7],[2,3,5,7],[1,2,5,7],[1,4,5,7]];
  quietBeats.forEach((columns,round) => {
    columns.forEach(col => {
      state.beat=12+16*round+col+.5;
      assert.equal(sendPulse(state),'Received');
      sendPulse(state);
    });
    if (round===1) assert.equal(reception(state).outcome,'partial');
  });
  assert.equal(state.hits.size,16);
  assert.equal(reception(state).outcome,'complete');
  for (let round=0;round<4;round++) for (let col=0;col<8;col++) {
    state.beat=12+16*round+col+.5;
    sendPulse(state);
  }
  assert.equal(reception(state).outcome,'failed');
  const early=newBroadcast(); early.running=true; early.beat=13.01;
  assert.equal(sendPulse(early),'Off beat');
  assert.equal(early.hits.size,0);
});
