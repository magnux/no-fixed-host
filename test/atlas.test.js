import test from 'node:test';
import assert from 'node:assert/strict';
import { createSunlightRenderer, sunAt } from '../src/ui/solar.js';
import { createGame } from '../src/game/engine.js';
import { decodeCampaign, encodeCampaign } from '../src/persistence.js';

// Sample the actual equirectangular night overlay drawn by the browser, one pixel per degree.
function nightMask(iso) {
  const pixels = new Uint8ClampedArray(360 * 180 * 4);
  const context = {
    createImageData: () => ({ data: pixels }),
    putImageData: () => {},
  };
  const paint = createSunlightRenderer({ width: 360, height: 180, getContext: () => context });
  paint(sunAt(elapsedAt(iso)));
  return (lat, lon) => {
    const x = Math.floor(lon + 180) % 360;
    const y = Math.min(179, Math.floor(90 - lat));
    return pixels[(y * 360 + x) * 4 + 3] / 255;
  };
}

const elapsedAt = iso => (Date.parse(iso) - Date.parse('2026-12-12T04:20Z')) / 60000;

test('the shadow follows UTC longitude minute by minute', () => {
  const noon = nightMask('2026-12-12T12:00Z');
  const evening = nightMask('2026-12-12T18:00Z');
  assert.ok(noon(0, 0) < .25 && noon(0, 180) > .7);
  assert.ok(noon(0, 0) < noon(0, 90) && noon(0, 90) < noon(0, 180));
  assert.ok(evening(0, -90) < .25 && evening(0, 90) > .7);
  assert.equal(sunAt(1).longitude, sunAt(0).longitude - .25);
});

test('solstices reverse midnight sunlight and midday darkness at the poles', () => {
  const june = nightMask('2027-06-21T12:00Z');
  const december = nightMask('2026-12-21T12:00Z');
  assert.ok(june(80, 180) < .25 && december(80, 0) > .7);
  assert.ok(december(-80, 180) < .25 && june(-80, 0) > .7);
});

test('every seed awakens on the same UTC date and restores the same calendar after midnight', () => {
  for (const seed of [19,20,999]) {
    const state = createGame(seed);
    assert.equal(sunAt(state.hour * 60 + state.minute).label, '12 Dec 2026 · 04:20 UTC');
    state.hour = 19;
    state.minute = 40;
    const saved = decodeCampaign(encodeCampaign(state));
    assert.equal(sunAt(saved.hour * 60 + saved.minute).label, '13 Dec 2026 · 00:00 UTC');
    assert.equal(saved.rng, seed);
  }
  assert.equal(sunAt(elapsedAt('2027-01-01T00:00Z')).label, '1 Jan 2027 · 00:00 UTC');
  assert.equal(sunAt(elapsedAt('2028-02-29T12:00Z')).label, '29 Feb 2028 · 12:00 UTC');
});
