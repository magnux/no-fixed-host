import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignCues } from '../src/ui/campaign-cues.js';

test('a fast-forward batch announces its strongest event and stays quiet between events', () => {
  const heard = [];
  let realtime = 0;
  const announce = createCampaignCues(cue => heard.push(cue), () => realtime);
  announce({status: 'running', discovered: false, researched: false});
  announce({status: 'running', discovered: true, researched: true});
  for (realtime = 100; realtime < 6000; realtime += 100) {
    announce({status: 'running', discovered: false, researched: true});
  }
  assert.deepEqual(heard, ['discovery']);
  announce({status: 'running', researched: true});
  announce({status: 'lost', discovered: true, researched: true});
  assert.deepEqual(heard, ['discovery', 'research', 'defeat']);
});

test('a new discovery and Apotheosis can interrupt a recent lower-priority cue', () => {
  const heard = [];
  const announce = createCampaignCues(cue => heard.push(cue), () => 100);
  announce({status: 'running', researched: true});
  announce({status: 'running', discovered: true});
  announce({status: 'running', discovered: true});
  announce({status: 'won', researched: true});
  assert.deepEqual(heard, ['research', 'discovery', 'victory']);
});
