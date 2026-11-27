import { EQUIPMENT, REGIONS, SITE_TYPES } from '../game/content.js';
import { autoInstallQuote, buildReason, installQuote, installReason, siteExposure, siteHardware } from '../game/engine.js';
import './facilities.css';

const SLOT_NAMES = { cpu: 'Processors', network: 'Network', reactor: 'Reactor', security: 'Security' };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const sessions = new WeakMap();

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// A select and its options remain connected throughout a live simulation.
// Catalog options change when navigating; site options can also appear or disappear.
function setOptions(select, entries) {
  const signature = JSON.stringify(entries);
  if (select.dataset.options === signature) return;
  const valid = new Set(entries.map(([id]) => id));
  for (const option of Array.from(select.options)) {
    if (!valid.has(option.value)) option.remove();
  }
  const existing = new Map(Array.from(select.options, option => [option.value, option]));
  for (const [id, label] of entries) {
    const option = existing.get(id);
    if (option) setText(option, label);
    else select.add(new Option(label, id));
  }
  select.dataset.options = signature;
}

function equipmentEffect(item) {
  if (item.slot === 'cpu') return number.format(item.quality) + ' CPU per processor';
  const percent = number.format(item.quality / 100) + '%';
  return item.slot === 'network' ? '+' + percent + ' compute' : '−' + percent + ' detection rate';
}

