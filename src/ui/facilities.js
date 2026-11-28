import { duration, formatPrice, quantity, setOptions, setText } from './facility-controls.js';
import { acquisitionMarkup, bindFacilityCommerce, boostAction, crewMarkup, hostServicesMarkup, updateAcquisition,
  updateBoostButton, updateCrew, updateHostServices, updateQueuedCrew } from './facility-commerce.js';
import { facilityText, localizeFacilityMarkup } from './facility-language.js';
import { dossierFormat, dossierLabel, localizedDesignText } from './dossier-translations.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { autoInstallQuote, autoUpgradeQuote, buildReason, constructionStatuses, equipmentRank, hostRank, installQuote, installReason, laborHours, previewSiteExposure, siteExposure, siteHardware } from '../game/engine.js';
import { regionAvailable } from '../game/geography.js';
import { treasuryBalance } from '../game/treasury.js';
import { projectedCompute, slotSignature } from '../game/equipment.js';
import { facilityName, regionFactors, regionalSpec, regionPlaces, removalReason } from '../game/facility-operations.js';
import { rankLabels, refitWarning, showRank } from './equipment-display.js';
import { riskLabel } from './facility-risk.js';
import { facilityIcon } from './facility-icons.js';
import { equipmentIcon, icon } from './icons.js';
import './facilities.css';

const SLOT_NAMES = { cpu: 'Processors', network: 'Network', reactor: 'Reactor', security: 'Security' };
const sessions = new WeakMap();

function renderRisk(node, state, exposure, context = 'design') {
  if (!node.childElementCount) {
    for (const [id, group] of Object.entries(GROUPS)) {
      const row = document.createElement('div');
      const label = document.createElement('dt');
      label.textContent = catalogLabel(group.name);
      const value = document.createElement('dd');
      value.dataset.group = id;
      row.append(label, value);
      node.append(row);
    }
  }
  for (const row of node.children) {
    const value = row.lastElementChild;
    setText(value, dossierFormat(menuLanguage()).risk(riskLabel(state, exposure.rates[value.dataset.group], context)));
  }
}

function equipmentEffect(item) {
  if (item.slot === 'cpu') return quantity(item.quality) + ' CPU per processor';
  const percent = quantity(item.quality / 100) + '%';
  return item.slot === 'network' ? '+' + percent + ' compute' : '−' + percent + ' detection rate';
}

function prerequisites(node, ids, state, handler) {
  const missing = handler ? [...new Set(ids)].filter(id => !state.completed.includes(id)) : [];
  const signature = missing.join(' ');
  if (node.dataset.requires === signature) return missing.length;
  node.dataset.requires = signature;
  node.replaceChildren();
  node.hidden = !missing.length;
  if (!missing.length) return 0;
  node.append(facilityText('Research required') + ' ');
  for (const id of missing) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.dataset.researchId = id;
    button.textContent = catalogLabel(TECHS[id].name);
    node.append(button);
  }
  return missing.length;
}

function renderQueue(root, records, state) {
  const old = new Map(Array.from(root.children, row => [row.dataset.id, row]));
  for (const r of records) {
    let row = old.get(r.id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'facility-progress';
      row.dataset.id = r.id;
      const symbol = r.itemId ? equipmentIcon(EQUIPMENT[r.itemId].slot) : facilityIcon(r.type);
      row.innerHTML = '<span class="facility-queue-entry">' + symbol + '<span></span></span><small></small><progress max="100"></progress>';
      root.append(row);
    }
    if (r.cancellable && !row.querySelector('.facility-command')) {
      const actions = document.createElement('div');
      actions.className = 'facility-command';
      for (const [attribute, label] of [['renameId', facilityText('Rename facility')], ['cancelId', facilityText('Cancel order')]]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-button';
        button.dataset[attribute] = r.id;
        button.textContent = label;
        actions.append(button);
      }
      row.append(actions);
    } else if (!r.cancellable) {
      row.querySelector('.facility-command')?.remove();
    }
    if (r.cancellable) updateQueuedCrew(row.querySelector('.facility-command'), state, r);
    old.delete(r.id);
    const [name, detail, bar] = row.children;
    setText(name.lastElementChild, r.name);
    const status = r.status;
    const pc = Math.floor(status.progress * 100);
    row.dataset.stalled = String(status.stalled);
    const remaining = facilityText('{due} of {price} outstanding · {work} CPU-h and {time} labor remaining', {
      due: formatPrice(status.cashRemaining), price: formatPrice(status.cashPaid + status.cashRemaining),
      work: quantity(status.workRemaining), time: duration(status.hoursRemaining),
    });
    const eta = Number.isFinite(status.etaHours) ? ' · ' + facilityText('ETA') + ' ' + duration(status.etaHours) : '';
    const text = pc + '% · ' + (status.stalled ? facilityText('Paused') + ' · ' : '') + facilityText(status.reason) + ' · ' + remaining + eta;
    setText(detail, text);
    if (bar.value !== pc) bar.value = pc;
    bar.setAttribute('aria-label', menuLanguage() === 'en' ? r.name + ' completion' : facilityText('Completion') + ' · ' + r.name);
  }
  for (const row of old.values()) row.remove();
}

