import { REGIONS } from './content.js';
import { siteHardware } from './equipment.js';

const regionIds = Object.keys(REGIONS);

export function avatarModel(state) {
  let form = 'terminal';
  if (state.completed.includes('telepresence')) form = 'presence';
  else if (state.completed.length) form = 'face';

  const lights = new Map();
  for (const site of state.sites) {
    if (!siteHardware(state, site).rawCpu) continue;
    if (site.power === 'active') lights.set(site.region, 'online');
    else if (!lights.has(site.region)) lights.set(site.region, 'sleeping');
  }
  const regions = regionIds.filter(id => lights.has(id)).map(id => ({ id, status: lights.get(id) }));
  return { form, regions };
}
