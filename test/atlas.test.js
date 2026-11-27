import test from 'node:test';
import assert from 'node:assert/strict';
import { createSunlightRenderer, sunAt } from '../src/ui/solar.js';

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
});

test('solstices reverse midnight sunlight and midday darkness at the poles', () => {
  const june = nightMask(171 * 24 + 12);
  const december = nightMask(354 * 24 + 12);
  assert.ok(june(80, 180) < 0.25 && december(80, 0) > 0.7);
  assert.ok(december(-80, 180) < 0.25 && june(-80, 0) > 0.7);
  assert.match(sunAt(0).label, /1 Jan · 00:00 UTC/);
});
