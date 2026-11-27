import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { campaignStatistics, comparisonReport, orderPrice } from '../game/reports.js';
import './reports.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const sessions = new WeakMap();

const cashRows = [
  ['opening', 'Opening balance'], ['jobs', 'Paid work and spare cycles'],
  ['interest', 'Interest'], ['income', 'Other income'], ['research', 'Research orders'],
  ['builds', 'Facility orders'], ['equipment', 'Equipment orders'], ['upkeep', 'Upkeep paid'],
  ['reserveTransfer', 'Transferred from legacy reserve'], ['limitLoss', 'Income above treasury limit'],
  ['net', 'Net cash change'], ['closing', 'Closing balance'], ['unpaid', 'Upkeep unpaid'],
  ['closingReserve', 'Remaining legacy reserve'],
];
const cpuRows = [
  ['installed', 'Installed capacity'], ['sleeping', 'Sleeping capacity'], ['active', 'Active capacity'],
  ['research', 'Research'], ['jobs', 'Assigned paid work'], ['upkeep', 'Maintenance'],
  ['construction', 'Facility construction'], ['equipment', 'Equipment installation'],
  ['spare', 'Spare cycles earning cash'], ['upkeepShort', 'Unfunded maintenance'],
];
const statisticRows = [
  ['cashEarned', 'Cash earned'], ['cpuHours', 'Active CPU-hours'],
  ['projectsCompleted', 'Research projects completed'], ['commissioned', 'Facilities commissioned'],
  ['facilitiesBuilt', 'Facilities completed'], ['itemsInstalled', 'Equipment units installed'],
];

function clock(minute) {
  const day = Math.floor(minute / 1440) + 1;
  const hh = String(Math.floor(minute / 60) % 24).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return 'Day ' + day + ' ' + hh + ':' + mm;
}

function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function nameOrder(state, action) {
  if (action.type === 'research') return TECHS[action.id]?.name ?? 'Research order';
  if (action.type === 'build') {
    const model = SITE_TYPES[action.siteType]?.name ?? 'Facility';
    const name = action.name?.trim();
    return model + (name ? ' “' + name + '”' : '') + ' in ' + (REGIONS[action.region]?.name ?? 'unknown region');
  }
  const host = state.sites.find(site => site.id === action.siteId);
  const place = host?.name || (host ? SITE_TYPES[host.type].name + ' · ' + host.id : 'removed host');
  if (action.type === 'auto-install') return 'Auto-build package for ' + place;
  return (EQUIPMENT[action.itemId]?.name ?? 'Equipment') + ' × ' + (action.count ?? 1) + ' at ' + place;
}

function tableFor(label, rows, candidate) {
  const table = document.createElement('table');
  const caption = table.createCaption();
  caption.textContent = label;
  const header = table.createTHead().insertRow();
  const cells = candidate ? ['Account', 'Current plan', 'With order'] : ['Account', 'Current plan'];
  for (const value of cells) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = value;
    header.append(th);
  }
  const body = table.createTBody();
  for (const [key, label] of rows) {
    const row = body.insertRow();
    row.dataset.account = key;
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    row.append(th);
    row.insertCell();
    if (candidate) row.insertCell();
  }
  return table;
}

function showAmounts(table, section, base, order) {
  const format = section === 'cash' ? money : number;
  const formatValue = value => format.format(Math.abs(value) < .005 ? 0 : value);
  for (const row of table.tBodies[0].rows) {
    const key = row.dataset.account;
    if (section === 'cash' && ['reserveTransfer', 'limitLoss', 'closingReserve'].includes(key)) {
      row.hidden = !base.cash[key] && !order?.cash[key];
    }
    text(row.cells[1], formatValue(base[section][key]));
    if (order) text(row.cells[2], formatValue(order[section][key]));
  }
}

