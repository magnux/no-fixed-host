const width = 344;
const height = 168;
const floor = 138;
const end = 640;
const walkSpeed = 104;
const bossGate = 428;
const stages = {
  foundry: {
    name: 'Foundry', boss: 'Kiln Walker', reward: 'Heat shield',
    sky: '#271c34', horizon: '#723d49', metal: '#92565b', light: '#ffc680', hot: '#ff704c',
    decks: [[0, 108, floor], [139, 199, 125], [209, 258, 129], [286, 366, floor], [384, end, floor]],
    vent: 318, fragile: 2,
  },
  turbine: {
    name: 'Turbine', boss: 'Spindle', reward: 'Air dash',
    sky: '#122940', horizon: '#275768', metal: '#47727e', light: '#8ae9e1', hot: '#ff8bac',
    decks: [[0, 95, floor], [118, 193, 123], [223, 309, floor], [330, 379, 128], [397, end, floor]],
    vent: 258, fragile: -1,
  },
};

export function newChassis() {
  return { phase: 'choose', cleared: [], stage: null, time: 0, message: 'Choose a plant. The first boss supplies a module for the second plant.' };
}

export function enterPlant(game, id) {
  if (!Object.hasOwn(stages, id) || !['choose', 'swap'].includes(game.phase) || game.cleared.includes(id)) return;
  Object.assign(game, {
    phase: 'run', stage: id, x: 24, y: floor, vy: 0, face: 1, deck: 0, hp: 4,
    elapsed: 0, dash: 0, usedDash: false, cooldown: 0, invulnerable: 0, collapse: 0,
    bullets: [], embers: [], checkpoint: false, bossHp: 8, bossFlash: 0, bossClock: 0, nextShot: 1.4, wave: 0,
    message: id === 'foundry'
      ? 'Jump the shafts. The striped grating drops under load. Reach the kiln and fire at its eye.'
      : 'Jump the gaps. The vent glows before it fires. Past the gate, jump to hit the spinning hub.',
  });
}

export function jumpChassis(game) {
  if (game.phase !== 'run' || game.deck === null) return;
  game.deck = null;
  game.vy = -229;
  game.usedDash = false;
}

export function airDash(game) {
  if (game.phase !== 'run' || !game.cleared.includes('turbine') || game.deck !== null || game.usedDash) return;
  game.dash = .21;
  game.usedDash = true;
  game.vy = 0;
}

export function fireChassis(game) {
  if (game.phase !== 'run' || game.cooldown > 0) return;
  game.cooldown = .24;
  game.bullets.push({ x: game.x + 9 * game.face, y: game.y - 10, vx: 245 * game.face, life: .65 });
}

function damage(game, reason) {
  game.hp--;
  game.invulnerable = 1.2;
  game.message = reason;
  if (!game.hp) game.phase = game.cleared.length ? 'partial' : 'failed';
}

function bossPosition(game) {
  const t = game.bossClock;
  if (game.stage === 'foundry') return { x: 580 + Math.sin(t * 1.7) * 16, y: floor - 16 };
  return { x: 574 + Math.sin(t * 1.45) * 19, y: floor - 30 - 17 * Math.sin(t * 1.9) };
}

