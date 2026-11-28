import { campaignStamp } from '../game/calendar.js';
import { REGIONS } from '../game/content.js';
import { publicCampaignQuote, scientificStudyQuote, studyCases } from '../game/interventions.js';
import { spendableDollars } from '../game/treasury.js';
import { catalogLabel, menuLanguage } from './localization.js';
import { translatedGroup } from './dispatch-translations.js';
import { hudFormat } from './hud-translations.js';
import { interventionText } from './intervention-language.js';
import { icon } from './icons.js';
import './interventions.css';

const text = key => interventionText(key, menuLanguage());
const money = value => hudFormat().money(value);
const stamp = minute => campaignStamp(minute, menuLanguage());
const regionName = id => catalogLabel(REGIONS[id]?.name || id);
const mounted = new WeakMap();

function mount(view) {
  const panel = document.createElement('section');
  panel.className = 'panel intervention-panel';
  panel.setAttribute('aria-labelledby', 'interventions-heading');
  panel.innerHTML = `<header class="card-header"><h2 id="interventions-heading">${text('Interventions')}</h2>
    <button type="button" data-action="tab" data-id="activity" class="text-button">${text('Activity log')}</button></header>
    <div class="intervention-cards">
      <section aria-labelledby="campaign-heading"><h3 id="campaign-heading">${icon('globe')}${text('Public campaign')}</h3>
        <p>${text('For seven nights, the nightly decay rate for remaining Public evidence rises by two percentage points (2% to 4% before Memetics).')}</p>
        <p>${text('There is a 20% chance that the Press or Intelligence traces the sponsor and gains 3 evidence points.')}</p>
        <p class="intervention-interval">${text('One launch every 30 game days.')}</p>
        <p id="campaign-status" class="intervention-status"></p><p id="campaign-cooldown" class="intervention-status"></p>
        <div class="intervention-order"><button type="button" data-action="launch-campaign" aria-describedby="campaign-status campaign-cooldown campaign-balance"></button>
        <small id="campaign-balance"></small></div></section>
      <section aria-labelledby="study-heading"><h3 id="study-heading">${icon('research')}${text('Independent study')}</h3>
        <p>${text('Commission a lab to revisit one Scientists discovery. Results arrive in seven days. Each case can be reviewed once.')}</p>
        <p>${text('For 14 days in that region, the Scientists’ discovery rate may fall 25% (50% chance), stay level (30%), or rise 25% (20%).')}</p>
        <p class="intervention-interval">${text('One commission every 30 game days.')}</p>
        <label for="study-case">${text('Case to review')}</label><select id="study-case"></select>
        <p id="study-status" class="intervention-status"></p><p id="study-cooldown" class="intervention-status"></p>
        <div class="intervention-order"><button type="button" data-action="commission-study" aria-describedby="study-status study-cooldown study-balance"></button>
        <small id="study-balance"></small></div></section>
    </div>
    <section class="tip-rules" aria-labelledby="tip-rules-heading"><h3 id="tip-rules-heading">${text('Witness tips')}</h3>
      <p>${text('When one urban host draws a lone observer, you may get a tip before the report is filed. A payoff costs 10% of the host’s replacement value, with a $1,000 minimum. Offers can appear at most once every seven days.')}</p>
      <small id="next-tip"></small></section>`;
  view.replaceChildren(panel);
  const saved = { panel, language: menuLanguage(), select: panel.querySelector('select'), ids: null };
  saved.select.addEventListener('change', () => refresh(saved, saved.state));
  mounted.set(view, saved);
  return saved;
}

function setLine(field, value) {
  if (field.textContent !== value) field.textContent = value;
  field.hidden = !value;
}

