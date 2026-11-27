import test from 'node:test';
import assert from 'node:assert/strict';
import { createScorePlayer } from '../src/arcade/audio/player.js';

function audioRig(t) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const sources = [];
  function node() {
    return {
      connect(target) { this.connected = target; return target; },
      disconnect() { this.connected = null; },
    };
  }
  function param() {
    return {
      changes: [],
      setValueAtTime(value, time) { this.changes.push([value, time]); },
      exponentialRampToValueAtTime(value, time) { this.changes.push([value, time]); },
    };
  }
  function source() {
    const unit = {
      ...node(), frequency: param(), type: '', onended: null,
      start(time) { this.startTime = time; },
      stop(time) { this.stopTime = time; },
    };
    sources.push(unit);
    return unit;
  }
  const context = {
    currentTime: 0, state: 'running', sampleRate: 24000,
    createOscillator: source, createBufferSource: source,
    createBiquadFilter: () => ({ ...node(), Q: { value: 0 }, frequency: param() }),
    createGain: () => ({ ...node(), gain: param() }),
    createBuffer: (channels, length) => ({ getChannelData: () => new Float32Array(length) }),
  };
  const score = {
    bpm: 120, beats: 4,
    voices: [{ wave: 'sine', gain: .14, notes: [[0, 60, .1], [1, 62, .1]] }],
    effects: { ping: [[0, 80, 70, .08, 'triangle', .2]], delayed: [[.5, 68, 55, .2, 'noise', .1]] },
  };
  const music = node();
  const effects = node();
  const player = createScorePlayer(context, music, effects, score);
  t.after(() => player.stop());
  function advance(ms) {
    context.currentTime += ms / 1000;
    for (const s of sources) if (s.stopTime <= context.currentTime) s.onended?.();
    t.mock.timers.tick(ms);
  }
  return { player, sources, music, effects, context, advance };
}

test('score times follow the audio clock across the loop and skip missed onsets after a stalled timer', t => {
  const { player, sources, music, advance } = audioRig(t);
  player.start();
  player.start();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].connected.connected, music);
  advance(400);
  assert.equal(sources.length, 2);
  assert.equal(sources[1].startTime - sources[0].startTime, .5);
  advance(1540);
  assert.equal(sources.length, 3);
  assert.equal(sources[2].startTime - sources[0].startTime, 2);
  // Ten seconds later the next onset is the only one inside the new lookahead.
  advance(10000);
  assert.equal(sources.length, 4);
  assert.ok(Math.abs(sources[3].startTime - 12.015) < 1e-8);
});

test('muting music preserves effects; suspending cancels future noise and stop is terminal', t => {
  const { player, sources, effects, context, advance } = audioRig(t);
  context.state = 'suspended'; // resume() may still be pending on the first tap.
  player.start();
  assert.equal(sources.length, 1);
  context.state = 'running';
  player.setMusicActive(false);
  assert.equal(sources[0].connected, null);
  assert.equal(player.effect('delayed'), true);
  const delayed = sources.at(-1);
  assert.equal(delayed.connected.connected.connected, effects);
  assert.ok(delayed.startTime > context.currentTime);
  assert.equal(player.effect('delayed'), false);
  player.suspend();
  assert.equal(delayed.connected, null);
  assert.equal(delayed.stopTime, context.currentTime);
  advance(10000);
  assert.equal(sources.length, 2);
  assert.equal(player.effect('ping'), false);
  player.start();
  assert.equal(player.effect('ping'), true);
  player.stop();
  player.start();
  player.setMusicActive(true);
  advance(1000);
  assert.equal(player.effect('complete'), false);
  assert.ok(sources.every(unit => unit.connected === null));
});

test('rhythm mode restarts on the downbeat at a quieter level, and a fresh attempt restores normal music', t => {
  const { context, player, sources, advance } = audioRig(t);
  player.start();
  const initialLevel = sources[0].connected.gain.changes[1][0];
  advance(270);
  player.setMusicMode('rhythm');
  const ducked = sources.at(-1);
  assert.equal(ducked.startTime, context.currentTime + .015);
  assert.ok(ducked.connected.gain.changes[1][0] < initialLevel * .3);
  assert.equal(player.effect('partial'), true);
  assert.equal(player.effect('partial'), false);
  player.suspend();
  player.setMusicMode('normal');
  player.start();
  assert.equal(sources.at(-1).connected.gain.changes[1][0], initialLevel);
  assert.equal(sources.at(-1).startTime, context.currentTime + .015);
});