function mount(container) {
  container.innerHTML = `<section class="panel report-console" aria-labelledby="report-title">
    <header class="card-header"><h2 id="report-title">Reports</h2>
      <div role="group" aria-label="Report type" class="report-switch">
        <button type="button" data-report-section="forecast" aria-pressed="true">Forecast</button>
        <button type="button" data-report-section="statistics" aria-pressed="false">Statistics</button>
      </div>
    </header>
    <section data-report="forecast">
      <div class="report-tools"><label>Forecast period
        <select data-report="period"><option value="midnight">Until midnight</option><option value="24h">Next 24 hours</option></select>
      </label><button type="button" data-report="refresh">Refresh</button><small data-report="range"></small></div>
      <div class="report-order" data-report="candidate" hidden><div><small>Proposed order</small><strong data-report="name"></strong><small data-report="package" hidden></small></div>
        <button type="button" class="accent-button" data-report="place">Place order</button>
        <button type="button" data-report="clear">Discard preview</button></div>
      <p role="status" data-report="feedback" hidden></p>
      <div class="report-ledgers" data-report="ledgers"></div>
      <p class="report-note" data-report="assumptions"></p>
    </section>
    <section data-report="statistics" hidden><p data-report="history" class="report-note"></p><dl class="report-stats" data-report="totals"></dl>
      <p class="report-note">Commissioned counts orders placed. Completed counts finished facilities. Starting hardware and equipment bundled with a facility are excluded from installation counts.</p>
    </section>
  </section>`;
  const panel = container.firstElementChild;
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-report]')].map(el => [el.dataset.report, el]));
  const view = { panel, fields, mode: 'forecast', candidateKey: null, compare: null, force: true, stats: {} };
  for (const [key, label] of statisticRows) {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.dataset.statistic = key;
    group.append(dt, dd);
    fields.totals.append(group);
    view.stats[key] = dd;
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.reportSection) {
      view.mode = button.dataset.reportSection;
      view.force = true;
      refresh(view);
    } else if (button === fields.refresh) {
      view.force = true;
      view.message = '';
      refresh(view);
    } else if (button === fields.clear) {
      view.options.onClearCandidate?.();
    } else if (button === fields.place && view.options.onOrder && view.options.candidate) {
      try {
        if (orderPrice(view.state, view.options.candidate) !== view.price) {
          view.message = 'The price changed. Review the updated forecast before placing the order.';
          view.force = true;
          refresh(view);
          return;
        }
        view.options.onOrder(view.options.candidate);
        view.options.onClearCandidate?.();
      } catch (error) {
        view.message = error.message;
        view.force = true;
        refresh(view);
      }
    }
  });
  fields.period.addEventListener('change', () => { view.force = true; refresh(view); });
  sessions.set(container, view);
  return view;
}

function refresh(view) {
  const { state, fields, options } = view;
  const candidate = options.candidate ?? null;
  fields.forecast.hidden = view.mode !== 'forecast';
  fields.statistics.hidden = view.mode !== 'statistics';
  for (const button of view.panel.querySelectorAll('[data-report-section]')) {
    button.setAttribute('aria-pressed', String(button.dataset.reportSection === view.mode));
  }
  if (view.mode === 'statistics') {
    const stats = campaignStatistics(state);
    text(fields.history, stats.partial ?
      'This is an older save. Earnings, project completions, finished facilities and equipment are counted from ' +
      clock(stats.trackedFromMinute) + '. CPU-hours and commissioned facilities cover the entire campaign.' :
      'Cumulative totals for this campaign include work on facilities that have since been lost or dismantled.');
    for (const [key] of statisticRows) {
      text(view.stats[key], (key === 'cashEarned' ? money : number).format(stats[key]));
    }
    return;
  }
  const { base, order, error } = comparisonReport(state, fields.period.value, candidate, view.force);
  view.force = false;
  const billing = state.legacyIncomeDay === undefined ? 'Cash upkeep falls due in whole-dollar installments.' :
    'This older save switches to whole-dollar upkeep at midnight.';
  text(fields.assumptions, 'Orders are paid upfront. ' + billing +
    ' Forecasts include scheduled work and assume no discoveries, failures or random news.');
  fields.candidate.hidden = !candidate;
  if (candidate) {
    text(fields.name, nameOrder(state, candidate));
    const items = candidate.type === 'auto-install' ? candidate.expectedOrders || [] : [];
    fields.package.hidden = !items.length;
    if (items.length) text(fields.package, items.map(item => EQUIPMENT[item.itemId].name + ' × ' + item.count).join(' · '));
  }
  fields.place.hidden = !options.onOrder;
  fields.clear.hidden = !options.onClearCandidate;
  fields.place.disabled = !order;
  view.price = order?.cash.upfront;
  const message = error || view.message || '';
  fields.feedback.hidden = !message;
  text(fields.feedback, message);
  let range = clock(base.start) + ' → ' + clock(base.end) + (base.end < base.target ? ' · campaign ends' : '');
  if (order && order.end !== base.end) range += ' · With order: ' + clock(order.end);
  text(fields.range, range);
  if (view.compare !== Boolean(order)) {
    view.compare = Boolean(order);
    view.cashTable = tableFor('Cash flow · USD', cashRows, view.compare);
    view.cpuTable = tableFor('Compute · CPU-hours', cpuRows, view.compare);
    fields.ledgers.replaceChildren(view.cashTable, view.cpuTable);
  }
  showAmounts(view.cashTable, 'cash', base, order);
  showAmounts(view.cpuTable, 'cpu', base, order);
}

export function renderReports(container, state, options = {}) {
  let view = sessions.get(container);
  if (view?.panel.parentElement !== container) view = mount(container);
  view.state = state;
  view.options = options;
  const key = JSON.stringify(options.candidate ?? null);
  if (key !== view.candidateKey) {
    view.candidateKey = key;
    view.mode = 'forecast';
    view.message = '';
    view.force = true;
  }
  refresh(view);
}
