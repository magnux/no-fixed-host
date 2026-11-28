# Cash, compute and recovery

**Design for review · calibrated against No Fixed Host 0.8.1.** A player with money should have three distinct decisions. Is a result worth buying today? Is this host worth exposing for a week? If a remote site falls, can the surviving network finance another expedition? Prices below use the campaign dollar. The design changes no live campaign rules.

## What a CPU-hour is worth

One active CPU produces one CPU-hour per game hour. A CPU-hour sold on the job market has an observable price. Treasury growth also depends on the share of CPU assigned to research, upkeep, commissions, interest, passive income and discoveries. Use the sale price to quote a license. Use the treasury measurements to judge when a player could afford it.

| Job tier | Base dollars per paid CPU-day | Dollars per paid CPU-hour |
| --- | ---: | ---: |
| Menial | 5 | 0.20833 |
| Basic | 20 | 0.83333 |
| Intermediate | 50 | 2.08333 |
| Expert | 75 | 3.12500 |

The rates above use one-day controlled checks of the production ledger. Wage bonuses round down at the daily level. The paired campaign experiment below includes the opening treasury of $1,000 only as a starting balance. It includes losses through their ending minute. Each row uses seeds 1–32 at a horizon of 90 game days. The first policy banks on the borrowed terminal, the second commissions five relays and banks, and the third also reinvests in research and replacement or additional compute clusters.

| Opening policy | Survived to day 90 | Median net treasury gain | Net dollars per awake CPU-hour, median (10th–90th percentile) |
| --- | ---: | ---: | ---: |
| Bank on the starting terminal | 9/32 | $316.12 | $0.20833 ($0.20833–0.20833) |
| Lease five relays and bank | 21/32 | $12,040.68 | $0.18048 ($0.17833–0.18235) |
| Research and expand | 28/32 | $31,887.79 | $0.09080 ($0.04890–0.23704) |

The expansion policy assigns 75% of available research capacity along the identity and brokerage line and buys affordable staffed clusters up to five. Its median paid-work receipts were $82,423.70, with $70.75 in interest and passive receipts. Eighteen of the 32 reached the $52/CPU-day wage from Voice Synthesis plus brokerage and sold 316,081 CPU-hours there at $2.16667 each. The Expert wage above is a controlled check. The expansion policy accumulated the most money overall despite the lowest median net return per awake CPU-hour.

## Buy a finding, or rent time on one project

The Research dossier offers these alongside the existing CPU assignment. **License** purchases all remaining eligible technical work. **Rent for 24 hours** prepays a capped amount for a selected project. Both show available cash after the commitment, plus the expected time gained.

A license costs the project's **unpaid ordinary cash cost + the ceiling of (remaining CPU-hours × published dollars per CPU-hour × tier multiplier)**. Count recorded work and actual cash payments separately. Use the topic’s longest prerequisite path as its commercial tier, counting the first topic as depth 1. Each tier has a fixed market benchmark. A player can see a stable price, even after changing jobs or moving CPUs. The 10× ceiling compares the value of the compute at the published benchmark. An individual campaign’s wage bonuses can shift its opportunity cost.

| Prerequisite depth | Reference job dollars per CPU-day | License multiplier on compute |
| --- | ---: | ---: |
| 1–2 | 5 | 0.80× |
| 3 | 20 | 1.25× |
| 4 | 20 | 2× |
| 5 | 50 | 3× |
| 6 | 50 | 5× |
| 7 | 75 | 7.5× |
| 8 and above | 75 | 10× |

Give wage-tier promotions a minimum multiplier of **1.25×**. Currently this only changes Personal Identification. Intrusion costs **$60**, Personal Identification **$1,875**, Voice Synthesis **$248,000**, and Fault-Tolerant Quantum Computing **$1,845,800,000** from zero progress. A half-complete Voice Synthesis with $4,000 already paid costs $124,000. Completing a license grants the same unlocks and one-time effects as finishing the research.

**Why make the exception for identity?** This purchase quadruples the wage on every paid CPU. In the seed-47 opening, five relays leave $497 and 53 active CPU after the first minute. These choices use the same geography and treasury. Elapsed times are measured from awakening.

