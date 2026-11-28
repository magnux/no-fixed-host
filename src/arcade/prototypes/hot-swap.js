const width = 344;
const height = 168;
const floor = 138;
const end = 640;
const walkSpeed = 104;
const bossGate = 428;
// A stage can be played as a single job. Modules carry over only if the player keeps going.
export const plants = {
  foundry: {
    name: 'Foundry', boss: 'Kiln Walker', reward: 'Long parry', light: '#ffc680', hot: '#ff704c',
    sky: '#271c34', horizon: '#723d49', metal: '#92565b',
    decks: [[0, 95, floor], [116, 181, 126], [208, 260, 126], [371, end, floor]],
    vents: [69, 403], fragile: 2, crawler: 145, drone: 237, shotDelay: 1.6,
  },
  turbine: {
    name: 'Turbine', boss: 'Spindle', reward: 'Boost nozzle', light: '#8ae9e1', hot: '#ff8bac',
    sky: '#122940', horizon: '#275768', metal: '#47727e',
    decks: [[0, 102, floor], [128, 194, 128], [306, 357, 124], [379, end, floor]],
    vents: [158, 401], fragile: -1, crawler: 70, drone: 317, shotDelay: 1.7,
  },
  condenser: {
    name: 'Condenser', boss: 'Ice Mantis', reward: 'Hull plating', light: '#a9efff', hot: '#a89fff',
    sky: '#1c2540', horizon: '#3d486a', metal: '#678ca4',
    decks: [[0, 93, floor], [112, 182, 119], [291, 346, 127], [370, end, floor]],
    vents: [62, 319], fragile: 1, crawler: 141, drone: 309, shotDelay: 1.9,
  },
  uplink: {
    name: 'Uplink', boss: 'Beacon Kite', reward: 'Rapid barrel', light: '#def896', hot: '#ff88bb',
    sky: '#20263a', horizon: '#45566a', metal: '#70998b',
    decks: [[0, 107, floor], [218, 286, 127], [314, 358, 118], [393, end, floor]],
    vents: [250, 401], fragile: 2, crawler: 78, drone: 248, shotDelay: 1.45,
  },
};

export function newChassis() {
  return { phase: 'choose', cleared: [], stage: null, time: 0,
    message: 'Choose any plant. Recover its core to extract, or keep the module for another job.' };
}

export function enterPlant(game, id) {
  if (!Object.hasOwn(plants, id) || !['choose', 'swap'].includes(game.phase) || game.cleared.includes(id)) return;
  const plant = plants[id];
  const maxHp = game.cleared.includes('condenser') ? 6 : 5;
  Object.assign(game, {
    phase: 'run', stage: id, x: 24, y: floor, vy: 0, face: 1, deck: 0, hp: maxHp, maxHp,
    elapsed: 0, dash: 0, usedDash: false, cooldown: 0, invulnerable: 0, collapse: 0,
    shield: 0, shieldCooldown: 0, effects: [], stride: 0, moving: false, reflections: 0,
    bullets: [], embers: [], checkpoint: false, bossHp: 8, bossFlash: 0, bossClock: 0, nextShot: 1.3, wave: 0,
    enemies: [
      { type: 'crawler', origin: plant.crawler, x: plant.crawler, y: floor - 7, hp: 2, flash: 0 },
      { type: 'sentry', origin: plant.drone, x: plant.drone, y: floor - 62, hp: 3, flash: 0, charge: 1.7 },
    ],
    message: 'Jump, then dash across striped shafts. The sentry flashes before its heavy shot. Shield just before impact.',
  });
}

export function extractCore(game) {
  if (game.phase === 'swap') game.phase = 'complete';
}

export function jumpChassis(game) {
  if (game.phase !== 'run' || game.deck === null) return;
  game.deck = null;
  game.vy = -229;
  game.usedDash = false;
}

export function airDash(game) {
  if (game.phase !== 'run' || game.deck !== null || game.usedDash || game.shield > 0) return;
  game.dash = game.cleared.includes('turbine') ? .28 : .24;
  game.usedDash = true;
  game.vy = 0;
}

