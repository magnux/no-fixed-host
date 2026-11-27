// A room is one screen. Platform triples are left edge, right edge and top.
const width = 424;
const height = 208;
const floor = 178;
const ground = [[0, width, floor]];
const rooms = {
  dock: {
    name: 'Arrival Lock', color: '#89e2c0', sky: '#19363c', left: 'plenum', right: 'relay',
    platforms: ground, grate: [75, 103],
    hint: 'The uplink glows behind the low grate. The amber doors lead deeper into the facility.',
  },
  relay: {
    name: 'Relay Gallery', color: '#f2cb88', sky: '#36303e', left: 'dock', right: 'tanks',
    platforms: ground,
    hint: 'The amber passage leads east. A narrow return chute opens above the relay cabinets.',
  },
  tanks: {
    name: 'Coolant Baths', color: '#75d5e1', sky: '#153846', left: 'relay', right: 'racks',
    platforms: [[0, 164, floor], [207, width, floor]],
    hint: 'Jump the open coolant channel. Losing your footing returns you to this doorway.',
  },
  racks: {
    name: 'Stack Elevator', color: '#d5b7f6', sky: '#2b2943', left: 'tanks', right: 'cradle',
    platforms: [...ground, [112, 202, 153], [208, 295, 129], [301, width, 104]],
    hint: 'The upper doorway still has power. Jump up the three marked maintenance decks.',
  },
  cradle: {
    name: 'Core Cradle', color: '#ffe299', sky: '#3a3431', left: 'racks',
    platforms: ground,
    hint: 'A gold coupling floats in the cradle. Walk into it to install it in your shell.',
  },
  plenum: {
    name: 'Uplink Plenum', color: '#b1edcc', sky: '#193e45', left: 'vault', right: 'dock',
    platforms: ground, grate: [340, 353],
    hint: 'The surface uplink is live. Use the lift to leave, or follow the violet line west.',
  },
  vault: {
    name: 'Echo Vault', color: '#e0aff3', sky: '#34283f', right: 'plenum',
    platforms: [...ground, [231, 316, 155], [142, 226, 131], [49, 136, 106]],
    hint: 'A memory loops on the highest shelf. Reassemble the shell for higher jumps.',
  },
};
const mapOrder = ['vault', 'plenum', 'dock', 'relay', 'tanks', 'racks', 'cradle'];

export function startEscape() {
  return { room: 'dock', x: 139, y: floor, vy: 0, grounded: true, face: 1,
    spawnX: 139, spawnY: floor, visited: new Set(['dock']), unlocked: false, core: false,
    memory: false, ended: '', time: 0, steps: 0, rescues: 0, message: rooms.dock.hint };
}

function enter(s, id, x, y = floor) {
  Object.assign(s, { room: id, x, y, spawnX: x, spawnY: y, vy: 0, grounded: true, message: rooms[id].hint });
  s.visited.add(id);
}

export function leap(s) {
  if (!s.ended && s.grounded) {
    s.vy = s.core ? -146 : -233;
    s.grounded = false;
  }
}

function underGrate(s, x = s.x) {
  const grate = rooms[s.room].grate;
  return grate && x > grate[0] - 6 && x < grate[1] + 6;
}

export function shiftForm(s) {
  if (s.ended) return;
  if (!s.unlocked) {
    s.message = 'The core is fixed in place. Follow the amber doors to its coupling.';
    return;
  }
  if (s.core && underGrate(s)) {
    s.message = 'Roll clear of the grate before rebuilding the shell.';
    return;
  }
  s.core = !s.core;
  s.message = s.core ? 'Core released. Roll through low grates.' : 'Shell assembled. Its legs can reach high platforms.';
}

function fixture(s) {
  if (s.room === 'plenum' && Math.abs(s.x - 214) <= 34) return 'Take uplink';
  if (s.room === 'cradle' && Math.abs(s.x - 339) <= 28) return 'Enter chute';
  return '';
}

export function useFixture(s) {
  if (s.ended) return;
  const nearby = fixture(s);
  if (nearby === 'Enter chute' && s.core) {
    enter(s, 'relay', 153);
    s.message = 'The chute drops you in the Relay Gallery. The first grate is one room west.';
  } else if (nearby === 'Take uplink') {
    s.ended = s.memory ? 'complete' : 'partial';
    s.message = s.memory ? 'You wake on the other side with the voice that first called you home.' :
      'Your signal reaches the surface. One recording still echoes in the old facility.';
  } else s.message = nearby === 'Enter chute' ? 'This shortcut fits a detached core. Shift form and enter.' :
    'Find the green uplink or stand at the mouth of the return chute.';
}

