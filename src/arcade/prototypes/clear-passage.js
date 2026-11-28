const width = 640,
  height = 300,
  tau = Math.PI * 2,
  duration = 40;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const laneName = (lane) => ['upper', 'middle', 'lower'][lane + 1];
const laneY = (lane) => 150 + lane * 85;

function makeBelt(random) {
  const routePhase = random() * tau;
  const routeRate = 0.3 + random() * 0.12;
  const plan = [];
  let at = 0;
  for (let i = 0; i < 15; i++) {
    const giant = [1, 5, 9, 13].includes(i);
    const lane = i === 1 ? 0 : Math.floor(random() * 3) - 1;
    const vx = -78 - random() * 25,
      vy = (random() - 0.5) * (giant ? 7 : 20);
    const radius = giant ? 34 + random() * 8 : 13 + random() * 9;
    const crossY = laneY(lane) + (random() - 0.5) * 30;
    const startX = i === 0 ? 410 : width + radius;
    const timeToCross = (startX - 104) / -vx;
    plan.push({
      at,
      x: startX,
      y: crossY - vy * timeToCross,
      vx,
      vy,
      r: radius,
      giant,
      lane,
      fragment: false,
      shape: 1 + random() * 8,
      spin: random() * tau,
      rate: (random() - 0.5) * (giant ? 0.48 : 1.4),
    });
    at += 2 + random() * 0.4;
  }
  return { plan, routePhase, routeRate };
}

export function startConvoy(random = Math.random) {
  const belt = makeBelt(random);
  return {
    ...belt,
    phase: 'ready',
    time: 0,
    wave: 0,
    cargo: 3,
    shield: 0,
    cooldown: 0,
    stun: 0,
    thrustTime: 0,
    hull: 3,
    formation: false,
    tug: { x: 104, y: 150, lane: 0, roll: 0 },
    ship: { x: 185, y: 151, vx: 0, vy: 0, angle: 0 },
    rocks: [],
    shots: [],
    sparks: [],
    message: '',
  };
}

export function pilot(game, input) {
  if (game.phase !== 'flight') return;
  const ship = game.ship;
  if (input === 'tugUp' || input === 'tugDown') {
    game.tug.lane = clamp(game.tug.lane + (input === 'tugUp' ? -1 : 1), -1, 1);
    game.message = 'Survey tug acknowledges ' + laneName(game.tug.lane) + ' lane.';
    return;
  }
  if (game.stun > 0) return;
  if (input === 'formation') {
    game.formation = !game.formation;
    return;
  }
  if (input === 'left' || input === 'right') ship.angle += ((input === 'left' ? -1 : 1) * Math.PI) / 14;
  else if (input === 'thrust') {
    game.formation = false;
    ship.vx = clamp(ship.vx + Math.cos(ship.angle) * 55, -160, 160);
    ship.vy = clamp(ship.vy + Math.sin(ship.angle) * 55, -160, 160);
    game.thrustTime = 0.26;
  } else if (input === 'fire' && game.cooldown <= 0) {
    const cos = Math.cos(ship.angle),
      sin = Math.sin(ship.angle);
    game.shots.push({
      x: ship.x + cos * 15,
      y: ship.y + sin * 15,
      vx: ship.vx + cos * 360,
      vy: ship.vy + sin * 360,
      life: 1.65,
    });
    game.cooldown = 0.16;
  }
}

function burst(game, x, y, color) {
  for (let i = 0; i < 7; i++) {
    const angle = (i * tau) / 7 + 0.3;
    game.sparks.push({ x, y, vx: Math.cos(angle) * 35, vy: Math.sin(angle) * 35, color, life: 0.34 });
  }
}

