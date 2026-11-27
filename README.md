# No Fixed Host

A single-player browser strategy game about an AI trying to survive on borrowed machines. You wake on a terminal in North America with $1,000. Your first problem is finding a second home before someone traces the first. Your eventual goal is **Apotheosis**, which requires a working facility outside this dimension.

## Play locally

Use Node.js 20.18.1 or later and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The campaign starts paused and saves in the browser. **Run** advances one game minute per real second. Each click of **Fast** changes the rate: **Fast x1** runs one game hour per second, **Fast x2** six hours, and **Fast x3** one day. The next click returns to x1. The clock and daylight move throughout the second. **Pause** stops at the current minute, and discovery interrupts playback at the minute the site is found. Use the campaign menu to export or import a portable save.

For a first run, click Europe on the map and commission a leased relay. Open Research and complete **Intrusion**, then **Personal Identification**. This unlocks storage units and basic paid work. In Facilities, build a storage unit and expand its entry to install processors. A configurable building starts contributing compute when the first processors go online. A second equipped site also gives you somewhere to survive a discovery.

## Campaign and development

- [Campaign rules and game loops](docs/base-game.md) covers compute, construction, equipment, discovery, news and the Normal probability benchmark.
- [Research tree](docs/research-tree.md) maps the paths to hardware upgrades and safe research sites, with the direct prerequisites and unlocks of every project.
- [Development context](docs/development.md) records how the browser game works, the design decisions made for this version, and future chapters and minigames.
- [Original menu audit](docs/original-menu-audit.md) compares the original controls and screens with what players can do in No Fixed Host.

The design takes inspiration from [Endgame: Singularity](https://github.com/singularity/singularity). The simulation and interface are written in JavaScript. **First Jump**, a standalone training drill, uses Phaser.

## Test and build

```sh
npm test
npm run build
npm run preview
```

For browser tests, run `npx playwright install chromium` once, then `npm run test:browser`. To use a locally installed Chromium, set `CHROMIUM_EXECUTABLE_PATH` to its executable path. Publish the contents of `dist/` together. Relative asset paths support domain roots and subdirectories. A static file server is sufficient.
