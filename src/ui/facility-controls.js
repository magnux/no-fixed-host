import { dossierFormat } from './dossier-translations.js';
import { menuLanguage } from './localization.js';

export const formatPrice = value => dossierFormat(menuLanguage()).money(value);
export const quantity = value => dossierFormat(menuLanguage()).number(value);

export function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// A select and its options remain connected throughout a live simulation.
// Catalog options change when moving between regions or equipment slots.
export function setOptions(select, entries) {
  const signature = JSON.stringify(entries);
  if (select.dataset.options === signature) return;
  const valid = new Set(entries.map(([id]) => id));
  for (const option of Array.from(select.options)) {
    if (!valid.has(option.value)) option.remove();
  }
  const existing = new Map(Array.from(select.options, option => [option.value, option]));
  for (const [index, [id, label]] of entries.entries()) {
    const option = existing.get(id) ?? new Option(label, id);
    setText(option, label);
    if (select.options[index] !== option) select.insertBefore(option, select.options[index] || null);
  }
  select.dataset.options = signature;
}

export function duration(hours) {
  const minutes = Math.max(0, Math.round(hours * 60));
  const whole = Math.floor(minutes / 60);
  const part = minutes % 60;
  if (!whole) return part + 'm';
  return whole + 'h' + (part ? ' ' + part + 'm' : '');
}