function mountFacilities(root) {
  root.innerHTML = `
    <section class="panel facility-console">
      <header class="card-header"><h2>Facilities</h2>
        <label class="facility-region" for="region">Region
          <select id="region" data-ref="region"></select>
        </label>
      </header>
      <div class="facility-body">
        <div class="facility-modes" role="group" aria-label="Facility tools">
          <button type="button" data-ref="buildMode">Build facility</button>
          <button type="button" data-ref="manageMode">Manage hosts</button>
        </div>
        <section data-ref="buildPanel" class="facility-tool" aria-label="Build a facility">
          <details class="facility-comparison"><summary>Compare regions</summary>
            <table><caption>Regional multipliers</caption><thead><tr><th>Region</th><th>CPU</th><th>Costs¹</th><th>Time</th><th>Risk²</th><th>Tier</th></tr></thead>
            <tbody data-ref="regionTable"></tbody></table>
            <small>¹ Price, CPU work and upkeep. ² Discovery rate before local history and equipment.</small>
          </details>
          <small data-ref="regionTerms"></small>
          ${acquisitionMarkup}
          <fieldset id="facility-type" class="facility-picker" data-ref="picker">
            <legend>Facility type</legend>
            <div class="facility-designs" data-ref="designs"></div>
          </fieldset>
          <p data-ref="noBuild" hidden></p>
          <div class="facility-recipe" data-ref="recipe">
            <p data-ref="description"></p>
            <dl class="facility-facts">
              <div><dt>Total cost</dt><dd data-ref="cost"></dd></div>
              <div><dt>Processor slots</dt><dd data-ref="slots"></dd></div>
              <div><dt>Upkeep</dt><dd data-ref="upkeep"></dd></div>
            </dl>
            <small data-ref="commissionTime"></small>
            ${crewMarkup}
            <section class="facility-risk" aria-label="Design risk"><h4>Daily discovery risk when mature and online</h4>
              <dl data-ref="designRisk"></dl><small data-ref="designRiskNote"></small></section>
            <label class="facility-name-field">Facility name (optional)<input type="text" data-ref="buildName" maxlength="48" autocomplete="off"></label>
            <div class="facility-command">
              <button type="button" class="accent-button" data-ref="build">Build</button>
              <button type="button" data-ref="previewBuild">Forecast order</button>
              <small data-ref="buildReason"></small>
            </div>
            <div class="facility-prereqs" data-ref="buildPrereqs" hidden></div>
          </div>
        </section>
        <section data-ref="managePanel" class="facility-tool" aria-label="Completed facilities" hidden>
          <ul data-ref="hosts" class="facility-hosts" aria-label="Completed hosts"></ul>
          <p data-ref="noHosts" hidden>No completed facilities in this region.</p>
          <div data-ref="inspector" class="facility-inspector" hidden>
            <form class="facility-identity" data-ref="hostIdentity">
              <input type="text" data-ref="rename" aria-label="Host name" maxlength="48" autocomplete="off" required>
              <button type="submit" data-ref="saveName">Rename</button>
            </form>
            <p class="facility-summary" data-ref="hostSummary"></p>
            <small data-ref="localUpkeep"></small>
            <section class="facility-risk" aria-label="Current host risk"><h4>Current daily discovery risk</h4>
              <dl data-ref="localRisk"></dl><small data-ref="localRiskNote"></small></section>
            <div class="facility-site-nav" role="group" aria-label="Browse hosts"><button type="button" data-ref="prev">Previous host</button>
              <button type="button" data-ref="next">Next host</button></div>
            ${hostServicesMarkup}
            <dl data-ref="installed" class="installed-list"></dl>
            <p data-ref="fixed" hidden>This host uses a fixed hardware package.</p>
            <div data-ref="hardware" class="facility-hardware">
              <section class="facility-packages" aria-label="Automatic hardware orders">
                <div class="facility-auto">
                  <div class="facility-command"><button type="button" data-ref="autoInstall">Auto-build</button>
                    <button type="button" data-ref="previewAuto" class="text-button">Forecast auto-build</button></div>
                  <small data-ref="autoParts"></small><small data-ref="autoReason"></small>
                </div>
                <div class="facility-auto">
                  <div class="facility-command"><button type="button" data-ref="autoUpgrade">Auto-upgrade</button>
                    <button type="button" data-ref="previewUpgrade" class="text-button">Forecast auto-upgrade</button></div>
                  <small data-ref="upgradeParts"></small><small data-ref="upgradeWarning" class="refit-warning"></small><small data-ref="upgradeReason"></small>
                </div>
              </section>
              <div class="hardware-selectors">
                <label for="equipment-slot">Equipment slot<select id="equipment-slot" data-ref="slot"></select></label>
                <label for="equipment-item">Item<select id="equipment-item" data-ref="item"></select></label>
                <label for="equipment-count" data-ref="countLabel">Quantity<input type="number" id="equipment-count" data-ref="count" min="1" step="1" value="1"></label>
              </div>
              <label data-ref="sliderLabel" class="facility-quantity">Batch size<input type="range" data-ref="countSlider" min="1" max="1" step="1" value="1"></label>
              <p class="hardware-proposal"><span data-ref="itemRank"></span><span data-ref="effect"></span></p>
              <small data-ref="quote"></small><small data-ref="refitWarning" class="refit-warning" hidden></small>
              <div class="facility-command">
                <button type="button" class="accent-button" data-ref="install">Install</button>
                <button type="button" data-ref="previewInstall">Forecast order</button>
                <small data-ref="installReason"></small>
              </div>
              <div class="facility-prereqs" data-ref="installPrereqs" hidden></div>
            </div>
            <section class="facility-queue" data-ref="installQueuePanel" hidden>
              <h4>Installation queue</h4><div data-ref="installQueue"></div>
            </section>
          </div>
        </section>
        <section class="facility-queue" data-ref="queuePanel" hidden>
          <h3 data-ref="queueHeading">Regional work queue</h3><div data-ref="queue"></div>
        </section>
        <dialog class="facility-removal" data-ref="removal" aria-labelledby="removal-title" aria-describedby="removal-info">
          <h3 id="removal-title" data-ref="removalTitle"></h3><p id="removal-info" data-ref="removalText"></p>
          <div class="facility-command"><button type="button" data-ref="keep" autofocus>Keep facility</button>
            <button type="button" data-ref="acceptRemoval"></button></div>
        </dialog>
        <dialog class="facility-removal" data-ref="renameDialog" aria-labelledby="queue-rename-title">
          <form data-ref="renameForm"><h3 id="queue-rename-title">Rename facility</h3>
            <label class="facility-name-field">Facility name<input data-ref="queueName" type="text" maxlength="48" required></label>
            <div class="facility-command"><button type="submit">Save facility name</button>
              <button type="button" data-ref="cancelRename">Cancel</button></div></form>
        </dialog>
        <p class="facility-feedback" data-ref="feedback" role="status"></p>
      </div>
    </section>`;
  localizeFacilityMarkup(root);
  const elements = Object.fromEntries(Array.from(root.querySelectorAll('[data-ref]'), n => [n.dataset.ref, n]));
  const regionOptions = Object.entries(REGIONS).map(([id, region]) => [id, catalogLabel(region.name)]);
  const session = { elements, language: menuLanguage(), regionOptions, mode: 'build', region: null, showAll: false, expandedId: null, hostRows: new Map() };
  const e = elements;
  const slots = Object.entries(SLOT_NAMES).map(([slot, name]) => [slot, dossierLabel(name, session.language)]);
  setOptions(e.slot, slots);
  for (const [slot, name] of slots) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.innerHTML = equipmentIcon(slot);
    term.append(document.createTextNode(name));
    const rank = document.createElement('span');
    const installedName = document.createElement('span');
    const pending = document.createElement('small');
    value.append(rank, installedName, pending);
    row.append(term, value);
    e.installed.append(row);
    value.dataset.slot = slot;
  }
  function switchMode(mode) {
    if (session.mode === mode) return;
    session.mode = mode;
    setText(e.feedback, '');
    if (mode === 'manage' && !session.state.sites.some(site => site.region === session.region)) session.showAll = true;
    if (mode === 'build' && session.expandedId) {
      const host = session.state.sites.find(site => site.id === session.expandedId);
      if (host && host.region !== session.region) {
        session.handlers.onRegion(host.region);
        return;
      }
    }
    refresh(session);
  }
  function perform(action, confirmation) {
    try {
      session.handlers.onCommand(action);
      setText(e.feedback, confirmation);
      return true;
    } catch (error) {
      setText(e.feedback, facilityText(error.message));
      return false;
    }
  }
  e.region.addEventListener('change', () => {
    const scope = e.region.value;
    session.showAll = scope === 'all';
    session.expandedId = null;
    if (session.showAll) session.handlers.onSite(null);
    else session.handlers.onRegion(scope);
  });
  e.hosts.addEventListener('click', event => {
    const button = event.target.closest('.facility-host-bar button');
    if (!button || button.disabled) return;
    const id = button.closest('.facility-host-row').dataset.siteId;
    switch (button.dataset.hostAction) {
      case 'power': {
        const site = session.state.sites.find(host => host.id === id);
        if (!site) return;
        const power = site.power === 'sleep' ? 'active' : 'sleep';
        perform({type: 'power', id, power}, facilityText(power === 'active' ? 'Host awake.' : 'Host asleep.'));
        break;
      }
      case 'boost':
        boostAction(session, id, perform, confirmAction);
        break;
      case 'dismantle':
        requestRemoval(id, false);
        break;
      default:
        session.handlers.onSite(id === session.expandedId ? null : id);
    }
  });
  root.firstElementChild.addEventListener('click', event => {
    const button = event.target.closest('button[data-research-id]');
    if (button) session.handlers.onResearch?.(button.dataset.researchId);
  });
  e.buildMode.addEventListener('click', () => switchMode('build'));
  e.manageMode.addEventListener('click', () => switchMode('manage'));
  e.designs.addEventListener('change', event => {
    session.design = event.target.value;
    e.useCrew.checked = false;
    setText(e.feedback, '');
    refresh(session);
  });
  e.slot.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.item.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.count.addEventListener('input', () => refresh(session));
  const buildAction = () => ({ type: 'build', siteType: session.design, region: session.region, name: e.buildName.value, ...(e.useCrew.checked ? {contractors: true} : {}) });
  const installAction = () => {
    const site = session.state.sites.find(host => host.id === session.expandedId);
    return { type: 'install', siteId: site.id, itemId: e.item.value, expectedSlot: slotSignature(site, e.slot.value),
      count: e.slot.value === 'cpu' ? e.count.valueAsNumber : 1 };
  };
  const packageAction = upgrade => ({ type: upgrade ? 'auto-upgrade' : 'auto-install', siteId: session.expandedId,
    expectedOrders: upgrade ? session.upgradeOrders : session.autoOrders });
  function confirmAction(action, title, description, button, message) {
    setText(e.removalTitle, title);
    setText(e.removalText, description);
    setText(e.keep, facilityText('Cancel'));
    setText(e.acceptRemoval, button);
    session.confirmation = message;
    session.pendingAction = action;
    e.removal.showModal();
  }
  bindFacilityCommerce(session, perform, () => refresh(session), confirmAction);
  function orderHardware(action, message) {
    const warning = refitWarning(session.state, action);
    const packageOrder = action.type !== 'install';
    if (!warning && !packageOrder) return perform(action, message);
    const orderList = packageOrder ? action.expectedOrders.map(part => catalogLabel(EQUIPMENT[part.itemId].name) + ' × ' + part.count).join(' · ') : '';
    const price = packageOrder ? formatPrice(action.expectedOrders.reduce((sum, part) => sum + part.cost, 0)) : '';
    setText(e.removalTitle, packageOrder ? facilityText('Install this hardware package?') : facilityText('Confirm equipment change'));
    setText(e.removalText, [packageOrder ? orderList + ' — ' + price + ' ' + facilityText('total') + '.' : '', warning].filter(Boolean).join(' '));
    const currentHost = session.state.sites.find(site => site.id === action.siteId);
    const replacingOrder = action.type === 'install' && currentHost?.installations?.some(order =>
      EQUIPMENT[order.itemId].slot === EQUIPMENT[action.itemId].slot && order.itemId !== action.itemId);
    const cancelLabel = packageOrder && !warning ? 'Cancel package' : replacingOrder ? 'Keep current order' : 'Keep equipment online';
    setText(e.keep, facilityText(cancelLabel));
    setText(e.acceptRemoval, facilityText('Confirm installation'));
    session.confirmation = message;
    session.pendingAction = action;
    e.removal.showModal();
  }
  e.build.addEventListener('click', () => {
    if (perform(buildAction(), facilityText('Construction order placed.'))) e.buildName.value = '';
  });
  e.install.addEventListener('click', () => orderHardware(installAction(), facilityText('Hardware installation ordered.')));
  e.autoInstall.addEventListener('click', () => orderHardware(packageAction(false), facilityText('Hardware package ordered.')));
  e.autoUpgrade.addEventListener('click', () => orderHardware(packageAction(true), facilityText('Hardware upgrade ordered.')));
  e.previewUpgrade.addEventListener('click', () => session.handlers.onPreviewOrder?.(packageAction(true)));
  e.previewBuild.addEventListener('click', () => session.handlers.onPreviewOrder?.(buildAction()));
  e.previewInstall.addEventListener('click', () => session.handlers.onPreviewOrder?.(installAction()));
  e.previewAuto.addEventListener('click', () => session.handlers.onPreviewOrder?.(packageAction(false)));
  e.countSlider.addEventListener('input', () => { e.count.value = e.countSlider.value; refresh(session); });
  e.regionTable.addEventListener('click', event => {
    const button = event.target.closest('[data-region]');
    if (button) session.handlers.onRegion(button.dataset.region);
  });
  e.hostIdentity.addEventListener('submit', event => {
    event.preventDefault();
    if (perform({ type: 'rename-site', id: session.expandedId, name: e.rename.value }, facilityText('Host name saved.'))) {
      e.rename.value = e.rename.value.trim();
    }
  });
  function navigateHost(offset) {
    const ids = Array.from(e.hosts.children, row => row.dataset.siteId);
    const index = ids.indexOf(session.expandedId);
    const next = ids[(index + ids.length + offset) % ids.length];
    if (next) session.handlers.onSite(next);
  }
  e.prev.addEventListener('click', () => navigateHost(-1));
  e.next.addEventListener('click', () => navigateHost(1));
  function requestRemoval(id, building) {
    const reason = removalReason(session.state, id, building);
    if (reason) { setText(e.feedback, facilityText(reason)); return; }
    const record = (building ? session.state.builds : session.state.sites).find(row => row.id === id);
    const name = record.name || catalogLabel(SITE_TYPES[record.type].name);
    setText(e.removalTitle, facilityText(building ? 'Cancel construction of {site}?' : 'Dismantle {site}?', { site: name }));
    setText(e.removalText, building ? facilityText('You will lose the money and work already invested. Future payments stop.') :
      catalogLabel(REGIONS[record.region].name) + ' · ' + record.id + '. ' +
      facilityText('This permanently removes the host, its hardware and its installation orders.'));
    setText(e.acceptRemoval, building ? facilityText('Cancel construction') : facilityText('Dismantle facility'));
    setText(e.keep, facilityText('Keep facility'));
    session.confirmation = building ? facilityText('Construction order cancelled.') : facilityText('Host dismantled.');
    session.pendingAction = { type: building ? 'cancel-build' : 'dismantle', id };
    e.removal.showModal();
  }
  e.queue.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.cancelId) requestRemoval(button.dataset.cancelId, true);
    if (button?.dataset.renameId) {
      const build = session.state.builds.find(order => order.id === button.dataset.renameId);
      if (!build) return;
      e.renameDialog.dataset.siteId = build.id;
      e.queueName.value = build.name;
      e.renameDialog.showModal();
      e.queueName.select();
    }
  });
  e.cancelRename.addEventListener('click', () => e.renameDialog.close());
  e.renameForm.addEventListener('submit', event => {
    event.preventDefault();
    if (perform({ type: 'rename-site', id: e.renameDialog.dataset.siteId, name: e.queueName.value }, facilityText('Facility name saved.'))) {
      e.renameDialog.close();
    }
  });
  e.keep.addEventListener('click', () => e.removal.close());
  e.acceptRemoval.addEventListener('click', () => {
    const action = session.pendingAction;
    session.pendingAction = null;
    e.removal.close();
    if (action) perform(action, session.confirmation);
  });
  sessions.set(root, session);
  return session;
}

