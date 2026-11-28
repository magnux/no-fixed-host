import { REGIONS } from './content.js';
import { siteHardware } from './equipment.js';

// Form order describes the silhouette. Individual parts unlock independently.
export const AVATAR_FORMS = [
  { id: 'terminal', name: 'Terminal', origin: 'Awakening' },
  { id: 'face', name: 'Face', origin: 'First completed research' },
  { id: 'presence', name: 'Presence', research: 'telepresence' },
  { id: 'chassis', name: 'Chassis', research: 'autonomousVehicles' },
  { id: 'simulacrum', name: 'Simulacrum', research: 'simulacra' },
  { id: 'ascendant', name: 'Ascendant', research: 'apotheosis' },
];

export const AVATAR_PARTS = [
  { id: 'antennae', name: 'Relay antennae', research: 'clusterNetworking' },
  { id: 'voice', name: 'Voice waveform', research: 'voiceSynthesis' },
  { id: 'optics', name: 'Tracking lens', research: 'socioanalytics' },
  { id: 'solar', name: 'Solar fins', research: 'solarCollectors' },
  { id: 'core', name: 'Fusion core', research: 'fusionPower' },
  { id: 'lens', name: 'Spacetime halo', research: 'spaceTimeManipulation' },
];

const regionIds = Object.keys(REGIONS);

export function avatarModel(state) {
  const completed = new Set(state.completed);
  const form = AVATAR_FORMS.findLast(stage => stage.research ? completed.has(stage.research) :
    stage.id === 'terminal' || completed.size > 0).id;
  const parts = AVATAR_PARTS.filter(part => completed.has(part.research)).map(part => part.id);
  const lights = new Map();
  for (const site of state.sites) {
    if (!siteHardware(state, site).rawCpu) continue;
    if (site.power === 'active') lights.set(site.region, 'online');
    else if (!lights.has(site.region)) lights.set(site.region, 'sleeping');
  }
  const regions = regionIds.filter(id => lights.has(id)).map(id => ({ id, status: lights.get(id) }));
  return { form, parts, regions };
}