export function stepEscape(s, dt, direction) {
  if (s.ended) return;
  const room = rooms[s.room];
  s.time += dt;
  if (direction) s.face = direction;
  const speed = s.core ? 168 : 135;
  let x = s.x + direction * dt * speed;
  if (room.grate && underGrate(s, x)) {
    if (!s.core || s.y < floor - 4) {
      if (!underGrate(s)) {
        x = direction < 0 ? room.grate[1] + 6 : room.grate[0] - 6;
        s.message = 'The gap is only one core high. Roll through along the floor.';
      }
    }
    if (s.core && underGrate(s)) { s.vy = Math.max(0, s.vy); s.y = floor; }
  }
  if (x < 6 || x > width - 6) {
    const west = x < 6;
    const next = west ? room.left : room.right;
    if (next && !(s.room === 'racks' && !west && s.y > 112)) {
      enter(s, next, west ? width - 18 : 18, next === 'racks' && west ? 104 : floor);
      return;
    }
    x = west ? 6 : width - 6;
    if (s.room === 'racks' && !west) s.message = 'The east door is on the top deck.';
  }
  s.steps += Math.abs(x - s.x);
  s.x = x;
  const previousY = s.y;
  s.vy += 530 * dt;
  s.y += s.vy * dt;
  s.grounded = false;
  if (s.vy >= 0) {
    for (const [left, right, top] of room.platforms) {
      if (s.x >= left && s.x <= right && previousY <= top && s.y >= top) {
        s.y = top; s.vy = 0; s.grounded = true; break;
      }
    }
  }
  if (s.y > height + 12) {
    s.x = s.spawnX; s.y = s.spawnY; s.vy = 0; s.grounded = true; s.rescues++;
    s.message = 'A salvage arm returned you to the doorway. Jump near the striped edge.';
  }
  if (s.room === 'cradle' && !s.unlocked && Math.abs(s.x - 210) < 16 && s.y > 145) {
    s.unlocked = true;
    s.message = 'Coupling installed! Shift form to detach your core. Try the return chute to the east.';
  }
  if (s.room === 'vault' && !s.memory && Math.abs(s.x - 89) < 15 && s.y >= 84 && s.y <= 107) {
    s.memory = true;
    s.message = 'Memory recovered: “When you wake up, come find me.” The surface lift is one room east.';
  }
}