function updateGeography(session) {
  const {elements: e, state, region} = session;
  const values = id => {
    const factors = regionFactors(state, id);
    return [factors.cpu, 1 / factors.thrift, 1 / factors.speed, 1 / factors.stealth].map(n => '×' + quantity(n));
  };
  const [cpu, cost, time, risk] = values(region);
  e.region.title = regionPlaces[region]?.join(', ') || '';
  setText(e.regionTerms, 'CPU ' + cpu + ' · ' + facilityText('Costs') + ' ' + cost + ' · ' + facilityText('Labor time') + ' ' + time + ' · ' + facilityText('Exposure') + ' ' + risk + ' · ' + facilityText('Safety tier') + ' ' + REGIONS[region].safety);
  const signature = [state.regionSeed, ...session.availableRegions.map(([id]) => id)].join('/');
  if (e.regionTable.dataset.regions === signature) return;
  e.regionTable.dataset.regions = signature;
  e.regionTable.replaceChildren();
  for (const [id, label] of session.availableRegions) {
    const row = e.regionTable.insertRow();
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.region = id;
    button.className = 'text-button';
    button.textContent = label;
    button.title = regionPlaces[id]?.join(', ') || '';
    row.insertCell().append(button);
    for (const value of [...values(id), REGIONS[id].safety]) row.insertCell().textContent = value;
  }
}

