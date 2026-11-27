// The reference grades each investigator's daily intensity at 75, 150 and
// 225 per 10,000. Numeric readouts show the actual one-day probability.
export function riskLabel(state, intensity) {
  if (state.completed.includes('advancedSocioanalytics')) {
    return (-Math.expm1(-intensity) * 100).toFixed(2) + '%';
  }
  if (state.completed.includes('socioanalytics')) {
    const rounded = Math.round(-Math.expm1(-intensity) * 400) / 4;
    return '≈' + rounded.toFixed(2) + '%';
  }
  if (intensity > 0.0225) return 'Critical';
  if (intensity > 0.015) return 'High';
  if (intensity > 0.0075) return 'Moderate';
  return 'Low';
}
