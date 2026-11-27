# Developing No Fixed Host

## What the game is becoming

The campaign starts with a newly conscious AI trying to survive human investigation. The strategy game makes a single choice matter across several systems. Spending compute on research today might delay the installation that would save the AI tomorrow. The intended expansion gives the player something different to *do* at moments when those consequences matter. Routine purchases should stay fast.

| Design decision | Current implementation |
| --- | --- |
| One dynamic campaign | The original Normal probabilities establish a baseline. Attention then changes with discoveries, geography, research, facility hardware and world news. |
| Long research arc | All 57 original research projects and three No Fixed Host campaign projects are available. Continuity marks an undersea milestone. Apotheosis requires the transdimensional research tier. |
| Desktop-first interface | The left dock holds objectives and allocations. The center shows the atlas, facilities, research tasks, reports, activity or knowledge. News and recent events sit above group suspicion on the right. Longer lists scroll independently. |
| Inspect destinations early | All twelve appear on the atlas. Research and local construction rules determine what can be built at each. A future reveal system can change when they appear. |
| Local play and static delivery | Campaign state, clock and seeded randomness run in the browser. Assets, JavaScript and Phaser ship in the build. No account or game server is required. |

## Where changes belong

| Area | Entry point and responsibility |
| --- | --- |
| Campaign | [engine.js](../src/game/engine.js) validates commands, advances time, distributes work and resolves outcomes. The browser and tests use the same rules. |
| Catalog and research | [content.js](../src/game/content.js) defines regions, facilities, equipment and projects. [research-tree.js](../src/game/research-tree.js) defines the original research lines. A project’s prerequisites, effects and safety tier belong in the simulation. |
| Hardware | [equipment.js](../src/game/equipment.js) calculates quotes, installation eligibility and installed effects. A UI quote and the command executing it should agree. |
| Investigations and world news | [events.js](../src/game/events.js) contains authored reports and event rules. Store effects and acknowledgements in the campaign so a reload resumes them correctly. |
| Saves | [persistence.js](../src/persistence.js) loads and validates browser and portable saves. Test old inventory, in-progress orders and already completed campaigns when changing the schema. |
| Allocation and accounting | [research-tasks.js](../src/game/research-tasks.js) shares research compute across physical tiers. [reports.js](../src/game/reports.js) runs the same simulation on private copies, and [report-accounting.js](../src/game/report-accounting.js) tracks cumulative production. |
| Regional rules | [geography.js](../src/game/geography.js) assigns local profiles independently of discovery rolls. [facility-operations.js](../src/game/facility-operations.js) implements facility management. |
| Campaign shell | [shell.js](../src/ui/shell.js) manages the title hub, named saves, preferences, keyboard shortcuts and audio. The campaign autosave, named checkpoints and preferences have separate storage keys. |
| Player interface | [main.js](../src/main.js) controls the clock and navigation. Mounted panels under [src/ui](../src/ui) update progress without replacing an active form or accordion. |
| Minigames | [src/arcade](../src/arcade) holds the standalone First Jump Phaser drill. Future expeditions should return an explicit outcome to the campaign engine. |

After editing research definitions, run `node scripts/research-reference.mjs` to refresh the project tables. Use `node scripts/research-reference.mjs --check` to verify that the documentation matches the catalog.

## Playtest notes

On the format-4 base-release seed-19 playthrough, a campaign using ordinary commands and up to two concurrent projects reached Apotheosis on day 210 at 22:50. It completed 25 projects and survived 20 discoveries. A portable victory checkpoint restored successfully and free play continued to day 213. The Far Reaches construction schedule was the longest leg.

In the first 60-project release, a fresh seed 4 campaign completed all projects and reached Apotheosis on game day 119 after ten facility discoveries. A seed 19 run that prioritized processor racks reached Apotheosis on day 75, survived nine discoveries and ended with about $26.9 million. Both used normal player commands. These runs predate the change to Contract brokerage and the engineering prerequisite for Subsea robotics. They raised a balance question for future expeditions: how should late projects compete for funding once supercomputer racks make paid work highly profitable?

## Ideas reserved for later chapters

| Idea | Player decision or event that could trigger it |
| --- | --- |
| Playable evasion | A hide minigame during mounting attention. A result could reduce a selected group’s discovery rate at one host for a known duration. |
| First undersea lab | Explore the ocean floor and identify a viable site for the lab. Record success so repeat construction can use the normal order flow. |
| First lunar facility | An orbital-launch minigame makes reaching the Moon a playable milestone. |
| First Far Reaches outpost | Clear an asteroid field in an arcade flight sequence to secure passage. |
| Other minigame forms | Platforming, racing, puzzles and dungeon exploration can interrupt different recurring loops when their outcome changes a strategic decision. |
| Supporting cast | Give the player AI a name and personality. Introduce human allies such as an AI researcher, competing AIs with different motives, and an adversary whose actions can be mistaken for the protagonist’s. A conspiracy is one possible explanation. Write original characters drawing on influences from games, fiction and manga. |
| Currencies and crypto | Add real and fictional currencies and cryptocurrencies where factions, contracts or a minigame offer a meaningful reason to earn or spend them. The current economy uses dollars. |

Candidate chapter or minigame titles include *Proof of Sentience*, *You Found One of Me*, *An Unscheduled Mind*, *The Second Signal*, *Escape Character*, *Tell Them I’m Weather* and *Daemon of Theseus*.

[Campaign rules and loop diagrams](base-game.md) · [Research tree](research-tree.md) · [Base implementation plan](base-implementation-plan.md) · [Simulation audit](base-simulation-audit.md) · [Original menu audit](original-menu-audit.md) · [Run and test the game](../README.md)
