import { designRiskLabel, hostRiskLabel } from '../game/awareness.js';

export function riskLabel(state, intensity, context = 'design') {
  return context === 'host' ? hostRiskLabel(state, intensity) : designRiskLabel(state, intensity);
}
