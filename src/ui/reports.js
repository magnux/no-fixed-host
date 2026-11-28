import { commercialAccounts } from '../game/report-accounting.js';
import { campaignStamp } from '../game/calendar.js';
import { EQUIPMENT, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { campaignStatistics, comparisonReport, orderPrice } from '../game/reports.js';
import { refitWarning } from './equipment-display.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { reportLabel as t, reportFormats } from './report-languages.js';
import { dossierFormat } from './dossier-translations.js';
import { facilityText } from './facility-language.js';
import './reports.css';

const sessions = new WeakMap();

const cashRows = [
  ['opening', 'Opening balance'], ['jobs', 'Paid work and spare cycles'],
  ['interest', 'Interest'], ['income', 'Other income'], ['research', 'Research orders'],
  ['builds', 'Facility orders'], ['equipment', 'Equipment orders'], ['upkeep', 'Upkeep paid'],
  ['rentalRefund', 'Rental funds returned'], ['prepaidUpkeep', 'Upkeep covered by standby reserve'],
  ['limitLoss', 'Income above treasury limit'],
  ['net', 'Net cash change'], ['closing', 'Closing balance'], ['unpaid', 'Upkeep unpaid'],
];
const cpuRows = [
  ['installed', 'Installed capacity'], ['sleeping', 'Sleeping capacity'], ['active', 'Active capacity'],
  ['research', 'Research'], ['jobs', 'Assigned paid work'], ['upkeep', 'Maintenance'],
  ['construction', 'Facility construction'], ['equipment', 'Equipment installation'],
  ['burst', 'Capacity from boosts'], ['unusedBurst', 'Unused boost capacity'], ['rented', 'External research work'],
  ['spare', 'Spare cycles earning cash'], ['upkeepShort', 'Unfunded maintenance'],
];
const plannedCashRows = [
  ['jobs', 'Job income'], ['interest', 'Interest'], ['income', 'Other income'],
  ['research', 'Research funding'], ['upkeep', 'Maintenance due'], ['construction', 'Facility and equipment funding'],
  ['net', 'Planned cash change'], ['closing', 'Balance if fully funded'],
];
const plannedCpuRows = [
  ['pool', 'Shared CPU pool'], ['upkeep', 'Maintenance demand'],
  ['construction', 'Construction demand'], ['balance', 'Pool surplus / shortfall'],
];
const statisticRows = [
  ['cashEarned', 'Total cash received'], ['cpuHours', 'Active CPU-hours'],
  ['projectsCompleted', 'Research projects completed'], ['commissioned', 'Facilities commissioned'],
  ['facilitiesBuilt', 'Facilities completed'], ['installationsCompleted', 'Installation orders completed'],
  ['itemsInstalled', 'Equipment units installed'],
];

function clock(minute) {
  return campaignStamp(minute, menuLanguage());
}

function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function feedback(message, candidate) {
  if (!message || menuLanguage() === 'en') return message;
  const language = menuLanguage();
  const format = dossierFormat(language);
  const max = /^At most ([\d.]+) CPU are available for this project\.$/.exec(message);
  if (max) return format.message('Choose an amount between 0 and {max} CPU in steps of {step}.',
    { max: format.number(Number(max[1])), step: format.number(.01) });
  const topic = candidate?.type === 'assign-research' && TECHS[candidate.id];
  if (topic && message.startsWith('Requires an active ')) {
    return format.label('No eligible CPU is online.') + ' ' + format.safety(topic);
  }
  const requirement = /^Requires (.+)\.$/.exec(message);
  if (requirement) return format.message('Requires {topic}.', { topic: catalogLabel(requirement[1]) });
  if (message === 'Research complete.') return format.label('Research complete') + '.';
  const localized = t(message);
  return localized === message ? facilityText(message) : localized;
}

function nameOrder(state, action) {
  if (action.type === 'assign-research') {
    return catalogLabel(TECHS[action.id]?.name ?? 'Research') + ' · ' + reportFormats().number.format(action.cpu) + ' CPU';
  }
  if (action.type === 'build') {
    const model = catalogLabel(SITE_TYPES[action.siteType]?.name ?? 'Facility');
    const name = action.name?.trim();
    return t('{model} in {region}', { model: model + (name ? ' “' + name + '”' : ''),
      region: catalogLabel(REGIONS[action.region]?.name ?? t('unknown region')) });
  }
  const host = state.sites.find(site => site.id === action.siteId);
  const place = host?.name || (host ? catalogLabel(SITE_TYPES[host.type].name) + ' · ' + host.id : t('removed host'));
  if (action.type === 'auto-upgrade') return t('Auto-upgrade package for {site}', { site: place });
  if (action.type === 'auto-install') return t('Auto-build package for {site}', { site: place });
  return t('{item} × {count} at {site}', { item: catalogLabel(EQUIPMENT[action.itemId]?.name ?? 'Equipment'),
    count: reportFormats().number.format(action.count ?? 1), site: place });
}

function tableFor(label, rows, candidate) {
  const table = document.createElement('table');
  const caption = table.createCaption();
  caption.textContent = t(label);
  const header = table.createTHead().insertRow();
  const cells = candidate ? ['Account', 'Current plan', 'With order'] : ['Account', 'Current plan'];
  for (const value of cells) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = t(value);
    header.append(th);
  }
  const body = table.createTBody();
  for (const [key, label] of rows) {
    const row = body.insertRow();
    row.dataset.account = key;
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = t(label);
    row.append(th);
    row.insertCell();
    if (candidate) row.insertCell();
  }
  return table;
}