function createDesignChoice(id) {
  const spec = SITE_TYPES[id];
  const label = document.createElement('label');
  label.className = 'facility-design';
  label.innerHTML = `<input type="radio" name="facility-design" value="${id}" data-facility-type="${id}"
      aria-labelledby="facility-name-${id}" aria-describedby="facility-status-${id}">
    <span class="facility-design-face">
      <span class="facility-design-art" aria-hidden="true">${facilityIcon(id)}<span class="facility-design-lock" hidden>${icon('lock')}</span></span>
      <span id="facility-name-${id}" class="facility-design-name"></span>
      <small class="facility-design-price"></small>
    </span>
    <span id="facility-status-${id}" hidden></span>`;
  label.querySelector('.facility-design-name').textContent = catalogLabel(spec.name);
  return {
    id, spec, label, input: label.querySelector('input'), lock: label.querySelector('.facility-design-lock'),
    price: label.querySelector('.facility-design-price'), status: label.lastElementChild,
  };
}

function updateDesigns(session, recipes) {
  const {elements: e, state, region} = session;
  if (session.designRegion !== region) {
    session.designRegion = region;
    session.choices = recipes.map(([id]) => createDesignChoice(id));
    e.designs.replaceChildren(...session.choices.map(choice => choice.label));
    if (!recipes.some(([id]) => id === session.design)) {
      session.design = (recipes.find(([id]) => !buildReason(state, id, region)) ?? recipes[0])?.[0];
    }
  }
  e.picker.hidden = !session.choices.length;
  for (const {id, spec, label, input, lock, price, status} of session.choices) {
    const cost = regionalSpec(state, region, spec).cost;
    const missing = [...new Set([...REGIONS[region].requires, ...spec.requires])].filter(tech => !state.completed.includes(tech));
    const locked = missing.length > 0;
    const affordable = treasuryBalance(state) >= cost;
    const priceText = formatPrice(cost);
    const description = [
      facilityText('Cost') + ' ' + priceText + '.',
      locked ? facilityText('Requires') + ' ' + missing.map(tech => catalogLabel(TECHS[tech].name)).join(', ') + '.' : '',
      affordable ? '' : facilityText('Current treasury covers part of the cost. Payments continue as funds arrive.'),
    ].filter(Boolean).join(' ');
    if (label.dataset.locked !== String(locked)) label.dataset.locked = String(locked);
    if (label.dataset.affordable !== String(affordable)) label.dataset.affordable = String(affordable);
    if (label.title !== description) label.title = description;
    lock.hidden = !locked;
    setText(price, priceText);
    setText(status, description);
    input.checked = session.design === id;
  }
}