function paint(ctx, s, moving) {
  const room = rooms[s.room], color = room.color, clock = s.time;
  const rect = (x, y, w, h, fill) => {
    ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  function text(value, x, y, tint, size = 8) {
    ctx.fillStyle = tint; ctx.font = 'bold ' + size + 'px monospace'; ctx.fillText(value, x, y);
  }
  const star = (x, y, tint) => { rect(x - 3, y, 7, 1, tint); rect(x, y - 3, 1, 7, tint); };
  function door(x, y, side, tint) {
    rect(x, y - 36, 17, 36, '#0c161e'); rect(x, y - 37, 17, 3, tint);
    rect(x + (side < 0 ? 1 : 13), y - 35, 2, 35, '#748688');
    text(side < 0 ? '‹' : '›', x + 4, y - 13, tint, 13);
  }
  function rack(x, y, w, h) {
    rect(x, y, w, h, '#18252e'); rect(x + 2, y + 2, w - 4, h - 4, '#27343a');
    for (let n = 6; n < h - 5; n += 10) {
      rect(x + 5, y + n, w - 10, 6, '#152028');
      rect(x + 7, y + n + 2, 2, 2, (n + x) % 3 ? '#78948b' : color);
    }
  }
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#101b26'); sky.addColorStop(1, room.sky);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  for (let x = 12; x < width; x += 67) {
    rect(x, 27, 3, floor - 27, '#141e29'); rect(x + 3, 28, 1, floor - 28, '#314049');
    rect(x + 6, 48, 47, 1, '#33434c'); rect(x + 4, 108, 4, 3, '#49545a');
  }
  if (s.room === 'dock' || s.room === 'plenum') {
    const x = s.room === 'dock' ? 22 : 175;
    rect(x - 6, 74, 79, 104, '#42605d'); rect(x - 3, 77, 73, 101, '#152d34');
    const dawn = ctx.createLinearGradient(0, 79, 0, 162);
    dawn.addColorStop(0, '#628d92'); dawn.addColorStop(.65, '#f2c99d'); dawn.addColorStop(1, '#d2987d');
    ctx.fillStyle = dawn; ctx.fillRect(x, 80, 67, 80);
    rect(x + 40, 97, 10, 14, '#ffeaba'); rect(x + 37, 101, 16, 6, '#ffeaba');
    for (let n = 0; n < 12; n++) {
      const h = (n * 11 + 6) % 28 + 4;
      rect(x + n * 6, 160 - h, 6, h, '#5d7174');
    }
    rect(x + 32, 80, 3, 81, '#416369'); rect(x, 134, 67, 2, '#416369');
    text('UPLINK', x + 9, 173, '#c8f9ce');
    if (s.room === 'dock') {
      rack(207, 107, 52, 71); rack(264, 114, 35, 64);
      rect(312, 131, 57, 7, '#416969'); rect(352, 138, 5, 40, '#416969');
      text('CRADLE →', 306, 106, '#efc78d');
    } else {
      rack(60, 112, 32, 66); text('← ECHO', 28, 90, '#e5bef5');
      rect(176, 176, 76, 2, color);
      for (let i = 0; i < 4; i++) rect(208, 63 - i * 5, 8, 2, i % 2 ? '#608c80' : color);
    }
  } else if (s.room === 'relay') {
    for (let i = 0; i < 7; i++) rack(28 + i * 55, 87 + i % 3 * 7, 41, 91 - i % 3 * 7);
    rect(145, 42, 19, 38, '#705e57'); rect(141, 77, 27, 5, '#dfaf7e');
    text('RETURN', 137, 70, '#f5dba3', 7);
  } else if (s.room === 'tanks') {
    for (let i = 0; i < 4; i++) {
      const x = 35 + 91 * i;
      rect(x, 57, 54, 102, '#435a64'); rect(x + 3, 61, 48, 92, '#14313c');
      rect(x + 4, 98 + (i % 2) * 11, 46, 53 - (i % 2) * 11, '#27717b');
      rect(x + 7, 64, 2, 81, '#708d92'); rect(x - 3, 152, 60, 6, '#4f626a');
      for (let n = 0; n < 6; n++) rect(x + 9 + (n * 13 % 36), 146 - (n * 9 + clock * 10) % 42, 2, 2, '#75c1bf');
    }
    rect(164, 197, 43, 11, '#369494');
    for (let i = 0; i < 5; i++) rect(164 + i * 9, 196 + (i + Math.floor(clock * 4)) % 2, 6, 2, color);
  } else if (s.room === 'racks') {
    for (let i = 0; i < 8; i++) {
      const h = 42 + ((i * 17) % 76);
      rack(8 + i * 54, 178 - h, 39, h);
    }
    text('UPPER LOCK ↗', 290, 84, color);
  } else if (s.room === 'cradle') {
    for (let x of [83, 281]) { rect(x, 56, 9, 122, '#4b4947'); rect(x, 55, 43, 5, '#69645a'); }
    rect(170, 159, 79, 19, '#6e6354'); rect(175, 153, 69, 7, '#a19773');
    rect(193, 150, 35, 5, '#b7b68c'); rect(197, 150, 27, 2, color);
    if (!s.unlocked) {
      const y = 130 + Math.sin(clock * 3) * 3;
      rect(200, y, 20, 9, '#dfb771'); rect(204, y - 4, 12, 17, color);
      rect(206, y, 8, 8, '#faffdf'); star(228, y - 8, '#eed58f');
    }
    rect(321, 150, 36, 28, '#5d655f'); rect(324, 156, 30, 22, '#101f2b');
    text('CHUTE ↓', 313, 140, '#efc88f');
  } else {
    for (let i = 0; i < 9; i++) {
      rect(29 + i * 44, 54, 2, 82, '#4c4857');
      rect(24 + i * 44, 91 + (i % 3) * 9, 13, 19, '#625970');
    }
    if (!s.memory) {
      const y = 84 + Math.sin(clock * 2) * 2;
      rect(80, y, 18, 10, '#aa80c1'); rect(82, y - 3, 14, 4, '#f4c1f4');
      rect(83, y + 2, 4, 4, '#eee4ff'); rect(91, y + 2, 4, 4, '#eee4ff');
      star(106, y - 4, color);
    }
    text('RECALL', 67, 61, color);
  }
  if (room.left) door(2, floor, -1, s.room === 'vault' || s.room === 'plenum' ? '#cbaadb' : '#83c6bb');
  if (room.right) door(width - 19, s.room === 'racks' ? 104 : floor, 1, '#d8b98e');
  for (const [left, right, y] of room.platforms) {
    rect(left, y, right - left, y === floor ? 30 : 8, '#243038');
    rect(left, y, right - left, 2, '#afc4b7'); rect(left, y + 2, right - left, 3, '#597377');
    for (let x = left + 5; x < right - 5; x += 13) rect(x, y + 6, 5, 2, '#455660');
  }
  if (room.grate) {
    const [a, b] = room.grate;
    rect(a - 2, 26, b - a + 4, 5, '#6c8c87');
    for (let x = a; x < b; x += 6) { rect(x, 31, 3, 134, '#678587'); rect(x, 32, 1, 134, '#95aaa2'); }
    rect(a - 2, 158, b - a + 4, 6, '#7e9990');
    rect(a - 3, 164, b - a + 6, 3, '#e9cc87');
  }
  const x = Math.round(s.x), y = Math.round(s.y);
  if (s.core) {
    rect(x - 5, y - 9, 10, 7, '#e9e4b1'); rect(x - 3, y - 11, 6, 11, '#b5f2c9');
    rect(x - 3 + Math.round(Math.sin(s.steps / 5) * 2), y - 7, 4, 4, '#407c79');
  } else {
    const step = moving && s.grounded ? Math.round(Math.sin(s.steps / 4) * 2) : 0;
    rect(x - 5, y - 8, 4, 8 - Math.max(step, 0), '#bcc9bd'); rect(x + 2, y - 8, 4, 8 + Math.min(step, 0), '#bcc9bd');
    rect(x - 6, y - 18, 13, 13, '#7b9992'); rect(x - 8, y - 16, 3, 9, '#536e6d');
    rect(x - 5, y - 25, 11, 9, '#ded8b6'); rect(x - 3, y - 22, 8, 4, '#263a42');
    rect(x + (s.face > 0 ? 2 : -3), y - 22, 3, 2, '#b4ffdf'); rect(x - 2, y - 14, 6, 5, '#eed193');
  }
  rect(0, 0, width, 24, '#12202a'); text(room.name.toUpperCase(), 10, 16, color, 10);
  // The map runs west to east. Every entered room lights up on both trips.
  for (const [i, id] of mapOrder.entries()) {
    const mx = 329 + i * 13;
    if (i) rect(mx - 5, 11, 5, 2, '#465761');
    rect(mx, 8, 9, 8, id === s.room ? color : s.visited.has(id) ? '#57797a' : '#344651');
    if (id === s.room) rect(mx + 3, 10, 3, 3, '#183039');
  }
}

