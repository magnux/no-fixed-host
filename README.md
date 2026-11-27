# No Fixed Host

A single-player browser strategy game about an AI trying to survive on borrowed machines. You wake on a terminal in North America with $1,000. Your first problem is finding a second home before someone traces the first. Your eventual goal is **Apotheosis**, which requires a working facility outside this dimension.

## Play locally

Use Node.js 20.18.1 or later and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The campaign starts paused and saves in the browser. **Run** advances one game minute per real second. Each click of **Fast** changes the rate: **Fast x1** runs one game hour per second, **Fast x2** six hours, and **Fast x3** one day. The next click returns to x1. The clock and daylight move throughout the second. **Pause** stops at the current minute, and discovery interrupts playback at the minute the site is found. Use the campaign menu to export or import a portable save.

For a first run, click Europe on the map and commission a leased relay. Open **Research**, select **Intrusion**, and assign it some CPU. When it finishes, assign CPU to **Personal Identification**. This unlocks storage units and basic paid work. In Facilities, build a storage unit and expand its entry to install processors. A configurable building starts contributing compute when the first processors go online. A second equipped site also gives you somewhere to survive a discovery.

## Playing the campaign

| When you need to… | Where to go |
| --- | --- |
| Split work between projects or suspend an experiment | In **Research**, select an available topic and assign idle CPU. The first positive assignment pays its listed price. Set a topic to zero to pause it, or use the left-dock research slider to resize all running topics proportionally. |
| Compare building here with keeping the money | Open a facility or research design and preview the order in **Reports**. Compare cash and CPU to midnight or over the next 24 hours. Place the order there if the trade looks worthwhile. |
| Change an existing host | Click its region on the atlas, expand its entry in **Facilities**, and inspect upgrades, local upkeep and investigator risks. |
| Understand a discovery | Read the paused report, inspect its region, or open **Activity** to filter the history and replay dispatches. |
| Look up a rule or a completed experiment | Search **Knowledge**. The research entry links back to the project and records the AI’s findings after completion. |
| Keep a checkpoint or change the presentation | Open **Campaign menu → Save library** or **Options**. Named checkpoints coexist with autosave and portable JSON. **About** lists the keyboard shortcuts. |

## Campaign and development

- [Campaign rules and game loops](docs/base-game.md) covers compute, construction, equipment, discovery, news and the Normal probability benchmark.
- [Research tree](docs/research-tree.md) maps the paths to hardware upgrades and safe research sites, with the direct prerequisites and unlocks of every project.
- [Development context](docs/development.md) records how the browser game works, the design decisions made for this version, and future chapters and minigames.
- [Base implementation plan](docs/base-implementation-plan.md) records priorities, dependencies, acceptance checks and the release outcome.
- [Simulation audit](docs/base-simulation-audit.md) traces mechanics in the original code and records where browser campaign rules differ. [Original menu audit](docs/original-menu-audit.md) preserves the screen comparison that initiated this release.

The design takes inspiration from [Endgame: Singularity](https://github.com/singularity/singularity). The simulation and interface are written in JavaScript. **First Jump**, a standalone training drill, uses Phaser.

## Test and build

```sh
npm test
npm run build
npm run preview
```

For browser tests, run `npx playwright install chromium` once, then `npm run test:browser`. To use a locally installed Chromium, set `CHROMIUM_EXECUTABLE_PATH` to its executable path. Publish the contents of `dist/` together. Relative asset paths support domain roots and subdirectories. A static file server is sufficient.
