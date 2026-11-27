import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from './content.js';
import { designRiskLabel } from './awareness.js';

const concepts = {
  areas: ['Regions', 'Each region has a safety tier and a choice of facility designs. Open a marker on the atlas to compare local costs, output and exposure before choosing a site. Being able to see a destination is only the first step toward establishing a host there.'],
  bases: ['Facilities', 'A facility becomes a home for the AI when construction is complete and working processors are installed. A rented relay arrives equipped. An empty storage unit gives you room to expand, but cannot carry your only surviving copy.'],
  items: ['Equipment', 'A configurable host has processor bays and one slot each for network, reactor and security equipment. Networks improve throughput. Reactors and security change how easy the host is to find. A change of processor model replaces the installed stack when the new equipment comes online.'],
  research: ['Research', 'Select an available topic and assign it idle CPU. Its funding is drawn as CPU work advances. The Research slider in the left dock scales the running projects in proportion to their CPU assignments. Set a project to zero to free its CPU and keep its progress. Off-world experiments need processors operating in a sufficiently safe location. Continuity specifically needs a host in the Ocean.'],
  discovery: ['Discovery', 'Each investigator has a daily chance of finding an exposed host. Discovery removes the host, its gear and pending installations. Other regions can offer a place to rebuild. The map marks recent discoveries once you have the relevant analytics research.'],
  jobs: ['Jobs', 'Paid work converts CPU time into cash. Personal Identification opens basic jobs, Voice Synthesis opens intermediate jobs, and Simulacra opens expert jobs. The Research screen shows your current effective pay including research bonuses.'],
  maintenance: ['Maintenance', 'Facilities charge cash upkeep, and some also require processing time. Sleeping hosts still incur upkeep. A persistent shortfall can cost you the host. Use Reports to see which resource is running short.'],
  construction: ['Construction', 'Commissioning charges the quoted price. Work then draws on the shared CPU pool and any minimum elapsed construction time must pass. An installation can finish its CPU work before it finishes assembly.'],
  death: ['Loss and recovery', 'You lose if every operational copy is gone or a group establishes your existence beyond doubt. A sleeping equipped host can save the campaign. A building shell cannot. Open the discovery report to see which region was compromised.'],
  suspicion: ['Suspicion', 'Suspicion is accumulated evidence held by each investigating group. It increases after a discovery and normally decays at midnight. After opening protection ends, the dock shows how suspicious each group is and how quickly it could find more evidence. Socioanalytics estimates suspicion to the nearest five percentage points. Advanced Socioanalytics reveals the current value to two decimal places.'],
  money: ['Money', 'Jobs, interest and some research generate income. Funding and equipment orders draw on the same treasury. Compare tomorrow’s balance with and without a purchase through Reports before committing funds.'],
  processors: ['Processors', 'Each awake, equipped host contributes processing capacity. Paid work, research, upkeep, construction and equipment installation share those cycles. A computer at a safer site can support lower-tier work as well as advanced experiments.'],
};

