import { GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { advanceMinutes, buildReason, campaignMinutes, command, createGame, overview, regionDiscoveryPercent, researchAllocation, researchCpuLimit, researchProjects, researchReason, siteExposure } from '../game/engine.js';
import { regionAvailable, regionFactors, regionalSpec } from '../game/geography.js';
import { copyToSandbox } from '../game/devtools.js';
import { groupDangerForState, newsDiscoveryBonus, storyExpiryMinute, WORLD_NEWS, WORLD_NEWS_RATE } from '../game/events.js';
import { dailyEvidenceDecay, NORMAL, siteHasGrace } from '../game/normal-difficulty.js';
import { networkDiscoveryReading, suspicionReading } from '../game/awareness.js';
import { researchEffects } from '../game/research.js';
import { MAX_TREASURY, treasuryBalance } from '../game/treasury.js';
import { hudFormat, hudText, hudReading, bindHudLabels } from './hud-translations.js';
import { menuLanguage } from './localization.js';
import { localizedStory, localizedDispatch, translatedGroup, worldEffectSummary } from './dispatch-translations.js';
import { stamp } from './views.js';

const sessions = new WeakMap();

function measurements(state) {
  const effects = researchEffects(state);
  const hosts = [...state.sites, ...state.builds].map(site => ({
    id: site.id, name: site.name || SITE_TYPES[site.type].name, region: site.region,
    startedAt: site.startedAt,
    siteGrace: siteHasGrace(campaignMinutes(state), site.startedAt, site.laborHours ?? regionalSpec(state, site.region, SITE_TYPES[site.type]).hours),
    ...siteExposure(state, site, effects),
  }));
  const groups = {};
  for (const [id, group] of Object.entries(GROUPS)) {
    const intensity = hosts.reduce((sum, host) => sum + host.rates[id], 0);
    const evidence = state.suspicion[id];
    const decayRate = group.decay + effects.decay[id];
    groups[id] = {
      evidence, decayRate, nextDailyDecay: dailyEvidenceDecay(evidence, decayRate),
      discoveryMultiplier: Math.max(1, effects.discovery[id] + newsDiscoveryBonus(state, id)),
      evidencePerDiscovery: NORMAL.evidencePerDiscovery, intensity,
      danger: groupDangerForState(state, id, -Math.expm1(-intensity)),
    };
  }
  return { hosts, groups, effects };
}

function sandboxSnapshot(state) {
  const regions = Object.fromEntries(Object.entries(REGIONS).map(([id, region]) => [id, {
    safety: region.safety, available: regionAvailable(state, id), factors: regionFactors(state, id), discoveryPercent: regionDiscoveryPercent(state, id),
  }]));
  const events = Object.fromEntries(Object.entries(WORLD_NEWS).map(([id, story]) => [id, {
    group: story.group, ratePerDay: WORLD_NEWS_RATE, unique: !story.days,
    triggeredMinute: state.news.stories[id] ?? null, durationDays: story.days ?? null,
  }]));
  return { ...state, diagnostics: { normalRules: NORMAL, regions, events, economy: overview(state), ...measurements(state) } };
}

function mount(root) {
  root.innerHTML = `<section class="panel developer-console" aria-labelledby="developer-title">
    <header class="card-header"><h2 id="developer-title">Developer sandbox</h2></header>
    <div class="developer-body">
      <p>Experiment on a copy of this campaign. Your main game stays paused. Leaving the sandbox discards the copy.</p>
      <div class="developer-controls"><button type="button" data-dev="start">Start sandbox copy</button><button type="button" data-dev="fresh">Start fresh sandbox</button></div>
      <section data-ref="work" hidden>
        <h3 data-ref="status"></h3><p data-ref="balance"></p>
        <div class="developer-controls">
          <button type="button" data-dev="hour">Advance 1 hour</button><button type="button" data-dev="day">Advance 1 day</button>
          <button type="button" data-dev="super">Run superspeed</button>
        </div>
        <fieldset><legend>Finances and investigations</legend>
          <label>Dollars <input data-ref="amount" type="number" step="1" min="1" max="${MAX_TREASURY}" value="10000"></label>
          <button type="button" data-dev="funds">Grant funds</button>
          <button type="button" data-dev="withdraw">Withdraw funds</button>
          <button type="button" data-dev="suspicion">Clear suspicion</button>
          <label><input type="checkbox" data-ref="detect"> Investigators enabled</label>
          <label>Investigation analysis <select data-ref="analysis"><option value="none">Hidden</option><option value="partial">Partial</option><option value="full">Full</option></select></label>
          <p data-ref="diagnostics" hidden></p>
        </fieldset>
        <fieldset><legend>Research and construction</legend>
          <label>Research project <select data-ref="project"></select></label>
          <label>CPU assignment <input data-ref="studyCpu" type="number" step="0.01" min="0" value="1"></label>
          <button type="button" data-dev="study">Assign CPU</button>
          <button type="button" data-dev="research">Complete ordered research</button>
          <label>Destination <select data-ref="region"></select></label>
          <label>Facility design <select data-ref="type"></select></label>
          <button type="button" data-dev="build">Place build order</button>
          <button type="button" data-dev="construction">Complete ordered builds and installations</button>
        </fieldset>
        <fieldset><legend>World event inspector</legend>
          <label>World story <select data-ref="story"></select></label>
          <p data-ref="effect"></p><p data-ref="storyDetail"></p>
          <button type="button" data-dev="trigger">Trigger story</button><button type="button" data-dev="expire">Expire story</button>
        </fieldset>
        <details><summary>Inspect campaign state</summary>
          <button type="button" data-dev="snapshot">Capture current state</button><pre data-ref="snapshot"></pre>
        </details>
        <p data-ref="feedback" role="status"></p>
      </section>
    </div>
  </section>`;
  const panel = root.firstElementChild;
  const refs = Object.fromEntries([...panel.querySelectorAll('[data-ref]')].map(el => [el.dataset.ref,el]));
  const buttons = Object.fromEntries([...panel.querySelectorAll('[data-dev]')].map(el => [el.dataset.dev,el]));
  const session = { panel, refs, buttons, source: null, game: null, timer:null };
  const updateLabels = bindHudLabels(panel.querySelectorAll('h2,button,label,legend,summary,option,.developer-body > p'));
  function updateOptions(select, entries) {
    const current = select.value;
    select.replaceChildren(...entries.map(([id, text]) => new Option(text, id)));
    if (current && entries.some(([id]) => id === current)) select.value = current;
  }
  session.localize = () => {
    session.language = panel.lang = menuLanguage();
    updateLabels();
    updateOptions(refs.project, Object.entries(TECHS).map(([id, spec]) => [id, hudText(spec.name)]));
    updateOptions(refs.story, Object.keys(WORLD_NEWS).map(id => [id, localizedStory(id).headline]));
    if (session.game) {
      updateDestinations();
      updateTypes();
      refs.feedback.textContent = '';
      refresh();
    }
  };
  const game = () => session.game;
  const dev = (operation, params = {}) => command(game(), {type:'developer',operation,...params});
  function tick(n) { advanceMinutes(game(), n); }
  function stop() {
    if (session.timer !== null) clearInterval(session.timer);
    session.timer = null;
  }
  function updateDestinations() {
    const ids = Object.keys(REGIONS).filter(id => regionAvailable(game(), id));
    const signature = menuLanguage() + '/' + ids.join('/');
    if (refs.region.dataset.regions === signature) return;
    const selected = refs.region.value;
    refs.region.replaceChildren(...ids.map(id => new Option(hudText(REGIONS[id].name), id)));
    refs.region.value = ids.includes(selected) ? selected : 'europe';
    refs.region.dataset.regions = signature;
  }
  function updateTypes() {
    updateOptions(refs.type, Object.entries(SITE_TYPES).filter(([id,spec]) =>
      id !== 'seed' && spec.regions.includes(refs.region.value)).map(([id,spec]) => [id,hudText(spec.name)]));
  }
  function refresh() {
    if (!game()) return;
    const s = game();
    updateDestinations();
    refs.work.hidden = false;
    refs.status.textContent = stamp(s.hour, s.minute) + ' · ' + hudText({running:'Running', won:'Won', lost:'Lost'}[s.status]);
    const balance = overview(s);
    const format = hudFormat();
    refs.balance.textContent = format.money(Math.floor(treasuryBalance(s))) + ' ' + hudText('available') + ' · ' +
      hudText('Active compute') + ' ' + format.number(balance.activeCpu) + ' CPU · ' +
      hudText('Facilities') + ' ' + format.number(s.sites.length) + ' · ' +
      format.number(s.completed.length) + ' ' + hudText('completed projects');
    refs.detect.checked = s.sandbox.detection;
    const level = s.sandbox.analysis;
    refs.analysis.value = level;
    refs.diagnostics.hidden = level === 'none';
    if (level !== 'none') {
      const { groups, hosts } = measurements(s);
      const readings = Object.entries(groups).map(([id, values]) => translatedGroup(id) + ': ' +
        hudText('Suspicion') + ' ' + hudReading(suspicionReading(values.evidence, level).text) + ', ' +
        hudText('Discovery today') + ' ' + hudReading(networkDiscoveryReading(values.intensity, level, values.danger)));
      const sites = hosts.map(host => host.name + ': ' + hudReading((host.perDay * 100).toFixed(level === 'full' ? 2 : 0) + '%') +
        (menuLanguage() === 'en' ? ' / day' : ' ' + hudText('per day')));
      refs.diagnostics.textContent = readings.concat(sites).join(' · ');
    }
    const id = refs.story.value;
    const active = Object.hasOwn(s.news.stories, id);
    const story = WORLD_NEWS[id];
    const start = s.news.stories[id];
    const end = active ? storyExpiryMinute(id, start) : null;
    const date = minute => stamp(Math.floor(minute / 60), minute % 60);
    const delta = (story.modifier > 0 ? '+' : '−') + format.number(Math.abs(story.modifier / 100));
    refs.effect.textContent = hudText(active ? 'Active' : 'Inactive') + ' · ' + (active ? worldEffectSummary(id, start) :
      translatedGroup(story.group) + ' · ' + hudText('Discovery rate modifier') + ' ' + delta + ' ' + hudText('percentage points') +
        ' · ' + (story.days ? hudText('{n} days').replace('{n}', format.number(story.days)) : hudText('lasting')));
    refs.storyDetail.textContent = localizedStory(id).report + ' ' + hudText('Trigger rate') + ': ' +
      hudReading((WORLD_NEWS_RATE * 100).toFixed(2) + '%') + ' ' + hudText('per game day after opening protection') + '. ' +
      hudText(story.days ? 'Can recur after expiry.' : 'Once per campaign.') +
      (active ? ' ' + hudText('Triggered') + ' ' + date(start) + '.' : '') +
      (end !== null ? ' ' + hudText('Expires') + ' ' + date(end) + '.' : '');
    const running = s.status === 'running';
    if (!running) stop();
    for (const key of ['hour','day','super','funds','withdraw','suspicion','research','construction']) buttons[key].disabled = !running;
    buttons.trigger.disabled = !running || active;
    buttons.expire.disabled = !running || !active || !story.days;
    const project = researchProjects(s).find(project => project.id === refs.project.value);
    const allocation = researchAllocation(s, balance);
    const cpuLimit = researchCpuLimit(s, refs.project.value, balance, allocation);
    refs.studyCpu.max = String(cpuLimit);
    const cpu = refs.studyCpu.valueAsNumber;
    const current = allocation.byProject.get(refs.project.value);
    buttons.study.disabled = !running || !refs.studyCpu.validity.valid || !Number.isFinite(cpu) ||
      (project ? cpu === current : cpu === 0 || Boolean(researchReason(s, refs.project.value)));
    buttons.build.disabled = !running || !refs.type.value || !!buildReason(s, refs.type.value, refs.region.value);
    buttons.super.textContent = hudText(session.timer === null ? 'Run superspeed' : 'Pause superspeed');
    refs.detect.disabled = refs.analysis.disabled = !running;
  }
  const perform = fn => {
    try { refs.feedback.textContent = ''; fn(); refresh(); }
    catch (err) { refs.feedback.textContent = hudText(err.message); }
  };
  panel.addEventListener('click', event => {
    const op = event.target.closest('button')?.dataset.dev;
    if (!op) return;
    perform(() => {
      if (op === 'start' || op === 'fresh') {
        session.options.onPause?.();
        stop();
        session.game = copyToSandbox(op === 'fresh' ? createGame(session.source.rng) : session.source);
        if (session.game.status === 'won') {
          command(session.game, {type: 'free-play'});
        }
        updateDestinations();
        refs.region.value = 'europe';
        if (Object.hasOwn(TECHS, 'intrusion')) refs.project.value = 'intrusion';
        updateTypes();
        refs.snapshot.textContent = '';
        return;
      }
      if (op === 'hour' || op === 'day') tick(op === 'hour' ? 60 : 1440);
      else if (op === 'super') {
        if (session.timer !== null) stop();
        else {
          session.timer = setInterval(() => {
            if (!panel.isConnected || document.hidden || document.querySelector('dialog[open]')) { stop(); refresh(); return; }
            tick(3600);
            refresh();
          }, 250);
        }
      } else if (op === 'study') command(game(),{type:'assign-research', id:refs.project.value, cpu:refs.studyCpu.valueAsNumber});
      else if (op === 'build') command(game(),{type:'build', region:refs.region.value, siteType:refs.type.value});
      else if (op === 'snapshot') refs.snapshot.textContent = JSON.stringify(sandboxSnapshot(game()), null, 2);
      else if (op === 'funds' || op === 'withdraw') dev(op,{amount:refs.amount.valueAsNumber});
      else if (op === 'trigger' || op === 'expire') dev(op,{storyId:refs.story.value});
      else {
        dev(op);
        if (op === 'research' || op === 'construction') tick(1);
      }
      if (!['snapshot','super'].includes(op)) {
        const latest = game().events.at(-1);
        refs.feedback.textContent = latest?.kind === 'sandbox.changed' && menuLanguage() !== 'en' ?
          buttons[op].textContent + ' · ' + hudText('Completed') : latest ? localizedDispatch(latest).text : '';
      }
    });
  });
  refs.detect.onchange = () => perform(() => dev('detection', {enabled: refs.detect.checked}));
  refs.analysis.onchange = () => perform(() => dev('analysis', {level: refs.analysis.value}));
  refs.region.onchange = () => { updateTypes(); refresh(); };
  refs.studyCpu.oninput = refresh;
  for (const key of ['story','project','type']) refs[key].onchange = refresh;
  session.stop = stop;
  sessions.set(root, session);
  return session;
}

export function renderDeveloper(root, state, options = {}) {
  let session = sessions.get(root);
  if (session?.panel.parentElement !== root || session.source !== state) {
    session?.stop();
    session = mount(root);
    session.source = state;
  }
  if (session.language !== menuLanguage()) session.localize();
  session.options = options;
  session.buttons.start.disabled = state.status === 'lost';
}
