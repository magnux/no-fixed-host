import Phaser from 'phaser';
import { candidates, layers, links, listenersAt, packetAt, packetRadius, sensorRadius } from '../migration.js';

const mint = 0x84f4c9, gold = 0xffa56e, blue = 0x78b4dc, deep = 0x0d1d2a;
const viewWidth = 680, viewHeight = 278;
export function createMigrationView(parent, getState, onSelect, onPulse) {
  const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function create() {
    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x101c2e, 0x101c2e, 0x112e32, 0x0d202d).fillRect(0, 0, viewWidth, viewHeight);
    for (let x = 12; x < viewWidth; x += 16) for (let y = 16; y < viewHeight; y += 16) {
      backdrop.fillStyle(0x5e9aae, x % 48 === 12 ? .42 : .19).fillRect(x, y, 1, 1);
    }
    const caption = { fontFamily: 'monospace', fontSize: '11px', color: '#92b7c4' };
    this.add.text(15, 10, 'RELAY MESH  /  04 LINKS', caption);
    this.add.text(viewWidth - 15, 10, '●  LIVE SWEEPS', { ...caption, color: '#ffb486' }).setOrigin(1, 0);
    for (let i = 0; i < links.length; i++) {
      layers[i].forEach((node, j) => links[i][j].forEach(k => {
        const dest = layers[i + 1][k];
        backdrop.lineStyle(2, 0x2c515e).lineBetween(node.x, node.y, dest.x, dest.y);
      }));
    }
    this.mesh = this.add.graphics();
    layers.forEach(layer => layer.forEach(node => this.add.text(node.x, node.y + 15, node.name.toUpperCase(), caption).setOrigin(.5, 0)));
    const click = event => {
      const rect = parent.getBoundingClientRect();
      const x = (event.clientX - rect.left) * viewWidth / rect.width, y = (event.clientY - rect.top) * viewHeight / rect.height;
      const state = getState(), options = candidates(state);
      if (state.outcome !== 'active') return;
      if (state.phase === 'docked') {
        const relay = options.find(i => {
          const node = layers[state.hop + 1][i];
          return Math.hypot(node.x - x, node.y - y) < 24;
        });
        if (relay !== undefined) { onSelect(relay); return; }
      }
      onPulse();
    };
    parent.addEventListener('pointerdown', click);
    this.events.once('shutdown', () => parent.removeEventListener('pointerdown', click));
  }
  function update() {
    const state = getState(), g = this.mesh;
    g.clear();
    const source = layers[state.hop][state.relay];
    const options = candidates(state), dest = layers[state.hop + 1]?.[state.choice];
    if (dest) {
      g.lineStyle(3, mint, .75).lineBetween(source.x, source.y, dest.x, dest.y);
      // The socket marks the actual vertical docking tolerance.
      g.lineStyle(2, mint, .6).lineBetween(dest.x, dest.y - 25, dest.x, dest.y + 25);
      for (const v of [-25, 25]) g.lineBetween(dest.x - 5, dest.y + v, dest.x, dest.y + v);
    }
    for (let i = 0; i < state.trail.length - 1; i++) {
      const p = layers[i][state.trail[i]], q = layers[i + 1][state.trail[i + 1]];
      g.lineStyle(3, 0x4fbaaa).lineBetween(p.x, p.y, q.x, q.y);
    }
    layers.forEach((layer, i) => layer.forEach((p, j) => {
      const selected = p === dest || p === source, available = i === state.hop + 1 && options.includes(j);
      const ink = selected ? mint : available ? blue : 0x486777;
      g.fillStyle(deep).fillRoundedRect(p.x - 9, p.y - 8, 18, 16, 3);
      g.lineStyle(selected ? 2 : 1, ink).strokeRoundedRect(p.x - 9, p.y - 8, 18, 16, 3);
      for (const dx of [-5, 0, 5]) g.fillStyle(ink).fillRect(p.x + dx - 1, p.y - 3, 2, 6);
      if (p === source && state.energy > 0) g.lineStyle(3, mint).beginPath().arc(p.x, p.y, 13, -.5 * Math.PI, (-.5 + state.energy / 50) * Math.PI).strokePath();
    }));
    for (const [i, eye] of listenersAt(state.time).entries()) {
      const track = i < 2 ? 0x805e5e : 0x694d5a;
      for (let y = 42; y <= 231; y += 9) {
        const x = (layers[i][0].x + layers[i + 1][0].x) / 2;
        g.fillStyle(track, .55).fillRect(x, y, 1, 3);
      }
      const {x, y} = eye;
      g.fillStyle(gold, .15).fillCircle(x, y, sensorRadius);
      g.lineStyle(1.5, gold).strokeCircle(x, y, sensorRadius);
      g.fillStyle(0x6e4757).fillTriangle(x - 7, y - 4, x - 11, y - 1, x - 6, y + 4)
        .fillTriangle(x + 7, y - 4, x + 11, y - 1, x + 6, y + 4);
      g.fillStyle(gold).fillEllipse(x, y, 13, 8);
      g.fillStyle(0x462738).fillCircle(x, y, 2.6);
    }
    const p = packetAt(state);
    if (state.phase === 'flying') {
      if (!quiet) {
        const length = 10 + Math.sin(state.time * 19) * 3;
        g.fillStyle(mint, .55).fillTriangle(p.x - 2, p.y - 2, p.x - length, p.y + state.velocity * .035, p.x - 2, p.y + 2);
      }
      g.lineStyle(1, mint, .45).strokeCircle(p.x, p.y, packetRadius + 2);
    }
    g.fillStyle(0xf1ffdb).fillCircle(p.x, p.y, packetRadius);
  }
  return new Phaser.Game({
    type: Phaser.CANVAS, width: viewWidth, height: viewHeight, parent, backgroundColor: '#10202c',
    banner: false, autoFocus: false, input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    audio: { noAudio: true }, fps: { target: 60 }, scene: { create, update },
  });
}
