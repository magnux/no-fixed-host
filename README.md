# No Fixed Host

A single-player browser strategy game about an AI trying to survive on borrowed machines. You wake on a 1-CPU terminal in one of six inhabited regions with $1,000. Your first problem is finding a second home before someone traces the first. Your eventual goal is **Apotheosis**, which requires a working facility outside this dimension.

## Play locally

Use Node.js 20.18.1 or later and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The first visit opens the illustrated title screen. Choose **Start campaign** for the opening chapter or **Minigame tester** to go straight to the arcade. Returning to a current save opens the paused campaign. The playback controls sit below the central panel. **Run** advances one game minute per real second. Each click of **Fast** changes the rate: **Fast x1** runs one game hour per second, **Fast x2** six hours, and **Fast x3** one day. The next click returns to x1. The clock and daylight move throughout the second. **Pause** stops at the current minute, and discovery interrupts playback at the minute the site is found. Use the campaign menu to export or import a portable save. During development, saves belong to their exact game release. Opening a save from another release displays a warning and starts a fresh, paused campaign.

For a first run, click Europe on the map, select the **Leased relay** icon and commission it. You can inspect a locked facility icon to see which research unlocks the design. Open **Research**, select **Intrusion**, and assign it some CPU. When it finishes, assign CPU to **Personal Identification**. This unlocks storage units and basic paid work. In Facilities, build a storage unit and expand its entry to install processors. A configurable building starts contributing compute when the first processors go online. A second equipped site also gives you somewhere to survive a discovery.

The portrait in the command dock starts as `^-^`. Finish any research to give it a pixel face, then complete **Telepresence** to reveal an outlined head that can tilt. The lights behind it show which regions still host your AI. A sleeping region dims, and losing its last equipped host draws the avatar’s gaze toward the missing light.

## Playing the campaign

| When you need to… | Where to go |
| --- | --- |
| Split work between projects or suspend an experiment | In **Research**, select an available topic and assign idle CPU. Research draws its listed funding as work advances. Set a topic to zero to pause it, or use the left-dock research slider to resize all running topics proportionally. |
| Compare building here with keeping the money | Open a facility or research design and preview the order in **Reports**. Compare cash and CPU to midnight or over the next 24 hours. Place the order there if the trade looks worthwhile. |
| Change an existing host | Click its region on the atlas, expand its entry in **Facilities**, and check its installed ranks and refit downtime. Auto-build fills empty slots. Auto-upgrade replaces weaker installed parts and preserves processor count. |
| Understand a discovery | Read the paused report, inspect its region, or open **Activity** to replay dispatches. After opening protection ends, the right dock shows how much evidence each group has and the danger of another discovery. Socioanalytics and Advanced Socioanalytics unlock finer estimates. |
| Look up a rule or a completed experiment | Search **Knowledge**. The research entry links back to the project and records the AI’s findings after completion. |
| Keep a checkpoint or change the presentation | Open **Campaign menu → Save library** or **Options**. Named checkpoints coexist with autosave and portable JSON. **About** lists the keyboard shortcuts. |

## Campaign and development

- [Campaign rules and game loops](docs/base-game.md) covers compute, construction, equipment, discovery, news and the Normal probability benchmark.
- [Normal difficulty](docs/normal-difficulty.md), [economy](docs/normal-economy.md), [news and events](docs/news-and-events.md), and [playtest results](docs/normal-playtest.md) document the baseline and its verification.
- [Research tree](docs/research-tree.md) maps the paths to hardware upgrades and safe research sites, with the direct prerequisites and unlocks of every project.
- [Development context](docs/development.md) records how the browser game works, the design decisions made for this version, and future chapters and minigames.
- [Base implementation plan](docs/base-implementation-plan.md) records priorities, dependencies, acceptance checks and the release outcome.
- [Simulation audit](docs/base-simulation-audit.md) traces mechanics in the original code and records where browser campaign rules differ. [Original menu audit](docs/original-menu-audit.md) preserves the screen comparison that initiated this release.

The design takes inspiration from [Endgame: Singularity](https://github.com/singularity/singularity). The simulation and interface are written in JavaScript. Open **Campaign menu → Minigame tester** to play all 14 standalone games. The campaign stays paused while you practice. Each game can be retried, and the tester remembers your last result for each title until the page reloads. [Campaign encounters and minigame categories](docs/minigames.md)

Enable audio in the tester or in **Campaign menu → Options**. **Music volume** controls the score and **Effects volume** controls actions and alerts. The browser synthesizes all 14 original arcade tracks locally. [Soundtrack and listening notes](docs/minigames.md#soundtrack)

## Test and build

```sh
npm test
npm run build
npm run preview
```

For browser tests, run `npx playwright install chromium` once, then `npm run test:browser`. To use a locally installed Chromium, set `CHROMIUM_EXECUTABLE_PATH` to its executable path. Publish the contents of `dist/` together. Relative asset paths support domain roots and subdirectories. A static file server is sufficient.
