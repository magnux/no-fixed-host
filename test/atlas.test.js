import test from 'node:test';
import assert from 'node:assert/strict';
import { createSunlightRenderer, startingDay, sunAt } from '../src/ui/solar.js';
import { createGame } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

// Sample the actual equirectangular night overlay drawn by the browser, one pixel per degree.
function nightMask(hour) {
  const pixels = new Uint8ClampedArray(360 * 180 * 4);
  const context = {
    createImageData: () => ({ data: pixels }),
    putImageData: () => {},
  };
  const paint = createSunlightRenderer({ width: 360, height: 180, getContext: () => context });
  paint(sunAt(hour));
  return (lat, lon) => {
    const x = Math.floor(lon + 180) % 360;
    const y = Math.min(179, Math.floor(90 - lat));
    return pixels[(y * 360 + x) * 4 + 3] / 255;
  };
}

test('daylight travels west with game time and repeats after a 365-day year', () => {
  const noon = nightMask(12);
  const evening = nightMask(18);
  assert.ok(noon(0, 0) < 0.25 && noon(0, 180) > 0.7);
  assert.ok(noon(0, 0) < noon(0, 90) && noon(0, 90) < noon(0, 180));
  assert.ok(evening(0, -90) < 0.25 && evening(0, 90) > 0.7);
  assert.deepEqual(sunAt(24 * 365 + 18), sunAt(18));
  assert.equal(sunAt(18, 1).longitude, sunAt(18).longitude - 0.25);
  assert.match(sunAt(18, 1).label, /18:01 UTC/);
});

test('solstices reverse midnight sunlight and midday darkness at the poles', () => {
  const june = nightMask(171 * 24 + 12);
  const december = nightMask(354 * 24 + 12);
  assert.ok(june(80, 180) < 0.25 && december(80, 0) > 0.7);
  assert.ok(december(-80, 180) < 0.25 && june(-80, 0) > 0.7);
  assert.match(sunAt(0).label, /1 Jan · 00:00 UTC/);
});

test('campaign season varies by seed and survives reloading without using a discovery draw', () => {
  const state = createGame(19);
  const rng = state.rng;
  const initialDay = startingDay(state.regionSeed);
  assert.notEqual(startingDay(createGame(20).regionSeed), initialDay);
  const sun = sunAt(23, 59, initialDay);
  assert.deepEqual(sun, sunAt(initialDay * 24 + 23, 59));
  assert.equal(state.rng, rng);
  const restored = decodeCampaign(encodeCampaign(state));
  assert.deepEqual(sunAt(23 + 365 * 24, 59, startingDay(restored.regionSeed)), sun);
});