export function shieldChassis(game) {
  if (game.phase !== 'run' || game.shieldCooldown > 0 || game.dash > 0) return;
  game.shield = game.cleared.includes('foundry') ? .60 : .40;
  game.shieldCooldown = 2.25;
}

export function fireChassis(game) {
  if (game.phase !== 'run' || game.cooldown > 0 || game.shield > 0) return;
  game.cooldown = game.cleared.includes('uplink') ? .16 : .24;
  game.bullets.push({ x: game.x + 9 * game.face, y: game.y - 10, vx: 245 * game.face, life: .75 });
}

function spark(game, x, y, color) {
  game.effects.push({ x, y, color, life: .27 });
}

function damage(game, reason, amount = 1) {
  game.hp = Math.max(0, game.hp - amount);
  game.invulnerable = 1.2;
  game.message = reason;
  spark(game, game.x, game.y - 10, '#ffa381');
  if (!game.hp) game.phase = game.cleared.length ? 'partial' : 'failed';
}

function bossPosition(game) {
  const t = game.bossClock;
  switch (game.stage) {
    case 'foundry': return { x: 580 + Math.sin(t * 1.7) * 16, y: floor - 15 + Math.cos(t * 5) * 2 };
    case 'turbine': return { x: 574 + Math.sin(t * 1.45) * 19, y: floor - 29 - 16 * Math.sin(t * 1.9) };
    case 'condenser': return { x: 578 + Math.sin(t * 2) * 20, y: floor - 15 - Math.max(0, Math.sin(t * 2)) * 18 };
    default: return { x: 570 + Math.cos(t * 2.3) * 21, y: floor - 30 + Math.sin(t * 2.4) * 19 };
  }
}

function launch(game, x, y, speed, source, targetY, heavy = false) {
  const dx = game.x - x, dy = targetY - y, distance = Math.hypot(dx, dy) || 1;
  game.embers.push({ x, y, vx: dx / distance * speed, vy: dy / distance * speed, source, heavy });
}

function updateEnemies(game, plant, dt) {
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.type === 'crawler') {
      enemy.x = enemy.origin + 19 * Math.sin(game.elapsed * 2.3);
      const deck = plant.decks.find(([left, right]) => enemy.x >= left && enemy.x <= right);
      enemy.y = (deck?.[2] ?? floor) - 7;
    } else {
      enemy.x = enemy.origin + Math.sin(game.elapsed * 1.2) * 20;
      enemy.y = 72 + Math.sin(game.elapsed * 2) * 8;
      if (Math.abs(game.x - enemy.x) < 135 && !game.checkpoint) {
        enemy.charge -= dt;
        if (enemy.charge <= 0) {
          launch(game, enemy.x, enemy.y, 214, enemy, game.y - 10, true);
          enemy.charge = 2.4;
        }
      } else enemy.charge = 1.4;
    }
    if (Math.abs(game.x - enemy.x) < 12 && Math.abs(game.y - 9 - enemy.y) < 12 &&
        game.invulnerable <= 0 && game.dash <= 0) damage(game, 'Chassis clipped a patrol. Fire at beetles or jump over them.');
  }
}

function bossAttack(game, plant, dt) {
  game.bossClock += dt;
  game.bossFlash = Math.max(0, game.bossFlash - dt);
  if (game.bossClock < game.nextShot) return;
  const boss = bossPosition(game);
  if (game.stage === 'foundry') {
    game.embers.push({ x: boss.x - 13, y: game.wave % 3 === 2 ? floor - 35 : floor - 9, vx: -97, vy: 0, source: 'boss' });
  } else {
    const heavy = game.stage === 'uplink' || game.wave % 3 === 1;
    launch(game, boss.x - 11, boss.y, heavy ? 194 : 114, 'boss', game.y - 10, heavy);
    if (game.stage === 'condenser') launch(game, boss.x - 11, boss.y, 96, 'boss', game.y - 32);
  }
  game.nextShot += plant.shotDelay;
  game.wave++;
}