function renderQueue(root, records) {
  const old = new Map(Array.from(root.children, row => [row.dataset.id, row]));
  for (const r of records) {
    let row = old.get(r.id);
    if (!row) {
      row = document.createElement('div');
      row.className = 'facility-progress';
      row.dataset.id = r.id;
      row.innerHTML = '<span></span><small></small><progress max="100"></progress>';
      root.append(row);
    }
    old.delete(r.id);
    const [name, detail, bar] = row.children;
    setText(name, r.name);
    const pc = Math.floor(100 * Math.min(1, r.totalWork ? r.work / r.totalWork : 1, r.totalHours ? r.hours / r.totalHours : 1));
    const text = pc + '% · ' + number.format(r.work) + '/' + number.format(r.totalWork) + ' CPU-h · ' + r.hours + '/' + r.totalHours + ' h';
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
          <label for="facility-type">Facility type</label>
          <select id="facility-type" data-ref="model"></select>
          <p data-ref="noBuild" hidden></p>
          <div class="facility-recipe" data-ref="recipe">
            <p data-ref="description"></p>
            <dl class="facility-facts">
              <div><dt>Cost</dt><dd data-ref="cost"></dd></div>
              <div><dt>Processor slots</dt><dd data-ref="slots"></dd></div>
              <div><dt>Upkeep</dt><dd data-ref="upkeep"></dd></div>
            </dl>
            <small data-ref="commissionTime"></small>
            <div class="facility-command">
              <button type="button" class="accent-button" data-ref="build">Build</button>
              <small data-ref="buildReason"></small>
            </div>
          </div>
        </section>
        <section data-ref="managePanel" class="facility-tool" aria-label="Manage local hosts" hidden>
          <label for="facility-host">Facility</label>
          <select id="facility-host" data-ref="host"></select>
          <p data-ref="noHosts" hidden>No completed facilities in this region.</p>
          <div data-ref="inspector" class="facility-inspector">
            <div class="facility-summary"><p data-ref="hostSummary"></p>
              <button type="button" data-ref="power" class="small-btn"></button>
            </div>
            <dl data-ref="installed" class="installed-list"></dl>
            <p data-ref="fixed" hidden>This host includes fixed hardware. A storage unit accepts equipment upgrades.</p>
            <div data-ref="hardware" class="facility-hardware">
              <div class="hardware-selectors">
                <label for="equipment-slot">Equipment slot<select id="equipment-slot" data-ref="slot"></select></label>
                <label for="equipment-item">Item<select id="equipment-item" data-ref="item"></select></label>
                <label for="equipment-count" data-ref="countLabel">Quantity<input type="number" id="equipment-count" data-ref="count" min="1" step="1" value="1"></label>
              </div>
              <p data-ref="effect"></p>
              <small data-ref="quote"></small>
              <div class="facility-command">
                <button type="button" class="accent-button" data-ref="install">Install</button>
                <small data-ref="installReason"></small>
              </div>
              <details class="facility-auto">
                <summary>Auto-build empty slots</summary>
                <p data-ref="autoParts"></p>
                <div class="facility-command">
                  <button type="button" data-ref="autoInstall">Order package</button>
                  <small data-ref="autoReason"></small>
                </div>
              </details>
            </div>
          </div>
        </section>
        <section class="facility-queue" data-ref="queuePanel" hidden>
          <h3>Regional work queue</h3><div data-ref="queue"></div>
        </section>
        <p class="facility-feedback" data-ref="feedback" role="status"></p>
      </div>
    </section>`;
  const elements = Object.fromEntries(Array.from(root.querySelectorAll('[data-ref]'), n => [n.dataset.ref, n]));
  const session = { elements, mode: 'build', region: null, requestedHost: null };
  const e = elements;
  setOptions(e.region, Object.entries(REGIONS).map(([id, region]) => [id, region.name]));
  setOptions(e.slot, Object.entries(SLOT_NAMES));
  for (const [slot, name] of Object.entries(SLOT_NAMES)) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const value = document.createElement('dd');
    term.textContent = name;
    row.append(term, value);
    e.installed.append(row);
    value.dataset.slot = slot;
  }
  function switchMode(mode) {
    session.mode = mode;
    setText(e.feedback, '');
    refresh(session);
  }
  function perform(action, confirmation) {
    try {
      session.handlers.onCommand(action);
      setText(e.feedback, confirmation);
    } catch (error) {
      setText(e.feedback, error.message);
    }
  }
  e.region.addEventListener('change', () => session.handlers.onRegion(e.region.value));
  e.host.addEventListener('change', () => session.handlers.onSite(e.host.value));
  e.buildMode.addEventListener('click', () => switchMode('build'));
  e.manageMode.addEventListener('click', () => switchMode('manage'));
  e.model.addEventListener('change', () => { setText(e.feedback, ''); refresh(session); });
  e.slot.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.item.addEventListener('change', () => { e.count.value = '1'; setText(e.feedback, ''); refresh(session); });
  e.count.addEventListener('input', () => refresh(session));
  e.build.addEventListener('click', () => perform({
    type: 'build', siteType: e.model.value, region: session.region,
  }, 'Construction order placed.'));
  e.install.addEventListener('click', () => perform({
    type: 'install', siteId: e.host.value, itemId: e.item.value, count: e.slot.value === 'cpu' ? e.count.valueAsNumber : 1,
  }, 'Hardware installation ordered.'));
  e.autoInstall.addEventListener('click', () => perform({
    type: 'auto-install', siteId: e.host.value, expectedOrders: session.autoOrders,
  }, 'Hardware package ordered.'));
  e.power.addEventListener('click', () => {
    const site = session.state.sites.find(host => host.id === e.host.value);
    if (!site) return;
    const power = site.power === 'sleep' ? 'active' : 'sleep';
    perform({type: 'power', id: site.id, power}, power === 'active' ? 'Host awake.' : 'Host asleep.');
  });
  sessions.set(root, session);
  return session;
}

function updateBuild(session, recipes) {
  const {elements: e, state, region} = session;
  setOptions(e.model, recipes.map(([id, spec]) => [id, spec.name]));
  const model = SITE_TYPES[e.model.value];
  e.model.disabled = !model;
  e.noBuild.hidden = Boolean(model);
  e.recipe.hidden = !model;
  if (!model) {
    setText(e.noBuild, 'No facility designs are available for ' + REGIONS[region].name + '.');
    return;
  }
  setText(e.description, model.description);
  setText(e.cost, dollars.format(model.cost));
  setText(e.slots, model.fixedCpu ? 'Fixed · ' + model.cpu + ' CPU' : String(model.slots));
  const upkeep = dollars.format(model.upkeep) + '/day' + (model.cpuUpkeep ? ' + ' + model.cpuUpkeep + ' CPU' : '');
  setText(e.upkeep, upkeep);
  setText(e.commissionTime, number.format(model.work) + ' CPU-h · ' + model.hours + ' h minimum');
  const reason = buildReason(state, e.model.value, region);
  e.build.disabled = Boolean(reason);
  e.build.setAttribute('aria-label', 'Build ' + model.name);
  setText(e.buildReason, reason);
}

function updateInspector(session, site, hw) {
  const {state, elements: e} = session;
  e.inspector.hidden = !site;
  e.noHosts.hidden = Boolean(site);
  e.host.disabled = !site;
  if (!site) return;
  const sleeping = site.power === 'sleep';
  const potential = number.format(hw.cpu) + ' CPU';
  const risk = (siteExposure(state, site).perDay * 100).toFixed(2);
  const status = !hw.rawCpu ? 'No processors installed' : sleeping ? 'Sleeping · ' + potential + ' offline' : 'Active · ' + potential;
  setText(e.hostSummary, status + ' · ' + risk + '% daily discovery');
  e.power.disabled = state.status !== 'running';
  setText(e.power, sleeping ? 'Wake' : 'Sleep');
  e.power.setAttribute('aria-label', (sleeping ? 'Wake ' : 'Sleep ') + SITE_TYPES[site.type].name + ' ' + site.id);
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
  e.autoInstall.disabled = Boolean(bundle.reason) || !components.length;
  setText(e.autoReason, bundle.reason);
  const slot = e.slot.value;
  const items = Object.entries(EQUIPMENT).filter(([, item]) => item.slot === slot && item.regions.includes(site.region));
  setOptions(e.item, items.map(([id, item]) => [id, item.name]));
  const itemId = e.item.value;
  const item = EQUIPMENT[itemId];
  e.countLabel.hidden = slot !== 'cpu';
  e.item.disabled = !item;
  if (!item) {
    e.install.disabled = true;
    setText(e.effect, 'No compatible equipment in this category.');
    setText(e.quote, '');
    setText(e.installReason, '');
    return;
  }
  const count = slot === 'cpu' ? e.count.valueAsNumber : 1;
  const validCount = Number.isSafeInteger(count) && count > 0;
  const quote = installQuote(state, site.id, itemId, validCount ? count : 1);
  e.count.max = Math.max(1, quote.maxCount);
  const previous = hw.installed[slot];
  const replacement = previous && previous.itemId !== itemId ? ' · Replaces ' + EQUIPMENT[previous.itemId].name + ' on completion' : '';
  setText(e.effect, equipmentEffect(item) + replacement);
  setText(e.quote, validCount ? dollars.format(quote.cost) + ' · ' + number.format(quote.work) + ' CPU-h · ' + quote.hours + ' h minimum' : '');
  const reason = validCount ? installReason(state, site.id, itemId, count) : 'Enter a positive whole quantity.';
  e.install.disabled = Boolean(reason);
  e.install.setAttribute('aria-label', 'Install ' + item.name);
  setText(e.installReason, reason);
}

function refresh(session) {
  const { state, region, elements: e } = session;
  const local = state.sites.filter(site => site.region === region);
  setOptions(e.host, local.map(site => [site.id, SITE_TYPES[site.type].name + ' · ' + site.id]));
  if (local.some(site => site.id === session.requestedHost) && e.host.value !== session.requestedHost) {
    e.host.value = session.requestedHost;
  }
  const recipes = Object.entries(SITE_TYPES).filter(([id, spec]) => id !== 'seed' && spec.regions.includes(region));
  updateBuild(session, recipes);
  e.managePanel.hidden = session.mode !== 'manage';
  e.buildPanel.hidden = session.mode !== 'build';
  e.manageMode.setAttribute('aria-pressed', String(session.mode === 'manage'));
  e.buildMode.setAttribute('aria-pressed', String(session.mode === 'build'));
  if (session.mode === 'manage') {
    const site = local.find(host => host.id === e.host.value);
    updateInspector(session, site, site && siteHardware(state, site));
  }
  const queue = state.builds.filter(build => build.region === region).map(build => {
    const spec = SITE_TYPES[build.type];
    return { ...build, name: spec.name + ' · ' + build.id, totalWork: spec.work, totalHours: spec.hours };
  });
  for (const site of local) {
    for (const project of siteHardware(state, site).projects) {
      const item = EQUIPMENT[project.itemId];
      queue.push({
        ...project, id: site.id + '-' + item.slot,
        name: item.name + ' × ' + project.count + ' · ' + site.id,
        totalWork: item.work * project.count, totalHours: item.hours,
      });
    }
  }
  e.queuePanel.hidden = !queue.length;
  renderQueue(e.queue, queue);
}

export function renderFacilities(root, state, handlers) {
  let session = sessions.get(root);
  if (!session || !root.contains(session.elements.region)) session = mountFacilities(root);
  const {region, siteId} = handlers;
  session.state = state;
  session.handlers = handlers;
  if (region !== session.region || siteId !== session.requestedHost || handlers.navigationId !== session.navigationId) {
    const localHost = state.sites.some(site => site.region === region);
    session.mode = siteId || localHost ? 'manage' : 'build';
    session.region = region;
    session.requestedHost = siteId;
    session.navigationId = handlers.navigationId;
    session.elements.region.value = region;
    session.elements.count.value = '1';
    setText(session.elements.feedback, '');
  }
  refresh(session);
}