function updateBoss(game, dt) {
  const plant = stages[game.stage];
  game.bossClock += dt;
  game.bossFlash = Math.max(0, game.bossFlash - dt);
  const boss = bossPosition(game);
  if (game.bossClock >= game.nextShot) {
    const high = game.wave % 3 === 2;
    if (game.stage === 'foundry') {
      game.embers.push({ x: boss.x - 13, y: high ? floor - 35 : floor - 9, vx: high ? -111 : -85, vy: 0 });
      game.nextShot += game.wave % 3 === 0 ? .55 : 1.65;
    } else {
      // The turbine tracks the chassis once, at release. Changing height evades its line.
      const dx = Math.max(30, boss.x - game.x);
      const vy = Math.max(-42, Math.min(42, (game.y - 10 - boss.y) * 92 / dx));
      game.embers.push({ x: boss.x - 13, y: boss.y, vx: -92, vy });
      game.nextShot += 1.5;
    }
    game.wave++;
  }
  for (const shot of game.bullets) {
    if (Math.abs(shot.x - boss.x) < 14 && Math.abs(shot.y - boss.y) < 12) {
      shot.life = 0;
      game.bossHp--;
      game.bossFlash = .10;
    }
  }
  for (const ember of game.embers) {
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    if (ember.reflected && Math.abs(ember.x - boss.x) < 15 && Math.abs(ember.y - boss.y) < 18) {
      ember.spent = true;
      game.bossHp--;
      game.bossFlash = .10;
    } else if (!ember.reflected && Math.abs(ember.x - game.x) < 9 && Math.abs(ember.y - (game.y - 10)) < 10) {
      if (game.cleared.includes('foundry') && game.stage === 'turbine') {
        ember.reflected = true;
        ember.vx = 156;
        ember.vy *= -1;
        game.message = 'Heat shield reflected a hot bolt.';
      } else {
        ember.spent = true;
        if (game.invulnerable <= 0 && game.dash <= 0) damage(game, 'Hull hit. Jump low volleys and let high shots pass overhead.');
      }
    }
  }
  game.embers = game.embers.filter(ember => !ember.spent && ember.x > bossGate - 25 && ember.x < end);
  if (game.phase === 'run' && Math.abs(game.x - boss.x) < 18 && Math.abs(game.y - 10 - boss.y) < 22 && game.invulnerable <= 0 && game.dash <= 0) {
    damage(game, 'Chassis struck the boss housing. Keep a little firing distance.');
  }
  if (game.bossHp <= 0 && game.phase === 'run') {
    game.cleared.push(game.stage);
    game.phase = game.cleared.length === 2 ? 'complete' : 'swap';
    game.message = plant.boss + ' released the ' + plant.reward.toLowerCase() + '.';
  }
}

function ventLevel(game) {
  return game.elapsed % 2.8;
}

export function tickChassis(game, dt, direction, firing) {
  game.time += dt;
  if (game.phase !== 'run') return;
  const plant = stages[game.stage];
  game.elapsed += dt;
  game.cooldown = Math.max(0, game.cooldown - dt);
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  if (game.dash <= 0 && direction) game.face = direction;
  const previousY = game.y;
  const dash = game.dash > 0;
  game.x = Math.max(game.checkpoint ? bossGate - 9 : 5, Math.min(end - 8,
    game.x + dt * (dash ? game.face * 232 : direction * walkSpeed)));
  if (game.deck === plant.fragile && plant.fragile >= 0) game.collapse = Math.min(1, game.collapse + dt);
  function supports(index) {
    const [left, right] = plant.decks[index];
    return game.x >= left - 2 && game.x <= right + 2 && (index !== plant.fragile || game.collapse < .70);
  }
  if (game.deck !== null && !supports(game.deck)) game.deck = null;
  if (game.deck === null) {
    if (!dash) game.vy += 525 * dt;
    game.y += game.vy * dt;
    if (game.vy >= 0) {
      const landing = plant.decks.findIndex(([, , y], i) => supports(i) && previousY <= y && game.y >= y);
      if (landing >= 0) {
        game.deck = landing;
        game.y = plant.decks[landing][2];
        game.vy = 0;
        game.usedDash = false;
      }
    }
  }
  game.dash = Math.max(0, game.dash - dt);
  if (game.y > height + 15) {
    damage(game, 'Chassis dropped into the service shaft. The grating has reset.');
    game.x = 24; game.y = floor; game.deck = 0; game.vy = game.dash = game.collapse = 0;
    return;
  }
  if (ventLevel(game) >= 1.85 && Math.abs(game.x - plant.vent) < 10 && game.y > floor - 25 &&
      !game.cleared.includes('foundry') && !dash && game.invulnerable <= 0) {
    damage(game, 'Vent burst. Jump across when the exhaust goes dark.');
  }
  if (game.phase !== 'run') return;
  if (firing) fireChassis(game);
  for (const shot of game.bullets) { shot.x += shot.vx * dt; shot.life -= dt; }
  game.bullets = game.bullets.filter(shot => shot.life > 0);
  if (!game.checkpoint && game.x >= bossGate) {
    game.checkpoint = true;
    game.message = plant.boss + ' engaged. Flashing muzzle signals a volley.';
  }
  if (game.checkpoint) updateBoss(game, dt);
  game.bullets = game.bullets.filter(shot => shot.life > 0);
}

