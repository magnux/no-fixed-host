import { facilityText } from './facility-language.js';
import { catalogLabel } from './localization.js';
import { EQUIPMENT } from '../game/content.js';
import { siteHardware } from '../game/equipment.js';

export const rankLabels = ['—', 'I', 'II', 'III', 'IV', 'V'];

export function showRank(node, rank, description) {
  if (node.dataset.rank === String(rank) && node.dataset.description === description) return;
  node.dataset.rank = rank;
  node.dataset.description = description;
  node.className = 'hardware-rank';
  node.setAttribute('role', 'img');
  const label = description + ' · ' + (rank ? facilityText('Tech rank {rank} of 5', { rank }) : facilityText('No installed rank'));
  node.setAttribute('aria-label', label);
  node.title = label;
  if (!node.firstChild) {
    const bars = document.createElement('span');
    bars.className = 'hardware-rank-bars';
    bars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i++) bars.append(document.createElement('i'));
    node.append(bars, document.createTextNode(''));
  }
  for (const [i, bar] of Array.from(node.firstChild.children).entries()) {
    bar.classList.toggle('filled', i < rank);
  }
  node.lastChild.data = rankLabels[rank];
}

export function refitWarning(state, action) {
  if (!['install', 'auto-install', 'auto-upgrade'].includes(action?.type)) return '';
  const site = state.sites.find(host => host.id === action.siteId);
  if (!site) return '';
  const hardware = siteHardware(state, site);
  const orders = action.type === 'install' ? [action] : action.expectedOrders || [];
  const slots = orders.map(order => EQUIPMENT[order.itemId]?.slot)
    .filter(slot => hardware.installed[slot] && !hardware.offlineSlots.includes(slot));
  const effects = [];
  for (const order of orders) {
    const pending = hardware.projects.find(project => EQUIPMENT[project.itemId].slot === EQUIPMENT[order.itemId]?.slot);
    if (pending && pending.itemId !== order.itemId) {
      effects.push(facilityText('Replacing the unfinished {model} discards that order and its invested cash, CPU work and assembly time.',
        { model: catalogLabel(EQUIPMENT[pending.itemId].name) }));
    }
  }
  if (slots.includes('cpu')) {
    effects.push(facilityText('The processor bank goes offline. This host supplies 0 CPU until the installation finishes.'));
    const backups = state.sites.filter(other => other.id !== site.id && siteHardware(state, other).rawCpu > 0);
    if (backups.length && backups.every(host => host.power === 'sleep')) {
      effects.push(facilityText('All backup processors are asleep. Wake a backup to continue CPU-funded work.'));
    }
  }
  if (slots.includes('network')) effects.push(facilityText('The network compute bonus goes offline during replacement.'));
  if (slots.includes('reactor') || slots.includes('security')) effects.push(facilityText('Replacing protective equipment suspends its detection reduction during installation.'));
  return effects.join(' ');
}