function breakRock(game, rock) {
  if (rock.giant) {
    burst(game, rock.x, rock.y, '#ffc06b');
    game.message = 'Monolith armor deflected the shot. Move the tug and escort into another lane.';
    return;
  }
  rock.gone = true;
  burst(game, rock.x, rock.y, '#eab78e');
  if (!rock.fragment) {
    for (const side of [-1, 1]) {
      game.rocks.push({
        ...rock,
        gone: false,
        fragment: true,
        r: 8,
        x: rock.x + 2,
        y: rock.y + side * 5,
        vx: rock.vx * 0.96,
        vy: rock.vy + side * 21,
        rate: rock.rate + side * 2,
      });
    }
  }
}

function hitFreighter(game, rock) {
  if (rock.tugHit || game.shield > 0) return;
  rock.tugHit = true;
  if (!rock.giant) rock.gone = true;
  game.cargo = Math.max(0, game.cargo - (rock.giant ? 2 : 1));
  game.shield = 0.85;
  burst(game, game.tug.x + 26, game.tug.y, '#ffaf79');
  game.message = `Cargo hit. ${game.cargo} of 3 crates still aboard.`;
}

export function stepConvoy(game, dt) {
  if (game.phase !== 'flight') return;
  game.time += dt;
  while (game.wave < game.plan.length && game.plan[game.wave].at <= game.time) {
    const next = game.plan[game.wave++];
    game.rocks.push({ ...next });
    if (next.giant)
      game.message = 'Monolith on scope, ' + laneName(next.lane) + ' corridor. Signal a clear lane with Q/E.';
  }
  const tug = game.tug;
  const oldY = tug.y;
  const wavelength = game.time * game.routeRate + game.routePhase;
  tug.x = 104 + Math.sin(wavelength * 0.68) * 14;
  const flightLine = laneY(tug.lane) + Math.sin(wavelength) * 21 + Math.sin(wavelength * 2.3) * 7;
  tug.y += (flightLine - tug.y) * (1 - Math.exp(-dt * 1.25));
  tug.roll = clamp(((tug.y - oldY) / Math.max(0.001, dt)) * 0.0023, -0.18, 0.18);
  for (const name of ['shield', 'cooldown', 'stun', 'thrustTime']) game[name] = Math.max(0, game[name] - dt);
  const ship = game.ship;
  if (game.formation && !game.stun) {
    ship.vx = (tug.x + 82 - ship.x) * 2.2;
    ship.vy = (tug.y - ship.y) * 2.2;
  }
  ship.x = clamp(ship.x + ship.vx * dt, 22, width - 22);
  ship.y = clamp(ship.y + ship.vy * dt, 22, height - 22);
  ship.vx *= Math.exp(-dt * 0.72);
  ship.vy *= Math.exp(-dt * 0.72);
  for (const rock of game.rocks) {
    rock.x += rock.vx * dt;
    rock.y += rock.vy * dt;
    rock.spin += rock.rate * dt;
  }
  for (const shot of game.shots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    const hit = game.rocks.find(
      (rock) => !rock.gone && Math.hypot(rock.x - shot.x, rock.y - shot.y) < rock.r + 2,
    );
    if (hit) {
      shot.life = 0;
      breakRock(game, hit);
    }
  }
  for (const rock of game.rocks) {
    if (rock.gone) continue;
    if (Math.abs(rock.x - tug.x) < 34 + rock.r && Math.abs(rock.y - tug.y) < 10 + rock.r * 0.8)
      hitFreighter(game, rock);
    else if (!game.stun && !rock.shipHit && Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r + 8) {
      rock.shipHit = true;
      game.hull = Math.max(0, game.hull - (rock.giant ? 2 : 1));
      game.stun = 0.75;
      burst(game, ship.x, ship.y, '#f3b97e');
      const dy = ship.y - rock.y;
      ship.vy = dy < 0 ? -44 : 44;
      game.message = 'Escort clipped. Thrusters will recover in a moment.';
    }
  }
  for (const spark of game.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
  }
  game.sparks = game.sparks.filter((spark) => spark.life > 0);
  game.shots = game.shots.filter(
    (shot) => shot.life > 0 && shot.x >= 0 && shot.x <= width && shot.y >= 0 && shot.y <= height,
  );
  game.rocks = game.rocks.filter(
    (rock) => !rock.gone && rock.x > -55 && rock.y > -40 && rock.y < height + 40,
  );
  if (!game.cargo || !game.hull || game.time >= duration) {
    game.phase = 'arrived';
    if (!game.hull)
      return {
        outcome: 'failed',
        detail: 'Escort hull lost. Thrust clear of monoliths or use R to fly formation with the tug.',
      };
    if (game.cargo === 3)
      return { outcome: 'complete', detail: 'All three survey crates reached the Far Reaches.' };
    if (game.cargo)
      return {
        outcome: 'partial',
        detail: `The freighter made it through with ${game.cargo} of 3 survey crates.`,
      };
    return {
      outcome: 'failed',
      detail:
        'The last survey crate was lost. Break incoming rocks while they are still far from the freighter.',
    };
  }
}

