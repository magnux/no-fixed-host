import test from 'node:test';
import { networkThreat } from '../src/game/threat.js';
import assert from 'node:assert/strict';
import { createGame } from '../src/game/engine.js';
import { designRiskLabel, hostRiskLabel, networkDiscoveryReading, suspicionReading } from '../src/game/awareness.js';
import { suspicionPanel } from '../src/ui/views.js';

test('suspicion grades cover the four evidence bands, independent of future risk', () => {
  const levels = [0, 2499, 2500, 4999, 5000, 7499, 7500, 10_001];
  assert.deepEqual(levels.map(amount => suspicionReading(amount, 'none').text),
    ['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Critical', 'Critical']);
  assert.ok(levels.every(amount => suspicionReading(amount, 'none').percent === null));
  assert.equal(suspicionReading(2750, 'partial').text, '≈25%');
  assert.equal(suspicionReading(2751, 'partial').percent, 30);
  assert.equal(suspicionReading(2751, 'full').text, '27.51%');
});

test('research reveals combined one-day discovery probability in progressively smaller steps', () => {
  const danger = {label:'Rising'};
  assert.equal(networkDiscoveryReading(0.019, 'none', danger), 'Rising');
  assert.equal(networkDiscoveryReading(0.019, 'partial', danger), '≈2%');
  assert.equal(networkDiscoveryReading(0.019, 'full', danger), '1.88%');
});

test('proposed designs and installed hosts have separate estimate precision until full analytics', () => {
  const state = createGame(19);
  // A nominal intensity of 1.4% gives a 1.39% chance over a whole day.
  assert.equal(designRiskLabel(state, 0.021), 'High');
  assert.equal(hostRiskLabel(state, 0.021), 'High');
  assert.equal(designRiskLabel(state, 0.016), 'High');
  assert.equal(hostRiskLabel(state, 0.006), 'Moderate');
  assert.equal(designRiskLabel(state, 0.006), 'Low');
  state.completed.push('socioanalytics');
  assert.equal(designRiskLabel(state, 0.014), '≈1.50%');
  assert.equal(hostRiskLabel(state, 0.014), '≈1.00%');
  assert.equal(hostRiskLabel(state, 0.005), '≈0.00%');
  state.completed.push('advancedSocioanalytics');
  assert.equal(designRiskLabel(state, 0.014), '1.39%');
  assert.equal(hostRiskLabel(state, 0.014), '1.39%');
});

test('dock protection and knowledge limits apply to the rendered and accessible evidence values', () => {
  const state = createGame(19);
  state.suspicion.news = 4132;
  assert.doesNotMatch(suspicionPanel(networkThreat(state, true)), /sus-row|41.32|<progress/);
  state.hour = 24 * 25;
  const basic = suspicionPanel(networkThreat(state, false));
  assert.match(basic, /class="sus-value">Moderate</);
  assert.match(basic, /Discovery outlook/);
  assert.doesNotMatch(basic, /41.32|4132|%|<progress/);
  state.completed.push('socioanalytics');
  const estimated = suspicionPanel(networkThreat(state, false));
  assert.match(estimated, /aria-valuetext="≈40%" max="100" value="40"/);
  assert.match(estimated, /Discovery today/);
  assert.doesNotMatch(estimated, /41.32|4132/);
  state.completed.push('advancedSocioanalytics');
  assert.match(suspicionPanel(networkThreat(state, false)), /aria-valuetext="41.32%" max="100" value="41.32"/);
  state.completed.push('apotheosis');
  assert.doesNotMatch(suspicionPanel(networkThreat(state, false)), /sus-row|41.32/);
  state.freePlay = true;
  assert.doesNotMatch(suspicionPanel(networkThreat(state, false)), /sus-row/);
});
