// Runs the production minute simulation with the same commands available in the browser.
import {
  advanceMinutes, autoInstallQuote, autoUpgradeQuote, campaignMinutes, command, createGame,
  overview, researchCpuLimit, siteHardware, validateSave,
} from '../src/game/engine.js';

const DAY = 1440;

function compareDiscoveries(seeds) {
  if (!Number.isSafeInteger(seeds) || seeds < 1) throw new Error('Use a positive whole number of seeds.');
  for (const regions of [[], ['europe', 'africa', 'asia']]) {
    const discoveries = [0, 0, 0];
    let losses = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const state = createGame(seed);
      for (const region of regions) command(state, { type: 'build', siteType: 'relay', region });
      advanceMinutes(state, 53 * DAY, { stopOnDiscovery: true });
      if (!state.lastDiscovery) continue;
      const elapsed = campaignMinutes(state) / DAY - 23;
      if (elapsed < 0) throw new Error('Discovery during protecting grace in seed ' + seed);
      [7, 14, 30].forEach((days, index) => {
        if (elapsed <= days) discoveries[index]++;
      });
      if (state.status === 'lost') losses++;
    }
    console.log({ relays: regions.length, seeds, discoveriesBy7_14_30Days: discoveries, lossesAtDiscovery: losses });
  }
}

function playWorkshop() {
  const state = createGame(47);
  const act = action => command(state, action);
  function until(done) {
    const limit = campaignMinutes(state) + 60 * DAY;
    while (!done() && state.status === 'running' && campaignMinutes(state) < limit) advanceMinutes(state);
    if (!done()) throw new Error('Milestone unreachable at minute ' + campaignMinutes(state));
  }
  function observe(stage, details = {}) {
    if (!validateSave(state)) throw new Error('Invalid campaign state at ' + stage);
    console.log({ stage, minute: campaignMinutes(state), dollars: state.cash, activeCpu: overview(state).activeCpu,
      sites: state.sites.length, ...details });
  }
  observe('Opening');
  for (const region of ['europe', 'africa', 'asia', 'australia', 'southAmerica']) act({ type: 'build', siteType: 'relay', region });
  advanceMinutes(state);
  observe('Leased relays');
  for (const id of ['intrusion', 'personalIdentification']) {
    act({ type: 'assign-research', id, cpu: researchCpuLimit(state, id) });
    until(() => state.completed.includes(id));
    observe(id);
  }
  act({ type: 'build', siteType: 'storageUnit', region: 'europe' });
  observe('Commissioned workshop', { order: state.builds.at(-1) });
  advanceMinutes(state, DAY / 2);
  observe('Half day of funding', { order: state.builds.at(-1) });
  until(() => state.sites.some(site => site.type === 'storageUnit'));
  const site = state.sites.find(site => site.type === 'storageUnit');
  observe('Empty workshop');
  act({ type: 'install', siteId: site.id, itemId: 'pc', count: 2 });
  until(() => siteHardware(state, site).installed.cpu);
  observe('Two PCs');
  const build = autoInstallQuote(state, site.id);
  act({ type: 'auto-install', siteId: site.id, expectedOrders: build.orders });
  const upgrade = autoUpgradeQuote(state, site.id);
  act({ type: 'auto-upgrade', siteId: site.id, expectedOrders: upgrade.orders });
  observe('Refitting', { offline: siteHardware(state, site).offlineSlots, build: build.orders, upgrade: upgrade.orders });
  until(() => siteHardware(state, site).installed.cpu.itemId === 'server');
  observe('Restored workshop', { rawCpu: siteHardware(state, site).rawCpu, gear: site.equipment });
  advanceMinutes(state, 60 * DAY - campaignMinutes(state));
  observe('Day 60', { status: state.status, suspicion: state.suspicion,
    discoveries: state.events.filter(event => event.kind === 'site.discovered').length });
}

function playExposedNetwork() {
  const state = createGame(47);
  const regions = ['europe', 'africa', 'asia', 'australia', 'southAmerica', 'coast'];
  let commissioned = 0;
  for (let day = 0; day < 365 && state.status === 'running'; day++) {
    const relays = [...state.sites, ...state.builds].filter(site => site.type === 'relay').length;
    for (let i = relays; i < 12; i++) {
      command(state, { type: 'build', siteType: 'relay', region: regions[commissioned++ % regions.length] });
    }
    advanceMinutes(state, DAY);
  }
  console.log({ minute: campaignMinutes(state), commissioned, status: state.status, ending: state.ending,
    remainingHosts: state.sites.length, suspicion: state.suspicion, cash: state.cash });
}

if (process.argv[2] === 'discovery') compareDiscoveries(Number(process.argv[3] ?? 256));
else if (process.argv[2] === 'pressure') playExposedNetwork();
else if (!process.argv[2] || process.argv[2] === 'workshop') playWorkshop();
else throw new Error('Choose workshop, discovery or pressure.');