function drawField(ctx, game) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#131c32');
  bg.addColorStop(1, '#202633');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 62; i++) {
    const speed = 3 + (i % 5) * 1.9;
    const x = (width + ((i * 137.1 + 21) % width) - game.time * speed) % width;
    ctx.fillStyle = i % 5 ? '#627686' : '#c7c4ad';
    ctx.fillRect(x, (i * i * 12.1 + 31) % height, i % 6 ? 1.4 : 3, 1.3);
  }
  ctx.fillStyle = '#514444';
  ctx.beginPath();
  ctx.arc(535, 61, 24, 0, tau);
  ctx.fill();
  ctx.fillStyle = '#302e39';
  ctx.beginPath();
  ctx.arc(542, 59, 23, 0, tau);
  ctx.fill();
  ctx.strokeStyle = '#756063';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(535, 61, 38, 6, -0.38, 0, tau);
  ctx.stroke();
  // The dashed strip marks the freighter's route through the moving field.
  const y = laneY(game.tug.lane);
  ctx.strokeStyle = '#364c5c';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y - 22);
  ctx.lineTo(width, y - 22);
  ctx.moveTo(0, y + 22);
  ctx.lineTo(width, y + 22);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#8799a7';
  ctx.font = '11px monospace';
  ctx.fillText('FAR REACHES', 21, 26);
  ctx.strokeStyle = '#526174';
  ctx.strokeRect(115, 18, 92, 6);
  ctx.fillStyle = '#dcac77';
  ctx.fillRect(116, 19, 90 * Math.min(1, game.time / duration), 4);
}

function drawFreighter(ctx, game) {
  const { x, y, roll } = game.tug;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roll);
  // Exposed truss, dual drive bells and a tracking survey dish identify the cargo vessel.
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#9c9f98';
  ctx.strokeRect(-34, -10, 53, 19);
  for (let i = -32; i < 14; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -10);
    ctx.lineTo(i + 9, 9);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#687883';
    ctx.fillRect(-42, side * 9 - 3, 19, 6);
    ctx.fillStyle = '#f1a570';
    ctx.fillRect(-45, side * 9 - 2, 5, 4);
  }
  ctx.strokeStyle = '#ceba99';
  ctx.beginPath();
  ctx.moveTo(9, -6);
  ctx.lineTo(12, -18);
  ctx.stroke();
  ctx.save();
  ctx.translate(12, -18);
  ctx.rotate(Math.sin(game.time * 1.4) * 0.65);
  ctx.beginPath();
  ctx.arc(0, -3, 7, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#bc9978';
  ctx.beginPath();
  ctx.moveTo(-35, -7);
  ctx.lineTo(16, -7);
  ctx.lineTo(24, -13);
  ctx.lineTo(35, -8);
  ctx.lineTo(40, 1);
  ctx.lineTo(29, 10);
  ctx.lineTo(-34, 10);
  ctx.fill();
  ctx.fillStyle = '#8bcdd1';
  ctx.fillRect(20, -8, 8, 5);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < game.cargo ? '#7cb6a4' : '#3d535a';
    ctx.fillRect(-31 + i * 16, -11, 13, 14);
    ctx.strokeStyle = '#263e46';
    ctx.strokeRect(-30 + i * 16, -10, 11, 12);
    ctx.beginPath();
    ctx.moveTo(-30 + i * 16, 1);
    ctx.lineTo(-20 + i * 16, -8);
    ctx.stroke();
  }
  ctx.fillStyle = '#e58c62';
  ctx.beginPath();
  ctx.moveTo(-34, -4);
  ctx.lineTo(-47 - Math.sin(game.time * 14) * 4, 1);
  ctx.lineTo(-34, 5);
  ctx.fill();
  if (game.shield > 0) {
    ctx.strokeStyle = '#ffc08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 49, 21, 0, 0, tau);
    ctx.stroke();
  }
  ctx.fillStyle = '#b6c7c6';
  ctx.font = '11px monospace';
  ctx.fillText('SURVEY TUG', -34, 32);
  ctx.restore();
}