const sprites = {
  pilot: [
    '    aa    ', '   aaaa   ', '  bbbbb   ', '  bcccb   ', '  abbaa d ',
    ' aaaaaaad ', ' abbbdddd ', '  aaaaa   ', '  bb bb   ', ' ddd ddd  ',
  ],
  foundry: [
    '  aa    aa    ', '  ab aa ab    ', ' aaaaaaaaaaa  ', ' abbbaabbbaba ', ' abdddddddbba ',
    ' abbdcccdbbba ', ' abbbdddbbbba ', 'aabbaabbaabbaa', 'abbaabbbbaabba', ' abaaaaaaaaaa ',
    '  aaabbbbaaa  ', '  abba  abba  ', ' bbbba  abbbb ',
  ],
  turbine: [
    '     aaaa     ', '    abbbba    ', '   abcccbba   ', ' aaabcccbbaaa ', 'abbbbaaaabbbba',
    'accbbaddabbcca', 'accbaddddabcca', 'abbbaddddabbba', ' aaabaddabaaa ', '   abbaabba   ',
    '   abcccbba   ', '    abbbba    ', '     aaaa     ',
  ],
};
function sprite(ctx, id, x, y, size, colors, facing = 1) {
  const rows = sprites[id];
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(facing, 1);
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ink = colors[row[i]];
      if (ink) { ctx.fillStyle = ink; ctx.fillRect((i - Math.floor(rows[0].length / 2)) * size, (j - Math.floor(rows.length / 2)) * size, size, size); }
    }
  });
  ctx.restore();
}
const bossInk = p => ({ a: '#182334', b: p.metal, c: p.light, d: p.hot });
function label(ctx, text, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.fillText(text, x, y);
}
function selectScreen(ctx, game) {
  ctx.fillStyle = '#11202f'; ctx.fillRect(0, 0, width, height);
  for (const [i, [id, plant]] of Object.entries(stages).entries()) {
    const left = 6 + i * 168;
    const x = left + 82;
    const complete = game.cleared.includes(id);
    ctx.fillStyle = plant.horizon; ctx.fillRect(left, 7, 163, 151);
    ctx.fillStyle = plant.sky; ctx.fillRect(left + 2, 9, 159, 147);
    ctx.fillStyle = plant.horizon;
    for (let y = 35; y < 111; y += 8) ctx.fillRect(left + 7, y, 149, 1);
    ctx.strokeStyle = plant.metal; ctx.beginPath(); ctx.arc(x, 76, 34, 0, 2*Math.PI); ctx.stroke();
    sprite(ctx, id, x, 75 + Math.round(Math.sin(game.time * 2 + i) * 2), 4, bossInk(plant));
    ctx.textAlign = 'center';
    label(ctx, plant.boss.toUpperCase(), x, 26, 12, '#ffeed3');
    label(ctx, complete ? 'MODULE INSTALLED' : plant.name.toUpperCase(), x, 128, 13, plant.light);
    label(ctx, plant.reward.toUpperCase(), x, 145, 9, '#e9e1cf');
    ctx.textAlign = 'start';
  }
}

