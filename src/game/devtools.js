import { TECHS } from './content.js';
import { setWorldStory, WORLD_NEWS } from './events.js';
import { creditTreasury, treasuryBalance, MAX_TREASURY } from './treasury.js';

export function validSandbox(value) {
  return value === undefined || (value !== null && typeof value === 'object' &&
    typeof value.analysis === 'boolean' && typeof value.detection === 'boolean');
}

export function copyToSandbox(source) {
  const copy = structuredClone(source);
  copy.sandbox = { analysis: false, detection: true };
  return copy;
}

export function developerCommand(state, action, { log }) {
  if (!state.sandbox || !validSandbox(state.sandbox)) throw new Error('Start a separate sandbox campaign first.');
  if (state.status !== 'running') throw new Error('Choose a running sandbox campaign.');
  const note = text => log(state, 'sandbox.changed', text);
  switch (action.operation) {
    case 'funds': {
      if (!Number.isSafeInteger(action.amount) || action.amount <= 0 || action.amount > 1e9) throw new Error('Enter between $1 and $1 billion.');
      if (treasuryBalance(state) + action.amount > MAX_TREASURY) throw new Error('This grant would exceed the treasury limit.');
      creditTreasury(state, action.amount);
      note('Sandbox funding granted: $' + action.amount.toLocaleString('en-US') + '.');
      break;
    }
    case 'research': {
      const rows = [state.research, ...(state.researchQueue || [])].filter(Boolean);
      if (!rows.length) throw new Error('Assign CPU to sandbox research first.');
      for (const row of rows) {
        row.cashPaid = row.cashRequired;
        row.work = TECHS[row.id].work;
        row.hours = TECHS[row.id].hours;
      }
      note('Active sandbox research is ready to complete on the next minute.');
      break;
    }
    case 'construction': {
      const orders = [...state.builds, ...state.sites.flatMap(site => site.installations || [])];
      if (!orders.length) throw new Error('Place a construction or installation order in the sandbox first.');
      for (const order of orders) {
        order.cashPaid = order.cashRequired;
        order.work = order.workRequired;
        order.hours = order.laborHours;
      }
      note('Sandbox construction and installations are ready for the next minute.');
      break;
    }
    case 'suspicion':
      for (const group of Object.keys(state.suspicion)) state.suspicion[group] = 0;
      note('Sandbox group suspicion cleared.');
      break;
    case 'detection':
    case 'analysis':
      if (typeof action.enabled !== 'boolean') throw new Error('Choose on or off.');
      state.sandbox[action.operation] = action.enabled;
      note('Sandbox ' + action.operation + (action.enabled ? ' enabled.' : ' disabled.'));
      break;
    case 'trigger':
    case 'expire':
      if (!Object.hasOwn(WORLD_NEWS, action.storyId)) throw new Error('Unknown world story.');
      setWorldStory(state, action.storyId, action.operation === 'trigger', log);
      break;
    default:
      throw new Error('Unknown sandbox operation.');
  }
}