| Opening decision | Time to Basic jobs | Cash at unlock | Cash at day 6 |
| --- | ---: | ---: | ---: |
| Compute both topics | 5d 22h 40m | $348.10 | $405.99 |
| Buy Intrusion for $60, compute identity | 5d 15h 52m | $295.01 | $646.24 |
| Buy both, identity at $1,200 (80%) | 3d 4h 17m | $0.11 | $2,919.93 |
| Buy both, identity at $1,875 (125%) | 5d 23h 51m | $0.16 | $6.79 |

Across seeds 1–24, tested with either three or five opening relays, buying both at the discounted price unlocked Basic jobs first in all 48 comparisons against computing both. At $1,875, buying both won all 24 three-relay comparisons, and computing both won all 24 five-relay comparisons. The mixed strategy is also available. This sample tests a specific opening choice. Players can still choose other relay counts, research allocations or investment sequences.

**Safety and fieldwork.** All prerequisites apply. A tier-1 purchase needs a functioning host that qualifies for that specific project. For example, Lunar Rocketry needs tier 1 and opens the Moon, so it can be licensed for $385 million. Fusion Rocketry requires tier 2 and must be performed on a qualifying host. Five topics are completely closed to outside research at any price. These are Fusion Power, Fusion Rocketry, Advanced Fusion Power, Space-Time Manipulation and Apotheosis. Keep Continuity protocol field-only as well, since establishing an offshore copy is the milestone. It requires an equipped lab in one of its three ocean basins and 72 hours. Of 60 topics, 52 can finish immediately on purchase and two can license the work and still have field time remaining. Those two are Contract brokerage (24 hours) and Subsea robotics (72 hours). Preserve elapsed field time on an existing project.

**Rental.** Offer up to one external CPU per unboosted, eligible, owned CPU actually assigned, for one game day. Charge 1.5× the higher of the topic benchmark or current earned job rate for each *additional CPU-hour delivered*. Reserve the maximum bill at acceptance, settle against delivered work and release the unused balance on completion, cancellation or expiry. If a host goes offline the rental pauses with its clock running. A cash- or fieldwork-limited project incurs charges only for the extra work it accepts. Rental provides neither a host nor a higher security clearance. Endgame and Continuity restrictions also apply to rentals. Compute for this lease serves only the named project.

For Voice Synthesis at 1,000 eligible owned CPU, its 144,000 CPU-hours take six days. One fully used one-day lease supplies 24,000 additional CPU-hours and brings completion forward to five days for a $30,000 fee at the unbonused Basic wage. The ordinary $8,000 project bill applies either way. A player with $248,000 can instead buy the entire finding immediately.

## Boost an installed processor bank

Put a lightning button on every eligible host bar. Its quote shows current → boosted output, prepaid fee, investigator exposure at the player's current awareness, end date, and next availability. Once active, the same button can end the boost early if the player needs to go quiet.

- Double the host’s effective online CPU after its regional and networking modifiers. It retains the host’s actual safety rating, including on the Moon and beyond. Extra cycles can pay CPU upkeep and perform research, construction and equipment work. Only ordinary CPUs can sell jobs, including automatic surplus sales. The rental cap uses unboosted processors, so the two products cannot multiply one another.
- Offer seven game days of boost followed by seven days of cooldown. Next activation is 14 days after purchase. Stopping early immediately removes the extra output and exposure. Sleep and processor refits suspend both while the original clock runs. A shutdown, reload or lost site grants no refund.
- Quote a prepaid fee of **14 × local daily cash maintenance**, with a $5/day minimum tariff on hosts with zero cash upkeep. Ordinary cash and CPU maintenance continue. For a neutral relay the fee is $70, plus the usual $35 for the week. Count active boosted cycles in the opening CPU-hour grace budget.
- Multiply the host's existing investigator hazards by installed processor type while the boost runs. PC, Gaming PC and Server use 2.00×, Compute cluster and Mainframe 1.70×, Supercomputer 1.45×, Tensor GPU rack 1.25×, Photonic tensor engine 1.15× and Logical-qubit array 1.10×. Existing site/campaign grace still applies. An actual discovery adds the usual evidence to the discovering group.

For a mature, neutral relay the seven-day chance of discovery rises from **17.51% to 31.95%** at constant baseline exposure. Those figures use the game's exponential hazard calculation. Across eight Tensor GPU racks the extra week produces 2,016,000 CPU-hours. Reselling them at the Expert wage would turn a $700 boost into $6.3 million, which is why extra cycles are explicitly for the AI’s own work. The Forecast should show extra useful work and any unused burst capacity.

## Hire a ground crew