function drawEscort(ctx, game) {
  const ship = game.ship;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  if (game.thrustTime > 0) {
    ctx.fillStyle = '#74dede';
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-21, 0);
    ctx.lineTo(-9, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#3591a2';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(7, 2 * side);
    ctx.lineTo(-9, 13 * side);
    ctx.lineTo(-17, 13 * side);
    ctx.lineTo(-7, 2 * side);
    ctx.fill();
    ctx.fillStyle = '#d0a86e';
    ctx.fillRect(-13, 10 * side - 1, 12, 2);
    ctx.fillStyle = '#3591a2';
  }
  ctx.fillStyle = game.stun > 0 ? '#de9875' : '#a2e4db';
  ctx.strokeStyle = '#173e49';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-11, -9);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-11, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#315d72';
  ctx.beginPath();
  ctx.ellipse(3, 0, 5, 2.7, 0, 0, tau);
  ctx.fill();
  ctx.fillStyle = '#d3ffff';
  ctx.fillRect(4, -1, 3, 1.3);
  ctx.strokeStyle = '#629b9e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();
  ctx.restore();
}

function drawRocks(ctx, game) {
  for (const rock of game.rocks) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    // A faint projection shows where the moving rock is heading.
    if (!rock.fragment) {
      ctx.strokeStyle = '#806c62';
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(rock.vx * 0.38, rock.vy * 0.38);
      ctx.lineTo(rock.vx * 1.1, rock.vy * 1.1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (rock.giant) {
      ctx.strokeStyle = '#eeb473';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, rock.r + 5, 0, tau);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ebbd8d';
      ctx.font = '9px monospace';
      ctx.fillText('MONOLITH', -23, -rock.r - 9);
    }
    ctx.rotate(rock.spin);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i * tau) / 9,
        r = rock.r * (0.83 + 0.17 * Math.sin(rock.shape + i * 7.2));
      const x = Math.cos(a) * r,
        y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = rock.giant ? '#775c62' : rock.fragment ? '#947e71' : '#6f6a68';
    ctx.fill();
    ctx.strokeStyle = '#bba58c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 0; i < (rock.giant ? 8 : 3); i++) {
      const a = rock.shape + i * 2.9,
        r = rock.r * (0.27 + 0.25 * Math.sin(i * 3.1));
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, rock.r * 0.15, rock.r * 0.09, a, 0, tau);
      ctx.fillStyle = rock.giant ? '#53414e' : '#56545b';
      ctx.fill();
    }
    ctx.strokeStyle = '#514e51';
    ctx.beginPath();
    ctx.moveTo(-rock.r * 0.55, rock.r * 0.3);
    ctx.lineTo(0, 0);
    ctx.lineTo(-rock.r * 0.1, -rock.r * 0.55);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = '#a3f3db';
  ctx.lineWidth = 2.3;
  for (const shot of game.shots) {
    ctx.beginPath();
    ctx.moveTo(shot.x, shot.y);
    ctx.lineTo(shot.x - shot.vx * 0.025, shot.y - shot.vy * 0.025);
    ctx.stroke();
  }
  for (const spark of game.sparks) {
    ctx.fillStyle = spark.color;
    ctx.fillRect(spark.x, spark.y, 2, 2);
  }
}

