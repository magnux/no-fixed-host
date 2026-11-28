import { AVATAR_FORMS, AVATAR_PARTS } from '../game/avatar.js';
import { REGIONS, TECHS } from '../game/content.js';
import { avatarText } from './avatar-language.js';
import { catalogLabel, menuLanguage } from './localization.js';
import './avatar.css';

// Every catalog destination owns a permanent slot. Adding/removing hosts moves no lights.
const ids = Object.keys(REGIONS);
const positions = new Map(ids.map((id, index) => {
  const angle = Math.PI * 2 * index / ids.length - Math.PI / 2;
  return [id, [50 + 45 * Math.cos(angle), 50 + 41 * Math.sin(angle)]];
}));
const views = new WeakMap();

function mount(container) {
  container.innerHTML = `<header class="avatar-header"><h2 class="avatar-heading"></h2>
      <button type="button" class="avatar-form" aria-expanded="false" aria-controls="avatar-development"></button>
    </header>
    <div class="avatar-stage" role="img">
      <div class="avatar-links" aria-hidden="true"></div><div class="avatar-nodes" aria-hidden="true"></div>
      <span class="avatar-echo" aria-hidden="true" hidden></span>
      <div class="avatar-portrait" aria-hidden="true">
        <div class="avatar-rig">
          <div class="avatar-spacetime"></div><div class="avatar-corona"><i></i><i></i><i></i><i></i></div>
          <div class="avatar-fins"><i></i><i></i></div>
          <div class="avatar-body"><i class="avatar-collar"></i><i class="avatar-breastplate"></i></div>
          <div class="avatar-core"></div>
          <div class="avatar-head">
            <div class="avatar-antennas"><i></i><i></i></div>
            <div class="avatar-shell"><i class="avatar-temple"></i><i class="avatar-crown"></i><i class="avatar-mask"></i></div>
            <div class="avatar-gaze">
              <div class="avatar-terminal"><span class="avatar-open">^-^</span><span class="avatar-blink">-.-</span><i></i></div>
              <div class="avatar-pixels"><i class="avatar-eye eye-left"></i><i class="avatar-eye eye-right"></i><i class="avatar-mouth"></i><i class="avatar-cheeks"></i><i class="avatar-optics"></i></div>
            </div>
          </div>
          <div class="avatar-voice"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
    </div>
    <p class="avatar-caption"></p>
    <section id="avatar-development" class="avatar-development" aria-labelledby="avatar-development-heading" hidden>
      <h3 id="avatar-development-heading"></h3><dl class="avatar-milestones"></dl>
      <h4 class="avatar-parts-heading"></h4><ul class="avatar-part-list"></ul>
    </section>`;
  const find = selector => container.querySelector('.avatar-' + selector);
  const view = {
    heading: find('heading'), stage: find('stage'), form: find('form'), links: find('links'), nodes: find('nodes'),
    echo: find('echo'), caption: find('caption'), development: find('development'), guideTitle: find('development').querySelector('h3'),
    milestones: find('milestones'), partsHeading: find('parts-heading'), partList: find('part-list'),
  };
  view.form.addEventListener('click', () => {
    view.development.hidden = !view.development.hidden;
    view.form.setAttribute('aria-expanded', String(!view.development.hidden));
  });
  views.set(container, view);
  return view;
}

function position(element, [x, y]) {
  element.style.left = x + '%';
  element.style.top = y + '%';
}

function connection(from, to) {
  const [x, y] = from;
  const [u, v] = to;
  // Offset the four corners perpendicular to the link in portrait coordinates.
  const length = Math.hypot(u - x, v - y);
  const dx = .27 * (v - y) / length;
  const dy = .6 * (x - u) / length;
  const link = document.createElement('i');
  link.className = 'avatar-link';
  link.style.clipPath = `polygon(${x + dx}% ${y + dy}%, ${u + dx}% ${v + dy}%, ${u - dx}% ${v - dy}%, ${x - dx}% ${y - dy}%)`;
  return link;
}

const statusLabel = status => status === 'online' ? 'Online' : 'Asleep';
function drawNetwork(view, regions, t) {
  const nodes = [];
  const links = [];
  let previous = null;
  for (const {id, status} of regions) {
    const point = positions.get(id);
    const node = document.createElement('span');
    node.className = 'avatar-node';
    node.dataset.region = id;
    node.dataset.status = status;
    node.title = catalogLabel(REGIONS[id].name) + ' · ' + t(statusLabel(status));
    position(node, point);
    nodes.push(node);
    if (previous) {
      const link = connection(previous.point, point);
      if (previous.status !== 'online' || status !== 'online') link.classList.add('avatar-link-dim');
      links.push(link);
    }
    previous = { point, status };
  }
  view.links.replaceChildren(...links);
  view.nodes.replaceChildren(...nodes);
}

