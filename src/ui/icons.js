const paths = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  facilities:
    '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M6 6.5h2m-2 11h2"/>',
  research:
    '<path d="M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/>',
  reports: '<path d="M3 3v18h18M7 16v-4m5 4V6m5 10V9"/>',
  knowledge: '<path d="M12 6v15m0-15C9 3 5 3 2 4v14c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Z"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  news: '<path d="M3 4h15v13a2 2 0 0 0 4 0V8h-4M3 4v13a2 2 0 0 0 2 2h15"/><path d="M6.5 8h8M6.5 12h3v3h-3zM12.5 12h2M12.5 15h2"/>',
  science: '<path d="m13 3 4 2-4 8-4-2zM8 12l4 2M15 10a6 6 0 0 1-1 11M5 21h15M4 16h8"/>',
  covert: '<circle cx="6.5" cy="15" r="4"/><circle cx="17.5" cy="15" r="4"/><path d="m3 13 3-8h3l1.5 8m10.5 0-3-8h-3l-1.5 8M10.5 14h3"/>',
  public: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zM16 5a3 3 0 0 1 0 6m1 2a5 5 0 0 1 4 5v2h-3"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
  reactor: '<path d="m13.5 2-9 12h6L9 22l10.5-13h-7z"/>',
  network: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2.5" y="16" width="6" height="5" rx="1"/><rect x="15.5" y="16" width="6" height="5" rx="1"/><path d="M12 8v4m-6.5 4v-4h13v4"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h1m10 0h1"/>',
  shield:
    '<path d="m12 2 8 4v6c0 5-5 8-8 10-3-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 3v4m10-4v4"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  jump: '<path d="M3 18h6l7-12h5m-5 0v5"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  pause: '<path d="M8 4v16m8-16v16"/>',
  fast: '<path d="m3 6 8 6-8 6zm10 0 8 6-8 6z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
};
export function lineIcon(shape, className = 'icon') {
  return '<svg class="' + className + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    shape + '</svg>';
}

export const icon = id => lineIcon(paths[id]);
export const equipmentIcon = slot => icon(slot === 'security' ? 'shield' : slot);
