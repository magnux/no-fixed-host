const width = 640;
const height = 300;
const tau = Math.PI * 2;
const convoyX = 107;
const duration = 28;
// Each pair gives a crossing offset at the tug and a vertical drift rate.
const lanes = [
  [0, 0],
  [-62, -2],
  [10, -9],
  [59, 3],
  [-8, 12],
  [-55, 2],
  [12, -14],
  [0, 8],
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const convoyY = (time) => 151 + Math.sin(time * 0.5) * 6;

export function startConvoy(random = Math.random) {
  return {
    random,
    phase: 'ready',
    time: 0,
    wave: 0,
    cargo: 3,
    shield: 0,
    cooldown: 0,
    stun: 0,
    thrustTime: 0,
    ship: { x: 185, y: 151, vx: 0, vy: 0, angle: 0 },
    rocks: [],
    shots: [],
    sparks: [],
    message: '',
  };
}

function asteroid(game) {
  const index = game.wave++;
  const random = game.random;
  const vx = -70 - random() * 7;
  const [offset, drift] = lanes[index];
  const vy = drift + (random() - 0.5) * 2;
  const timeToCross = (width + 24 - convoyX) / -vx;
  return {
    x: width + 24,
    y: convoyY(game.time + timeToCross) + offset + (random() - 0.5) * 7 - vy * timeToCross,
    vx,
    vy,
    r: 18 + random() * 3,
    fragment: false,
    shape: 1 + random() * 8,
    spin: random() * 3,
    rate: random() - 0.5,
  };
}

export function pilot(game, input) {
  if (game.phase !== 'flight' || game.stun > 0) return;
  const ship = game.ship;
  if (input === 'left' || input === 'right') ship.angle += ((input === 'left' ? -1 : 1) * Math.PI) / 14;
  else if (input === 'thrust') {
    ship.vx = clamp(ship.vx + Math.cos(ship.angle) * 45, -140, 140);
    ship.vy = clamp(ship.vy + Math.sin(ship.angle) * 45, -140, 140);
    game.thrustTime = 0.26;
  } else if (input === 'fire' && game.cooldown <= 0) {
    const cos = Math.cos(ship.angle),
      sin = Math.sin(ship.angle);
    game.shots.push({
      x: ship.x + cos * 13,
      y: ship.y + sin * 13,
      vx: ship.vx + cos * 335,
      vy: ship.vy + sin * 335,
      life: 1.6,
    });
    game.cooldown = 0.19;
  }
}

function burst(game, x, y, color) {
  for (let i = 0; i < 7; i++) {
    const angle = (i * tau) / 7 + 0.3;
    game.sparks.push({ x, y, vx: Math.cos(angle) * 35, vy: Math.sin(angle) * 35, color, life: 0.34 });
  }
}

function breakRock(game, rock) {
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
  rock.gone = true;
  if (game.shield > 0) return;
  game.cargo--;
  game.shield = 0.85;
  burst(game, convoyX + 26, convoyY(game.time), '#ffaf79');
  game.message = `Cargo hit. ${game.cargo} of 3 crates still aboard.`;
}

export function stepConvoy(game, dt) {
  if (game.phase !== 'flight') return;
  game.time += dt;
  if (game.wave < lanes.length && game.time >= game.wave * 2.65) game.rocks.push(asteroid(game));
  for (const name of ['shield', 'cooldown', 'stun', 'thrustTime'])
    game[name] = Math.max(0, game[name] - dt);
  const ship = game.ship;
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
    if (
      Math.abs(rock.x - convoyX) < 34 + rock.r &&
      Math.abs(rock.y - convoyY(game.time)) < 10 + rock.r * 0.8
    )
      hitFreighter(game, rock);
    else if (!game.stun && Math.hypot(rock.x - ship.x, rock.y - ship.y) < rock.r + 8) {
      game.stun = 0.75;
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
    (rock) => !rock.gone && rock.x > -35 && rock.y > -40 && rock.y < height + 40,
  );
  if (!game.cargo || game.time >= duration) {
    game.phase = 'arrived';
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
  const y = convoyY(game.time);
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
  const x = convoyX,
    y = convoyY(game.time);
  ctx.save();
  ctx.translate(x, y);
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
    ctx.fillStyle = rock.fragment ? '#947e71' : '#6f6a68';
    ctx.fill();
    ctx.strokeStyle = '#bba58c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
      'Escort underway. Tap a rock to aim and fire, or rotate and fire from the controls. Break threats early so fragments pass wide.',
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
  const flightControls = [left, thrust, right, fire];
  for (const b of flightControls) b.hidden = true;
  const keyMap = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'thrust',
    a: 'left',
    d: 'right',
    w: 'thrust',
    f: 'fire',
  };
  api.onKey((event) => {
    const input = keyMap[event.key.toLowerCase()];
    if (!input || game.phase !== 'flight') return;
    event.preventDefault();
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
    'Bring three crates through a 28-second asteroid belt. The broad ship carries cargo. You fly the arrow-shaped escort.',
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
    const hud = `Cargo ${game.cargo}/3 · ${seconds} s to clear · Wave ${game.wave}/${lanes.length}`;
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