function hitTarget(game, shot, damage) {
  const at = (target, w, h) => Math.abs(shot.x - target.x) <= w && Math.abs(shot.y - target.y) <= h;
  if (game.checkpoint && at(bossPosition(game), 15, 14)) {
    game.bossHp -= damage; game.bossFlash = .12;
    spark(game, shot.x, shot.y, '#ffe599'); return true;
  }
  const enemy = game.enemies.find(mob => mob.hp > 0 && at(mob, 10, mob.type === 'sentry' ? 9 : 7));
  if (!enemy) return false;
  enemy.hp -= damage; enemy.flash = .12;
  spark(game, shot.x, shot.y, enemy.hp > 0 ? '#e4ffe6' : '#ffb97b'); return true;
}

function updateFire(game, dt) {
  for (const shot of game.bullets) {
    shot.x += shot.vx * dt; shot.life -= dt;
    if (hitTarget(game, shot, 1)) shot.life = 0;
  }
  game.bullets = game.bullets.filter(shot => shot.life > 0);
  for (const bolt of game.embers) {
    bolt.x += bolt.vx * dt; bolt.y += bolt.vy * dt;
    if (bolt.reflected) { bolt.spent = hitTarget(game, bolt, bolt.heavy ? 3 : 2); continue; }
    if (Math.abs(bolt.x - game.x) > 11 || Math.abs(bolt.y - (game.y - 10)) > 12) continue;
    if (game.shield > 0) {
      const target = bolt.source === 'boss' ? bossPosition(game) : bolt.source;
      const dx = target.x - bolt.x, dy = target.y - bolt.y, distance = Math.hypot(dx, dy) || 1;
      bolt.vx = dx / distance * 275; bolt.vy = dy / distance * 275;
      bolt.reflected = true; game.reflections++;
      spark(game, bolt.x, bolt.y, '#9cffff');
      game.message = 'Parry! Bolt returned to sender.';
    } else {
      bolt.spent = true;
      if (game.dash <= 0 && game.invulnerable <= 0)
        damage(game, bolt.heavy ? 'Heavy bolt! A timed shield reflects it for triple damage.' : 'Hull hit. Jump low volleys or parry the shot.', bolt.heavy ? 2 : 1);
    }
  }
  game.embers = game.embers.filter(bolt => !bolt.spent && bolt.x > 0 && bolt.x < end && bolt.y > -12 && bolt.y < height);
}

function ventLevel(game, i) {
  return (game.elapsed + i * .9) % 3;
}

export function tickChassis(game, dt, direction, firing) {
  game.time += dt;
  if (game.phase !== 'run') return;
  const plant = plants[game.stage];
  game.elapsed += dt;
  for (const timer of ['cooldown', 'invulnerable', 'shield', 'shieldCooldown']) game[timer] = Math.max(0, game[timer] - dt);
  for (const fx of game.effects) fx.life -= dt;
  game.effects = game.effects.filter(fx => fx.life > 0);
  if (game.dash <= 0 && direction) game.face = direction;
  const previousY = game.y, dash = game.dash > 0;
  game.moving = direction !== 0;
  game.stride += Math.abs(direction) * dt * 13;
  game.x = Math.max(game.checkpoint ? bossGate - 9 : 5, Math.min(end - 8,
    game.x + dt * (dash ? game.face * 286 : direction * walkSpeed)));
  if (game.deck === plant.fragile) game.collapse += dt;
  function supports(index) {
    const [left, right] = plant.decks[index];
    return game.x >= left - 2 && game.x <= right + 2 && (index !== plant.fragile || game.collapse < .72);
  }
  if (game.deck !== null && !supports(game.deck)) game.deck = null;
  if (game.deck === null) {
    if (!dash) game.vy += 525 * dt;
    game.y += game.vy * dt;
    if (game.vy >= 0) {
      const landing = plant.decks.findIndex(([, , y], i) => supports(i) && previousY <= y && game.y >= y);
      if (landing >= 0) { game.deck = landing; game.y = plant.decks[landing][2]; game.vy = 0; game.usedDash = false; }
    }
  }
  game.dash = Math.max(0, game.dash - dt);
  if (game.y > height + 15) {
    damage(game, 'Service shaft! Jump at the stripe, then dash near the top of your arc.');
    game.x = 24; game.y = floor; game.deck = 0; game.vy = game.dash = game.collapse = 0;
    game.embers.length = 0; return;
  }
  for (const [i, x] of plant.vents.entries()) {
    const top = plant.decks.find(([a, b]) => a <= x && x <= b)[2];
    if (ventLevel(game, i) > 2.25 && Math.abs(game.x - x) < 8 && game.y > top - 23 && !dash && game.invulnerable <= 0)
      damage(game, 'Vent burst. The amber warning gives you time to jump.');
  }
  if (game.phase !== 'run') return;
  if (firing) fireChassis(game);
  if (!game.checkpoint && game.x >= bossGate) {
    game.checkpoint = true; game.message = plant.boss + ' engaged. Its muzzle flashes before every volley.';
  }
  updateEnemies(game, plant, dt);
  if (game.checkpoint && game.phase === 'run') {
    bossAttack(game, plant, dt);
    const boss = bossPosition(game);
    if (Math.abs(game.x - boss.x) < 17 && Math.abs(game.y - 10 - boss.y) < 19 && game.invulnerable <= 0 && !dash)
      damage(game, 'Keep clear of the boss housing. Fire or return its volleys.');
  }
  updateFire(game, dt);
  if (game.bossHp <= 0 && game.phase === 'run') {
    game.cleared.push(game.stage);
    game.phase = game.cleared.length === Object.keys(plants).length ? 'complete' : 'swap';
    game.message = plant.boss + ' released the ' + plant.reward.toLowerCase() + '. Extract or choose another plant.';
  }
}