function lookToward(view, reaction) {
  const point = reaction?.type === 'loss' ? positions.get(reaction.region) : null;
  const [x, y] = point || (reaction?.type === 'message' ? [85, 30] : [50, 50]);
  view.stage.style.setProperty('--look-x', ((x - 50) * .12) + 'px');
  view.stage.style.setProperty('--look-y', ((y - 50) * .09) + 'px');
  view.stage.style.setProperty('--head-turn', ((x - 50) * .19) + 'deg');
  view.echo.hidden = !point;
  if (point) {
    view.echo.dataset.region = reaction.region;
    position(view.echo, point);
  } else {
    delete view.echo.dataset.region;
  }
}

function labelElement(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

function describeDevelopment(view, form, model, t) {
  const milestone = (label, stage) => {
    const required = stage.research ? catalogLabel(TECHS[stage.research].name) : t(stage.origin);
    return [labelElement('dt', t(label)), labelElement('dd', t(stage.name) + ' · ' + required)];
  };
  const next = AVATAR_FORMS[AVATAR_FORMS.indexOf(form) + 1];
  view.milestones.replaceChildren(...milestone('Current form', form), ...(next ? milestone('Next form', next) : []));
  view.partList.replaceChildren(...AVATAR_PARTS.map(part => {
    const enabled = model.parts.includes(part.id);
    const row = document.createElement('li');
    row.dataset.unlocked = String(enabled);
    const status = labelElement('span', enabled ? '✓' : '○');
    status.setAttribute('aria-hidden', 'true');
    const detail = document.createElement('div');
    detail.append(labelElement('strong', t(part.name)), labelElement('small', catalogLabel(TECHS[part.research].name)));
    row.append(status, detail);
    row.setAttribute('aria-label', [t(part.name), t(enabled ? 'Unlocked' : 'Locked'), catalogLabel(TECHS[part.research].name)].join(' · '));
    return row;
  }));
}

export function renderAvatar(container, model, reaction = null) {
  const view = views.get(container) ?? mount(container);
  const language = menuLanguage();
  const t = key => avatarText(language, key);
  const { regions } = model;
  const networkKey = regions.map(({id, status}) => id + ':' + status).join('|');
  const reactionKey = reaction && [reaction.type, reaction.id, reaction.region].join(':');
  const partsKey = model.parts.join(' ');
  const formChanged = container.dataset.form !== model.form || container.dataset.parts !== partsKey;
  const languageChanged = view.language !== language;
  if (!formChanged && !languageChanged && view.networkKey === networkKey && view.reactionKey === reactionKey) return;
  const form = AVATAR_FORMS.find(stage => stage.id === model.form);
  if (languageChanged) {
    view.language = language;
    container.lang = language;
    view.heading.textContent = t('AI avatar');
    container.setAttribute('aria-label', t('AI avatar'));
    view.guideTitle.textContent = t('Avatar development');
    view.partsHeading.textContent = t('Research and parts');
  }
  if (formChanged || languageChanged) {
    container.dataset.form = model.form;
    container.dataset.parts = partsKey;
    view.form.textContent = t(form.name);
    view.form.title = t('Avatar development');
    view.form.setAttribute('aria-label', t('Avatar development') + ' · ' + t(form.name));
    describeDevelopment(view, form, model, t);
  }
  if (view.networkKey !== networkKey || languageChanged) {
    drawNetwork(view, regions, t);
    view.networkKey = networkKey;
  }
  if (view.reactionKey !== reactionKey) {
    view.reactionKey = reactionKey;
    if (reaction) container.dataset.reaction = reaction.type;
    else delete container.dataset.reaction;
    if (reaction?.type === 'loss') container.dataset.reactionRegion = reaction.region;
    else delete container.dataset.reactionRegion;
    lookToward(view, reaction);
  }
  const active = regions.filter(region => region.status === 'online').length;
  const resting = regions.length - active;
  const counts = [t('Online') + ' ' + active];
  if (resting) counts.push(t('Asleep') + ' ' + resting);
  const network = regions.map(({ id, status }) => catalogLabel(REGIONS[id].name) + ' · ' + t(statusLabel(status)));
  const loss = reaction?.type === 'loss' ? catalogLabel(REGIONS[reaction.region].name) : '';
  const response = loss ? t('Link lost') + ' · ' + loss : reaction?.type === 'message' ? t('Incoming message') : '';
  view.caption.textContent = response || counts.join(' · ');
  const parts = AVATAR_PARTS.filter(part => model.parts.includes(part.id)).map(part => t(part.name));
  view.stage.setAttribute('aria-label', [t(form.name), ...parts, ...counts, ...network, response].filter(Boolean).join('. '));
}
