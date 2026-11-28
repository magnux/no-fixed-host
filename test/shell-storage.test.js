import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, advanceMinutes } from '../src/game/engine.js';
import { listSlots, loadSlot, matchesSlotName, preferences, PREF_KEY, QUICK_SLOT, removeSlot, slotInfo, slotKey, writeSlot } from '../src/shell-storage.js';

function memory() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null,
    setItem: (k,v) => data.set(k,v),
    removeItem: k => data.delete(k),
  };
}

test('named checkpoints preserve independent campaigns, search and timestamp ordering', () => {
  const storage = memory();
  const state = createGame(17);
  const first = slotKey('Private <lab>'); const second = slotKey('Second host');
  writeSlot(storage,first,'Private <lab>',state,null,{ now: 100, gameVersion: '0.1.0' });
  advanceMinutes(state,15);
  writeSlot(storage,second,'Second host',state,null,{ now: 110 });
  assert.deepEqual(listSlots(storage).map(row=>row.key),[second,first]);
  assert.equal(listSlots(storage,'LAB')[0].name,'Private <lab>');
  assert.equal(listSlots(storage,'LAB   PRIVATE')[0].key, first);
  assert.equal(matchesSlotName('Montréal relay 88','88 montre\u0301al'), true);
  assert.equal(slotInfo(storage,second).minutes,15);
  assert.equal(slotInfo(storage,first).gameVersion,'0.1.0');
  assert.equal(loadSlot(storage,first,slotInfo(storage,first).revision).minute,0);
  assert.equal(loadSlot(storage,second,slotInfo(storage,second).revision).rng,state.rng);
  assert.equal(slotKey(' SECOND HOST '),second);
  assert.throws(() => slotKey(' '),/invalidName/);
  assert.throws(() => slotKey('a'.repeat(61)),/invalidName/);
});

test('stale overwrite and delete confirmations do not affect a newer checkpoint', () => {
  const storage = memory();
  const key = slotKey('Operations');
  const state = createGame(1);
  writeSlot(storage,key,'Operations',state,null,{ now: 100, gameVersion: '0.1.0' });
  const prev = slotInfo(storage,key).revision;
  advanceMinutes(state,7);
  writeSlot(storage,key,'Operations',state,prev,{ now: 110 });
  assert.throws(() => writeSlot(storage,key,'Operations',state,prev),/staleSlot/);
  assert.throws(() => removeSlot(storage,key,prev),/staleSlot/);
  assert.throws(() => loadSlot(storage,key,prev),/staleSlot/);
  const rev = slotInfo(storage,key).revision;
  writeSlot(storage,QUICK_SLOT,'Quicksave',state,null,{ now: 120 });
  removeSlot(storage,key,rev);
  assert.deepEqual(listSlots(storage).map(row=>row.key),[QUICK_SLOT]);
  assert.equal(loadSlot(storage,QUICK_SLOT,slotInfo(storage,QUICK_SLOT).revision).minute,7);
});

test('preferences restore understood values while damaged entries cannot break other slots', () => {
  const storage = memory();
  storage.setItem(PREF_KEY,JSON.stringify({language:'es',theme:'wrong',daylight:false,uiVolume:-1,warnings:{stalledBuild:false}}));
  const prefs = preferences(storage);
  assert.equal(prefs.language,'es'); assert.equal(prefs.theme,'night'); assert.equal(prefs.daylight,false);
  assert.equal(prefs.uiVolume,45); assert.equal(prefs.warnings.stalledBuild,false); assert.equal(prefs.warnings.lastHost,true);
  const key = slotKey('Corrupt');
  storage.setItem(key,'{');
  writeSlot(storage,QUICK_SLOT,'Quicksave',createGame(5),null);
  assert.equal(listSlots(storage).length,1);
  assert.throws(() => writeSlot(storage,key,'Corrupt',createGame(6),null),/invalidSlot/);
  assert.equal(storage.getItem(key),'{');
  const damaged = listSlots(storage, 'corrupt', true)[0];
  assert.equal(damaged.damaged, true);
  storage.setItem(key, 'changed-in-another-tab');
  assert.throws(() => removeSlot(storage, key, undefined, damaged.unreadableData), /staleSlot/);
  removeSlot(storage, key, undefined, slotInfo(storage, key, true).unreadableData);
  assert.equal(storage.getItem(key), null);
});
