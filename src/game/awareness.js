import { researchEffects } from './research.js';

const labels = ['Low', 'Moderate', 'High', 'Critical'];
const symbols = ['🟢', '👀', '⚠️', '🚨'];

// The original rounds exact half steps down (g.nearest_percent).
function rounded(value, step) {
  const remainder = value % step;
  return value - remainder + (2 * remainder > step ? step : 0);
}

function dailyProbability(intensity) {
  return -Math.expm1(-intensity);
}

// Suspicion is a stock of evidence, measured in basis points. Only the
// displayed precision changes with research; investigators keep their real values.
export function suspicionReading(basisPoints, insight) {
  const level = Math.min(3, Math.floor(basisPoints / 2500));
  let percent = null;
  let text = labels[level];
  if (insight === 'partial') {
    percent = rounded(basisPoints, 500) / 100;
    text = '≈' + percent + '%';
  } else if (insight === 'full') {
    percent = basisPoints / 100;
    text = percent.toFixed(2) + '%';
  }
  return { text, percent, level, grade: labels[level], emoji: symbols[level] };
}

export function networkDiscoveryReading(intensity, insight, danger) {
  const probability = dailyProbability(intensity);
  if (insight === 'partial') return '≈' + rounded(probability * 100, 1) + '%';
  if (insight === 'full') return (probability * 100).toFixed(2) + '%';
  return danger.label;
}

function facilityRisk(state, intensity, installed) {
  const insight = researchEffects(state).insight;
  if (insight === 'none') {
    // Facility grades use the original thresholds on intensity. The
    // inspector rounds the individual host first (base.get_detect_chance).
    let basisPoints = Math.round(intensity * 10_000);
    if (installed) basisPoints = rounded(basisPoints, 100);
    const level = basisPoints > 225 ? 3 : basisPoints > 150 ? 2 : basisPoints > 75 ? 1 : 0;
    return labels[level];
  }
  const percent = dailyProbability(intensity) * 100;
  if (insight === 'full') return percent.toFixed(2) + '%';
  const interval = installed ? 1 : 0.25;
  return '≈' + rounded(percent, interval).toFixed(2) + '%';
}

export function designRiskLabel(state, intensity) {
  return facilityRisk(state, intensity, false);
}

export function hostRiskLabel(state, intensity) {
  return facilityRisk(state, intensity, true);
}