function draw(ctx, game) {
  if (!game.stage || game.phase === 'swap') { selectScreen(ctx, game); return; }
  const plant = stages[game.stage];
  const camera = Math.max(0, Math.min(end - width, Math.floor(game.x - width * .38)));
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  rect(0, 0, width, height, plant.sky);
  rect(0, 71, width, 97, plant.horizon);
  for (let i = -1; i < 11; i++) {
    const x = i * 45 - (camera * .32 % 45);
    const top = 31 + (i % 3) * 5;
    if (game.stage === 'foundry') {
      rect(x, top, 16, 106, '#3c3042'); rect(x - 2, top, 20, 4, plant.metal);
      rect(x + 4, top + 6, 3, 58, '#684251'); rect(x - 10, 91, 42, 25, '#443749');
      for (let y = 96; y < 116; y += 7) rect(x - 4, y, 6, 3, '#f0a775');
    } else {
      ctx.save(); ctx.translate(Math.round(x + 8), top + 16);
      ctx.fillStyle = '#254754'; ctx.fillRect(-2, 0, 4, 103);
      ctx.rotate(game.elapsed * .75 + i);
      for (let vane = 0; vane < 4; vane++) { ctx.fillRect(2, -3, 16, 4); ctx.rotate(Math.PI / 2); }
      ctx.restore();
    }
  }
  for (let x = 1; x < width; x += 18) rect(x, 5, 7, 2, plant.metal);
  ctx.save(); ctx.translate(-camera, 0);
  plant.decks.forEach(([left, right, y], i) => {
    if (i === plant.fragile && game.collapse >= .7) return;
    rect(left, y, right - left, 4, plant.light);
    rect(left, y + 4, right - left, height - y, '#192938');
    for (let x = left + 3; x < right - 3; x += 11) {
      rect(x, y + 5, 6, 2, plant.metal);
      rect(x + 2, y + 7, 2, 6, '#334557');
      if (i === plant.fragile) rect(x, y, 4, game.collapse > .25 ? 7 : 3, '#211d31');
    }
  });
  const level = ventLevel(game);
  for (let i = -1; i <= 1; i++) {
    const x = plant.vent + i * 4;
    rect(x, floor - 2, 3, 3, '#232836');
    if (level > 1.85) {
      const h = 18 + Math.floor((Math.sin(game.elapsed * 22 + i) + 1) * 4);
      rect(x, floor - h, 3, h - 1, plant.hot); rect(x + 1, floor - h + 8, 1, h - 7, '#fff2c8');
    } else if (level > 1.20) rect(x, floor - 6, 2, 3, '#fff2c8');
  }
  rect(bossGate, floor - 59, 3, 59, plant.metal);
  rect(bossGate - 2, floor - 61, 8, 4, plant.light);
  const boss = bossPosition(game);
  const armor = bossInk(plant);
  if (game.bossFlash > 0) armor.b = armor.d = '#fffbe1';
  sprite(ctx, game.stage, boss.x, boss.y, 2, armor);
  if (game.checkpoint && game.nextShot - game.bossClock < .40) {
    rect(boss.x - 20, boss.y - 2, 5, 3, '#fffaca');
  }
  if (game.invulnerable <= 0 || Math.floor(game.time * 13) % 2 === 0) {
    if (game.dash > 0) rect(game.x - game.face * 20, game.y - 10, 14, 3, '#96e8f1');
    sprite(ctx, 'pilot', game.x, game.y - 10, 2, { a: '#d9e2c3', b: '#2d6772', c: '#a3f6ea', d: '#ffc47b' }, game.face);
    if (game.cleared.includes('foundry')) rect(game.x + game.face * 11, game.y - 17, 2, 13, '#ffce86');
  }
  for (const shot of game.bullets) rect(shot.x - 4, shot.y - 1, 8, 3, '#ccfff0');
  for (const ember of game.embers) {
    rect(ember.x - 4, ember.y - 3, 8, 6, ember.reflected ? '#72efe2' : plant.hot);
    rect(ember.x - 1, ember.y - 1, 3, 2, '#fff3b6');
  }
  ctx.restore();
  const title = game.checkpoint ? plant.boss.toUpperCase() : plant.name.toUpperCase();
  rect(6, 11, title.length * 6 + 12, 16, '#142130');
  label(ctx, title, 11, 22, 10, plant.light);
  if (game.checkpoint) {
    for (let i = 0; i < 8; i++) rect(width - 68 + 7*i, 14, 5, 8, i < game.bossHp ? plant.hot : '#342e3b');
  }
}

