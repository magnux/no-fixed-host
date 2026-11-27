import { CASH_UNITS_PER_DOLLAR } from './report-accounting.js';

// At this scale a balance can round-trip through dollars while preserving
// every 1/144000-dollar accounting unit. All catalog orders fit in the wallet.
export const MAX_TREASURY = 10_000_000_000;
const maxUnits = MAX_TREASURY * CASH_UNITS_PER_DOLLAR;

export function validTreasury(state, legacy = false) {
  const { cash, cashReserve } = state;
  if (!Number.isFinite(cash) || cash < 0) return false;
  if (legacy) return cash <= Number.MAX_SAFE_INTEGER && cashReserve === undefined;
  if (cash > MAX_TREASURY) return false;
  return cashReserve === undefined || (Number.isSafeInteger(cashReserve) && cashReserve > 0 &&
    cash > MAX_TREASURY - 1 && cashReserve <= Number.MAX_SAFE_INTEGER - Math.ceil(cash));
}

export function migrateTreasury(state) {
  if (!validTreasury(state, true)) throw new RangeError('Invalid legacy treasury.');
  if (state.cash <= MAX_TREASURY) return;
  state.cashReserve = Math.ceil(state.cash - MAX_TREASURY);
  state.cash -= state.cashReserve;
}

function drawReserve(state, wholeDollars) {
  if (!state.cashReserve || wholeDollars <= 0) return 0;
  const drawn = Math.min(state.cashReserve, wholeDollars);
  state.cashReserve -= drawn;
  if (!state.cashReserve) delete state.cashReserve;
  return drawn;
}

// Campaign purchase prices are whole dollars. Redeem migrated funds first.
export function spendTreasury(state, price) {
  if (!Number.isSafeInteger(price) || price < 0 || price > MAX_TREASURY ||
      price - (state.cashReserve || 0) > state.cash) throw new RangeError('Invalid treasury purchase.');
  const drawn = drawReserve(state, price);
  const walletUnits = Math.round(state.cash * CASH_UNITS_PER_DOLLAR);
  state.cash = (walletUnits - (price - drawn) * CASH_UNITS_PER_DOLLAR) / CASH_UNITS_PER_DOLLAR;
}

export function settleTreasury(state, proposedCashUnits) {
  const drawn = drawReserve(state, Math.floor((maxUnits - proposedCashUnits) / CASH_UNITS_PER_DOLLAR));
  const balance = proposedCashUnits + drawn * CASH_UNITS_PER_DOLLAR;
  state.cash = Math.min(maxUnits, Math.max(0, balance)) / CASH_UNITS_PER_DOLLAR;
  return {
    unpaid: Math.max(0, -balance) / CASH_UNITS_PER_DOLLAR,
    clipped: Math.max(0, balance - maxUnits) / CASH_UNITS_PER_DOLLAR,
  };
}
