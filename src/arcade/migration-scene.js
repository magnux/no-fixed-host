import Phaser from 'phaser';
import { requiredBlocks, signalAt } from '../migration.js';

const palette = { track: 0x36545b, quiet: 0x87f2da, scan: 0xffae74, grid: 0x203139 };
const sourceX = 86;
const relayX = 554;
const laneY = 86;

export function createMigrationView(parent, getState) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function create() {
    const grid = this.add.graphics().fillStyle(palette.grid);
    for (let x = 8; x < 640; x += 16) {
      for (let y = 8; y < 140; y += 16) grid.fillRect(x, y, 1, 1);
    }
    const lines = this.add.graphics();
    const packet = this.add.rectangle(sourceX, laneY, 11, 6, palette.quiet).setVisible(false);
    const type = { fontFamily: 'monospace', fontSize: '14px', color: '#aac1c5' };
    this.add.text(sourceX, 116, 'LOCAL HOST', type).setOrigin(0.5);
    this.add.text(relayX, 116, 'RELAY HOST', type).setOrigin(0.5);
    this.add.text(320, 25, 'UPLINK', type).setOrigin(0.5);

    const paint = (state, action) => {
      const warning = state.outcome === 'traced' || signalAt(state.turn) === 'scan' && state.outcome === 'active';
      const ink = warning ? palette.scan : palette.quiet;
      lines.clear().lineStyle(2, palette.track).lineBetween(sourceX, laneY, relayX, laneY);
      lines.strokeCircle(sourceX, laneY, 17).strokeCircle(relayX, laneY, 17);
      lines.fillStyle(palette.quiet).fillCircle(sourceX, laneY, 6);
      if (state.outcome === 'complete') lines.fillCircle(relayX, laneY, 6);
      for (let n = 0; n < requiredBlocks; n++) {
        const x = 280 + n * 34;
        lines.lineStyle(1, palette.track).strokeRect(x, 42, 17, 8);
        if (n < state.copied) lines.fillRect(x + 2, 44, 13, 4);
      }
      if (warning) {
        for (const offset of [-8, 0, 8]) {
          lines.lineStyle(2, ink).lineBetween(320 + offset, 67, 320 + offset, 103);
        }
      }
      this.tweens.killTweensOf(packet);
      packet.setVisible(false);
      if (action === 'transmit' && !reducedMotion) {
        packet.setPosition(sourceX, laneY).setFillStyle(state.outcome === 'traced' ? palette.scan : palette.quiet).setVisible(true);
        this.tweens.add({
          targets: packet,
          x: state.outcome === 'traced' ? 320 : relayX,
          duration: 450,
          ease: 'Sine.easeInOut',
          onComplete: () => packet.setVisible(false),
        });
      }
    };
    paint(getState());
    this.game.events.on('migration', paint);
    this.events.once('shutdown', () => this.game.events.off('migration', paint));
  }

  return new Phaser.Game({
    type: Phaser.CANVAS, width: 640, height: 144, parent,
    backgroundColor: '#101a20', banner: false, autoFocus: false,
    input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    audio: { noAudio: true }, fps: { target: 30 },
    scene: { create },
  });
}
