# Campaign rules and game loops

You begin on a single borrowed terminal. Building a second machine buys time. Combining specialist facilities, better hardware and research eventually lets the AI move beyond the reach of every terrestrial investigator. **Continuity** secures an undersea recovery protocol. **Apotheosis** wins the campaign.

## A minute of simulation

The player divides active compute between paid work, research and a shared pool. Research can only use processors in a location safe enough for its project. Unused cycles return to the pool. Compute upkeep is paid before outstanding construction and installation work. Spare cycles can earn cash. Orders require both their CPU work and their minimum construction time. A host’s equipment contributes its effect after installation.

```mermaid
flowchart TD
    Host["Equipped, awake hosts"] --> CPU["Allocate compute"]
    CPU --> Jobs["Paid work"]
    CPU --> Research["Eligible research"]
    CPU --> Pool["Shared pool"]
    Pool --> Costs["Upkeep and construction"]
    Pool -->|spare cycles| Jobs
    Jobs --> Money["Cash"]
    Money --> Costs
    Costs --> Host
    Research --> Designs["New jobs, equipment and sites"]
    Designs --> Host
```

Each simulation tick advances one minute. **Run** processes one tick per real second. The three **Fast** settings process 60, 360 and 1,440 ticks per second, and the fourth click returns to the first setting. The visible clock and daylight update as time passes between display frames. If a discovery happens partway through a frame’s work, the clock stops on that minute. The atlas starts on 1 January at 00:00 UTC and follows the campaign’s day and season.

## Planning several turns ahead

Funding a research project pays its cash cost immediately and adds it to Tasks. The research slider sets a total budget. Each funded project’s weight determines its share. Set a weight to zero to suspend a project and keep its progress. Research can stall after an eligible host sleeps or disappears. A higher safety tier can supply a lower-tier experiment. Continuity specifically needs Ocean processors. Cycles that cannot go to an experiment return to the shared pool.

Cash upkeep is due in whole-dollar installments through the day. The network bill uses the combined daily rate. A host can suffer a cash-maintenance failure only when its own installment falls due and the network cannot pay. CPU maintenance draws from the pool every minute.

Use a design’s forecast action to compare the current network against the same network with that order funded. **Reports** advances private copies through the same minute scheduler. Jobs, passive income, maintenance, construction and completion can all change during the forecast. Unknown discoveries and future random news remain outside the estimate. Both columns start from the same minute. **Statistics** retains cumulative production even when a building is subsequently lost. Migrated campaigns label the point where tracking began.

## Where to build

All twelve destinations are visible. Activating a location opens its facility controls. Six populated continents offer ordinary leases. Antarctica and the Ocean support remote work. The Moon, Far Reaches, and transdimensional locations support progressively more sensitive projects. Earth Orbit appears as a destination without a facility design, as in the reference game. Seeing a location lets the player inspect its prerequisites before committing resources.

A leased relay arrives with fixed hardware. A storage unit provides eight processor bays. Expand a finished facility in the Facilities list to see its equipment, power controls and pending installations. Each configurable host accepts a stack of matching processors and one component each for networking, power and security. A network boosts processing throughput. Reactors and security systems lower exposure. Auto-build quotes a package for available empty slots before purchase. The installed equipment keeps working until a refit completes.

| Strategy | What the player gives up |
| --- | --- |
| Lease a second machine immediately | Cash and a daily running cost in exchange for an equipped fallback. |
| Build a shell and buy processors | More up-front decisions and installation time in exchange for expandable capacity. An empty shell cannot keep the AI alive. |
| Sleep a viable backup | It can survive a loss and is harder to trace, but its CPU stops earning money or doing research. |
| Spread hosts across regions | A discovery in one region leaves more of the network outside that region’s increased exposure. Every additional visible host also provides another discovery opportunity. |
| Rush a remote research tier | Opening the destination alone is insufficient. Its equipment must be built, powered and available for research. |

A new campaign shuffles six urban profiles. Geography changes local thrift, construction speed, CPU output and stealth. The facility inspector shows the local quantities used in a quote. Worlds imported from earlier releases retain their existing geography. Facilities can be named, renamed, and decommissioned. Dismantling an equipped host also discards its pending installations. The last viable copy is protected against voluntary dismantling. Buyers can add matching processors to an in-progress batch when enough bays and cash remain.

## Discovery and news

