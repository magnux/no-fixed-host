// One whole tick is one simulated minute at every playback speed.
export const FAST_RATES = [60, 360, 1440];

export function nextFastRate(rate) {
  return FAST_RATES[(FAST_RATES.indexOf(rate) + 1) % FAST_RATES.length];
}

export class MinuteClock {
  rate = 0;
  lastTime = 0;
  credit = 0;

  setRate(rate, now) {
    this.rate = rate;
    this.lastTime = now;
    if (!rate) this.credit = 0;
  }

  takeTicks(now) {
    const elapsed = now - this.lastTime;
    if (elapsed <= 0) return 0;
    this.lastTime = now;
    // Drop time spent suspended or stalled instead of replaying a burst on return.
    if (!this.rate || elapsed > 250) {
      this.credit = 0;
      return 0;
    }
    this.credit += elapsed * this.rate;
    const count = Math.floor((this.credit + 1e-7) / 1000);
    this.credit -= count * 1000;
    return count;
  }
}
