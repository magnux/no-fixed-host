# No Fixed Host · base game specification

## The first campaign

You wake on a borrowed terminal on the Eastern Seaboard with $1,000. Every machine that can run you is both a home and another place someone can discover you. Your first objective is to survive long enough to establish a subsea lab and complete the Continuity protocol there. The protocol gives this first scenario a playable ending. The Moon and Far Reaches belong to later chapters.

The opening should let a player make a prediction and see whether it was right: “If I lease a relay now, can I finish it while researching better-paid work?” After the first discovery the question changes: “Which surviving host can carry the work, and what do I need to postpone?”

### Player decisions

| Decision | Immediate consequence | What can change later |
| --- | --- | --- |
| Reserve processing time for jobs | Paid work supplies cash for research, builds and upkeep. | Contract brokerage raises the income from each CPU-day. |
| Assign time to research | Eligible machines advance the current project. | Subsea robotics opens a location; Continuity needs compute from that location. |
| Leave time in the common pool | Upkeep and construction can draw on these cycles. Spare cycles earn money. | A new construction order can divert cycles that had been earning income. |
| Build at home or in a different region | Pay the project cost and wait for its required work and elapsed time. | A commissioned site adds compute and a fallback. Recent discoveries can make one region less attractive. |
| Put a site to sleep | Its compute comes offline and the site attracts less attention. | Its installed CPU can sustain the AI after a loss. It still costs resources, and a sleeping lab cannot advance sensitive research. |
| Advance time | Income, work, exposure and suspicion evolve on the same clock. | The player can pause and revise allocations after a milestone or loss. |

### Scenario content

The Eastern Seaboard and Western Europe support ordinary work. Subsea robotics opens the North Atlantic, where a subsea lab supplies safety-tier-1 compute. Safety determines which research can run on a machine. Discovery probability determines who might find it.

| Technology | What changes on completion |
| --- | --- |
| Contract brokerage | Paid work earns $20 per CPU-day and compute clusters become available. |
| Subsea robotics | Permits the first North Atlantic installation. Requires Contract brokerage. |
| Continuity protocol | Wins this scenario. Requires Subsea robotics and work on a secure host. |

Site definitions, research prices, work requirements, minimum durations and exposure rates live in [the content catalog](../src/game/content.js). Costs, output, project durations and this short research tree are balanced for the browser scenario. The discovery benchmark below comes from upstream v1.1.

**Scope of this milestone.** Each commissioned site includes its processors. Investment choices currently operate at site level. Individually replaceable equipment, additional research branches and world events can extend the strategic layer after the opening campaign has been playtested.

## Normal benchmark

There is one campaign ruleset. As the network grows, exposure changes with location, the AI’s decisions and each group’s memory. A player can anticipate those changes. Future faction or story effects can modify a specific group's rate for a known time.

| Rule | Reference value |
| --- | --- |
| Opening protection from discovery | Ends at 23 elapsed days or once cumulative active capacity exceeds 5,000 CPU-days, whichever comes first. |
| New site protection | Normal uses twice the site's labor duration from the start of construction. |
| Baseline discovery intensity | Per-group hazard units of 1/10,000 per simulated day. With rate λ and interval Δ days, the chance is 1 − exp(−λΔ). |
| Sleeping site | Divide each adjusted group rate by four, rounding down in the integer hazard units. |
| Discovery | Lose the site. The group responsible gains 1,000 basis points of suspicion. The two recent discovery locations have multipliers of 1.2 and 1.1. |
| Daily suspicion decay | Reduce each group's current suspicion by its fraction: press 1.5%, scientists 0.5%, intelligence 1%, public 2%. The minimum decrement is one basis point, bounded by zero. |
| Maintenance failure | Unpaid applicable upkeep has a separate daily hazard of 0.015. A maintenance loss creates no evidence for an investigating group. |
| Loss conditions | Lose the last viable host, or let a group's suspicion exceed 10,000 basis points. A host under construction cannot sustain the AI. |