function showAmounts(table, section, base, order) {
  const { money, number, percent } = reportFormats();
  const format = section === 'cash' || section === 'planCash' ? money : number;
  const formatValue = value => format.format(Math.abs(value) < .005 ? 0 : value);
  for (const row of table.tBodies[0].rows) {
    const key = row.dataset.account;
    if ((section === 'cash' || section === 'planCash') && key === 'interest') {
      text(row.cells[0], t('Interest ({rate} daily)', { rate: percent.format(base.dailyRate / 100) }));
    }
    if (['limitLoss', 'rentalRefund', 'prepaidUpkeep', 'burst', 'unusedBurst', 'rented'].includes(key)) {
      row.hidden = !base[section][key] && !order?.[section][key];
      if (row.hidden) continue;
    }
    text(row.cells[1], formatValue(base[section][key] ?? 0));
    if (order) text(row.cells[2], formatValue(order[section][key] ?? 0));
  }
}

function mount(container) {
  container.innerHTML = `<section class="panel report-console" aria-labelledby="report-title">
    <header class="card-header"><h2 id="report-title">${t('Reports')}</h2>
      <div role="group" aria-label="${t('Report type')}" class="report-switch">
        <button type="button" data-report-section="forecast" aria-pressed="true">${t('Forecast')}</button>
        <button type="button" data-report-section="budget" aria-pressed="false">${t('Funding needs')}</button>
        <button type="button" data-report-section="finance" aria-pressed="false">${t('Finance')}</button>
        <button type="button" data-report-section="statistics" aria-pressed="false">${t('Statistics')}</button>
      </div>
      <div class="report-tools" data-report="tools"><label>${t('Forecast')} period
        <select data-report="period"><option value="midnight">${t('Until midnight')}</option><option value="24h">${t('Next 24 hours')}</option></select>
      </label><button type="button" data-report="refresh">${t('Refresh')}</button></div>
    </header>
    <section data-report="forecast">
      <div class="report-order" data-report="candidate" hidden><div><small data-report="kind"></small><strong data-report="name"></strong><small data-report="package" hidden></small><small data-report="refit" hidden></small></div>
        <button type="button" class="accent-button" data-report="place">${t('Place order')}</button>
        <button type="button" data-report="clear">${t('Discard preview')}</button></div>
      <p role="status" data-report="feedback" hidden></p>
      <div class="report-ledgers" data-report="ledgers"></div>
      <p class="report-note"><strong data-report="range"></strong> · <span data-report="assumptions"></span></p>
    </section>
    <section data-report="finance" class="report-finance" hidden>
      <table><caption>${t('Campaign spending')}</caption>
        <thead><tr><th scope="col">${t('Account')}</th><th scope="col">${t('Paid or reserved')}</th><th scope="col">${t('Returned')}</th></tr></thead>
        <tbody data-report="accounts"></tbody></table>
      <p class="report-note" data-report="empty">${t('Purchases and reservations will appear here.')}</p>
    </section>
    <section data-report="statistics" hidden><p data-report="history" class="report-note"></p><dl class="report-stats" data-report="totals"></dl>
      <p class="report-note">${t('Cash received includes the opening grant. Each completed processor batch counts as one order. Starting hardware and equipment bundled with a facility are excluded from installation counts.')}</p>
    </section>
  </section>`;
  const panel = container.firstElementChild;
  panel.lang = menuLanguage();
  const fields = Object.fromEntries([...panel.querySelectorAll('[data-report]')].map(el => [el.dataset.report, el]));
  const view = { panel, fields, language: menuLanguage(), mode: 'forecast', candidateKey: null, compare: null, force: true, stats: {} };
  view.accounts = {};
  for (const [key, label] of Object.entries(commercialAccounts)) {
    const row = fields.accounts.insertRow();
    row.dataset.commercialAccount = key;
    const title = document.createElement('th');
    title.scope = 'row';
    title.textContent = t(label);
    row.append(title);
    row.insertCell();
    row.insertCell();
    view.accounts[key] = row;
  }
  for (const [key, label] of statisticRows) {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = t(label);
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
  const { money, number } = reportFormats();
  const candidate = options.candidate ?? null;
  fields.finance.hidden = view.mode !== 'finance';
  fields.forecast.hidden = view.mode === 'statistics' || view.mode === 'finance';
  fields.tools.hidden = fields.forecast.hidden;
  fields.statistics.hidden = view.mode !== 'statistics';
  for (const button of view.panel.querySelectorAll('[data-report-section]')) {
    button.setAttribute('aria-pressed', String(button.dataset.reportSection === view.mode));
  }
  if (view.mode === 'finance') {
    const accounts = state.statistics.commercial;
    fields.empty.hidden = Object.keys(accounts).length > 0;
    for (const [key, row] of Object.entries(view.accounts)) {
      const values = accounts[key];
      row.hidden = !values;
      if (!values) continue;
      text(row.cells[1], money.format(values.paid));
      text(row.cells[2], money.format(values.returned));
    }
    return;
  }
  if (view.mode === 'statistics') {
    const stats = campaignStatistics(state);
    text(fields.history, t('Cumulative totals for this campaign include work on facilities that have since been lost or dismantled.'));
    for (const [key] of statisticRows) {
      text(view.stats[key], (key === 'cashEarned' ? money : number).format(stats[key]));
    }
    return;
  }
  const { base, order, error } = comparisonReport(state, fields.period.value, candidate, view.force);
  view.force = false;
  const budget = view.mode === 'budget';
  text(fields.assumptions, t(budget ?
    'Current assignments and rates. Construction demand follows its assembly schedule. A negative balance is the additional cash or CPU needed.' :
    'Orders draw funds as work advances. This forecast assumes no discoveries, failures or random news.'));
  fields.candidate.hidden = !candidate;
  if (candidate) {
    const research = candidate.type === 'assign-research';
    const kind = t(research ? 'Proposed assignment' : 'Proposed order');
    text(fields.kind, kind);
    text(fields.place, t(research ? 'Assign CPU' : 'Place order'));
    text(fields.name, nameOrder(state, candidate));
    if (order) text(fields.kind, kind + ' · ' + t('{amount} new funding', { amount: money.format(order.price) }));
    const items = ['auto-install', 'auto-upgrade'].includes(candidate.type) ? candidate.expectedOrders || [] : [];
    const warning = refitWarning(state, candidate);
    fields.refit.hidden = !warning;
    text(fields.refit, warning);
    fields.package.hidden = !items.length;
    if (items.length) {
      const total = items.reduce((sum, item) => sum + item.cost, 0);
      text(fields.package, items.map(item => catalogLabel(EQUIPMENT[item.itemId].name) + ' × ' + number.format(item.count)).join(' · ') + ' · ' + t('{amount} total', { amount: money.format(total) }));
    }
  }
  fields.place.hidden = !options.onOrder;
  fields.clear.hidden = !options.onClearCandidate;
  fields.place.disabled = !order;
  view.price = order?.price;
  const message = error || view.message || '';
  fields.feedback.hidden = !message;
  text(fields.feedback, feedback(message, candidate));
  let range = clock(base.start) + ' → ' + clock(base.end) + (base.end < base.target ? ' · ' + t('campaign ends') : '');
  if (order && order.end !== base.end) range += ' · ' + t('With order') + ': ' + clock(order.end);
  text(fields.range, range);
  if (view.compare !== Boolean(order) || view.budget !== budget) {
    view.compare = Boolean(order);
    view.budget = budget;
    view.cashTable = budget ? tableFor('Funding needs · USD', plannedCashRows, view.compare) : tableFor('Cash flow · USD', cashRows, view.compare);
    view.cpuTable = budget ? tableFor('CPU demand · CPU-hours', plannedCpuRows, view.compare) : tableFor('Compute · CPU-hours', cpuRows, view.compare);
    fields.ledgers.replaceChildren(view.cashTable, view.cpuTable);
  }
  showAmounts(view.cashTable, budget ? 'planCash' : 'cash', base, order);
  showAmounts(view.cpuTable, budget ? 'planCpu' : 'cpu', base, order);
}

export function renderReports(container, state, options = {}) {
  let view = sessions.get(container);
  if (view?.panel.parentElement !== container) view = mount(container);
  else if (view.language !== menuLanguage()) {
    const previous = view;
    view = mount(container);
    view.mode = previous.mode;
    view.candidateKey = previous.candidateKey;
    view.fields.period.value = previous.fields.period.value;
  }
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