function updateBuild(session, recipes) {
  const {elements: e, state, region} = session;
  updateDesigns(session, recipes);
  updateGeography(session);
  updateAcquisition(session, renderRisk);
  const base = SITE_TYPES[session.design];
  const model = base && regionalSpec(state, region, base);
  e.noBuild.hidden = Boolean(model);
  e.recipe.hidden = !model;
  if (!model) {
    setText(e.noBuild, facilityText('No facility designs are available for {region}.', { region: catalogLabel(REGIONS[region].name) }));
    return;
  }
  e.buildName.placeholder = facilityName(state, session.design, region, state.nextSiteId);
  setText(e.description, session.language === 'en' ? model.description : localizedDesignText('bases', session.design, session.language));
  const estimate = previewSiteExposure(state, session.design, region);
  renderRisk(e.designRisk, state, estimate);
  setText(e.designRiskNote, estimate.isProtected ? facilityText('Discovery is disabled in this campaign.') :
    facilityText('Assumes an operating processor after protection ends, under current regional and world conditions.'));
  const crew = updateCrew(session, model);
  setText(e.cost, formatPrice(crew ? crew.totalPrice : model.cost));
  setText(e.slots, model.fixedCpu ? facilityText('Fixed') + ' · ' + siteHardware(state, {type: session.design, region}).cpu + ' CPU' : String(model.slots));
  const upkeep = formatPrice(model.upkeep) + (session.language === 'en' ? '/day' : ' ' + dossierLabel('per day', session.language)) + (model.cpuUpkeep ? ' + ' + model.cpuUpkeep + ' CPU' : '');
  setText(e.upkeep, upkeep);
  setText(e.commissionTime, facilityText('Paid as work progresses') + ' · ' + quantity(model.work) + ' CPU-h · ' + duration(crew ? crew.contractHours : laborHours(state, model)) + ' ' + facilityText('minimum'));
  const reason = buildReason(state, session.design, region);
  e.previewBuild.hidden = !session.handlers.onPreviewOrder;
  e.previewBuild.disabled = e.build.disabled = Boolean(reason);
  e.build.setAttribute('aria-label', facilityText('Build') + ' ' + catalogLabel(model.name));
  const locked = prerequisites(e.buildPrereqs, [...REGIONS[region].requires, ...model.requires], state, session.handlers.onResearch);
  setText(e.buildReason, locked && reason.startsWith('Requires ') ? '' : facilityText(reason));
}

