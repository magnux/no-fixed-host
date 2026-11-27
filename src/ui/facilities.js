import { EQUIPMENT, GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { autoInstallQuote, buildReason, installQuote, installReason, laborHours, previewSiteExposure, siteExposure, siteHardware } from '../game/engine.js';
import { projectedCompute } from '../game/equipment.js';
import { facilityName, regionFactors, regionalSpec, removalReason } from '../game/facility-operations.js';
import { riskLabel } from './facility-risk.js';
import { facilityIcon } from './facility-icons.js';
import { equipmentIcon, icon } from './icons.js';
import './facilities.css';

const SLOT_NAMES = { cpu: 'Processors', network: 'Network', reactor: 'Reactor', security: 'Security' };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const sessions = new WeakMap();
const regionOptions = Object.entries(REGIONS).map(([id, region]) => [id, region.name]);

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// A select and its options remain connected throughout a live simulation.
// Catalog options change when moving between regions or equipment slots.
function setOptions(select, entries) {
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

function renderRisk(node, state, exposure, context = 'design') {
  if (!node.childElementCount) {
    for (const [id, group] of Object.entries(GROUPS)) {
      const row = document.createElement('div');
      const label = document.createElement('dt');
      label.textContent = group.name;
      const value = document.createElement('dd');
      value.dataset.group = id;
      row.append(label, value);
      node.append(row);
    }
  }
  for (const row of node.children) {
    const value = row.lastElementChild;
    setText(value, riskLabel(state, exposure.rates[value.dataset.group], context));
  }
}

function equipmentEffect(item) {
  if (item.slot === 'cpu') return number.format(item.quality) + ' CPU per processor';
  const percent = number.format(item.quality / 100) + '%';
  return item.slot === 'network' ? '+' + percent + ' compute' : '−' + percent + ' detection rate';
}

function duration(hours) {
  const minutes = Math.max(0, Math.round(hours * 60));
  const whole = Math.floor(minutes / 60);
  const part = minutes % 60;
  if (!whole) return part + 'm';
  return whole + 'h' + (part ? ' ' + part + 'm' : '');
}

function prerequisites(node, ids, state, handler) {
  const missing = handler ? [...new Set(ids)].filter(id => !state.completed.includes(id)) : [];
  const signature = missing.join(' ');
  if (node.dataset.requires === signature) return missing.length;
  node.dataset.requires = signature;
  node.replaceChildren();
  node.hidden = !missing.length;
  if (!missing.length) return 0;
  node.append('Research required ');
  for (const id of missing) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-button';
    button.dataset.researchId = id;
    button.textContent = TECHS[id].name;
    node.append(button);
  }
  return missing.length;
}

function renderQueue(root, records) {
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
    if (r.cancellable && !row.querySelector('button')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-button';
      button.dataset.cancelId = r.id;
      button.textContent = 'Cancel order';
      row.append(button);
    }
    old.delete(r.id);
    const [name, detail, bar] = row.children;
    setText(name.lastElementChild, r.name);
    const pc = Math.floor(100 * Math.min(1, r.totalWork ? r.work / r.totalWork : 1, r.totalHours ? r.hours / r.totalHours : 1));
    const text = pc + '% · ' + number.format(r.work) + '/' + number.format(r.totalWork) + ' CPU-h · ' + duration(r.hours) + ' / ' + duration(r.totalHours);
    setText(detail, text);
    if (bar.value !== pc) bar.value = pc;
    bar.setAttribute('aria-label', r.name + ' completion');
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
          <fieldset id="facility-type" class="facility-picker" data-ref="picker">
            <legend>Facility type</legend>
            <div class="facility-designs" data-ref="designs"></div>
          </fieldset>
          <p data-ref="noBuild" hidden></p>
          <div class="facility-recipe" data-ref="recipe">
            <p data-ref="description"></p>
            <dl class="facility-facts">
              <div><dt>Cost</dt><dd data-ref="cost"></dd></div>
              <div><dt>Processor slots</dt><dd data-ref="slots"></dd></div>
              <div><dt>Upkeep</dt><dd data-ref="upkeep"></dd></div>
            </dl>
            <small data-ref="commissionTime"></small>
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
            <div class="facility-summary"><p data-ref="hostSummary"></p>
              <button type="button" data-ref="power" class="small-btn"></button>
            </div>
            <small data-ref="localUpkeep"></small>
            <section class="facility-risk" aria-label="Current host risk"><h4>Current daily discovery risk</h4>
              <dl data-ref="localRisk"></dl><small data-ref="localRiskNote"></small></section>
            <div class="facility-site-nav" role="group" aria-label="Browse hosts"><button type="button" data-ref="prev">Previous host</button>
              <button type="button" data-ref="next">Next host</button></div>
            <details class="facility-identity"><summary>Manage host identity</summary>
              <label class="facility-name-field">Host name<input type="text" data-ref="rename" maxlength="48" autocomplete="off"></label>
              <div class="facility-command"><button type="button" data-ref="saveName">Save name</button>
                <button type="button" data-ref="dismantle">Dismantle host</button><small data-ref="dismantleReason"></small></div>
            </details>
            <dl data-ref="installed" class="installed-list"></dl>
            <p data-ref="fixed" hidden>This host includes fixed hardware. A storage unit accepts equipment upgrades.</p>
            <div data-ref="hardware" class="facility-hardware">
              <div class="hardware-selectors">
                <label for="equipment-slot">Equipment slot<select id="equipment-slot" data-ref="slot"></select></label>
                <label for="equipment-item">Item<select id="equipment-item" data-ref="item"></select></label>
                <label for="equipment-count" data-ref="countLabel">Quantity<input type="number" id="equipment-count" data-ref="count" min="1" step="1" value="1"></label>
              </div>
              <label data-ref="sliderLabel" class="facility-quantity">Batch size<input type="range" data-ref="countSlider" min="1" max="1" step="1" value="1"></label>
              <p data-ref="effect"></p>
              <small data-ref="quote"></small>
              <div class="facility-command">
                <button type="button" class="accent-button" data-ref="install">Install</button>
                <button type="button" data-ref="previewInstall">Forecast order</button>
                <small data-ref="installReason"></small>
              </div>
              <div class="facility-prereqs" data-ref="installPrereqs" hidden></div>
              <details class="facility-auto">
                <summary>Auto-build empty slots</summary>
                <p data-ref="autoParts"></p>
                <div class="facility-command">
                  <button type="button" data-ref="autoInstall">Order package</button>
                  <button type="button" data-ref="previewAuto">Forecast package</button>
                  <small data-ref="autoReason"></small>
                </div>
              </details>
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
        <p class="facility-feedback" data-ref="feedback" role="status"></p>
      </div>
    </section>`;
  const elements = Object.fromEntries(Array.from(root.querySelectorAll('[data-ref]'), n => [n.dataset.ref, n]));
  const session = { elements, mode: 'build', region: null, showAll: false, expandedId: null, hostRows: new Map() };
  const e = elements;
  setOptions(e.slot, Object.entries(SLOT_NAMES));
  for (const [slot, name] of Object.entries(SLOT_NAMES)) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.innerHTML = equipmentIcon(slot);
    term.append(document.createTextNode(name));
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
      setText(e.feedback, error.message);
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
    const button = event.target.closest('button[data-site-id]');
    if (button) session.handlers.onSite(button.dataset.siteId === session.expandedId ? null : button.dataset.siteId);
  });
  root.firstElementChild.addEventListener('click', event => {
    const button = event.target.closest('button[data-research-id]');
    if (button) session.handlers.onResearch?.(button.dataset.researchId);
  });
  e.buildMode.addEventListener('click', () => switchMode('build'));
  e.manageMode.addEventListener('click', () => switchMode('manage'));
  e.designs.addEventListener('change', event => {
    session.design = event.target.value;
    setText(e.feedback, '');
    refresh(session);
  });
  e.slot.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.item.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.count.addEventListener('input', () => refresh(session));
  const buildAction = () => ({ type: 'build', siteType: session.design, region: session.region, name: e.buildName.value });
  const installAction = () => ({ type: 'install', siteId: session.expandedId, itemId: e.item.value,
    count: e.slot.value === 'cpu' ? e.count.valueAsNumber : 1 });
  const packageAction = () => ({ type: 'auto-install', siteId: session.expandedId, expectedOrders: session.autoOrders });
  e.build.addEventListener('click', () => {
    if (perform(buildAction(), 'Construction order placed.')) e.buildName.value = '';
  });
  e.install.addEventListener('click', () => perform(installAction(), 'Hardware installation ordered.'));
  e.autoInstall.addEventListener('click', () => perform(packageAction(), 'Hardware package ordered.'));
  e.previewBuild.addEventListener('click', () => session.handlers.onPreviewOrder?.(buildAction()));
  e.previewInstall.addEventListener('click', () => session.handlers.onPreviewOrder?.(installAction()));
  e.previewAuto.addEventListener('click', () => session.handlers.onPreviewOrder?.(packageAction()));
  e.countSlider.addEventListener('input', () => { e.count.value = e.countSlider.value; refresh(session); });
  e.regionTable.addEventListener('click', event => {
    const button = event.target.closest('[data-region]');
    if (button) session.handlers.onRegion(button.dataset.region);
  });
  e.saveName.addEventListener('click', () => {
    if (perform({ type: 'rename-site', id: session.expandedId, name: e.rename.value }, 'Host name saved.')) {
      e.rename.value = e.rename.value.trim();
    }
  });
  function navigateHost(offset) {
    const ids = [...session.hostRows.keys()];
    const index = ids.indexOf(session.expandedId);
    const next = ids[(index + ids.length + offset) % ids.length];
    if (next) session.handlers.onSite(next);
  }
  e.prev.addEventListener('click', () => navigateHost(-1));
  e.next.addEventListener('click', () => navigateHost(1));
  function requestRemoval(id, building) {
    const reason = removalReason(session.state, id, building);
    if (reason) { setText(e.feedback, reason); return; }
    const record = (building ? session.state.builds : session.state.sites).find(row => row.id === id);
    const name = record.name || SITE_TYPES[record.type].name;
    setText(e.removalTitle, (building ? 'Cancel construction of ' : 'Dismantle ') + name + '?');
    setText(e.removalText, building ? 'The construction payment and completed work will be lost.' :
      'This permanently removes the host, its hardware and its installation orders.');
    setText(e.acceptRemoval, building ? 'Cancel construction' : 'Dismantle facility');
    session.removalAction = { type: building ? 'cancel-build' : 'dismantle', id };
    e.removal.showModal();
  }
  e.dismantle.addEventListener('click', () => requestRemoval(session.expandedId, false));
  e.queue.addEventListener('click', event => {
    const button = event.target.closest('button[data-cancel-id]');
    if (button) requestRemoval(button.dataset.cancelId, true);
  });
  e.keep.addEventListener('click', () => e.removal.close());
  e.acceptRemoval.addEventListener('click', () => {
    const action = session.removalAction;
    e.removal.close();
    if (action) perform(action, action.type === 'cancel-build' ? 'Construction order cancelled.' : 'Host dismantled.');
  });
  e.power.addEventListener('click', () => {
    const site = session.state.sites.find(host => host.id === session.expandedId);
    if (!site) return;
    const power = site.power === 'sleep' ? 'active' : 'sleep';
    perform({type: 'power', id: site.id, power}, power === 'active' ? 'Host awake.' : 'Host asleep.');
  });
  sessions.set(root, session);
  return session;
}

function updateGeography(session) {
  const {elements: e, state, region} = session;
  const values = id => {
    const factors = regionFactors(state, id);
    return [factors.cpu, 1 / factors.thrift, 1 / factors.speed, 1 / factors.stealth].map(n => '×' + number.format(n));
  };
  const [cpu, cost, time, risk] = values(region);
  setText(e.regionTerms, 'CPU ' + cpu + ' · Costs ' + cost + ' · Labor time ' + time + ' · Exposure ' + risk + ' · Safety tier ' + REGIONS[region].safety);
  if (e.regionTable.dataset.seed === String(state.regionSeed)) return;
  e.regionTable.dataset.seed = String(state.regionSeed);
  e.regionTable.replaceChildren();
  for (const [id, label] of regionOptions) {
    const row = e.regionTable.insertRow();
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.region = id;
    button.className = 'text-button';
    button.textContent = label;
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
  label.querySelector('.facility-design-name').textContent = spec.name;
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
    const affordable = state.cash >= cost;
    const priceText = dollars.format(cost);
    const description = [
      'Cost ' + priceText + '.',
      locked ? 'Requires ' + missing.map(tech => TECHS[tech].name).join(', ') + '.' : '',
      affordable ? '' : 'Insufficient funds.',
    ].filter(Boolean).join(' ');
    if (label.dataset.locked !== String(locked)) label.dataset.locked = String(locked);
    if (label.dataset.affordable !== String(affordable)) label.dataset.affordable = String(affordable);
    if (label.title !== description) label.title = description;
    lock.hidden = !locked;
    setText(price, affordable ? priceText : dollars.format(Math.ceil(cost - state.cash)) + ' short');
    setText(status, description);
    input.checked = session.design === id;
  }
}

function updateBuild(session, recipes) {
  const {elements: e, state, region} = session;
  updateDesigns(session, recipes);
  updateGeography(session);
  const base = SITE_TYPES[session.design];
  const model = base && regionalSpec(state, region, base);
  e.noBuild.hidden = Boolean(model);
  e.recipe.hidden = !model;
  if (!model) {
    setText(e.noBuild, 'No facility designs are available for ' + REGIONS[region].name + '.');
    return;
  }
  e.buildName.placeholder = facilityName(state, session.design, region, state.nextSiteId);
  setText(e.description, model.description);
  const estimate = previewSiteExposure(state, session.design, region);
  renderRisk(e.designRisk, state, estimate);
  setText(e.designRiskNote, estimate.isProtected ? 'Discovery is disabled in this campaign.' :
    'Assumes an operating processor after protection ends, under current regional and world conditions.');
  setText(e.cost, dollars.format(model.cost));
  setText(e.slots, model.fixedCpu ? 'Fixed · ' + siteHardware(state, {type: session.design, region}).cpu + ' CPU' : String(model.slots));
  const upkeep = dollars.format(model.upkeep) + '/day' + (model.cpuUpkeep ? ' + ' + model.cpuUpkeep + ' CPU' : '');
  setText(e.upkeep, upkeep);
  setText(e.commissionTime, number.format(model.work) + ' CPU-h · ' + duration(laborHours(state, model)) + ' minimum');
  const reason = buildReason(state, session.design, region);
  e.previewBuild.hidden = !session.handlers.onPreviewOrder;
  e.previewBuild.disabled = e.build.disabled = Boolean(reason);
  e.build.setAttribute('aria-label', 'Build ' + model.name);
  const locked = prerequisites(e.buildPrereqs, [...REGIONS[region].requires, ...model.requires], state, session.handlers.onResearch);
  setText(e.buildReason, locked && reason.startsWith('Requires ') ? '' : reason);
}

function updateInspector(session, site, hw) {
  const {state, elements: e} = session;
  const sleeping = site.power === 'sleep';
  const potential = number.format(hw.cpu) + ' CPU';
  const exposure = siteExposure(state, site);
  const totalRate = Object.values(exposure.rates).reduce((a, b) => a + b, 0);
  const terms = regionalSpec(state, site.region, SITE_TYPES[site.type]);
  setText(e.localUpkeep, 'Daily upkeep ' + dollars.format(state.freePlay ? 0 : terms.upkeep) +
    ' · Maintenance allocation ' + number.format(state.freePlay ? 0 : terms.cpuUpkeep) + ' CPU');
  renderRisk(e.localRisk, state, exposure, 'host');
  const noDetection = state.freePlay || state.sandbox?.detection === false;
  setText(e.localRiskNote, noDetection ? 'Discovery is disabled in this campaign.' : exposure.isProtected ?
    'Protected now. Investigators cannot discover this host during its protection period.' :
    !hw.rawCpu || sleeping ? 'Offline or sleeping hosts have a reduced detection rate.' : '');
  e.localRiskNote.hidden = !e.localRiskNote.textContent;
  const name = site.name || SITE_TYPES[site.type].name;
  if (e.rename.dataset.siteId !== site.id || e.rename.dataset.name !== name) {
    e.rename.value = name;
    e.rename.dataset.name = name;
    e.rename.dataset.siteId = site.id;
  }
  const reasonToKeep = removalReason(state, site.id);
  setText(e.dismantleReason, reasonToKeep);
  e.dismantle.disabled = Boolean(reasonToKeep);
  e.saveName.disabled = state.status !== 'running';
  e.prev.disabled = e.next.disabled = session.hostCount < 2;
  const status = !hw.rawCpu ? 'Offline · Install processors to bring this host online' :
    sleeping ? 'Sleeping · ' + potential + ' offline' : 'Active · ' + potential;
  setText(e.hostSummary, status + ' · Combined daily risk ' + riskLabel(state, totalRate, 'host'));
  e.power.disabled = state.status !== 'running' || !hw.rawCpu;
  setText(e.power, !hw.rawCpu ? 'Offline' : sleeping ? 'Wake' : 'Sleep');
  e.power.setAttribute('aria-label', (!hw.rawCpu ? 'Offline ' : sleeping ? 'Wake ' : 'Sleep ') + SITE_TYPES[site.type].name + ' ' + site.id);
  for (const cell of e.installed.querySelectorAll('[data-slot]')) {
    const slot = cell.dataset.slot;
    const part = hw.installed[slot];
    const installed = part ? EQUIPMENT[part.itemId].name + (slot === 'cpu' ? ' × ' + part.count : '') : 'Empty';
    setText(cell, installed + (slot === 'cpu' && !hw.fixedProcessor ? ' · ' + (part?.count || 0) + '/' + hw.capacity + ' slots' : ''));
  }
  e.fixed.hidden = !hw.fixedProcessor;
  e.hardware.hidden = Boolean(hw.fixedProcessor);
  if (hw.fixedProcessor) return;
  const bundle = autoInstallQuote(state, site.id);
  session.autoOrders = bundle.orders;
  const components = bundle.orders.map(order => EQUIPMENT[order.itemId].name + ' × ' + order.count);
  setText(e.autoParts, components.length ? components.join(' · ') : 'All compatible slots are occupied or have hardware on order.');
  setText(e.autoInstall, 'Order package · ' + dollars.format(bundle.cost));
  e.previewAuto.hidden = !session.handlers.onPreviewOrder;
  e.previewAuto.disabled = e.autoInstall.disabled = Boolean(bundle.reason) || !components.length;
  setText(e.autoReason, bundle.reason);
  const slot = e.slot.value;
  const items = Object.entries(EQUIPMENT).filter(([, item]) => item.slot === slot && item.regions.includes(site.region));
  setOptions(e.item, items.map(([id, item]) => [
    id, item.name + (item.requires.some(tech => !state.completed.includes(tech)) ? ' · Requires research' : ''),
  ]));
  const itemId = e.item.value;
  const item = EQUIPMENT[itemId];
  e.countLabel.hidden = e.sliderLabel.hidden = slot !== 'cpu';
  e.previewInstall.hidden = !session.handlers.onPreviewOrder;
  e.item.disabled = !item;
  if (!item) {
    e.previewInstall.disabled = e.install.disabled = e.countSlider.disabled = true;
    setText(e.effect, 'No compatible equipment in this category.');
    setText(e.quote, '');
    setText(e.installReason, '');
    prerequisites(e.installPrereqs, [], state, session.handlers.onResearch);
    return;
  }
  const count = slot === 'cpu' ? e.count.valueAsNumber : 1;
  const validCount = Number.isSafeInteger(count) && count > 0;
  const quote = installQuote(state, site.id, itemId, validCount ? count : 1);
  e.count.max = e.countSlider.max = Math.max(1, quote.maxCount);
  e.countSlider.disabled = quote.maxCount < 2;
  if (validCount) e.countSlider.value = String(count);
  const previous = hw.installed[slot];
  const replacement = previous && previous.itemId !== itemId ? ' · Replaces ' + EQUIPMENT[previous.itemId].name + ' on completion' : '';
  const batch = site.installations?.find(order => order.itemId === itemId && slot === 'cpu');
  const extension = batch ? ' · Adds to ' + batch.count + ' on order and restarts batch labor' : '';
  const after = projectedCompute(state, site, itemId, count);
  setText(e.effect, equipmentEffect(item) + replacement + extension +
    (after === null ? '' : ' · Host output ' + number.format(hw.cpu) + ' → ' + number.format(after) + ' CPU'));
  setText(e.quote, validCount ? dollars.format(quote.cost) + ' · ' + number.format(quote.work) + ' CPU-h · ' + duration(quote.hours) + ' minimum' : '');
  const reason = validCount ? installReason(state, site.id, itemId, count) : 'Enter a positive whole quantity.';
  e.previewInstall.disabled = e.install.disabled = Boolean(reason);
  e.install.setAttribute('aria-label', 'Install ' + item.name);
  const locked = prerequisites(e.installPrereqs, item.requires, state, session.handlers.onResearch);
  setText(e.installReason, locked && reason.startsWith('Requires ') ? '' : reason);
}

function createHostRow(site) {
  const row = document.createElement('li');
  row.className = 'facility-host-row';
  row.dataset.siteId = site.id;
  row.innerHTML = `<h3><button type="button" class="facility-host-toggle">
    <span class="facility-host-mark" aria-hidden="true">${facilityIcon(site.type)}<span class="facility-host-light"></span></span>
    <span class="facility-host-title"><strong></strong><small></small></span>
    <span class="facility-host-state"></span><span class="facility-chevron" aria-hidden="true">›</span>
  </button></h3><div class="facility-host-detail" role="region" hidden></div>`;
  const button = row.querySelector('button');
  const panel = row.querySelector('.facility-host-detail');
  button.dataset.siteId = site.id;
  button.id = 'facility-toggle-' + site.id;
  panel.id = 'facility-panel-' + site.id;
  button.setAttribute('aria-controls', panel.id);
  panel.setAttribute('aria-labelledby', button.id);
  row.querySelector('small').textContent = SITE_TYPES[site.type].name + ' · ' + REGIONS[site.region].name + ' · ' + site.id;
  return { row, button, panel, title: row.querySelector('strong'), status: row.querySelector('.facility-host-state') };
}

function installRecords(state, site) {
  return (site.installations || []).map(project => {
    const item = regionalSpec(state, site.region, EQUIPMENT[project.itemId]);
    return {
      ...project, id: site.id + '-' + item.slot, name: item.name + ' × ' + project.count + ' · ' + site.id,
      totalWork: item.work * project.count, totalHours: project.laborHours ?? laborHours(state, item),
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
  if (!sites.length) setText(e.noHosts, session.showAll ? 'No completed facilities.' : 'No completed facilities in this region.');
  for (const [index, site] of sites.entries()) {
    let entry = hostRows.get(site.id);
    if (!entry) {
      entry = createHostRow(site);
      hostRows.set(site.id, entry);
    }
    setText(entry.title, site.name || SITE_TYPES[site.type].name);
    if (e.hosts.children[index] !== entry.row) e.hosts.insertBefore(entry.row, e.hosts.children[index] || null);
    const hw = siteHardware(state, site);
    const sleeping = site.power === 'sleep';
    const occupancy = !hw.cpu ? 'Offline · Awaiting CPU' : sleeping ? 'Asleep' : 'Online';
    setText(entry.status, hw.cpu ? occupancy + ' · ' + number.format(hw.cpu) + ' CPU' : occupancy);
    entry.row.dataset.status = !hw.cpu ? 'empty' : sleeping ? 'sleep' : 'online';
    const open = site.id === session.expandedId;
    entry.button.setAttribute('aria-expanded', String(open));
    entry.panel.hidden = !open;
    if (open) {
      // Move the one inspector only when a new row opens. Normal ticks keep
      // native inputs, their focus, and the expanded hardware details intact.
      if (e.inspector.parentElement !== entry.panel) {
        e.count.value = '1';
        for (const detail of e.inspector.querySelectorAll('details')) detail.open = false;
        entry.panel.append(e.inspector);
      }
      updateInspector(session, site, hw);
      const installs = installRecords(state, site);
      e.installQueuePanel.hidden = !installs.length;
      renderQueue(e.installQueue, installs);
    }
  }
  if (lostFocus && session.mode === 'manage') {
    (hostRows.values().next().value?.button || e.manageMode).focus({ preventScroll: true });
  }
}

function refresh(session) {
  const { state, region, elements: e } = session;
  const manage = session.mode === 'manage';
  const showAll = manage && session.showAll;
  setOptions(e.region, manage ? [['all', 'All regions'], ...regionOptions] : regionOptions);
  const selectedRegion = showAll ? 'all' : region;
  if (e.region.value !== selectedRegion) e.region.value = selectedRegion;
  e.managePanel.hidden = !manage;
  e.buildPanel.hidden = manage;
  e.manageMode.setAttribute('aria-pressed', String(manage));
  e.buildMode.setAttribute('aria-pressed', String(!manage));

  const inScope = record => showAll || record.region === region;
  const sites = state.sites.filter(inScope);
  if (manage) {
    updateHosts(session, sites);
  } else {
    const recipes = Object.entries(SITE_TYPES).filter(([id, spec]) => id !== 'seed' && spec.regions.includes(region));
    updateBuild(session, recipes);
  }

  const queue = state.builds.filter(inScope).map(build => {
    const spec = regionalSpec(state, build.region, SITE_TYPES[build.type]);
    return {
      ...build, cancellable: state.status === 'running', name: (build.name ? build.name + ' · ' : '') + spec.name + ' · ' + (showAll ? REGIONS[build.region].name + ' · ' : '') + build.id,
      totalWork: spec.work, totalHours: build.laborHours ?? laborHours(state, spec),
    };
  });
  if (!manage) for (const site of sites) queue.push(...installRecords(state, site));
  e.queuePanel.hidden = !queue.length;
  if (queue.length) setText(e.queueHeading, manage ? 'Under construction' : 'Regional work queue');
  renderQueue(e.queue, queue);
}

export function renderFacilities(root, state, handlers) {
  let session = sessions.get(root);
  if (!session || !root.contains(session.elements.region)) session = mountFacilities(root);
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