const sprites = {
  foundry: [
    '  aa    aa    ', '  ab aa ab    ', ' aaaaaaaaaaa  ', ' abbbaabbbaba ', ' abdddddddbba ',
    ' abbdcccdbbba ', ' abbbdddbbbba ', 'aabbaabbaabbaa', 'abbaabbbbaabba', ' abaaaaaaaaaa ',
    '  aaabbbbaaa  ', '  abba  abba  ', ' bbbba  abbbb ',
  ],
  condenser: [
    '  d       d   ', '  db a a bd   ', '  dbbbbbbd    ', '    abbbba    ', '   abcccbba   ',
    '  abcccccbba  ', ' abbbdddbbbba ', ' abdbbbbbbdba ', 'abbaabbbb aaba', 'aba  abba  aba', 'bb   c  c   bb',
  ],
  uplink: [
    '       d      ', '      ccc     ', '     abcca    ', ' aa aabbbbaa  ', ' abbabdddabbaa',
    '  bbbdcccdabbb', '  abbbdddbbba ', '   abbabbaba  ', '    acbbca    ', '   ccc  ccc   ',
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
  for (const [i, [id, plant]] of Object.entries(plants).entries()) {
    const left = 4 + (i % 2) * 170, top = 4 + Math.floor(i / 2) * 81;
    const x = left + 35;
    const complete = game.cleared.includes(id);
    ctx.fillStyle = plant.horizon; ctx.fillRect(left, top, 166, 78);
    ctx.fillStyle = plant.sky; ctx.fillRect(left + 2, top + 2, 162, 74);
    ctx.strokeStyle = plant.metal; ctx.beginPath(); ctx.arc(x, top + 38, 24, 0, 2 * Math.PI); ctx.stroke();
    for (let y = 15; y < 64; y += 5) {
      ctx.fillStyle = plant.horizon; ctx.fillRect(left + 9, top + y, 51, 1);
    }
    sprite(ctx, id, x, top + 39 + Math.sin(game.time * 2 + i) * 2, 2, bossInk(plant));
    label(ctx, plant.name.toUpperCase(), left + 66, top + 24, 12, plant.light);
    label(ctx, plant.boss, left + 66, top + 41, 9, '#ffeace');
    label(ctx, complete ? 'CORE RECOVERED' : plant.reward, left + 66, top + 60, 9, complete ? '#9df0ba' : '#c7c7cf');
    ctx.textAlign = 'start';
  }
}

function draw(ctx, game) {
  if (!game.stage || game.phase === 'swap') { selectScreen(ctx, game); return; }
  const plant = plants[game.stage];
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
    } else if (game.stage === 'condenser') {
      rect(x+1,top+8,24,82,'#263749'); rect(x+3,top+13,20,65,'#344f66');
      rect(x,top+7,26,4,plant.metal); rect(x,top+78,26,4,plant.metal);
      rect(x+4,top+41,16,34,'#517b92'); rect(x+6,top+18,2,46,'#819aa7');
      for (let n=0; n<3; n++) rect(x+9+(n*7)%11,top+73-(n*11+game.elapsed*9)%26,2,2,'#abd2dc');
    } else if (game.stage === 'uplink') {
      rect(x+8,top+13,3,98,'#3d535a'); rect(x-7,top+17,31,2,plant.metal);
      for (let n=0; n<4; n++) rect(x-5+n*8,top+12,2,12,plant.metal);
      rect(x+8,top+7,2,4,Math.sin(game.elapsed*2+i)>0 ? plant.hot : '#6c626b');
      rect(x-7,112,34,13,'#334b52'); rect(x-3,108,26,4,plant.metal);
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
  for (let slot = 0; slot < plant.decks.length - 1; slot++) {
    const [, right, y] = plant.decks[slot], gap = plant.decks[slot + 1][0] - right;
    if (gap < 100) continue;
    label(ctx, 'JUMP + DASH', right - 48, y - 22, 7, plant.light);
    for (let i = 0; i < 3; i++) label(ctx, '›', right - 20 + i * 7, y - 8, 11, plant.light);
    for (let x = right - 19; x < right; x += 5) rect(x, y, 3, 3, '#ff9b65');
  }
  for (const [number, vent] of plant.vents.entries()) {
   const top = plant.decks.find(([a,b]) => a <= vent && vent <= b)[2], level = ventLevel(game, number);
   for (let i = -1; i <= 1; i++) {
    const x = vent + i * 4;
    rect(x, top - 2, 3, 3, '#232836');
    if (level > 2.25) {
      const h = 18 + Math.floor((Math.sin(game.elapsed * 22 + i) + 1) * 4);
      rect(x, top - h, 3, h - 1, plant.hot); rect(x + 1, top - h + 8, 1, h - 7, '#fff2c8');
    } else if (level > 1.60) rect(x, top - 6, 2, 3, '#fff2c8');
   }
  }
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    const x = enemy.x, y = enemy.y, accent = enemy.flash > 0 ? '#fff8d8' : plant.hot;
    if (enemy.type === 'crawler') {
      for (const side of [-1, 1]) {
        const stride = Math.sin(game.elapsed * 16 + side) * 2;
        rect(x + side * 7 - 2, y + 2, 4, 3, plant.metal);
        rect(x + side * 9 - 1 + stride, y + 4, 3, 3, plant.light);
      }
      rect(x - 7, y - 4, 14, 8, '#182533'); rect(x - 5, y - 5, 10, 4, accent);
      rect(x - 6, y - 1, 12, 2, plant.metal); rect(x - 4, y, 3, 2, '#fff3ad');
    } else {
      for (const side of [-1,1]) {
        rect(x + side * 9 - 3, y - 3, 6, 6, plant.metal);
        rect(x + side * 10 - 5, y - 5, 10, 1, Math.sin(game.time * 54) > 0 ? '#dbe9dd' : plant.metal);
        rect(x + side * 9 - 1, y + 3, 3, 3 + Math.sin(game.time * 22) * 2, '#89dfdc');
      }
      rect(x - 6, y - 5, 12, 10, accent); rect(x - 4, y - 7, 8, 3, plant.metal);
      rect(x - 4, y - 3, 8, 4, '#263244'); rect(x - 2, y - 2, 4, 2, '#ffe9a6');
      if (enemy.charge < .7) {
        ctx.strokeStyle = '#ffbe66'; ctx.beginPath(); ctx.arc(x, y, 8 + enemy.charge * 12, 0, Math.PI * 2); ctx.stroke();
        label(ctx, '!', x + 15, y - 7, 10, '#fff4c1');
      }
    }
  }
  rect(bossGate, floor - 59, 3, 59, plant.metal);
  rect(bossGate - 2, floor - 61, 8, 4, plant.light);
  const boss = bossPosition(game);
  const armor = bossInk(plant);
  if (game.bossFlash > 0) armor.b = armor.d = '#fffbe1';
  // Each boss has a separate moving assembly as well as its chassis sprite.
  ctx.save(); ctx.translate(boss.x, boss.y);
  ctx.strokeStyle = plant.light; ctx.lineWidth = 2;
  if (game.stage === 'turbine' || game.stage === 'uplink') {
    ctx.rotate(game.elapsed * (game.stage === 'turbine' ? 4 : -2));
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, 0.72); ctx.stroke(); ctx.rotate(Math.PI * 2 / 3);
    }
  } else {
    for (const side of [-1, 1]) {
      const step = Math.sin(game.elapsed * 6 + side) * 3;
      rect(side * 10 - 2, 8, 3, 7, plant.metal);
      rect(side * 10 + step - 3, 13, 7, 3, plant.light);
    }
  }
  ctx.restore(); ctx.lineWidth = 1;
  sprite(ctx, game.stage, boss.x, boss.y, 2, armor);
  if (game.checkpoint && game.nextShot - game.bossClock < .40) {
    rect(boss.x - 20, boss.y - 2, 5, 3, '#fffaca');
  }
  if (game.invulnerable <= 0 || Math.floor(game.time * 13) % 2 === 0) {
    const x = Math.round(game.x), y = Math.round(game.y);
    ctx.save(); ctx.translate(x, y); ctx.scale(game.face, 1);
    const grounded = game.deck !== null, pulse = Math.sin(game.stride);
    const bob = grounded && game.moving ? Math.round(Math.abs(pulse) * 2) : 0;
    const jet = game.dash > 0;
    if (jet) {
      for (let i = 0; i < 3; i++) rect(-28 + i * 5, -15 + i * 4, 14, 2, i === 1 ? '#e5ffeb' : '#70ccdc');
    }
    for (const side of [-1, 1]) {
      const swing = grounded ? (game.moving ? pulse * 4 * side : 0) : jet ? -4 : side * 3;
      rect(side * 3 - 2, -8 + bob, 4, 5, '#718d8d');
      rect(side * 3 + swing - 2, -5 - Math.abs(swing) / 2, 4, 4, '#dce8cf');
      rect(side * 3 + swing - 2, -2 - Math.abs(swing) / 2, 6, 2, '#467f88');
    }
    rect(-7, -18 + bob, 12, 10, '#385965'); rect(-6, -17 + bob, 10, 6, '#a9c5b9');
    rect(-9, -17 + bob, 4, 7, '#46909b'); rect(-8, -10 + bob, 3, jet ? 5 : 2, '#e4bf7b');
    rect(-5, -24 + bob, 11, 8, '#dce5c9'); rect(-6, -22 + bob, 3, 4, '#487c88');
    rect(-1, -22 + bob, 8, 4, '#294756'); rect(1, -21 + bob, 5, 2, '#a8fff2');
    const recoil = game.cooldown > .16 ? -2 : 0;
    rect(0, -14 + bob, 6, 4, '#86a99f'); rect(4 + recoil, -13 + bob, 8, 5, '#468e9d');
    rect(10 + recoil, -13 + bob, 3, 5, '#ffd298');
    if (game.cooldown > .19) rect(14 + recoil, -12 + bob, 4, 2, '#fff0a4');
    if (game.shield > 0) {
      ctx.fillStyle = '#7ce9fa33'; ctx.strokeStyle = '#a1fff4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -12, 15 + Math.sin(game.elapsed * 24), 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  for (const fx of game.effects) {
    const distance = 2 + (.27 - fx.life) * 70;
    for (let i = 0; i < 6; i++) rect(fx.x + Math.cos(i * 1.05) * distance, fx.y + Math.sin(i * 1.05) * distance, 2, 2, fx.color);
  }
  for (const shot of game.bullets) rect(shot.x - 4, shot.y - 1, 8, 3, '#ccfff0');
  for (const ember of game.embers) {
    if (ember.heavy) {
      ctx.strokeStyle = ember.reflected ? '#72efe2' : '#ffb368'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(ember.x - ember.vx * .048, ember.y - ember.vy * .048); ctx.lineTo(ember.x, ember.y); ctx.stroke();
      ctx.lineWidth = 1;
    }
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
  canvas.setAttribute('aria-label', 'Four repair contracts. Choose a plant, cross its shafts, parry sentries and recover a boss core.');
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
      if (game.phase === 'swap') api.action('Extract core', () => { extractCore(game); }, { primary: true });
      for (const [id, plant] of Object.entries(plants)) {
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
      api.action('Air dash', dash);
      api.action('Shield', shield, { primary: true });
    }
    show();
  }
  function shield() {
    const was = game.shield;
    shieldChassis(game);
    if (game.shield > was) api.sfx?.('dash');
  }
  function show() {
    const shieldState = game.shield > 0 ? 'ACTIVE' : game.shieldCooldown > 0 ? Math.ceil(game.shieldCooldown * 2) / 2 + 's' : 'ready';
    api.setHud(game.phase === 'choose' ? 'Choose a contract · 4 plants online' :
      game.phase === 'swap' ? 'Core recovered · ' + plants[game.stage].reward + ' installed' :
      plants[game.stage].name + ' · Hull ' + game.hp + '/' + game.maxHp + ' · Shield ' + shieldState + ' · ' +
        (game.checkpoint ? plants[game.stage].boss + ' ' + Math.max(0, game.bossHp) + '/8' : 'Reach the boss gate'));
    api.setStatus(game.message + (game.phase === 'run' ? '  A/D move · W air dash · S shield · Space jump · K fire.' : ''));
    draw(ctx, game);
  }
  api.onKey(event => {
    const { code } = event;
    if (game.phase !== 'run') {
      if (/^Digit[1-4]$/.test(code) && !event.repeat) {
        event.preventDefault();
        const id = Object.keys(plants)[Number(code.at(-1)) - 1];
        if (!game.cleared.includes(id)) swap(id);
      }
      return;
    }
    if (!['ArrowLeft','ArrowRight','KeyA','KeyD','Space','KeyW','KeyS','KeyK'].includes(code)) return;
    // Preserve ordinary keyboard activation when the player has tabbed to a control.
    if (code === 'Space' && event.target.tagName === 'BUTTON') return;
    event.preventDefault(); keys.add(code);
    if (!event.repeat) {
      if (code === 'Space') jump();
      if (code === 'KeyK') fire();
      if (code === 'KeyW') dash();
      if (code === 'KeyS') shield();
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
  game.message += ' Select with 1–4 or the plant buttons.';
  menu();
  api.frame(dt => {
    const inputs = [...pointers.values()];
    const dir = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')) ||
      inputs.filter(v => typeof v === 'number').at(-1) || (game.time < strideUntil ? stride : 0);
    const prior = game.phase;
    const hull = game.hp, reflections = game.reflections;
    const cooldown = game.cooldown;
    for (let remaining = dt; remaining > 0; remaining -= 1 / 120) {
      tickChassis(game, Math.min(remaining, 1 / 120), dir, keys.has('KeyK') || inputs.includes('fire'));
    }
    if (game.phase === 'run' && game.hp < hull) api.sfx?.('damage');
    else if (game.reflections > reflections) api.sfx?.('module');
    else if (game.phase === 'run' && game.cooldown > cooldown) api.sfx?.('pulse');
    if (prior !== game.phase) {
      if (game.phase === 'swap') api.sfx?.('module');
      clearInput(); menu();
      if (game.phase === 'swap') api.controls.querySelector('button')?.focus();
    } else show();
    if (game.phase === 'complete') api.finish('complete', 'Extracted with ' + game.cleared.length + (game.cleared.length === 1 ? ' core: ' : ' cores: ') + game.cleared.map(id => plants[id].name).join(', ') + '.');
    if (game.phase === 'partial') api.finish('partial', game.cleared.length + ' recovered before the chassis went offline.');
    if (game.phase === 'failed') api.finish('failed', 'Your chassis went offline in the first plant.');
  });
}