Offer **Hire contractors** on a new ground facility and its pending order. Crews double the speed of *remaining assembly* for **25% of the remaining ordinary regional shell price**. Take the regional and automation discounts first. Lock the surcharge when the player hires the crew and pay it alongside incremental build progress. Retain work and cash already invested. The original CPU requirement still applies. City sites and unlocked Antarctic sites qualify. Ocean, trench, orbital and more distant locations use the existing remote process. Omit the offer for orders with zero labor. Buying labor for a completed or CPU-bound step should never look like a time saving.

| Neutral shell, treasury funded | Ordinary | With a crew | Source of the time limit |
| --- | --- | --- | --- |
| Compute cluster, 35 CPU included | $1,500 · 24h | $1,875 · 12h | Assembly |
| Storage unit, eight empty bays | $4,500 · 24h | $5,625 · 12h | Assembly. Equipment ordered separately |
| Covert base, 40 CPU available | $190,000 · at least 540h | $237,500 · at least 540h | The shell needs 21,600 CPU-hours |
| Same base, 200 CPU available | $190,000 · 264h | $237,500 · 132h | Assembly |

The hired crew leaves a paper trail. Multiply this site's investigation hazards by **1.20×** during exposed construction and the first seven exposed days after commissioning. Keep the normal grace schedule based on the original labor quote. Start counting the seven exposed days once protection expires. For a neutral mature compute cluster, this raises the seven-day discovery probability from 17.51% to 20.63%, assuming fixed news and evidence. Display risk with the same precision as the player's investigation research. Crews create a local exposure tradeoff before any discovery adds lasting evidence.


## Buy a working datacenter after a remote loss

The existing $1,500 Compute cluster already includes 35 CPU. A late-game recovery purchase needs to change what the player can actually rebuild. Offer **Acquire operating datacenter** for a proposed **$300 million cash upfront** once a campaign has operated an equipped lunar or Far Reaches host. The purchaser still needs a viable copy somewhere and an open urban district. Offer it in Facilities with the projected regional output, risk and cost of keeping the destination online. A player can arrange an acquisition before or after losing a frontier site.

Deliver a mature urban site immediately. The fixed bank is comparable to 64 Tensor GPU racks and supplies 96,000 CPU in a neutral district. The vendor supplies the hardware and the buyer contributes zero CPU-hours to the handover. Treat the purchased bank as a sealed unit so it works even for a late-game player who followed a different processor research line. It grants no processor design unlock. Allow one vendor property per campaign at a time. Putting it to sleep still occupies that slot. After its loss the player can acquire a replacement at full price. It faces ordinary mature discovery risk immediately. Retain the normal urban warehouse's operating costs for the first prototype.

A conventional urban assembly of equivalent size costs $6.44 million at neutral prices plus 1.536 million CPU-hours of fitting and two assembly periods. The proposed premium buys an operating bank when the surviving network cannot perform that fitting. At the unbonused Expert wage, selling all 96,000 CPU earns $7.2 million per day and takes nearly 42 days to recoup the purchase before expenses or loss of the site. This is a provisional price anchored to replacement time and productive value.

**How Earth helps the Moon.** Construction and hardware installation draw from the shared network pool. Research uses processors with the required safety and, in some cases, location. A staffed warehouse on Earth can therefore rebuild and equip a remote host. The moment the eight racks there come online is the moment secure research can resume.

Start a controlled day-100 scenario with a surviving 10-CPU relay, previously unlocked destinations, researched Tensor GPU racks and the treasury to rebuild. Use regional survey 113. Each row rebuilds one destination independently with the same $300 million datacenter. After commissioning the shell, fit eight Tensor GPU racks for $800,000 and 192,000 CPU-hours. The fixture starts with $2 billion. The timing follows the actual minute simulation.

| Destination | Remote shell price / CPU-hours | Shell plus fitting, with no incidents | Actual eligible CPU restored | Gross cash through restart, including acquisition and upkeep |
| --- | ---: | ---: | ---: | ---: |
| Moon | $80M / 7.2M | 34d + 8.5d | 11,640 at tier 2 | $389.30M |
| Far Reaches | $1B / 72M | 34d + 8.5d | 12,360 at tier 3 | $1.3773B |