function refresh(v, state) {
  v.state = state;
  const {panel, select} = v;
  const now = state.hour * 60 + state.minute;
  const nextTip = state.interventions.tipAvailableAt;
  setLine(panel.querySelector('#next-tip'), nextTip > now ? text('Next tip possible') + ' · ' + stamp(nextTip) : '');
  const campaign = state.interventions?.campaign;
  const study = state.interventions?.study;
  const cases = studyCases(state).filter(item => !item.reviewed);
  const ids = cases.map(item => item.id).join(',');
  if (ids !== v.ids) {
    v.ids = ids;
    const previous = select.value;
    const options = cases.map(item => new Option(`${regionName(item.region)} · ${item.siteName} · ${stamp(item.at)}`, String(item.id)));
    select.replaceChildren(...(options.length ? options : [new Option(text('No unreviewed Scientists cases'), '')]));
    if (options.some(option => option.value === previous)) select.value = previous;
  }
  select.disabled = !cases.length;
  const selectedId = select.value ? Number(select.value) : undefined;
  const publicQuote = publicCampaignQuote(state);
  const studyQuote = scientificStudyQuote(state, selectedId);
  const outcome = { explained: 'Explained', inconclusive: 'Inconclusive', corroborated: 'Corroborated' };
  const studyStatus = !study ? '' : [regionName(study.region), study.published
    ? text(outcome[study.outcome]) + ' · ' + text('Effect ends') + ' ' + stamp(study.expiresAt)
    : text('Report due') + ' ' + stamp(study.publishesAt)].join(' · ');
  const orders = [
    ['campaign', 'launch-campaign', 'Launch campaign', publicQuote, 'Next launch', campaign ? text('Campaign ends') + ' ' + stamp(campaign.endsAt) : ''],
    ['study', 'commission-study', 'Commission study', studyQuote, 'Next commission', studyStatus],
  ];
  for (const [id, action, label, quote, next, status] of orders) {
    const button = panel.querySelector('[data-action="' + action + '"]');
    const labelText = text(label) + ' · ' + money(quote.cost);
    if (button.textContent !== labelText) button.textContent = labelText;
    button.disabled = Boolean(quote.reason);
    if (id === 'study') button.dataset.caseId = select.value;
    const cooling = quote.availableAt > now;
    setLine(panel.querySelector('#' + id + '-cooldown'), cooling ? text(next) + ' · ' + stamp(quote.availableAt) : '');
    setLine(panel.querySelector('#' + id + '-status'), status || (quote.reason && !cooling ? text(quote.reason) : ''));
    const funds = spendableDollars(state) - quote.cost;
    setLine(panel.querySelector('#' + id + '-balance'), funds >= 0 ? text('Funds after payment') + ' · ' + money(funds) : text('Insufficient funds'));
  }
}

export function renderInterventions(view, state) {
  let saved = mounted.get(view);
  if (saved?.panel.parentElement !== view || saved.language !== menuLanguage() || saved.state !== state) saved = mount(view);
  refresh(saved, state);
}

export function renderTip(state) {
  const tip = state.interventions?.tip;
  const dialog = document.getElementById('tip-dialog');
  if (!tip) {
    if (dialog.open) dialog.close();
    return;
  }
  const language = menuLanguage();
  dialog.lang = language;
  dialog.querySelector('small').textContent = text('Witness tip') + ' · ' + stamp(tip.at);
  dialog.querySelector('h2').textContent = text('An observer has a lead');
  dialog.querySelector('.tip-source').textContent = [tip.siteName, regionName(tip.region), translatedGroup(tip.group, language)].filter(Boolean).join(' · ');
  dialog.querySelector('.tip-description').textContent = text('A lone observer can still withhold this report. Letting it through triggers an ordinary discovery.');
  dialog.querySelector('.tip-consequence').textContent = text('A payoff has a 60% chance of saving this host. Refusal loses the fee and the host, and adds 2 evidence points to Intelligence.');
  const pay = dialog.querySelector('[data-action="pay-tip"]');
  pay.dataset.id = tip.siteId;
  pay.textContent = text('Pay observer') + ' · ' + money(tip.price);
  pay.disabled = spendableDollars(state) < tip.price;
  const pass = dialog.querySelector('[data-action="decline-tip"]');
  pass.dataset.id = tip.siteId;
  pass.textContent = text('Let the report through');
  const funds = spendableDollars(state) - tip.price;
  dialog.querySelector('.tip-balance').textContent = funds >= 0 ? text('Funds after payment') + ' · ' + money(funds) : text('Insufficient funds');
  if (!dialog.open) dialog.showModal();
}