Normal gives a new player time to establish a backup. The opening grace ends at 23 elapsed days or when cumulative active capacity exceeds 5,000 CPU-days, whichever comes first. Individual sites also receive protection based on their construction time. Once exposed, hosts and construction projects face separate risks from the Press, Scientists, Intelligence and the Public.

```mermaid
flowchart TD
    Visible["Exposed site"] --> Check{"Group finds evidence?"}
    Check -->|No| Visible
    Check -->|Yes| Loss["Lose site, hardware and pending work"]
    Loss --> Trace["Group suspicion rises and region draws attention"]
    Trace --> Survive{"A viable copy remains and suspicion allows play?"}
    Survive -->|No| End["Campaign lost"]
    Survive -->|Yes| Decide["Review report and remaining sites"]
    Decide -->|Rebuild elsewhere| Visible
    Decide -->|Sleep or refit hosts| Lower["Change future discovery rates"]
    Lower --> Check
```

A discovery report names the group, site and location. The clock stops for the report even when a day was requested. Group suspicion records accumulated evidence. The right dock always displays that percentage and a danger emoji. Socioanalytics adds a qualitative network-wide discovery forecast there, and Advanced Socioanalytics exposes the estimated daily probability. In Facilities the four investigators start with qualitative site risk grades. The first analytics project gives approximate probabilities, and the second gives two-decimal estimates. The purchase screen estimates a mature, online design. The inspector accounts for the host’s current protection, power and hardware.

| Normal calibration | Rule |
| --- | --- |
| Site hazard | Each group contributes an intensity in units of 1/10,000 per site-day. A constant daily intensity λ gives interval probability 1 − exp(−λ × elapsed days). |
| Example relay | A mature awake relay in a neutral urban region, with no suspicion, research or news modifiers, has daily intensities of 0.005 for Press, 0 for Scientists, 0.010 for Intelligence and 0.0125 for Public. Combined one-day discovery probability is **2.7125%**. |
| Exposure modifiers | Protection, local geography, investigative attention, installed hardware, research, world news and power state affect the forecast. Sleeping divides adjusted group hazard by four with integer rounding. |
| Discovery and suspicion | The discovering group gains ten percentage points of suspicion. The two most recent discovery regions receive rate multipliers of 1.2 and 1.1. |
| Suspicion decay | Each midnight, current suspicion falls by 1.5% for Press, 0.5% for Scientists, 1% for Intelligence and 2% for Public, before research bonuses. The minimum decrement is one basis point, bounded by zero. |
| Loss | The last host with installed processing is lost, or one group’s suspicion exceeds 100%. Maintenance failure can also cost a host without creating discovery evidence. |

News is visible during opening protection. The early bulletins give the player a first signal from the outside world. After protection ends, eight world stories can alter the discovery multiplier of a particular group. Six have lasting effects and two press stories expire after 21 days. Each has a daily hazard of 20/10,000 while eligible. A newspaper headline can make future discovery more or less likely without naming or costing the player a site. News uses a separate random sequence from discovery.

**Repeatable playtest.** Start simulation seed 19, commission leased relays in Europe and Asia immediately, and keep the default allocation. The first news bulletin arrives at 06:00 on day 1. On day 35 at 21:34 the Public identifies the Asian relay. Its loss leaves two hosts, and Public suspicion rises by ten percentage points. The browser regression test runs this scenario and checks that the report survives reload.

## After a report or an ending

Activity groups dispatches by their simulated minute, filters events by category and keeps up to 1,000 records. Warnings in the right dock and Activity point to decisions the player can make. The four warning categories can be switched independently in Options. Read the opening through the campaign menu. Losing opening protection pauses playback on that minute and opens the grace chapter. Revisit chapters from their entries in Activity. A discovery on the same minute takes precedence.

After Apotheosis, choose **Enter free play** to keep the network and explore the remaining projects. Save slots can preserve the moment of victory separately. The developer sandbox in the campaign menu runs on a disposable copy and provides controls for testing particular situations.

## References

The research guide lists every hardware and location unlock. The source baseline is Endgame: Singularity v1.1. Browser prices and work requirements use our campaign balance.

[Research tree](research-tree.md) · [Normal preset](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat) · [Site hazards](https://github.com/singularity/singularity/blob/v1.1/singularity/data/bases.dat) · [Group decay](https://github.com/singularity/singularity/blob/v1.1/singularity/data/groups.dat) · [World events](https://github.com/singularity/singularity/blob/v1.1/singularity/data/events.dat) · [Simulation](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py) · [Solar rendering](https://github.com/singularity/singularity/blob/v1.1/singularity/code/screens/map.py)
