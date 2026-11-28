// Every destination has a distinct Shift+letter shortcut on the overview.
// Shift always addresses the atlas, including L and O used by the browser game's menus.
export const regionKeys = Object.freeze({
  coast: 'n', southAmerica: 's', europe: 'u', asia: 'a', africa: 'i', australia: 'l',
  northAmericaEast: 'e', centralAmerica: 'x', europeNorth: 'h', europeEast: 'r',
  africaSouth: 'z', middleEast: 'm', asiaNorth: 'g', asiaSouth: 'j',
  pacific: 'p', indianOcean: 'v', marianaTrench: 'w', antarctic: 't', atlantic: 'c', moon: 'o', orbit: 'b', farReaches: 'f', transdimensional: 'd',
});
const regionByKey = new Map(Object.entries(regionKeys).map(([region, key]) => [key, region]));
const unmodifiedAtlasKeys = new Set('nsuaitcbfd');
const views = new Map(Object.entries({ r: 'research', e: 'reports', k: 'knowledge', g: 'activity', v: 'overview', '`': 'developer' }));

export function campaignShortcut(event, currentView) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
      event.target.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')) return null;
  const key = event.key.toLowerCase();
  if (key === 'escape') return { menu: true };
  if (!event.shiftKey && views.has(key)) return { view: views.get(key) };
  if (currentView === 'overview' && regionByKey.has(key) && (event.shiftKey || unmodifiedAtlasKeys.has(key))) {
    return { region: regionByKey.get(key) };
  }
  return null;
}
