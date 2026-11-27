# Minigames in the campaign

Open **Campaign menu → Minigame tester** or enter from the title screen. All 17 games are playable here. You can go straight to the genre you want to try, retry a run, or leave early. Results belong to this playtest session. The campaign clock stays paused and campaign encounters and rewards are deferred until after player feedback.

## Soundtrack

Tick **Enable audio** in the tester to hear each game’s score. You can adjust music and effects independently in **Options**. An ending gives the final cue room to sound. Retry starts the score from its opening, and hiding the tab pauses playback. The weather receiver also offers a local sound switch.

| Game | Original track | Listen for |
| --- | --- | --- |
| First Jump | Carrier Pigeons | A three-beat duet between the source and relay. Holding and transmitting make different sounds. |
| Hide | Soft Soles | A five-beat bass walk. The short wait cue leaves space to watch the patrols. |
| Soundings | Below the Thermocline | Slow, low tones with room above them for sonar returns. |
| Night Shift | The Third Rail Swing | A swung factory groove punctuated by the drone’s jumps and calibrations. |
| Proof of Pattern | Seven Glass Teeth | A repeating seven-eighth-note figure behind the clicks of rotating tiles. |
| Orbital Insertion | Earthrise in Slow Motion | A broad, slow melody with short accents for transfer, braking and cutoff. |
| Clear Passage | Ballast and Stars | A five-beat engine rhythm, with separate cues for firing and cargo damage. |
| Crosscheck | Carbon Paper | A swung newsroom trio with soft paper sounds for selecting evidence. |
| Witness | The Open Receiver | A sparse duet in triple time that gives the interview room to breathe. |
| Clearing House | Settlement Window | Syncopated mallet tones punctuate route, rush and undo decisions. |
| Hot Swap | Two Furnaces | A fast chip-rock riff with distinct sounds for shots, dashes and module pickups. |
| Escape Character | The Seventh Room | A slow seven-beat phrase links the rooms. Changing form and recovering the memory have their own signals. |
| Neon Perimeter | Switchyard After Dark | A bass line grouped in threes, threes and twos. Building and overdriving a tower have different accents. |
| Dead Drop Circuit | Last Tram to the Quay | Offbeat chords mark the ride, with a pickup sound when the parcel changes hands. |
| Black Start | Flywheel in Three | A mechanical triple meter. Each breaker bank latches on its own pitch. |
| Tell Them I’m Weather | The Quiet Carrier | A sparse 120 BPM accompaniment starts again quietly at tune-in. The weather and rival signals remain in the foreground. |
| RAM Jam | Little CRT Pasture | A pastoral waltz, a modem whistle and a little greeting for each new friend. |

The [score collection](../src/arcade/audio/scores.js) contains the notes and action effects. The [player](../src/arcade/audio/player.js) schedules them on the Web Audio clock. The built game includes everything needed to play them.

## Seven more games to playtest

| Game | Try this on a second run |
| --- | --- |
| **Hot Swap** | Fight the bosses in the opposite order and see where the first upgrade changes the route. |
| **Escape Character** | Revisit the rooms that seemed inaccessible before the core could detach. Look for the lost memory on the way out. |
| **Neon Perimeter** | Compare clustering towers at the merge with delaying one approach. Use the wave preview before moving a tower. |
| **Dead Drop Circuit** | Take the tram depot shortcut and compare your exit speed against your previous delivery ghost. |
| **Black Start** | Pick a different breaker bank to light first, then line up the open generator ramp. |
| **Tell Them I’m Weather** | Follow the weather station through the rival signal. Both stations have distinct sounds and beat markings. |
| **RAM Jam** | Try greeting the most impatient RAM first. Watch what the dog does when you chirp near a cluster. |

These seven games are in the tester for feedback. Their campaign placements are open.

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

## Playtest and integration order

1. Try **Hide**, **Soundings** and **Night Shift** to compare responding to a loss, reaching a new location and filling a productive wait. For player feedback, the most useful details are the moment you understood the controls, the decision you enjoyed most, and whether you wanted another run.
2. If Hide works as a response to danger, connect one surviving-host choice to an ordinary discovery. Check simultaneous discoveries, losing the final copy, expiry and reopening a saved report.
3. If Soundings makes the first Ocean base feel earned, connect it at order confirmation in Facilities and the order forecast. Test canceling before commissioning and building a second lab. The Moon and Far Reaches can reuse that mechanism.
4. If players return to Night Shift voluntarily, attach the invitation to one long refit. Research, news, characters and contracts can follow where the playtest supports them.

The [tester catalog](../src/arcade/catalog.js) loads a game when selected. Each new game owns its own rules and input. The [practice dialog](../src/arcade/practice.js) manages replay, keyboard focus, frame timing and cleanup. Campaign state is never passed into these games.

## Where the current code supplies a hook

| Existing behavior | Integration still needed |
| --- | --- |
| `site.online` commissions a shell; `equipment.installed` can bring an empty shell online | Check actual equipped hosts in distinct regions after either event, and remember the first backup milestone. |
| `site.discovered` adds a grouped incident to the journal; `site.failed` records an upkeep loss | Attach Hide to an eligible confirmed discovery and store its chosen host, investigator and expiry. The existing threat tint is its own display rule. |
| The shared `build` command checks the region, design and research before logging `site.commissioned` | Stage the first-destination offer at order confirmation and revalidate the target and quote when returning. Forecasts must stay read-only and free of prompts. |
| Orders expose remaining cash, CPU, assembly and the reason progress has stalled | Add a one-shot eligibility marker for Night Shift. A proposed research insight threshold also needs its own event. |
| `news.world` already opens a consequential dispatch; First Jump runs independently with Phaser and native controls | Author specific clue sets before adding a puzzle action to a dispatch. Use the tester to exercise each outcome before connecting it to saved campaign state. |

[Campaign simulation](../src/game/engine.js) · [World events](../src/game/events.js) · [First Jump rules](../src/migration.js) · [Campaign loops](base-game.md)