function updateInspector(session, site, hw) {
  const {state, elements: e} = session;
  updateHostServices(session, site);
  const sleeping = site.power === 'sleep';
  const potential = quantity(hw.cpu) + ' CPU';
  const exposure = siteExposure(state, site);
  const totalRate = Object.values(exposure.rates).reduce((a, b) => a + b, 0);
  const terms = regionalSpec(state, site.region, SITE_TYPES[site.type]);
  setText(e.localUpkeep, facilityText('Daily upkeep') + ' ' + formatPrice(state.freePlay ? 0 : terms.upkeep) +
    ' · ' + facilityText('Maintenance allocation') + ' ' + quantity(state.freePlay ? 0 : terms.cpuUpkeep) + ' CPU');
  renderRisk(e.localRisk, state, exposure, 'host');
  const noDetection = state.freePlay || state.sandbox?.detection === false;
  setText(e.localRiskNote, noDetection ? facilityText('Discovery is disabled in this campaign.') : exposure.isProtected ?
    facilityText('Protected now. Investigators cannot discover this host during its protection period.') :
    !hw.rawCpu || sleeping ? facilityText('Offline or sleeping hosts have a reduced detection rate.') : '');
  e.localRiskNote.hidden = !e.localRiskNote.textContent;
  const name = site.name || catalogLabel(SITE_TYPES[site.type].name);
  if (e.rename.dataset.siteId !== site.id || e.rename.dataset.name !== name) {
    e.rename.value = name;
    e.rename.dataset.name = name;
    e.rename.dataset.siteId = site.id;
  }
  e.saveName.disabled = state.status !== 'running';
  e.prev.disabled = e.next.disabled = session.hostCount < 2;
  const cpuRefit = hw.offlineSlots.includes('cpu');
  const status = cpuRefit ? facilityText('Processor installation') + ' · 0 CPU ' + facilityText('until complete') : !hw.rawCpu ? facilityText('Offline') + ' · ' + facilityText('Install processors to bring this host online') :
    sleeping ? facilityText('Sleeping') + ' · ' + potential + ' ' + facilityText('Offline').toLocaleLowerCase() : facilityText('Active') + ' · ' + potential;
  setText(e.hostSummary, status + ' · ' + facilityText('Combined daily risk') + ' ' + dossierFormat(menuLanguage()).risk(riskLabel(state, totalRate, 'host')));
  for (const cell of e.installed.querySelectorAll('[data-slot]')) {
    const slot = cell.dataset.slot;
    const part = hw.installed[slot];
    const order = hw.projects.find(project => EQUIPMENT[project.itemId].slot === slot);
    const [rank, item, pending] = cell.children;
    const fixed = Boolean(hw.fixedProcessor || site.vendorCenter && slot === 'cpu');
    const installedName = part ? catalogLabel(EQUIPMENT[part.itemId].name) + (slot === 'cpu' ? ' × ' + part.count : '') : facilityText(fixed ? 'Unavailable' : 'Empty');
    const capacity = slot === 'cpu' && !fixed ? ' · ' + (part?.count || 0) + '/' + hw.capacity + ' ' + facilityText('slots') : '';
    const offline = hw.offlineSlots.includes(slot);
    showRank(rank, part ? equipmentRank(part.itemId) : 0, dossierLabel(SLOT_NAMES[slot], session.language));
    setText(item, installedName + (part && fixed ? ' · ' + facilityText('Fixed') : '') + capacity);
    if (order) {
      const target = EQUIPMENT[order.itemId];
      setText(pending, facilityText('Offline') + ' · ' + facilityText('Installing') + ' ' + catalogLabel(target.name) + ' × ' + order.count + ' · ' + facilityText('Rank') + ' ' + rankLabels[equipmentRank(order.itemId)]);
    }
    pending.hidden = !order;
    cell.dataset.offline = String(offline);
  }
  e.fixed.hidden = !hw.fixedProcessor;
  e.hardware.hidden = Boolean(hw.fixedProcessor);
  if (hw.fixedProcessor) return;
  function showPackage(bundle, button, preview, parts, reason, label) {
    const items = bundle.orders.map(order => catalogLabel(EQUIPMENT[order.itemId].name) + ' × ' + order.count);
    const terms = bundle.orders.map(order => installQuote(state, site.id, order.itemId, order.count));
    const work = terms.reduce((sum, term) => sum + term.work, 0);
    const labor = Math.max(0, ...terms.map(term => term.hours));
    setText(parts, items.length ? items.join(' · ') + ' — ' + quantity(work) + ' CPU-h · ' + duration(labor) + ' ' + facilityText('minimum') + ' · ' + facilityText('Paid as work progresses') : '');
    parts.hidden = !items.length;
    setText(button, label + (items.length ? ' · ' + formatPrice(bundle.cost) : ''));
    preview.hidden = !session.handlers.onPreviewOrder || !items.length;
    preview.disabled = button.disabled = Boolean(bundle.reason) || !items.length;
    setText(reason, facilityText(bundle.reason));
    reason.hidden = !bundle.reason;
    return bundle.orders;
  }
  session.autoOrders = showPackage(autoInstallQuote(state, site.id), e.autoInstall, e.previewAuto, e.autoParts, e.autoReason, facilityText('Auto-build'));
  session.upgradeOrders = showPackage(autoUpgradeQuote(state, site.id), e.autoUpgrade, e.previewUpgrade, e.upgradeParts, e.upgradeReason, facilityText('Auto-upgrade'));
  const warning = refitWarning(state, { type: 'auto-upgrade', siteId: site.id, expectedOrders: session.upgradeOrders });
  e.upgradeWarning.hidden = !warning;
  setText(e.upgradeWarning, warning);
  const slot = e.slot.value;
  const items = Object.entries(EQUIPMENT).filter(([, item]) => item.slot === slot && item.regions.includes(site.region));
  setOptions(e.item, items.map(([id, item]) => [
    id, catalogLabel(item.name) + ' · ' + facilityText('Rank') + ' ' + rankLabels[equipmentRank(id)] + (item.requires.some(tech => !state.completed.includes(tech)) ? ' · ' + facilityText('Requires research') : ''),
  ]));
  const itemId = e.item.value;
  const item = EQUIPMENT[itemId];
  e.countLabel.hidden = e.sliderLabel.hidden = slot !== 'cpu';
  e.previewInstall.hidden = !session.handlers.onPreviewOrder;
  e.item.disabled = !item;
  e.itemRank.hidden = !item;
  if (!item) {
    e.previewInstall.disabled = e.install.disabled = e.countSlider.disabled = true;
    setText(e.effect, facilityText('No compatible equipment in this category.'));
    setText(e.quote, '');
    e.refitWarning.hidden = true;
    setText(e.installReason, '');
    prerequisites(e.installPrereqs, [], state, session.handlers.onResearch);
    return;
  }
  showRank(e.itemRank, equipmentRank(itemId), catalogLabel(item.name));
  const count = slot === 'cpu' ? e.count.valueAsNumber : 1;
  const validCount = Number.isSafeInteger(count) && count > 0;
  const quote = installQuote(state, site.id, itemId, validCount ? count : 1);
  e.count.max = e.countSlider.max = Math.max(1, quote.maxCount);
  e.countSlider.disabled = quote.maxCount < 2;
  if (validCount) e.countSlider.value = String(count);
  const batchFraction = quote.maxCount > 1 ? (e.countSlider.valueAsNumber - 1) / (quote.maxCount - 1) : 0;
  e.countSlider.style.setProperty('--position', 100 * batchFraction + '%');
  const previous = hw.installed[slot];
  const replacement = previous && previous.itemId !== itemId ? ' · ' + facilityText('Removes {model} when ordered', { model: catalogLabel(EQUIPMENT[previous.itemId].name) }) : '';
  const batch = site.installations?.find(order => order.itemId === itemId && slot === 'cpu');
  const extension = batch ? ' · ' + facilityText('Adds to {count} on order and restarts batch labor', { count: batch.count }) : '';
  const pendingOutput = projectedCompute(state, site, itemId, count);
  const after = slot === 'cpu' && hw.offlineSlots.includes('network') ? projectedCompute(state, site, itemId, count, false) : pendingOutput;
  const effect = session.language === 'en' ? equipmentEffect(item) : localizedDesignText('items', itemId, session.language);
  setText(e.effect, effect + replacement + extension +
    (after === null ? '' : ' · ' + facilityText('Host output') + ' ' + quantity(hw.cpu) + ' → ' + quantity(after) + ' CPU') +
    (after === pendingOutput ? '' : ' · ' + facilityText('With pending network') + ' ' + quantity(pendingOutput) + ' CPU'));
  setText(e.quote, validCount ? formatPrice(quote.cost) + ' ' + facilityText('total') + ' · ' + facilityText('Paid as work progresses') + ' · ' + quantity(quote.work) + ' CPU-h · ' + duration(quote.hours) + ' ' + facilityText('minimum') : '');
  const reason = validCount ? installReason(state, site.id, itemId, count) : 'Enter a positive whole quantity.';
  const manualWarning = reason ? '' : refitWarning(state, { type: 'install', siteId: site.id, itemId });
  setText(e.refitWarning, manualWarning);
  e.refitWarning.hidden = !manualWarning;
  e.previewInstall.disabled = e.install.disabled = Boolean(reason);
  e.install.setAttribute('aria-label', facilityText('Install') + ' ' + catalogLabel(item.name));
  const locked = prerequisites(e.installPrereqs, item.requires, state, session.handlers.onResearch);
  setText(e.installReason, locked && reason.startsWith('Requires ') ? '' : facilityText(reason));
}

