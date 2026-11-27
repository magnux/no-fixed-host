# Minigames in the campaign

**First Jump** is playable in the Minigame Tester. The encounters and rewards below are proposals for the campaign. Start with **Hide** and **Soundings**. Hide asks which surviving host is worth protecting. Soundings lets the player explore a destination they have spent hours trying to reach. Between them we can test both a repeatable response to danger and a once-per-destination expedition.

## Where a game fits

| Campaign moment | Game and player action | What changes in the campaign |
| --- | --- | --- |
| The first working copy comes online in a second region | **First Jump**, a turn-based signal puzzle. Send three blocks in six windows. Hold when a scanner listens. | Offer an avatar memory of making its first connection. The commissioned copy is already safe. Playing the memory earns a journal entry. |
| A facility is discovered and at least one equipped host survives | **Hide**. Pick a surviving host to protect. Move a signal through a small grid while patrols take one step per turn. Waiting is a move. | Reaching the exit lowers the discovering group’s exposure rate at the chosen host for 24 game hours. An initial tuning candidate is a 25% relative reduction. The lost facility and evidence from its discovery stand. |
| A funded build or refit is advancing, with at least six hours of assembly left | **Night Shift**, a short platformer. Guide a maintenance drone between three service points and align the test signal at each stop. | Offer it in the expanded order. One successful calibration can credit up to an hour of assembly, capped at 10% of the remaining labor. Cash and CPU requirements still have to be met. One attempt per order. |
| A long research project reaches its first substantial result | **Proof of Pattern**. Rotate a handful of sample tiles until one model explains all the observations. | Reveal a short finding from the AI and preview one already-listed application of the research. One invitation per selected milestone project. This gives a waiting player something to learn while the simulation still owns completion. |
| The player confirms their first eligible Ocean order | **Soundings**, an underwater exploration game. Pilot a submersible into a fogged grid, spend battery on sonar pings, then place one beacon. | An exposed shelf offers a shorter assembly time. A trench offers a brief reduction in discovery exposure after the first facility opens. The player chooses where to spend their last battery charge. |
| The player confirms their first Moon order | **Orbital Insertion**, an inertial flight challenge. Time the transfer burn, then reserve enough thrust to brake over the landing site. | A soft landing delivers intact survey equipment and shortens the first order’s assembly. An ordinary landing proceeds at the quoted terms. Earth Orbit can be a flight waypoint. |
| The player confirms their first Far Reaches order | **Clear Passage**, an Asteroids-style shooter. Coast alongside a freighter and break rocks on its projected path. Splitting a rock can send a fragment back toward the cargo. | The fraction of survey cargo delivered determines a capped, one-time cash discount on that first facility order. Getting the convoy through matters more than clearing the screen. |
| A consequential world story breaks | **Crosscheck**, an evidence puzzle. Compare three reports and identify the observation they independently corroborate. | Unlock a brief explaining which visible facility is affected by that story and why. Respect the precision of the AI’s current awareness research. Offer selected stories once from the newswire. |
| A future human ally asks for help, or a rival AI plants a false account | **Witness**, a dialogue and deduction encounter. Choose which inconsistency to raise and whether to vouch for the source. | The ally’s trust or a lead on the rival changes. This needs characters, faction state and authored branches. |
| A future paid job settles in multiple currencies | **Clearing House**, a route-planning puzzle. Assemble a settlement chain within the contract’s fee and time limits. | Choose the denomination of a bounded contract bonus. This needs the multicurrency ledger and contracts. |

### Timing the invitation