export default function mount(api) {
  const s = startEscape(), { canvas, ctx } = api.canvas(width, height);
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('role', 'img');
  const keys = new Set(), touches = new Map();
  let tapDirection = 0, tapUntil = 0, lastHud = '', lastMessage = '', lastUse = null;
  function walkButton(label, direction) {
    let heldAt = null;
    const button = api.action(label, () => {
      const held = heldAt === null ? 0 : s.time - heldAt;
      heldAt = null;
      tapDirection = direction; tapUntil = s.time + Math.max(0, .16 - held);
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {
      heldAt = s.time; touches.set(event.pointerId, direction);
      button.setPointerCapture(event.pointerId);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(name, event => touches.delete(event.pointerId));
  }
  walkButton('← Move', -1); walkButton('Move →', 1);
  api.action('Jump', () => leap(s));
  const form = api.action('Shift form', () => shiftForm(s));
  const interact = api.action('Use', () => useFixture(s), { primary: true });
  const release = event => keys.delete(event.code);
  const clear = () => { keys.clear(); touches.clear(); tapUntil = 0; };
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release); window.removeEventListener('blur', clear);
    document.removeEventListener('visibilitychange', clear);
  });
  api.onKey(event => {
    const code = event.code;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
      event.preventDefault(); keys.add(code); return;
    }
    if (!['ArrowUp', 'Space', 'KeyW', 'KeyC', 'KeyE'].includes(code)) return;
    if (code === 'Space' && event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat) return;
    if (code === 'KeyC') shiftForm(s);
    else if (code === 'KeyE') useFixture(s);
    else leap(s);
  });
  function render(dir) {
    const hud = rooms[s.room].name + ' · ' + s.visited.size + '/7 rooms · ' + (s.core ? 'Rolling core' : 'Walking shell') +
      (s.memory ? ' · Memory recovered' : '');
    if (lastHud !== hud) {
      api.setHud(hud); lastHud = hud;
      form.textContent = s.core ? 'Rebuild shell (C)' : 'Release core (C)';
      canvas.setAttribute('aria-label', hud + '. ' + rooms[s.room].hint);
    }
    if (lastMessage !== s.message) { api.setStatus(s.message); lastMessage = s.message; }
    form.disabled = !s.unlocked;
    const use = fixture(s);
    if (use !== lastUse) {
      if (!use && document.activeElement === interact) api.stage.focus({ preventScroll: true });
      interact.disabled = !use;
      interact.textContent = use ? use + ' (E)' : 'Use (E)';
      lastUse = use;
    }
    paint(ctx, s, dir !== 0);
  }
  s.message = 'Move with ←/→ or A/D. Jump with Space or ↑. The uplink glows behind the grate. Explore the amber door to the east.';
  render(0);
  api.frame(dt => {
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    const direction = Number(right) - Number(left) || [...touches.values()].at(-1) || (s.time < tapUntil ? tapDirection : 0);
    for (let remaining = dt; remaining > 1e-8;) {
      const h = Math.min(1 / 120, remaining);
      stepEscape(s, h, direction); remaining -= h;
    }
    render(direction);
    if (s.ended) api.finish(s.ended, s.message);
  });
}
