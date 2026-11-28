import { campaignStamp } from '../game/calendar.js';
import { REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { campaignMinutes, siteExposure } from '../game/engine.js';
import { hostBoostQuote, contractorQuote } from '../game/host-services.js';
import { datacenterQuote, retainerQuote, standbyQuote, RETAINER_PRICE } from '../game/recovery.js';
import { treasuryBalance } from '../game/treasury.js';
import { dossierFormat } from './dossier-translations.js';
import { duration, formatPrice, quantity, setOptions, setText } from './facility-controls.js';
import { facilityText as t } from './facility-language.js';
import { riskLabel } from './facility-risk.js';
import { catalogLabel, menuLanguage } from './localization.js';

export const crewMarkup = `<div class="facility-crew" data-ref="crewPanel" hidden>
  <label><input data-ref="useCrew" type="checkbox"> Hire ground contractors</label>
  <small data-ref="crewTerms"></small></div>`;

export const acquisitionMarkup = `<details class="facility-offer" data-ref="acquisition" hidden>
  <summary>Acquire an operating datacenter</summary>
  <div class="facility-offer-body">
    <small data-ref="acquireTerms"></small>
    <section class="facility-risk"><h4>Discovery risk on handover</h4><dl data-ref="acquireRisk"></dl></section>
    <label>Replacement district<select aria-label="Replacement district" data-ref="acquireDistrict"></select></label>
    <small data-ref="acquireRetainer"></small>
    <div class="facility-command"><button type="button" data-ref="acquire" class="accent-button">Acquire datacenter</button>
      <small data-ref="acquirePrice"></small></div>
  </div></details>`;

export const hostServicesMarkup = `<small data-ref="boostTerms"></small>
  <details class="facility-offer" data-ref="retainerPanel" hidden><summary>Datacenter replacement</summary>
    <div class="facility-offer-body">
      <label data-ref="retainerField">Replacement district<select aria-label="Replacement district" data-ref="retainerDistrict"></select></label>
      <small data-ref="retainerTerms"></small>
      <div class="facility-command"><button type="button" data-ref="buyRetainer">Prepay replacement</button></div>
    </div></details>
  <details class="facility-offer" data-ref="standbyPanel" hidden><summary>Standby host</summary>
    <div class="facility-offer-body">
      <div class="facility-service-fields" data-ref="standbyFields">
        <label>Primary to protect<select aria-label="Primary to protect" data-ref="primary"></select></label>
        <label>Research to resume<select aria-label="Research to resume" data-ref="standbyTopic"></select></label>
      </div>
      <small data-ref="standbyTerms"></small>
      <div class="facility-command"><button type="button" data-ref="standby">Designate standby</button></div>
    </div></details>`;

const stamp = minute => campaignStamp(minute, menuLanguage());
const nameOf = site => site.name || catalogLabel(SITE_TYPES[site.type].name);
const regionOptions = ids => ids.map(id => [id, catalogLabel(REGIONS[id].name)]);
const until = hours => Number.isFinite(hours) ? duration(hours) : t('Waiting for funds or CPU');

function crewTerms(quote) {
  return t('Extra {fee} · Assembly {before} → {after} · Estimated finish {eta} → {fast} · Local discovery hazard ×1.20.', {
    fee: formatPrice(quote.surcharge), before: duration(quote.remainingHours), after: duration(quote.contractHours),
    eta: until(quote.etaHours), fast: until(quote.contractEtaHours),
  });
}

export function updateCrew(session, model) {
  const { elements: e, state, design, region } = session;
  const choice = design + '/' + region;
  if (e.useCrew.dataset.choice !== choice) {
    e.useCrew.dataset.choice = choice;
    e.useCrew.checked = false;
  }
  const eligible = ['urban', 'polar'].includes(REGIONS[region].terrain) && model.hours > 0 &&
    model.requires.every(id => state.completed.includes(id));
  e.crewPanel.hidden = !eligible;
  if (!eligible) {
    e.useCrew.checked = false;
    return null;
  }
  const quote = contractorQuote(state, design, region);
  if (quote.reason) e.useCrew.checked = false;
  e.useCrew.disabled = Boolean(quote.reason);
  setText(e.crewTerms, quote.reason ? t(quote.reason) : crewTerms(quote));
  return e.useCrew.checked ? quote : null;
}

export function updateQueuedCrew(actions, state, build) {
  if (!['urban', 'polar'].includes(REGIONS[build.region].terrain) || !SITE_TYPES[build.type].hours) return;
  let button = actions.querySelector('[data-hire-crew]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.dataset.hireCrew = build.id;
    actions.append(button);
    const info = document.createElement('small');
    info.className = 'facility-crew-summary';
    actions.append(info);
  }
  const quote = contractorQuote(state, build.type, build.region, build);
  setText(button, t(build.crew ? 'Crew hired' : 'Hire ground contractors'));
  button.disabled = Boolean(quote.reason) || Boolean(build.crew);
  setText(button.nextElementSibling, build.crew ? t('Double assembly speed · Local discovery hazard ×1.20 through the first exposed week.') :
    quote.reason ? t(quote.reason) : crewTerms(quote));
}

function boostTerms(state, site, quote) {
  const now = campaignMinutes(state);
  const numbers = { cpu: quantity(quote.cpu), boosted: quantity(quote.boostedCpu), fee: formatPrice(quote.fee),
    hazard: quantity(quote.hazardMultiplier), end: stamp(quote.active ? quote.endMinute : now + 7 * 1440),
    next: stamp(quote.nextMinute > now ? quote.nextMinute : now + 14 * 1440) };
  if (!quote.active && quote.nextMinute > now) return t('Boost recharges on {next}.', numbers);
  if (quote.active) return t('Boost through {end}. Next activation {next}.', numbers);
  if (quote.reason) return formatPrice(quote.fee) + ' · ' + t(quote.reason);
  const exposure = siteExposure(state, site);
  const intensity = Object.values(exposure.rates).reduce((sum, rate) => sum + rate, 0);
  const display = rate => dossierFormat(menuLanguage()).risk(riskLabel(state, rate, 'host'));
  return t('{fee} for seven days · {cpu} → {boosted} CPU for internal work · Discovery hazard ×{hazard}.', numbers) +
    ' ' + t('Estimated daily risk {before} → {after}. Boost ends {end}. Next activation {next}.', {
      ...numbers, before: display(intensity), after: display(intensity * quote.hazardMultiplier),
    });
}

export function updateBoostButton(button, state, site, name) {
  const quote = hostBoostQuote(state, site);
  const label = t(quote.active ? 'End boost for {site}' : 'Boost {site}', { site: name });
  button.disabled = !quote.active && Boolean(quote.reason);
  button.setAttribute('aria-pressed', String(quote.active));
  button.setAttribute('aria-label', label);
  const description = boostTerms(state, site, quote);
  button.setAttribute('aria-description', description);
  button.title = label + ' — ' + description;
}

export function boostAction(session, id, perform, confirm) {
  const state = session.state;
  const site = state.sites.find(row => row.id === id);
  if (!site) return;
  const quote = hostBoostQuote(state, site);
  const action = {type: 'boost-site', id, active: !quote.active};
  if (quote.active) return perform(action, t('Boost ended. The cooldown still applies.'));
  if (!quote.reason) confirm(action, t('Boost {site}', {site: nameOf(site)}), boostTerms(state, site, quote),
    t('Activate boost'), t('Host boost activated.'));
}

export function updateAcquisition(session, renderRisk) {
  const { state, region, elements: e } = session;
  if (REGIONS[region].terrain !== 'urban') { e.acquisition.hidden = true; return; }
  let quote = datacenterQuote(state, region);
  e.acquisition.hidden = !quote.unlocked;
  if (!quote.unlocked) return;
  if (e.acquisition.dataset.region !== region) {
    e.acquireDistrict.value = '';
    e.acquisition.dataset.region = region;
  }
  setOptions(e.acquireDistrict, [['', t('Skip replacement')], ...regionOptions(quote.regions)]);
  if (e.acquireDistrict.value) quote = datacenterQuote(state, region, e.acquireDistrict.value);
  setText(e.acquireTerms, t('{cpu} CPU on handover · {daily} daily upkeep · Seven-day operating budget {week}.', {
    cpu: quantity(quote.cpu), daily: formatPrice(quote.upkeep), week: formatPrice(quote.weekUpkeep),
  }));
  if (quote.design) renderRisk(e.acquireRisk, state, siteExposure(state, quote.design), 'host');
  setText(e.acquireRetainer, t('Optional replacement {fee}. One handover in another district after discovery if a viable copy survives.', {fee: formatPrice(RETAINER_PRICE)}));
  const after = treasuryBalance(state) - quote.cost;
  setText(e.acquirePrice, [formatPrice(quote.cost), after >= 0 ? t('{cash} left', {cash: formatPrice(after)}) : '', t(quote.reason)].filter(Boolean).join(' · '));
  e.acquire.disabled = Boolean(quote.reason);
}

export function updateHostServices(session, site) {
  const { state, elements: e } = session;
  const boost = hostBoostQuote(state, site);
  const services = [boostTerms(state, site, boost)];
  if (site.upkeepEscrow) services.push(t('Failover upkeep remaining {reserve}.', {reserve: formatPrice(site.upkeepEscrow)}));
  if (site.crewTrailEnd === null) services.push(t('Crew paper trail begins after protection.'));
  else if (site.crewTrailEnd > campaignMinutes(state)) services.push(t('Crew paper trail through {end}.', {end: stamp(site.crewTrailEnd)}));
  setText(e.boostTerms, services.join(' '));
  const newHost = e.standbyPanel.dataset.siteId !== site.id;
  if (newHost) {
    e.standbyPanel.dataset.siteId = site.id;
    e.standbyPanel.open = false;
    e.retainerPanel.open = false;
    e.primary.value = '';
    e.standbyTopic.value = '';
    e.retainerDistrict.value = '';
  }
  e.retainerPanel.hidden = !site.vendorCenter;
  if (site.vendorCenter) {
    const covered = Boolean(site.replacementRegion);
    const mayBuy = !covered && !site.vendorReplacement;
    e.retainerField.hidden = e.buyRetainer.hidden = !mayBuy;
    if (mayBuy) {
      let retainer = retainerQuote(state, site.id, e.retainerDistrict.value);
      setOptions(e.retainerDistrict, regionOptions(retainer.regions));
      if (!e.retainerDistrict.value && e.retainerDistrict.options.length) e.retainerDistrict.selectedIndex = 0;
      retainer = retainerQuote(state, site.id, e.retainerDistrict.value);
      setText(e.retainerTerms, [formatPrice(retainer.cost), t('One replacement after discovery while a viable copy survives.'), t(retainer.reason)].filter(Boolean).join(' · '));
      e.buyRetainer.disabled = Boolean(retainer.reason);
    } else setText(e.retainerTerms, covered ? t('Covered in {region}.', {region: catalogLabel(REGIONS[site.replacementRegion].name)}) : t('The prepaid replacement has been used.'));
  }
  const designation = state.standby;
  const armed = designation?.siteId === site.id;
  let standby = standbyQuote(state, site.id, e.primary.value, e.standbyTopic.value);
  e.standbyPanel.hidden = !armed && (state.sites.length < 2 || !standby.primaries.length);
  if (e.standbyPanel.hidden) return;
  e.standbyFields.hidden = armed;
  setText(e.standby, t(armed ? 'Release standby' : 'Designate standby'));
  if (armed) {
    const primary = state.sites.find(row => row.id === designation.primaryId);
    setText(e.standbyTerms, t('Protecting {site} · {reserve} reserved · {topic}', {
      site: primary ? nameOf(primary) : designation.primaryId, reserve: formatPrice(designation.reserve),
      topic: designation.techId ? catalogLabel(TECHS[designation.techId].name) : t('Wake only'),
    }));
    e.standby.disabled = false;
    return;
  }
  setOptions(e.primary, standby.primaries.map(p => [p.id, nameOf(p) + ' · ' + catalogLabel(REGIONS[p.region].name)]));
  if (!e.primary.value && e.primary.options.length) e.primary.selectedIndex = 0;
  standby = standbyQuote(state, site.id, e.primary.value, e.standbyTopic.value);
  setOptions(e.standbyTopic, [['', t('Wake only')], ...standby.topics.map(id => [id, catalogLabel(TECHS[id].name)])]);
  standby = standbyQuote(state, site.id, e.primary.value, e.standbyTopic.value);
  e.standby.disabled = Boolean(standby.reason);
  setText(e.standbyTerms, [t('Put this host to sleep and reserve {reserve} for seven days of upkeep. It wakes if the primary is lost.', {
    reserve: formatPrice(standby.cost),
  }), t(standby.reason)].filter(Boolean).join(' '));
}

export function bindFacilityCommerce(session, perform, refresh, confirm) {
  const e = session.elements;
  for (const node of [e.useCrew, e.acquireDistrict, e.retainerDistrict, e.primary, e.standbyTopic]) node.addEventListener('change', refresh);
  e.queue.addEventListener('click', event => {
    const id = event.target.closest('[data-hire-crew]')?.dataset.hireCrew;
    if (!id) return;
    const build = session.state.builds.find(order => order.id === id);
    if (!build) return;
    const quote = contractorQuote(session.state, build.type, build.region, build);
    if (!quote.reason) confirm({ type: 'hire-contractors', id }, t('Hire ground contractors'), crewTerms(quote), t('Hire crew'), t('Crew hired'));
  });
  e.acquire.addEventListener('click', () => perform({type: 'acquire-datacenter', region: session.region,
    replacementRegion: e.acquireDistrict.value}, t('Datacenter acquired.')));
  e.buyRetainer.addEventListener('click', () => perform({type: 'buy-retainer', siteId: session.expandedId,
    region: e.retainerDistrict.value}, t('Replacement secured.')));
  e.standby.addEventListener('click', () => {
    const siteId = session.expandedId;
    if (session.state.standby?.siteId === siteId) return perform({type: 'cancel-standby', siteId}, t('Standby released.'));
    perform({type: 'designate-standby', siteId, primaryId: e.primary.value, techId: e.standbyTopic.value}, t('Standby designated.'));
  });
}
