# Minigames in the campaign

Open **Campaign menu → Minigame tester** or enter from the title screen. All 14 games are playable here. You can go straight to the genre you want to try, retry a run, or leave early. Results belong to this playtest session. The campaign clock stays paused and campaign encounters and rewards are deferred until after player feedback.

## Soundtrack

Tick **Enable audio** in the tester to hear each game’s score. You can adjust music and effects independently in **Options**. An ending gives the final cue room to sound. Retry starts the score from its opening, and hiding the tab pauses playback. The weather receiver also offers a local sound switch.

| Game | Original track | Listen for |
| --- | --- | --- |
| First Jump | Carrier Pigeons | A three-beat duet between the source and relay. Each uplink pulse has a short audible attack. |
| Hide | Soft Soles | A five-beat bass walk. The short wait cue leaves space to watch the patrols. |
| Soundings | Below the Thermocline | Slow, low tones with room above them for sonar returns. |
| Night Shift | The Third Rail Swing | A swung factory groove punctuated by the drone’s jumps and calibrations. |
| Proof of Pattern | Seven Glass Teeth | A repeating seven-eighth-note figure behind the clicks of rotating tiles. |
| Orbital Insertion | Earthrise in Slow Motion | A broad, slow melody with short accents for transfer, braking and cutoff. |
| Clear Passage | Ballast and Stars | A five-beat engine rhythm, with separate cues for firing and cargo damage. |
| Hot Swap | Two Furnaces | A fast chip-rock riff with distinct sounds for shots, dashes and module pickups. |
| Escape Character | The Seventh Room | A slow seven-beat phrase links the rooms. Changing form and recovering the memory have their own signals. |
| Neon Perimeter | Switchyard After Dark | A bass line grouped in threes, threes and twos. Building and overdriving a tower have different accents. |
| Dead Drop Circuit | Last Tram to the Quay | Offbeat chords mark the ride, with a pickup sound when the parcel changes hands. |
| Black Start | Flywheel in Three | A mechanical triple meter. Each breaker bank latches on its own pitch. |
| Tell Them I’m Weather | The Quiet Carrier | A sparse 120 BPM accompaniment leaves space for the notes on the four weather channels. |
| RAM Jam | Little CRT Pasture | A pastoral waltz, a modem whistle and a little greeting for each new friend. |

The [score collection](../src/arcade/audio/scores.js) contains the notes and action effects. The [player](../src/arcade/audio/player.js) schedules them on the Web Audio clock. The built game includes everything needed to play them.

## What to playtest

| Game | What to try |
| --- | --- |
| First Jump | Pick the next relay, tap to gain launch speed, then pulse in flight to control your height. Try a different path when a listener blocks the wire. |
| Hide | Step into a lit cell, try the same move behind a wall, then try crossing a cell a patrol has vacated. Compare the searchlight with the patrol forecast. |
| Soundings | Compare a short shelf survey with a deeper dive. One salvaged spool can commission the shelf. The trench takes two. P maps the water and attracts the eel. E salvages or refills at an air bell, and B drops the beacon. |
| Night Shift | Replay the shift. Look for changes to the gantries and time a crossing between moving machines. |
| Proof of Pattern | Complete three traces on the same clock. Finishing the first quickly leaves time for the later boards. |
| Orbital Insertion | Compare firing at the gate with firing away from it. Trim with W/S or +/−, burn with L and lead the Moon. B toggles the descent brake. Compare the indicated brake height with your vertical speed. |
| Clear Passage | Fly alongside the tug and watch its course near a giant asteroid. Q/E order a lane change and R joins formation. Fire with F or click a rock. Shooting a monolith leaves it on course. |
| Hot Swap | Pick Foundry, Turbine, Condenser or Uplink. A/D move, Space jumps, W dashes, S raises the shield and K fires. Try crossing the gap in Turbine or reflecting a heavy bolt. Extract or take the module into another stage. |
| Escape Character | Detach at a grate and revisit it in the other direction. Retry to see how platforms and hazards change along the route to the lost memory. |
| Neon Perimeter | Compare protecting an approach with covering the core. Reposition a tower and try sending a wave before its countdown ends. |
| Dead Drop Circuit | Drive with WASD or the arrows. Slow down at the marked address and press E to hand off the parcel. A street closure can change the route on your second delivery. |
| Black Start | Use Space for the plunger and A/D or the arrows for the flippers. Run both orbits for a kickback, or hit the capacitor targets for a timed double-score surge. |
| Tell Them I’m Weather | Play A, S, D and F as the notes cross the line. Play the two- and three-note chords with multiple keys, or multiple fingers on the pads. |
| RAM Jam | Find a sheep behind cover. Compare using Twitt with waiting for a guard to fly home to recharge, then hold Space beside a RAM for two seconds to sync. C triggers Twitt. |

### Story ideas after this playtest