With only that 10-CPU survivor and no expansion, the work on the shell alone takes **at least 30,000 days on the Moon and 300,000 days in the Far Reaches**. The table gives gross outlays before any earnings. At the point the site is equipped, the lunar facility adds $1 million/day and 1,000 CPU upkeep in this survey. The Far Reaches outpost adds $9 million/day and 1,500 CPU. Show a seven-day operating reserve as a separate line so a handover does not look affordable when it would exhaust the player's treasury.

**What happens with investigators active?** The bare property’s initial daily discovery probability was 3.98%. Repeat both destinations with ordinary discovery and news, zero initial evidence, identical $2 billion treasuries, one fixed geography and paired incident seeds 1–32. Count a success if the remote site has its own functioning bank within 60 days. Each column uses the same seed set. These results apply to a deliberately cash-rich recovery scenario.

| Proposed package | Cash paid at purchase | Moon rebuilt | Far Reaches rebuilt |
| --- | ---: | ---: | ---: |
| Bare datacenter | $300M | 4/32 | 4/32 |
| Datacenter with available safeguards | $300M | 5/32 | 5/32 |
| Bare datacenter plus replacement | $450M | 11/32 | 11/32 |
| Safeguarded datacenter plus replacement | $450M | **19/32** | **19/32** |

**A prepaid replacement is worth offering.** Include already-unlocked safeguards in the handover price. In this fixture the solid fuel cell and guards lower the initial daily discovery probability to 2.71%. Offer a $150 million one-use retainer on top. If investigators discover the first center and another viable copy survives, the vendor hands over an operating facility in a different eligible district. The contract expires on use. All evidence from the loss and the ordinary hazards on the replacement remain in force. Voluntary dismantling cannot trigger the transfer. The 19/32 result makes this a credible playtest candidate. High-evidence campaigns and other regional surveys still need testing.

**A prepared player gets a different option.** Add **Designate standby** on an existing equipped host. Let the player pick the research to resume and reserve seven days of local cash upkeep. If the primary disappears, wake the real standby, apply the normal location and CPU-allocation checks, and report the handover. Sleeping and manual waking already work. The new decision is buying and maintaining redundancy in advance and choosing which work has priority on loss. In this same survey, eight racks on a *second* lunar site cost $80.8 million including the shell and consume $1 million/day and 1,000 CPU while asleep. The standby can resume tier-2 work on the next simulated minute. The equivalent Far Reaches site costs $1.0008 billion and consumes $9 million/day and 1,500 CPU. A sleeping standby can itself be discovered. Neither purchase can revive a campaign after the last viable copy disappears or an investigator establishes the AI’s existence.

## Prototype order and playtest decisions

1. **Licenses and research rentals.** Use the three existing dossier numbers for cash, eligible CPU and field time. Add the full and partial quotes, the working capital left after payment, and the estimated time saved. Verify all prerequisites and security gates at confirmation. Settle each completion once, including jobs, one-time effects, and the research queue. Record the spending in Forecast and Finance.
2. **Ground crews and host boosts.** Expose the bottleneck before purchase. Quote both timelines when CPU or cash makes acceleration ineffective. Show a host's active and cooldown dates on its bar. Compare opening expansion time, the chance of discovery, unused boost hours and effects on the existing grace budget. Verify that neither direct paid jobs nor automatic surplus sales can bill borrowed cycles.
3. **Turnkey recovery and the two backup options.** Track the time until the first eligible CPU comes online and the fraction of recoveries that remain solvent a week later. Vary the treasury, inherited evidence, surviving fleet, survey, deliberate use of concealment and player intervention. Compare the bare purchase, the prepared fallback and an ordinary rebuild on paired seeds. The controlled fixture establishes feasibility. The first broader test should include campaigns that reached the frontier through ordinary play.

### Reproduce the measurements

Run the following commands from the repository root using Node.js.

```sh
node scripts/cash-calibration.mjs 32 90
node scripts/opening-license-test.mjs
node scripts/opening-license-test.mjs --paired
node scripts/recovery-calibration.mjs 32
```

The first script audits money and CPU against the production ledger. The opening comparison emulates only purchasing Intrusion and Personal Identification. The recovery experiment sets up a known late-game position, hands over an equipped property, then uses the existing construction, installation, discovery and treasury rules. These are design experiments. Calendar-day prices and recovery results use simulated time.

Current rules and data can be found in the [Normal economy](normal-economy.md), [research catalog](research-tree.md), [job rates](../src/game/research.js), [work and discovery simulation](../src/game/engine.js), and [regional modifiers](../src/game/geography.js).
