import { GROUPS, REGIONS, SITE_TYPES, TECHS } from '../game/content.js';
import { advanceMinutes, buildReason, command, createGame, overview, researchAllocation, researchCpuLimit, researchProjects, researchReason, siteExposure } from '../game/engine.js';
import { regionAvailable } from '../game/geography.js';
import { copyToSandbox } from '../game/devtools.js';
import { WORLD_NEWS } from '../game/events.js';
import { stamp } from './views.js';

const sessions = new WeakMap();

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
          <label>Grant dollars <input data-ref="amount" type="number" step="1" min="1" max="1000000000" value="10000"></label>
          <button type="button" data-dev="funds">Grant funds</button>
          <button type="button" data-dev="suspicion">Clear suspicion</button>
          <label><input type="checkbox" data-ref="detect"> Investigators enabled</label>
          <label><input type="checkbox" data-ref="analysis"> Show detailed analysis</label>
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
          <p data-ref="effect"></p>
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
  const option = (select, specs) => Object.entries(specs).forEach(([id, spec]) => select.add(new Option(spec.name || spec.headline, id)));
  option(refs.project, TECHS); option(refs.story, WORLD_NEWS);
  const game = () => session.game;
  const dev = (operation, params = {}) => command(game(), {type:'developer',operation,...params});
  function tick(n) { advanceMinutes(game(), n); }
  function stop() {
    if (session.timer !== null) clearInterval(session.timer);
    session.timer = null;
  }
  function updateDestinations() {
    const ids = Object.keys(REGIONS).filter(id => regionAvailable(game(), id));
    const signature = ids.join('/');
    if (refs.region.dataset.regions === signature) return;
    const selected = refs.region.value;
    refs.region.replaceChildren(...ids.map(id => new Option(REGIONS[id].name, id)));
    refs.region.value = ids.includes(selected) ? selected : 'europe';
    refs.region.dataset.regions = signature;
  }
  function updateTypes() {
    refs.type.replaceChildren();
    for (const [id,spec] of Object.entries(SITE_TYPES)) {
      if (id !== 'seed' && spec.regions.includes(refs.region.value)) refs.type.add(new Option(spec.name,id));
    }
  }
  function refresh() {
    if (!game()) return;
    const s = game();
    updateDestinations();
    refs.work.hidden = false;
    refs.status.textContent = stamp(s.hour, s.minute) + ' · ' + s.status;
    const balance = overview(s);
    refs.balance.textContent = Math.floor(s.cash).toLocaleString('en-US',{ style: 'currency', currency: 'USD', maximumFractionDigits:0 }) +
      ' available · ' + balance.activeCpu + ' active CPU · ' + s.sites.length + ' facilities · ' + s.completed.length + ' completed projects';
    refs.detect.checked = s.sandbox.detection;
    refs.analysis.checked = s.sandbox.analysis;
    refs.diagnostics.hidden = !s.sandbox.analysis;
    if (s.sandbox.analysis) {
      const percent = n => (n * 100).toFixed(3) + '%';
      refs.diagnostics.textContent = [...s.sites, ...s.builds].map(site => {
        const { perDay, rates } = siteExposure(s, site);
        const groups = Object.entries(rates).map(([group, rate]) => GROUPS[group].name + ' ' + percent(-Math.expm1(-rate)));
        return (site.name || site.id) + ' · ' + percent(perDay) + ' / day (' + groups.join(', ') + ')';
      }).join(' · ') || 'No sites.';
    }
    const id = refs.story.value;
    const active = Object.hasOwn(s.news.stories, id);
    const story = WORLD_NEWS[id];
    refs.effect.textContent = (active ? 'Active' : 'Inactive') + ' · ' + story.group + ' investigation multiplier ' +
      (story.modifier > 0 ? '+' : '') + story.modifier / 100 + ' percentage points · ' +
      (story.days ? story.days + ' days' : 'lasting');
    const running = s.status === 'running';
    if (!running) stop();
    for (const key of ['hour','day','super','funds','suspicion','research','construction']) buttons[key].disabled = !running;
    buttons.trigger.disabled = !running || active;
    buttons.expire.disabled = !running || !active;
    const project = researchProjects(s).find(project => project.id === refs.project.value);
    const allocation = researchAllocation(s, balance);
    const cpuLimit = researchCpuLimit(s, refs.project.value, balance, allocation);
    refs.studyCpu.max = String(cpuLimit);
    const cpu = refs.studyCpu.valueAsNumber;
    const current = allocation.byProject.get(refs.project.value);
    buttons.study.disabled = !running || !refs.studyCpu.validity.valid || !Number.isFinite(cpu) ||
      (project ? cpu === current : cpu === 0 || Boolean(researchReason(s, refs.project.value)));
    buttons.build.disabled = !running || !refs.type.value || !!buildReason(s, refs.type.value, refs.region.value);
    buttons.super.textContent = session.timer === null ? 'Run superspeed' : 'Pause superspeed';
    refs.detect.disabled = refs.analysis.disabled = !running;
  }
  const perform = fn => {
    try { refs.feedback.textContent = ''; fn(); refresh(); }
    catch (err) { refs.feedback.textContent = err.message; }
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
      else if (op === 'snapshot') refs.snapshot.textContent = JSON.stringify(game(), null, 2);
      else if (op === 'funds') dev(op,{amount:refs.amount.valueAsNumber});
      else if (op === 'trigger' || op === 'expire') dev(op,{storyId:refs.story.value});
      else {
        dev(op);
        if (op === 'research' || op === 'construction') tick(1);
      }
      if (!['snapshot','super'].includes(op)) refs.feedback.textContent = game().events.at(-1)?.text || '';
    });
  });
  refs.detect.onchange = () => perform(() => dev('detection', {enabled: refs.detect.checked}));
  refs.analysis.onchange = () => perform(() => dev('analysis', {enabled: refs.analysis.checked}));
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
  session.options = options;
  session.buttons.start.disabled = state.status === 'lost';
}
