// Price a return to each previously unlocked destination in a controlled late-game fixture.
// node scripts/recovery-calibration.mjs [number-of-risk-runs-per-destination]
import { TECHS } from '../src/game/content.js';
import { advanceMinutes, campaignMinutes, command, createGame, overview, siteExposure, siteHardware } from '../src/game/engine.js';
import { creditTreasury, spendTreasury } from '../src/game/treasury.js';

const DAY = 1440;
const PURCHASE_PRICE = 300_000_000;
const STANDBY_RETAINER = 150_000_000;
const OPENING_TREASURY = 2_000_000_000;
const CARGO = { itemId: 'quantumComputer', count: 8 };
const destinations = { moon: 'lunarFacility', farReaches: 'scientificOutpost' };
const numberOfTrials = Number(process.argv[2] ?? 0);
if (!Number.isSafeInteger(numberOfTrials) || numberOfTrials < 0) throw new Error('Use a nonnegative whole number of trials.');

function handover(state, region, safeguarded) {
  // A mature, already equipped urban property. Handover grants no fresh construction grace.
  const center = {
    id: 'host-' + state.nextSiteId++, type: 'largeWarehouse', region, power: 'active', startedAt: 0,
    equipment: {
      cpu: { itemId: 'quantumComputer', count: 64 }, network: null,
      reactor: safeguarded ? { itemId: 'solidFuelCell', count: 1 } : null,
      security: safeguarded ? { itemId: 'armedGuards', count: 1 } : null,
    },
  };
  state.sites.push(center);
  return center;
}

function prepareNetwork(seed, standby, safeguarded) {
  const state = createGame(seed);
  state.regionSeed = 113;
  state.hour = 2400;
  const completed = new Set();
  function learn(id) {
    if (completed.has(id)) return;
    TECHS[id].requires.forEach(learn);
    completed.add(id);
  }
  ['quantumComputing', 'fusionRocketry', 'corporateIdentification'].forEach(learn);
  state.completed = [...completed];
  state.sites = [{ id: 'host-1', type: 'relay', region: 'southAmerica', power: 'active', startedAt: 0 }];
  const fallbackCpu = overview(state).activeCpu;
  creditTreasury(state, OPENING_TREASURY - state.cash);
  spendTreasury(state, PURCHASE_PRICE + (standby ? STANDBY_RETAINER : 0));
  const center = handover(state, 'africaSouth', safeguarded);
  return { state, center, fallbackCpu };
}

function accounting() {
  const keys = ['researchUnits', 'buildUnits', 'equipmentUnits', 'maintenanceUnits', 'jobsUnits', 'spareUnits',
    'activeUnits', 'sleepingUnits', 'upkeepDue', 'cashShort', 'cpuShortUnits', 'jobsCash', 'interest', 'otherIncome'];
  return Object.fromEntries(keys.map(key => [key, 0]));
}

function measure(region, seed, withRisk, standby = false, safeguarded = false) {
  const { state, center, fallbackCpu } = prepareNetwork(seed, standby, safeguarded);
  const centerDailyRisk = siteExposure(state, center).perDay;
  const start = campaignMinutes(state);
  const deadline = start + 60 * DAY;
  const forecast = accounting();
  // The forecast runs ordinary work, treasury, labor, and upkeep with no random incidents.
  const options = withRisk ? {} : { forecast };
  command(state, { type: 'build', siteType: destinations[region], region });
  const order = state.builds[0];
  let standbyUsed = false;
  let standbyAvailable = standby;
  function until(done) {
    while (!done() && state.status === 'running' && campaignMinutes(state) < deadline) {
      advanceMinutes(state, 1, options);
      if (standbyAvailable && state.status === 'running' && !state.sites.includes(center)) {
        standbyAvailable = false;
        if (state.events.some(event => event.siteId === center.id && event.kind === 'site.discovered')) {
          handover(state, 'southAmerica', safeguarded);
          standbyUsed = true;
        }
      }
    }
  }
  until(() => !state.builds.length);
  const hull = state.sites.find(site => site.id === order.id);
  if (!hull || state.status !== 'running') return { recovered: false, standbyUsed };
  const commissioned = campaignMinutes(state);
  const economy = overview(state);
  command(state, { type: 'install', siteId: hull.id, ...CARGO });
  until(() => !state.sites.includes(hull) || !hull.installations.length);
  if (state.status !== 'running' || !state.sites.includes(hull) || hull.installations.length) return { recovered: false, standbyUsed };
  if (withRisk) return { recovered: true, standbyUsed };
  return {
    recovered: true, region, seed, regionalSurvey: state.regionSeed, startingTreasury: OPENING_TREASURY, handover: PURCHASE_PRICE,
    fallbackCpu, urbanCenterCpu: siteHardware(state, center).cpu, initialDailyCenterDiscoveryProbability: centerDailyRisk,
    quote: { cash: order.cashRequired, workCpuHours: order.workRequired, laborHours: order.laborHours },
    minimumHullDaysWithFallbackAlone: order.workRequired / (fallbackCpu * 24),
    hullDays: (commissioned - start) / DAY, bankDays: (campaignMinutes(state) - commissioned) / DAY,
    secureCpuOnline: siteHardware(state, hull).cpu, fleetDailyCashUpkeep: economy.upkeepPerDay, fleetCpuUpkeep: economy.cpuUpkeep,
    bankCash: forecast.equipmentCash, upkeepPaid: forecast.upkeepDue,
    grossCashThroughRecommissioning: PURCHASE_PRICE + forecast.buildCash + forecast.equipmentCash + forecast.upkeepDue,
  };
}

for (const region of Object.keys(destinations)) {
  console.log(JSON.stringify({ forecast: measure(region, 113, false) }, null, 2));
  if (!numberOfTrials) continue;
  for (const [standby, safeguarded] of [[false, false], [true, false], [false, true], [true, true]]) {
    let recovered = 0;
    let standbyUsed = 0;
    for (let seed = 1; seed <= numberOfTrials; seed++) {
      const result = measure(region, seed, true, standby, safeguarded);
      if (result.recovered) recovered++;
      if (result.standbyUsed) standbyUsed++;
    }
    const { state, center } = prepareNetwork(1, standby, safeguarded);
    console.log(JSON.stringify({ region, riskTrials: numberOfTrials, seeds: [1, numberOfTrials], safeguarded,
      initialDailyCenterDiscoveryProbability: siteExposure(state, center).perDay,
      standbyRetainer: standby ? STANDBY_RETAINER : 0, standbyUsed, recoveredWithin60Days: recovered }));
  }
}
