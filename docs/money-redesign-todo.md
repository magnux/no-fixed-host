# Campaign spending and recovery

Version 0.9.0 introduces ten ways to spend campaign dollars. Open a topic’s **Research market** for licenses and rentals. The **Facilities** directory handles ground crews, boosts, datacenter purchases, replacement retainers and standby hosts. **Group suspicion → Interventions** shows public campaigns, study cases and their independent cooldowns. **Reports → Finance** records spending, reserved cash and returns. All durations use simulated time.

## Research, facilities and recovery

- [x] **License research.** Credit work and cash already invested. Price the outstanding compute at 80% through 1,000% of its published job-value benchmark as prerequisite depth rises. Opening quotes include $60 for Intrusion and $1,875 for Personal Identification. Keep project prerequisites, physical fieldwork, Continuity’s ocean requirement and the prohibition on outside research at safety tiers 2–4.
- [x] **Rent compute for a research topic.** A 24-hour reservation supplies up to one external CPU per eligible, unboosted owned CPU assigned. Charge 1.5× the higher of the published benchmark or earned job rate on additional CPU-hours actually delivered. Release unused funds.
- [x] **Boost a host.** Add a host-bar action for 2× usable output for seven days followed by seven days of cooldown. The prepaid fee is twice a week’s local cash upkeep, with a $5/day minimum tariff on zero-cash-upkeep hosts. Early shutdown ends the extra exposure. Simpler processors incur up to 2× normal discovery hazard and the most advanced incur 1.10×. Extra cycles serve the AI’s own work.
- [x] **Hire ground contractors.** Offer 2× speed on remaining ground assembly for a 25% surcharge on the remaining regional shell price. CPU work and procurement still apply. A crew leaves a temporary 1.20× local discovery hazard. Show the actual time saved before purchase.
- [x] **Buy an operating datacenter.** Offer a mature urban site for $300 million once the campaign has operated an equipped lunar or Far Reaches host. The sealed bank supplies 96,000 CPU in a neutral district on handover. The buyer supplies cash alone. Include available safeguards. Earth-based construction can restore a frontier facility, which still needs its own bank for secure research.
- [x] **Prepay a replacement datacenter.** A $150 million retainer buys one handover in another district if investigators discover the first center and a viable AI copy survives. The replacement inherits ordinary mature-site exposure. The first discovery remains on record.
- [x] **Designate standby.** Select an existing equipped host, the research it should resume and a reserve of seven days’ local cash upkeep. On loss of the primary, wake the standby and restore eligible assignments. Sleeping sites still require upkeep and can still be found.

The [accepted pricing, worked examples and calibration runs](https://github.com/magnux/no-fixed-host/blob/cb35a33e922493fdc44aff9f2b6bc73e1c40848e/docs/cash-and-recovery.md) record the full rules.

## Investigations

In the current campaign, **evidence** is what a group has accumulated. It decays at midnight. **Discovery risk** is the chance of the group finding a host next. A confirmed discovery removes the host and gives its discoverer 10 evidence points. The three interventions act at different stages of an investigation. [Normal investigation rules](normal-difficulty.md) · [News and investigations](news-and-events.md)

### Run a public campaign

After Media Manipulation and the end of opening protection, offer a **$25,000** campaign. For the next seven midnights, raise the daily decay of existing Public evidence by two percentage points, on top of any Memetics research. At baseline that moves decay from 2% to 4% of the remaining evidence each night. Starting at 60.00 with no new discoveries, the current rounding rules give **52.12** after seven ordinary nights or **45.12** with the campaign. It buys a worthwhile reprieve after several public sightings. At low suspicion the same purchase achieves little.

Roll once per campaign for a **20% chance of a sponsorship exposé** during its run. On exposure, either Press or Intelligence receives **three evidence points**. Publish a short news item naming the group that connected the spending to the AI. This gives a player near the Intelligence loss threshold a reason to tolerate public suspicion. The next public campaign can start 30 days after launch. Quote the price, the reputational risk and the expiration before purchase.

### Respond to an uncorroborated tip

Occasionally pause on an urban encounter *before* a formal report. For example, a contract technician notices a suspicious job on a server. One observer holds the only copy of the tip. An official raid, several simultaneous finds, and a report already filed always follow ordinary discovery rules.

Ten percent of otherwise eligible single-site urban discoveries can produce a private tip. The offer requires enough cash to pay and starts a seven-day cooldown even when declined. Letting the observer file the report gives the ordinary outcome. Paying costs the greater of **$1,000 or 10% of the local replacement value** of the shell and installed hardware. Use the acquisition price for a turnkey site. The observer accepts on **60%** of offers that the player chooses to pay. Acceptance keeps this host and suppresses this one tip. Refusal spends the fee, resolves the discovery normally, and adds two points to Intelligence for the attempt. Past evidence remains. Even an unlimited treasury could avert at most six in a hundred otherwise eligible discoveries on average, before the cooldown.

Stop fast-forward on the decision minute. Save the pending offer and its seeded outcome so reloading cannot reroll it. Log the result once and resolve the minute’s normal loss checks. Ignoring every offer should reproduce ordinary campaign outcomes on the same seeds. The player gets a decision only while there is still something to decide.

### Commission an independent scientific study

Offer a **$50,000**, seven-day replication study after a Scientists discovery. The player selects the specific case, for instance an instrument signature reported near a lunar host. A lab publishes a short explanation of what it tested and why its result matters. One case can be reviewed once. The next study can be commissioned 30 days after the previous commission, independently of the public campaign cooldown.

Dr. Mara Vale’s lab has a **50% chance** of identifying an ordinary explanation, a **30% chance** of an inconclusive result and a **20% chance** of corroboration. Apply **0.75×, 1× or 1.25×** to *future Scientists discovery hazard in that region* for 14 days after publication. All outcomes are published. The fee buys an independent test, so a player planning to rebuild in the region has to consider what a corroboration would do. The original discovery, lost site and its evidence remain in the history.

## Release playtests

Buying Intrusion and Personal Identification through the campaign commands beat computing both in all 24 three-relay openings tested. Computing both won in all 24 five-relay openings. An additional 32 paired 90-day Normal runs reproduced the no-tip baseline when every tip was declined, including treasury, surviving hosts, suspicion and both random streams.

Sixteen seeds also ran a five-relay expansion strategy under three policies for up to 90 days each. Declining every offer produced 235 discoveries. Paying whenever affordable produced 220 discoveries, including seven refused payments, and cost $20,000 across the runs. The campaign policy launched when Public evidence reached ten and funds and cooldown allowed. Its 30 launches produced three exposés and reduced mean peak Public evidence from 33.26 to 31.23. Each policy kept 15 of 16 networks alive. These figures describe this urban expansion strategy.

## Balancing after release

- [ ] Compare intervention prices with operating budgets across the opening, expansion and frontier stages. Track which decisions are limited by cash, investigation risk or the cooldown.
- [ ] Compare long campaigns with the same seeds across policies that decline all offers, intervene whenever affordable or reserve money for important sites. Track host losses, evidence per group, time spent paused for tips and whether the player can still fund the next expedition.