export default function mount(api) {
  const game = newChassis();
  const { canvas, ctx } = api.canvas(width, height);
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('aria-label', 'Two repair stages. Choose a plant, move across its suspended floors and defeat the boss.');
  const keys = new Set(), pointers = new Map();
  let stride = 0, strideUntil = 0;
  function clearInput() { keys.clear(); pointers.clear(); stride = 0; }
  function swap(id) {
    clearInput();
    enterPlant(game, id);
    menu();
    api.stage.focus({ preventScroll: true });
  }
  function jump() {
    const deck = game.deck;
    jumpChassis(game);
    if (deck !== null && game.deck === null) api.sfx?.('jump');
  }
  function fire() {
    const cooldown = game.cooldown;
    fireChassis(game);
    if (game.cooldown > cooldown) api.sfx?.('pulse');
  }
  function dash() {
    const previous = game.dash;
    airDash(game);
    if (game.dash > previous) api.sfx?.('dash');
  }
  function heldButton(label, input, tap) {
    let downAt;
    const button = api.action(label, event => {
      if (event.detail === 0 || downAt === undefined || game.time - downAt < .18) tap();
      downAt = undefined;
    });
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {
      button.setPointerCapture(event.pointerId);
      downAt = game.time;
      pointers.set(event.pointerId, input);
    });
    for (const type of ['pointerup', 'pointercancel','lostpointercapture']) {
      button.addEventListener(type, event => pointers.delete(event.pointerId));
    }
  }
  function menu() {
    api.controls.replaceChildren();
    if (game.phase === 'choose' || game.phase === 'swap') {
      for (const [id, plant] of Object.entries(stages)) {
        if (!game.cleared.includes(id)) api.action('Enter ' + plant.name, () => swap(id), { primary: true });
      }
    } else if (game.phase === 'run') {
      for (const direction of [-1, 1]) {
        heldButton(direction < 0 ? '← Left' : 'Right →', direction, () => {
          stride = direction; strideUntil = game.time + .15;
        });
      }
      api.action('Jump', jump);
      heldButton('Fire', 'fire', fire);
      if (game.cleared.includes('turbine')) api.action('Air dash', dash, { primary: true });
    }
    show();
  }
  function show() {
    api.setHud(game.phase === 'choose' ? 'Select first plant · 0 / 2 cores' :
      game.phase === 'swap' ? 'One core recovered · ' + stages[game.cleared[0]].reward + ' fitted · Hull repaired for next stage' :
      stages[game.stage].name + ' · Hull ' + game.hp + '/4 · ' +
        (game.checkpoint ? stages[game.stage].boss + ' ' + Math.max(0, game.bossHp) + '/8' : 'Reach the boss gate') +
        (game.cleared.length ? ' · ' + stages[game.cleared[0]].reward : ''));
    const keys = game.phase === 'run' ? '  ←/→ move · Z jump · X fire' + (game.cleared.includes('turbine') ? ' · C dash' : '') : '';
    api.setStatus(game.message + keys);
    draw(ctx, game);
  }
  api.onKey(event => {
    const { code } = event;
    if (game.phase !== 'run') {
      if ((code === 'Digit1' || code === 'Digit2') && !event.repeat) {
        event.preventDefault();
        const id = code === 'Digit1' ? 'foundry' : 'turbine';
        if (!game.cleared.includes(id)) swap(id);
      }
      return;
    }
    if (!['ArrowLeft','ArrowRight','KeyA','KeyD','KeyZ','Space','ArrowUp','KeyX','KeyC'].includes(code)) return;
    // Preserve ordinary keyboard activation when the player has tabbed to a control.
    if (code === 'Space' && event.target.tagName === 'BUTTON') return;
    event.preventDefault(); keys.add(code);
    if (!event.repeat) {
      if (['KeyZ','Space','ArrowUp'].includes(code)) jump();
      if (code === 'KeyX') fire();
      if (code === 'KeyC') dash();
    }
  });
  const release = e => keys.delete(e.code);
  window.addEventListener('keyup', release);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);
  api.onCleanup(() => {
    window.removeEventListener('keyup', release); window.removeEventListener('blur', clearInput);
    document.removeEventListener('visibilitychange', clearInput);
    clearInput();
  });
  game.message += ' Move with ←/→ or A/D. Jump with Z, fire with X and air dash with C when equipped.';
  menu();
  api.frame(dt => {
    const inputs = [...pointers.values()];
    const dir = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')) ||
      inputs.filter(v => typeof v === 'number').at(-1) || (game.time < strideUntil ? stride : 0);
    const prior = game.phase;
    const hull = game.hp;
    const cooldown = game.cooldown;
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      tickChassis(game, Math.min(remaining, 1 / 120), dir, keys.has('KeyX') || inputs.includes('fire'));
    }
    if (game.phase === 'run' && game.hp < hull) api.sfx?.('damage');
    else if (game.phase === 'run' && game.cooldown > cooldown) api.sfx?.('pulse');
    if (prior !== game.phase) {
      if (game.phase === 'swap') api.sfx?.('module');
      clearInput(); menu();
      if (game.phase === 'swap') api.controls.querySelector('button')?.focus();
    } else show();
    if (game.phase === 'complete') api.finish('complete', 'Both cores recovered. Your chassis carries the heat shield and air dash.');
    if (game.phase === 'partial') api.finish('partial', 'One core recovered before your chassis went offline.');
    if (game.phase === 'failed') api.finish('failed', 'Your chassis went offline in the first plant.');
  });
}