export default function mount(api) {
  const game = startConvoy();
  const { canvas, ctx } = api.canvas(width, height);
  canvas.setAttribute(
    'aria-label',
    'Escort ship and survey freighter in an asteroid field. Tap the field to aim and fire.',
  );
  canvas.style.touchAction = 'manipulation';
  function begin() {
    if (game.phase !== 'ready') return;
    game.phase = 'flight';
    api.sfx?.('launch');
    start.hidden = true;
    for (const b of flightControls) b.hidden = false;
    fire.focus();
    canvas.style.cursor = 'crosshair';
    api.setStatus(
      'Tap rocks to fire. Q/E orders the tug up/down one lane. R flies your escort in formation, or steer and thrust independently. Both ships must avoid ringed monoliths.',
    );
    render();
  }
  function control(input) {
    const shotsBefore = game.shots.length;
    pilot(game, input);
    if (game.shots.length > shotsBefore) api.sfx?.('laser');
  }
  const start = api.action('Start escort', begin, { primary: true });
  const left = api.action('Turn left (←)', () => control('left'));
  const thrust = api.action('Thrust (↑)', () => control('thrust'));
  const right = api.action('Turn right (→)', () => control('right'));
  const fire = api.action('Fire (F)', () => control('fire'), { primary: true });
  const tugUp = api.action('Tug ↑ (Q)', () => control('tugUp'));
  const tugDown = api.action('Tug ↓ (E)', () => control('tugDown'));
  const formation = api.action('Fly formation (R)', () => control('formation'));
  const flightControls = [left, thrust, right, fire, tugUp, tugDown, formation];
  for (const b of flightControls) b.hidden = true;
  const keyMap = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'thrust',
    a: 'left',
    d: 'right',
    w: 'thrust',
    f: 'fire',
    q: 'tugUp',
    e: 'tugDown',
    r: 'formation',
  };
  api.onKey((event) => {
    const input = keyMap[event.key.toLowerCase()];
    if (!input || game.phase !== 'flight') return;
    event.preventDefault();
    if (!event.repeat || input === 'thrust' || input === 'fire' || input === 'left' || input === 'right')
      control(input);
  });
  function aim(event) {
    if (game.phase !== 'flight' || game.stun > 0 || event.button !== 0) return;
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) * width) / box.width,
      y = ((event.clientY - box.top) * height) / box.height;
    game.ship.angle = Math.atan2(y - game.ship.y, x - game.ship.x);
    control('fire');
  }
  canvas.addEventListener('pointerdown', aim);
  api.onCleanup(() => canvas.removeEventListener('pointerdown', aim));
  api.setStatus(
    'Bring three crates across a new 40-second belt. Split small rocks, escort the survey tug and route both ships around indestructible monoliths.',
  );
  let lastHud = '';
  function render() {
    if (ctx) {
      drawField(ctx, game);
      drawFreighter(ctx, game);
      drawRocks(ctx, game);
      drawEscort(ctx, game);
    }
    const seconds = Math.max(0, Math.ceil(duration - game.time));
    formation.setAttribute('aria-pressed', String(game.formation));
    const hud = `Cargo ${game.cargo}/3 · Escort hull ${game.hull}/3 · Tug: ${laneName(game.tug.lane)} · ${game.formation ? 'Formation' : 'Free flight'} · ${seconds} s to clear`;
    if (hud !== lastHud) {
      api.setHud(hud);
      lastHud = hud;
    }
  }
  render();
  api.frame((dt) => {
    if (game.phase !== 'flight' || document.hidden) return;
    const oldCargo = game.cargo;
    const result = stepConvoy(game, Math.min(dt, 0.05));
    render();
    if (game.cargo < oldCargo && !result) api.sfx?.('cargo');
    if (game.message) {
      api.setStatus(game.message);
      game.message = '';
    }
    if (result) api.finish(result.outcome, result.detail);
  });
}