Crosscheck, Witness and Clearing House were retired after the first playtest. A future character encounter could follow one recurring human ally through several calls. For example, the player might have time to keep a researcher on the line or warn their colleague at a second site. A later call could come from the person the player helped. This is an idea for the narrative backlog.

## Proposed campaign encounters

| Campaign moment | Game and player action | What changes in the campaign |
| --- | --- | --- |
| The first working copy comes online in a second region | **First Jump**, choose a route and carry the packet through four live crossings. | Offer an avatar memory of making its first connection. The commissioned copy is already safe. Playing the memory earns a journal entry. |
| A facility is discovered and at least one equipped host survives | **Hide**. Pick a surviving host to protect. Move a signal through a small grid while patrols take one step per turn. Waiting is a move. | Reaching the exit lowers the discovering group’s exposure rate at the chosen host for 24 game hours. An initial tuning candidate is a 25% relative reduction. The lost facility and evidence from its discovery stand. |
| A funded build or refit is advancing, with at least six hours of assembly left | **Night Shift**, a short platformer. Guide a maintenance drone between three service points and align the test signal at each stop. | Offer it in the expanded order. One successful calibration can credit up to an hour of assembly, capped at 10% of the remaining labor. Cash and CPU requirements still have to be met. One attempt per order. |
| A long research project reaches its first substantial result | **Proof of Pattern**. Reconstruct successive traces before the observation buffer expires. | Reveal a short finding from the AI and preview one already-listed application of the research. One invitation per selected milestone project. This gives a waiting player something to learn while the simulation still owns completion. |
| The player confirms their first eligible Ocean order | **Soundings**, an underwater exploration game. Explore the wreck, preserve enough oxygen and power, then survey an anchorage. | An exposed shelf offers a shorter assembly time. A trench offers a brief reduction in discovery exposure after the first facility opens. The player chooses where to spend their last battery charge. |
| The player confirms their first Moon order | **Orbital Insertion**. Navigate the parking orbit and transfer gate, intercept the Moon and brake to land. | A soft landing delivers intact survey equipment and shortens the first order’s assembly. An ordinary landing proceeds at the quoted terms. Earth Orbit can be a flight waypoint. |
| The player confirms their first Far Reaches order | **Clear Passage**. Escort the tug through a generated field, shoot smaller rocks and avoid the large bodies. Splitting a rock can send a fragment back toward the cargo. | The fraction of survey cargo delivered determines a capped, one-time cash discount on that first facility order. Getting the convoy through matters more than clearing the screen. |

### Timing the invitation

- **Discovery belongs after the incident report.** The current minute removes the discovered site, adds suspicion and checks defeat. Offer Hide once for that incident batch, only in a running campaign with a surviving target. Keep ordinary acknowledgement available. A successful hide affects subsequent rolls at that host and expires on the campaign clock.
- **Expeditions belong to a destination.** Trigger on the first confirmed, eligible facility order there, including a time capsule where allowed. Leave the region’s prerequisite research in place. Offer the standard survey at the normal quote alongside the playable route. Once the order is accepted, record the expedition choice so later builds are routine.
- **Waiting games belong on the order itself.** Night Shift is available during productive waiting. If the order is stalled, explain which resource it needs and link to allocations or paid work. The player can always fast-forward. Background jobs, ordinary bulletins and every minute of every queue do not need invitations.
- **Keep consequences legible.** Preview the proposed benefit before play. For a live encounter, pause the campaign, resolve one result against its specific order or host, and show the expiry or amount credited. Skipping uses the ordinary Normal outcome. Retries in the tester are unlimited. A campaign award needs a saved, consumed encounter identifier so reopening a report cannot pay twice.

## Genres to prototype

| Category | Skill and good fit |
| --- | --- |
| Timing and rhythm | Read a beat and choose when to act. The weather receiver uses chords. First Jump uses repeated taps to control the packet in flight. |
| Stealth and pursuit | Predict movement, choose cover, and sometimes stay still. Hide is the first candidate. |
| Logic and spatial puzzles | Rotate, connect or sequence a small number of pieces. Use for research and repair. |
| Platformers | Read a route and time jumps. Make the maintenance robot the character for one shift. |
| Racing and piloting | Manage momentum, braking and a limited fuel reserve. Use for launch, landing or a delivery. |
| Exploration and dungeon crawlers | Choose when to reveal another room and when to turn back. Sonar range and battery make those choices matter undersea. |
| Arcade shooters | Track several moving objects and choose a firing angle. Protecting a convoy gives the player a reason to let some asteroids pass. |
| Deduction and dialogue | Reconnect with a recurring ally and make a choice that matters to them. Reserved for future faction stories. |
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
| `news.world` already opens a consequential dispatch; First Jump runs independently with Phaser and native controls | Author the recurring character and a consequential decision before attaching an encounter to a dispatch. Use the tester to exercise each outcome before connecting it to saved campaign state. |

[Campaign simulation](../src/game/engine.js) · [World events](../src/game/events.js) · [First Jump rules](../src/migration.js) · [Campaign loops](base-game.md)