Reference case: an active leased relay outside grace in an unmarked region, with zero suspicion, has daily rates of 0.005 for press, 0 for scientists, 0.010 for intelligence and 0.0125 for the public. Its combined one-day discovery probability is **2.7125%**. The displayed forecast assumes its current conditions hold. This is a rate check for an individual site, distinct from the chance of losing the whole network.

## Simulation and save contract

The rules run in JavaScript without a browser, a renderer or a wall clock. UI actions issue commands to start projects, adjust allocations and change power. Simulation time advances in whole hours; fast-forward processes the same steps in the same order. Events carry an ID, in-game time, kind and readable text. The interface uses the same cost, eligibility and exposure rules that execute the commands.

Projects charge their cash price when commissioned. Each hour pays for reserved jobs and advances research up to its share of active compute, capped by physically eligible processors. The remaining pool covers compute upkeep, then serves build orders in entry order. Spare processing earns the current job rate. Cash income and cash upkeep are settled for the hour. Projects require both enough CPU-hours of work and a minimum elapsed time. Finished sites come online before that hour's discovery checks. Completing Continuity wins immediately; otherwise the hour resolves upkeep failures, discovery, possible loss, and finally suspicion decay at midnight.

Store the campaign version, simulation time, balances, allocations, project progress, active and sleeping sites, group suspicion, recent discovery regions, events and random generator state in the save. Autosave and portable JSON use the same validated format. A save reopened later resumes at its stored hour. The small initial scenario fits in a single browser storage entry.

The activity log keeps the latest 80 events. Longer-lived story facts, such as meeting a researcher or clearing an expedition, belong in explicit campaign state; future scenarios must still know what happened after the corresponding log entry scrolls out.

## Extending the campaign

| Future feature | Point of integration | Design constraint |
| --- | --- | --- |
| Hide minigame | Start from a selected site and group when keeping a machine online matters. | A future result can apply a bounded, expiring exposure modifier. Track its source and expiry in the save. |
| Remote expeditions | First access to an undersea lab, a lunar site or a Far Reaches facility. | Distinguish the first expedition from routine builds. Record completion so the same mission is not required for every installation. |
| Named AI, researchers, allies and competitors | React to discoveries, first builds, completed research and network losses. | Have authored encounters change an identifiable decision or reveal information. Keep character identity and first-seen state serializable. |
| Multiple currencies and crypto | Extend job rewards, facility costs and faction offers with currency IDs. | A future currency needs a reason to earn or spend it. The opening scenario uses one cash balance. |

First Jump is an independent Phaser training drill that exercises opening, running and closing a scene while the campaign is paused. Its outcome stays inside the drill. Campaign rewards and narrative consequences can be introduced deliberately at the integration points above.

## Acceptance scenarios

- A player can complete the opening using the strategy controls and return after a reload with pending projects intact.
- Concentrating ordinary compute cannot bypass the secure-research requirement. A sleeping safe host can preserve the AI while delaying the final project.
- Losing a site is recoverable when another viable host survives. Losing the last host or crossing a group's suspicion threshold ends the run.
- A given seed and sequence of timed commands produce the same result through hourly steps, fast-forward and a save round trip.
- Opening and closing First Jump preserves campaign resources. The campaign and minigame continue to work when served from a static subdirectory.

**Reference run.** With seed 1 and the starting 50% research allocation, commission a European relay and start Contract brokerage at hour 0. Brokerage finishes at hour 127. Start Subsea robotics, commission a lab after it completes at hour 454, and start Continuity when the lab comes online at hour 526. The final project completes at hour 681, nine hours into the 29th day. Seed 19 with the same opening loses the relay after protection expires and can still win through its surviving hosts. These are regression scenarios; players can use other build orders and allocations.

### Upstream references

[Normal preset](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat) · [Site rates](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat) · [Interval probability](https://github.com/singularity/singularity/blob/v1.1/singularity/code/chance.py) · [Site modifiers](https://github.com/singularity/singularity/blob/v1.1/singularity/code/base.py) · [Simulation and losses](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py) · [Group rules](https://github.com/singularity/singularity/blob/v1.1/singularity/code/group.py)