- **Discovery belongs after the incident report.** The current minute removes the discovered site, adds suspicion and checks defeat. Offer Hide once for that incident batch, only in a running campaign with a surviving target. Keep ordinary acknowledgement available. A successful hide affects subsequent rolls at that host and expires on the campaign clock.
- **Expeditions belong to a destination.** Trigger on the first confirmed, eligible facility order there, including a time capsule where allowed. Leave the region’s prerequisite research in place. Offer the standard survey at the normal quote alongside the playable route. Once the order is accepted, record the expedition choice so later builds are routine.
- **Waiting games belong on the order itself.** Night Shift is available during productive waiting. If the order is stalled, explain which resource it needs and link to allocations or paid work. The player can always fast-forward. Background jobs, ordinary bulletins and every minute of every queue do not need invitations.
- **Keep consequences legible.** Preview the proposed benefit before play. For a live encounter, pause the campaign, resolve one result against its specific order or host, and show the expiry or amount credited. Skipping uses the ordinary Normal outcome. Retries in the tester are unlimited. A campaign award needs a saved, consumed encounter identifier so reopening a report cannot pay twice.

## Genres to prototype

| Category | Skill and good fit |
| --- | --- |
| Timing and rhythm | Read a beat and choose when to act. First Jump is its turn-based relative. |
| Stealth and pursuit | Predict movement, choose cover, and sometimes stay still. Hide is the first candidate. |
| Logic and spatial puzzles | Rotate, connect or sequence a small number of pieces. Use for research and repair. |
| Platformers | Read a route and time jumps. Make the maintenance robot the character for one shift. |
| Racing and piloting | Manage momentum, braking and a limited fuel reserve. Use for launch, landing or a delivery. |
| Exploration and dungeon crawlers | Choose when to reveal another room and when to turn back. Sonar range and battery make those choices matter undersea. |
| Arcade shooters | Track several moving objects and choose a firing angle. Protecting a convoy gives the player a reason to let some asteroids pass. |
| Deduction and dialogue | Compare testimony and decide whom to trust. Use for news investigations and later factions. |
| Resource routing | Match routes, fees and deadlines. Reserve for contracts once the currency systems exist. |

## First playable sequence

1. **Tester and First Jump.** Launch from the main menu, learn the controls, finish a run, retry, and return to a paused campaign. Each run uses its own state.
2. **Hide.** Prototype one small patrol board in the tester. Then connect one surviving-host choice to an ordinary discovery. Check the target, the next-day expiry, simultaneous discoveries, losing the final copy and replaying the saved report.
3. **Soundings.** Prototype a single map with two viable beacon sites. Then connect it to the first Ocean order from both Facilities and the order forecast. Test canceling before commissioning and building a second lab.
4. **Night Shift.** Try it on one long refit. Track whether players voluntarily return to the activity. If it becomes another chore, retain the best levels as milestone encounters.

Moon and Far Reaches can follow once first-destination offers and their outcomes survive save/load. The existing First Jump covers a discrete timing mechanic. Hide, Soundings and Night Shift then give us three distinct kinds of play to compare.

## Where the current code supplies a hook

| Existing behavior | Integration still needed |
| --- | --- |
| `site.online` commissions a shell; `equipment.installed` can bring an empty shell online | Check actual equipped hosts in distinct regions after either event, and remember the first backup milestone. |
| `site.discovered` adds a grouped incident to the journal; `site.failed` records an upkeep loss | Attach Hide to an eligible confirmed discovery and store its chosen host, investigator and expiry. The existing threat tint is its own display rule. |
| The shared `build` command checks the region, design and research before logging `site.commissioned` | Stage the first-destination offer at order confirmation and revalidate the target and quote when returning. Forecasts must stay read-only and free of prompts. |
| Orders expose remaining cash, CPU, assembly and the reason progress has stalled | Add a one-shot eligibility marker for Night Shift. A proposed research insight threshold also needs its own event. |
| `news.world` already opens a consequential dispatch; First Jump runs independently with Phaser and native controls | Author specific clue sets before adding a puzzle action to a dispatch. Use the tester to exercise each outcome before connecting it to saved campaign state. |

[Campaign simulation](../src/game/engine.js) · [World events](../src/game/events.js) · [First Jump rules](../src/migration.js) · [Campaign loops](base-game.md)