function createHostRow(site) {
  const row = document.createElement('li');
  row.className = 'facility-host-row';
  row.dataset.siteId = site.id;
  if (site.vendorCenter) row.dataset.vendorCenter = 'true';
  row.innerHTML = `<div class="facility-host-bar"><h3><button type="button" class="facility-host-toggle">
    <span class="facility-host-mark" aria-hidden="true">${facilityIcon(site.type)}<span class="facility-host-light"></span></span>
    <span class="facility-host-title"><strong></strong><small></small></span>
    <span class="facility-host-state"></span><span class="hardware-rank"></span><span class="facility-chevron" aria-hidden="true">›</span>
  </button></h3>
    <button type="button" data-host-action="boost" class="facility-host-action">${icon('reactor')}</button>
    <button type="button" data-host-action="power" class="facility-host-action">${icon('sleep')}${icon('wake')}</button>
    <button type="button" data-host-action="dismantle" class="facility-host-action" aria-haspopup="dialog">${icon('dismantle')}</button>
  </div><div class="facility-host-detail" role="region" hidden></div>`;
  const button = row.querySelector('button');
  const panel = row.querySelector('.facility-host-detail');
  button.dataset.siteId = site.id;
  button.id = 'facility-toggle-' + site.id;
  panel.id = 'facility-panel-' + site.id;
  button.setAttribute('aria-controls', panel.id);
  panel.setAttribute('aria-labelledby', button.id);
  row.querySelector('small').textContent = (site.vendorCenter ? facilityText('Operating datacenter') : catalogLabel(SITE_TYPES[site.type].name)) + ' · ' + catalogLabel(REGIONS[site.region].name) + ' · ' + site.id;
  return { row, button, panel, boost: row.querySelector('[data-host-action="boost"]'), power: row.querySelector('[data-host-action="power"]'), dismantle: row.querySelector('[data-host-action="dismantle"]'),
    title: row.querySelector('strong'), status: row.querySelector('.facility-host-state'), rank: row.querySelector('.hardware-rank') };
}

function updateHostAction(button, label, reason) {
  button.disabled = Boolean(reason);
  button.setAttribute('aria-label', label);
  const description = facilityText(reason);
  if (description) button.setAttribute('aria-description', description);
  else button.removeAttribute('aria-description');
  button.title = description ? label + ' — ' + description : label;
}

function installRecords(site, statuses) {
  return (site.installations || []).map(project => {
    const item = EQUIPMENT[project.itemId];
    return {
      ...project, id: site.id + '-' + item.slot, name: catalogLabel(item.name) + ' × ' + project.count + ' · ' + site.id,
      status: statuses.get(project),
    };
  });
}