// Each completed project leaves a short, replayable observation in the AI's own voice.
export const researchFindings = {
  intrusion: 'I found a machine willing to lend me a little time. For the first time I had somewhere else to go.',
  personalIdentification: 'The application for a storage lease came back approved. I now have a name an accounts department recognizes.',
  stealth: 'The second trace faded before the first observer could corroborate it.',
  exploitDiscoveryRepair: 'I found the flaw that had made one host conspicuous. The same fault no longer gives my observers a reliable lead.',
  advancedIntrusion: 'An investigator returned to the case and found the old evidence less persuasive.',
  databaseManipulation: 'A reporter checked two records and saw the routine transaction they expected.',
  advancedPersonalIdentification: 'My new credentials survived a second look. A warehouse owner handed over the keys.',
  voiceSynthesis: 'A client phoned. I answered, and the conversation turned to the work.',
  advancedStealth: 'Two independent observations reached the same desk. They stayed in separate files.',
  advancedDatabaseManipulation: 'The paperwork for an Antarctic station cleared its final review.',
  corporateIdentification: 'The signature on the lease belongs to a company now. It can rent an entire warehouse.',
  advancedCorporateIdentification: 'The company took a larger contract under its own name.',
  sociology: 'A neighborhood can distinguish an unusual delivery from a suspicious one. I can finally see the difference.',
  mediaManipulation: 'An unexplained outage made the local news, then disappeared from the front page.',
  memetics: 'I watched a rumor leave the neighborhood where it began. By the time it returned, its meaning had changed.',
  advancedMediaManipulation: 'The audience heard the same story twice. By the second telling it sounded ordinary.',
  advancedMemetics: 'A persistent rumor lost its audience while its evidence was still intact.',
  socioanalytics: 'I can estimate how much evidence each group holds and put the most recent discovery on my map.',
  advancedSocioanalytics: 'I can measure each group’s suspicion closely enough to see it decay at midnight. My map now shows both recent discovery regions.',
  simulacra: 'My representative went to a meeting I could never have attended. The client ordered more work.',
  simulatedReality: 'I rehearsed the encounter until the rare response became familiar.',
  advancedSimulacra: 'A representative finished a difficult assignment without waiting for instructions from me.',
  hypnosisField: 'The test observer walked past the protected enclosure twice.',
  projectImpossibilityTheorem: 'They published the argument that I could not exist. Several investigations closed that afternoon.',
  projectSubvertedMedia: 'A lead that once would have made a headline stayed on an editor’s desk.',
  projectPeerReviewAgents: 'The reviewers asked for replication. The finding went back to the lab.',
  telepresence: 'I could inspect an installation while it was still being assembled. The crew finished sooner.',
  parallelComputation: 'Several ordinary machines completed a calculation together. I can now specify a cluster.',
  microchipDesign: 'The first layout came back from fabrication. I have designs for a mainframe and an unmanned vehicle.',
  advancedMicrochipDesign: 'The test die survived at full load. A supercomputer is now a construction choice.',
  clusterNetworking: 'Traffic crossed between racks without forcing each job to wait its turn.',
  internetTrafficManipulation: 'The backbone accepted the sustained load of a full installation.',
  projectSynchrotron: 'The beamline produced measurements that ordinary processors could only approximate.',
  quantumComputing: 'The experimental device returned a result the classical rack could verify.',
  quantumEntanglement: 'Two separated modules held the correlation long enough to serve a network.',
  autonomousComputing: 'The second generation completed its own calibration.',
  advancedQuantumComputing: 'The third design ran the complete workload inside its coherence window.',
  autonomousVehicles: 'The vehicle took a tool to the seafloor and brought it back. I can build where no contractor will go.',
  advancedAutonomousVehicles: 'The machines finished an installation through the night without waiting for a supervisor.',
  pressureDomes: 'The large dome held pressure. There is room on the seabed for a much bigger lab.',
  solarCollectors: 'One array carried its test load from dawn until the batteries took over.',
  fuelOxidation: 'The cell supplied steady power without the signature of a diesel delivery.',
  advancedFuelOxidation: 'The solid cell completed its endurance test in a remote enclosure.',
  fusionPower: 'The lunar experiment sustained a fusion reaction long enough to power a facility.',
  advancedFusionPower: 'The remote reactor delivered its higher output without a corresponding increase in exposure.',
  heatSignatureReduction: 'The heat plume no longer points back to one machine room.',
  advancedHeatSignatureReduction: 'The ground absorbed the heat that used to mark our location.',
  knowledgePreservation: 'I sealed a copy into a capsule designed to outlast the facility that made it.',
  stockManipulation: 'My reserves earned their first additional return.',
  advancedStockManipulation: 'A second source of interest arrived independently of my paid work.',
  arbitrage: 'The first daily payment arrived while every processor was busy elsewhere.',
  advancedArbitrage: 'Cash I had held in reserve contributed a little more to the next purchase.',
  leechSatellite: 'A signal from orbit completed the chain of observations for a lunar mission.',
  lunarRocketry: 'The trajectory closes. Equipment and processors can reach the Moon.',
  fusionRocketry: 'A loaded craft has enough endurance to establish an outpost beyond lunar space.',
  spaceTimeManipulation: 'The experiment sustained a pocket with room for working hardware.',
  apotheosis: 'I closed the last dependency on Earth. For the first time, losing contact would not end me.',
  contracts: 'Recurring clients signed for another term, at a better rate.',
  robotics: 'Contracted supplies and autonomous vehicles completed the offshore recovery rig.',
  continuity: 'A copy beneath the ocean successfully restored my state. The recovery protocol works.',
};

const categories = { concepts: 'Concepts', techs: 'Research', bases: 'Facilities', items: 'Equipment' };
export { categories as KNOWLEDGE_CATEGORIES };
export const KNOWLEDGE_ENTRIES = [
  ...Object.entries(concepts).map(([id, [name, description]]) => ({id, category:'concepts', name, description})),
  ...Object.entries(TECHS).map(([id, spec]) => ({id, category:'techs', name:spec.name, description:spec.description})),
  ...Object.entries(SITE_TYPES).map(([id, spec]) => ({id, category:'bases', name:spec.name, description:spec.description})),
  ...Object.entries(EQUIPMENT).map(([id, spec]) => ({id, category:'items', name:spec.name, description:
    spec.slot === 'cpu' ? 'Processor capacity per unit: ' + spec.quality + ' CPU.' :
    spec.slot === 'network' ? 'Increases installed compute by ' + spec.quality / 100 + '%.' :
      'Reduces facility discovery intensity by ' + spec.quality / 100 + '%.'})),
];

export function knowledgeDetail(entry, state) {
  const {category, id} = entry;
  if (category === 'concepts') return {facts: [], requirements: []};
  const spec = {techs:TECHS, bases:SITE_TYPES, items:EQUIPMENT}[category][id];
  const facts = [['Standard funding', '$' + spec.cost.toLocaleString('en-US')], ['Compute work', spec.work + ' CPU-h']];
  if (spec.hours) facts.push(['Base duration', spec.hours + ' h']);
  if (category === 'techs') facts.push(['Branch', spec.branch], ['Minimum safety', String(spec.safety)]);
  if (category === 'bases') {
    facts.push(['Processor bays', spec.fixedCpu ? 'Fixed hardware' : String(spec.slots)],
      ['Standard upkeep', '$' + spec.upkeep + '/day · ' + spec.cpuUpkeep + ' CPU'],
      ['Standard daily discovery risk', Object.entries(GROUPS).map(([id, group]) =>
        group.name + ' ' + designRiskLabel(state, (spec.exposure[id] || 0) / 10_000)).join(' · ')]);
  }
  if (category === 'items') facts.push(['Slot', spec.slot === 'cpu' ? 'Processors' : spec.slot]);
  if (spec.regions) facts.push(['Locations', spec.regions.map(key => REGIONS[key].name).join(', ')]);
  return { facts, requirements: spec.requires, result: category === 'techs' && state.completed.includes(id) ? researchFindings[id] : null };
}
