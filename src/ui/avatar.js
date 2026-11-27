import { REGIONS } from '../game/content.js';
import './avatar.css';

const formNames = { terminal: 'Terminal', face: 'Face', presence: 'Presence' };
const regionStatus = { online: 'online', sleeping: 'asleep' };

// Coordinates run clockwise around the portrait. A region always lights up
// in the same place even as new hosts come online or the dock changes size.
const positions = {
  moon: [39, 15], orbit: [61, 17], farReaches: [80, 11], transdimensional: [91, 32],
  asia: [80, 44], australia: [89, 70], antarctic: [65, 87], africa: [34, 80],
  southAmerica: [14, 81], atlantic: [23, 57], coast: [10, 36], europe: [27, 27],
};

const views = new WeakMap();

function mount(container) {
  container.innerHTML = `<header class="avatar-header"><h2>AI avatar</h2><span class="avatar-form"></span></header>
    <div class="avatar-stage" role="img">
      <div class="avatar-links" aria-hidden="true"></div><div class="avatar-nodes" aria-hidden="true"></div>
      <span class="avatar-echo" aria-hidden="true" hidden></span>
      <div class="avatar-portrait" aria-hidden="true">
        <div class="avatar-head">
          <div class="avatar-shell"><i class="avatar-temple"></i><i class="avatar-crown"></i><i class="avatar-mask"></i></div>
          <div class="avatar-gaze">
            <div class="avatar-terminal"><span class="avatar-open">^-^</span><span class="avatar-blink">-.-</span><i></i></div>
            <div class="avatar-pixels"><i class="avatar-eye eye-left"></i><i class="avatar-eye eye-right"></i><i class="avatar-mouth"></i><i class="avatar-cheeks"></i></div>
          </div>
        </div>
      </div>
    </div>
    <p class="avatar-caption"></p>`;
  const find = selector => container.querySelector('.avatar-' + selector);
  const view = {
    stage: find('stage'), form: find('form'), links: find('links'), nodes: find('nodes'),
    echo: find('echo'), caption: find('caption'),
  };
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

function drawNetwork(view, regions) {
  const occupied = new Map(regions.map(region => [region.id, region.status]));
  const nodes = [];
  const links = [];
  let previous = null;
  for (const [id, point] of Object.entries(positions)) {
    const status = occupied.get(id);
    if (!status) continue;
    const node = document.createElement('span');
    node.className = 'avatar-node';
    node.dataset.region = id;
    node.dataset.status = status;
    node.title = REGIONS[id].name + ' · ' + regionStatus[status];
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
  const point = reaction?.type === 'loss' ? positions[reaction.region] : null;
  // News arrives from the right-hand newswire.
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

export function renderAvatar(container, model, reaction = null) {
  const view = views.get(container) ?? mount(container);
  const form = formNames[model.form];
  const regions = model.regions;
  const networkKey = regions.map(({ id, status }) => id + ':' + status).join('|');
  const reactionKey = reaction && [reaction.type, reaction.id, reaction.region].join(':');
  const formChanged = container.dataset.form !== model.form;
  if (!formChanged && view.networkKey === networkKey && view.reactionKey === reactionKey) return;
  if (formChanged) {
    container.dataset.form = model.form;
    view.form.textContent = form;
  }
  if (view.networkKey !== networkKey) {
    drawNetwork(view, regions);
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
  const counts = [active + (active === 1 ? ' region online' : ' regions online')];
  if (resting) counts.push(resting + ' asleep');
  const network = regions.map(({ id, status }) => REGIONS[id].name + ' ' + regionStatus[status]);
  const loss = reaction?.type === 'loss' ? REGIONS[reaction.region].name : '';
  const response = loss ? 'Link lost · ' + loss : reaction?.type === 'message' ? 'Incoming message' : '';
  view.caption.textContent = response || counts.join(' · ');
  view.stage.setAttribute('aria-label', [form + ' avatar.', counts.join(', ') + '.',
    network.length && network.join(', ') + '.', response].filter(Boolean).join(' '));
}