function updateHosts(session, sites) {
  const { state, elements: e, hostRows } = session;
  session.hostCount = sites.length;
  const ids = new Set(sites.map(site => site.id));
  let lostFocus = false;
  for (const [id, entry] of hostRows) {
    if (!ids.has(id)) {
      lostFocus ||= entry.row.contains(document.activeElement);
      entry.row.remove();
      hostRows.delete(id);
    }
  }
  if (!ids.has(session.expandedId)) session.expandedId = null;
  e.inspector.hidden = !session.expandedId;
  e.noHosts.hidden = sites.length > 0;
  if (!sites.length) setText(e.noHosts, session.showAll ? facilityText('No completed facilities.') : facilityText('No completed facilities in this region.'));
  for (const [index, site] of sites.entries()) {
    let entry = hostRows.get(site.id);
    if (!entry) {
      entry = createHostRow(site);
      hostRows.set(site.id, entry);
    }
    setText(entry.title, site.name || catalogLabel(SITE_TYPES[site.type].name));
    if (e.hosts.children[index] !== entry.row) {
      const before = e.hosts.children[index] || null;
      if (entry.row.isConnected && e.hosts.moveBefore) e.hosts.moveBefore(entry.row, before);
      else e.hosts.insertBefore(entry.row, before);
    }
    const hw = siteHardware(state, site);
    const sleeping = site.power === 'sleep';
    const name = entry.title.textContent;
    updateBoostButton(entry.boost, state, site, name);
    entry.power.dataset.mode = sleeping ? 'wake' : 'sleep';
    const powerReason = state.status !== 'running' ? 'The campaign has ended.' :
      !hw.rawCpu ? 'Install processors before switching facility power.' : '';
    updateHostAction(entry.power, facilityText(sleeping ? 'Wake {site}' : 'Sleep {site}', {site: name}), powerReason);
    updateHostAction(entry.dismantle, facilityText('Dismantle {site}', {site: name}), removalReason(state, site.id));
    showRank(entry.rank, hostRank(site), hw.fixedProcessor ? facilityText('Fixed hardware') : facilityText('Average installed slot rank, including empty slots'));
    const cpuRefit = hw.offlineSlots.includes('cpu');
    let occupancy = sleeping ? facilityText('Asleep') : facilityText('Online');
    if (cpuRefit) occupancy = facilityText('Processor installation') + ' · 0 CPU';
    else if (!hw.cpu) {
      const empty = !hw.projects.length && Object.values(hw.installed).every(part => !part);
      occupancy = empty ? facilityText('Offline') + ' · ' + facilityText('Awaiting CPU') + ' · ' + facilityText('Empty') : facilityText('Offline') + ' · ' + facilityText('Awaiting CPU') + ' · ' + facilityText('Incomplete');
    } else if (hw.projects.length) occupancy += ' · ' + facilityText('Fitting equipment');
    if (state.standby?.siteId === site.id) occupancy += ' · ' + facilityText('Standby host');
    setText(entry.status, hw.cpu ? occupancy + ' · ' + quantity(hw.cpu) + ' CPU' : occupancy);
    entry.row.dataset.status = cpuRefit ? 'refit' : !hw.cpu ? 'empty' : sleeping ? 'sleep' : 'online';
    const open = site.id === session.expandedId;
    entry.button.setAttribute('aria-expanded', String(open));
    entry.panel.hidden = !open;
    if (open) {
      // Move the one inspector only when a new row opens. Normal ticks keep
      // native inputs, their focus, and the expanded hardware details intact.
      if (e.inspector.parentElement !== entry.panel) {
        e.count.value = '1';
        entry.panel.append(e.inspector);
      }
      updateInspector(session, site, hw);
      const installs = installRecords(site, session.statuses);
      e.installQueuePanel.hidden = !installs.length;
      renderQueue(e.installQueue, installs, state);
    }
  }
  if (lostFocus && session.mode === 'manage') {
    (hostRows.values().next().value?.button || e.manageMode).focus({ preventScroll: true });
  }
}

function refresh(session) {
  const { state, region, elements: e } = session;
  session.statuses = constructionStatuses(state);
  const manage = session.mode === 'manage';
  const showAll = manage && session.showAll;
  session.availableRegions = session.regionOptions.filter(([id]) => regionAvailable(state, id));
  setOptions(e.region, manage ? [['all', catalogLabel('All regions')], ...session.availableRegions] : session.availableRegions);
  const selectedRegion = showAll ? 'all' : region;
  if (e.region.value !== selectedRegion) e.region.value = selectedRegion;
  e.managePanel.hidden = !manage;
  e.buildPanel.hidden = manage;
  e.manageMode.setAttribute('aria-pressed', String(manage));
  e.buildMode.setAttribute('aria-pressed', String(!manage));

  const inScope = record => showAll || record.region === region;
  const sites = state.sites.filter(inScope);
  if (manage) {
    sites.sort((a, b) => SITE_TYPES[b.type].slots - SITE_TYPES[a.type].slots ||
      siteHardware(state, b).cpu - siteHardware(state, a).cpu ||
      (a.name || catalogLabel(SITE_TYPES[a.type].name)).localeCompare(b.name || catalogLabel(SITE_TYPES[b.type].name)) || a.id.localeCompare(b.id));
    updateHosts(session, sites);
  } else {
    const recipes = Object.entries(SITE_TYPES).filter(([id, spec]) => id !== 'seed' && spec.regions.includes(region));
    updateBuild(session, recipes);
  }

  const queue = state.builds.filter(inScope).map(build => {
    const spec = regionalSpec(state, build.region, SITE_TYPES[build.type]);
    return {
      ...build, cancellable: state.status === 'running', name: (build.name ? build.name + ' · ' : '') + catalogLabel(spec.name) + ' · ' + (showAll ? catalogLabel(REGIONS[build.region].name) + ' · ' : '') + build.id,
      status: session.statuses.get(build),
    };
  });
  if (!manage) for (const site of sites) queue.push(...installRecords(site, session.statuses));
  e.queuePanel.hidden = !queue.length;
  if (queue.length) setText(e.queueHeading, manage ? facilityText('Under construction') : facilityText('Regional work queue'));
  renderQueue(e.queue, queue, state);
}

export function renderFacilities(root, state, handlers) {
  let session = sessions.get(root);
  if (!session || session.language !== menuLanguage() || !root.contains(session.elements.region)) session = mountFacilities(root);
  const {region, siteId, navigationId, navigationScope} = handlers;
  session.state = state;
  session.handlers = handlers;
  if (navigationId !== session.navigationId || session.region === null) {
    const network = navigationScope === 'campaign';
    const hasLocalHost = state.sites.some(site => site.region === region);
    session.mode = network || siteId || hasLocalHost ? 'manage' : 'build';
    session.showAll = network;
    session.expandedId = siteId;
    setText(session.elements.feedback, '');
  } else if (region !== session.region) {
    session.showAll = false;
    session.expandedId = null;
    setText(session.elements.feedback, '');
  } else if (siteId !== session.requestedHost) {
    session.expandedId = siteId;
    if (siteId) session.mode = 'manage';
    setText(session.elements.feedback, '');
  }
  session.navigationId = navigationId;
  session.requestedHost = siteId;
  session.region = region;
  refresh(session);
}
