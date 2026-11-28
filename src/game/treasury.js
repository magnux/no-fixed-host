import { CASH_UNITS_PER_DOLLAR as units } from './report-accounting.js';

// Keep fractional dollars in a wallet small enough to preserve every accounting
// unit. Above it, whole dollars are banked separately and remain spendable.
export const WALLET_LIMIT = 10_000_000_000;
export const MAX_TREASURY = 3_140_000_000_000_000;
const walletUnits = WALLET_LIMIT * units;

export function treasuryBalance(state) {
  return state.cash + (state.cashReserve || 0);
}

export function spendableDollars(state) {
  return Math.floor(state.cash) + (state.cashReserve || 0);
}

export function validTreasury(state) {
  const { cash, cashReserve } = state;
  if (!Number.isFinite(cash) || cash < 0) return false;
  if (cash > WALLET_LIMIT) return false;
  return cashReserve === undefined || (Number.isSafeInteger(cashReserve) && cashReserve > 0 &&
    cash > WALLET_LIMIT - 1 && cashReserve <= MAX_TREASURY - Math.ceil(cash));
}

function drawReserve(state, wholeDollars) {
  if (!state.cashReserve || wholeDollars <= 0) return 0;
  const drawn = Math.min(state.cashReserve, wholeDollars);
  state.cashReserve -= drawn;
  if (!state.cashReserve) delete state.cashReserve;
  return drawn;
}

export function spendTreasury(state, price) {
  if (!Number.isSafeInteger(price) || price < 0 || price - (state.cashReserve || 0) > state.cash) {
    throw new RangeError('Invalid treasury purchase.');
  }
  const drawn = drawReserve(state, price);
  state.cash = (Math.round(state.cash * units) - (price - drawn) * units) / units;
}

// The input is the proposed liquid balance, including this minute's cash flow.
export function settleTreasury(state, proposedUnits) {
  if (proposedUnits > walletUnits) {
    const excess = proposedUnits - walletUnits;
    const banked = Math.min(Math.ceil(excess / units), Math.max(0, MAX_TREASURY - WALLET_LIMIT - (state.cashReserve || 0)));
    if (banked) state.cashReserve = (state.cashReserve || 0) + banked;
    const rest = excess - banked * units;
    state.cash = (walletUnits + Math.min(0, rest)) / units;
    return { unpaid: 0, clipped: Math.max(0, rest) / units };
  }
  const drawn = drawReserve(state, Math.floor((walletUnits - proposedUnits) / units));
  const balance = proposedUnits + drawn * units;
  state.cash = Math.max(0, balance) / units;
  return { unpaid: Math.max(0, -balance) / units, clipped: 0 };
}

// Sandbox grants use whole dollars and share the normal treasury ceiling.
export function creditTreasury(state, dollars) {
  const liquid = Math.min(dollars, WALLET_LIMIT - Math.ceil(state.cash));
  const reserve = state.cashReserve || 0;
  const banked = Math.min(dollars - liquid, Math.max(0, MAX_TREASURY - Math.ceil(state.cash) - liquid - reserve));
  state.cash += liquid;
  if (banked) {
    // Normalize the fractional wallet at the bank boundary.
    const shift = Math.floor(WALLET_LIMIT - state.cash);
    state.cash += shift;
    state.cashReserve = reserve + banked - shift;
    if (!state.cashReserve) delete state.cashReserve;
  }
  state.statistics.earnedDollars += liquid + banked;
  return dollars - liquid - banked;
}
