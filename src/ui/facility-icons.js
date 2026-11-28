import { icon, lineIcon } from './icons.js';

// Each design has a recognizable outline even in the monochrome host inventory.
const shapes = {
  seed: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="m6 8 2.5 2-2.5 2m5 0h3m-2 4.5v4m-5 0h10"/>',
  relay: '<path d="m7 21 5-14 5 14m-8-5h6M7.5 5a6 6 0 0 0 0 8m9-8a6 6 0 0 1 0 8M4.5 2.5a10 10 0 0 0 0 13m15-13a10 10 0 0 1 0 13"/>',
  sharedTime: '<path d="M10 16H3V4h17v6M7.5 16v4M4 20h6"/><circle cx="16.5" cy="16.5" r="5"/><path d="M16.5 14v2.5l2 1"/>',
  storageUnit: '<path d="M2.5 5h19v15h-19zM5.5 20V8h13v12M6 11.5h12M6 15h12M10 18h4"/>',
  cluster: '<rect x="4" y="2.5" width="16" height="19" rx="1.5"/><path d="M4 9h16M4 15h16M7 6h2m-2 6h2m-2 6h2"/>',
  smallWarehouse: '<path d="m2 10 10-7 10 7M4 9v12h16V9M8 21v-8h8v8M8 16h8"/>',
  largeWarehouse: '<path d="M2 20V9l6-5v5l6-5v5l8-5v16zM5 20v-7h5v7m4 0v-7h5v7"/>',
  covertBase: '<path d="M2 15h20M4 15l4-6h8l4 6m-9-6V4h4m-8 11v5h10v-5M10 12h4"/>',
  lab: '<path d="M3 4q2.2-2 4.5 0t4.5 0 4.5 0 4.5 0M6.5 18l-2 3m13-3 2 3M13 9V6.5"/><rect x="2" y="9" width="20" height="9" rx="4.5"/><circle cx="8" cy="13.5" r="1.4"/><circle cx="15.5" cy="13.5" r="1.4"/>',
  largeLab: '<path d="M3 5q2.2-2 4.5 0t4.5 0 4.5 0 4.5 0M2 19v-4a4 4 0 0 1 8 0v4zm12 0v-6a4 4 0 0 1 8 0v6zm-4-3h4M4 21l1-2m14 0 1 2M16.5 14h3"/>',
  orbitalServer: '<g transform="rotate(-32 12 12)"><rect x="8.5" y="7.5" width="7" height="9" rx="1"/><path d="M2 9h5v6H2zM17 9h5v6h-5zM7 12h1.5m7 0H17m-6-2h2m-2 3h2m-1-6V4"/><circle cx="12" cy="3" r="1"/></g>',
  capsule: '<path d="m5 11 6-6a5.65 5.65 0 0 1 8 8l-6 6a5.65 5.65 0 0 1-8-8Zm3-3 8 8m-6 2 2-2"/>',
  lunarFacility: '<path d="M19.5 3a4.6 4.6 0 1 0 2 7A5 5 0 0 1 19.5 3ZM2 17q5-4 10-1t10 1M4 15.8v-2.5a3.5 3.5 0 0 1 7 0v2.2M6 19v2h10v-2m-6 .2v1.8"/>',
  scientificOutpost: '<path d="M4 4.5 16 13a7.4 7.4 0 0 1-12-8.5ZM10 9l4-5M9 14l-3 7m5-7 3 7M3 21h17m-4 0v-4h5v4"/><circle cx="15.5" cy="3.5" r="1"/>',
  realityBubble: '<circle cx="12" cy="12" r="9.5"/><path d="m12 6 5.2 3v6L12 18l-5.2-3V9zm0 6 5.2-3M6.8 9l5.2 3v6"/>',
};

export function facilityIcon(type) {
  return Object.hasOwn(shapes, type) ? lineIcon(shapes[type], 'icon facility-icon') : icon('facilities');
}
