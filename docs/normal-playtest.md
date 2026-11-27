# Normal campaign playtest

These runs start with a fresh $1,000 campaign and one borrowed terminal. They use the browser game's campaign commands and minute simulation. No scenario grants, developer commands or forecast mode are involved. Run the checks from the repository root.

```sh
node scripts/normal-playtest.mjs workshop
node scripts/normal-playtest.mjs discovery 256
node scripts/normal-playtest.mjs pressure
```

## First discovery

Each seed from 1 through 256 plays twice. One campaign keeps its original terminal. The other leases one relay each in Europe, Africa and Asia at minute zero. Both leave the hosts active, earn money with spare CPU and run through the first discovery or the end of day 53. Neither campaign reaches the compute limit for early loss of grace.

| Strategy | By 7 days after grace | By 14 days after grace | By 30 days after grace | Campaigns lost at first discovery |
| --- | ---: | ---: | ---: | ---: |
| Original terminal | 27/256 (10.5%) | 63/256 (24.6%) | 104/256 (40.6%) | 104 of 104 |
| Original terminal and three relays | 128/256 (50.0%) | 188/256 (73.4%) | 237/256 (92.6%) | 0 of 237 |

The opening protected both strategies for 23 days in this sample. Immediately before the end of protection, the original-terminal campaign had one active CPU and $1,115. The expanded campaigns had 31–35 active CPU and $3,878–$4,378, depending on their regional advantages. Multiple leases raised the odds of losing *a site*, while a surviving copy kept the network running. These percentages describe these two strategies and this finite set of seeds. Campaigns still undiscovered on day 53 are counted in the denominator.

## Sustained public exposure

A third strategy on seed 47 maintains twelve leased relays. It places replacements once per day and rotates through the six inhabited regions. Spare CPU earns money and the player takes no concealment research. The Public established the AI’s existence at minute 90,360, 62 days and 18 hours after awakening. Public evidence reached 107.80%. Eleven hosts and $33,498.04 remained. Of 27 lifetime relay orders, the first twelve opened the network and fifteen replaced losses.

## A workshop built from earnings

Seed 47 starts by commissioning five relays, one each in Europe, Africa, Asia, Australia and South America. It commits all available CPU to Intrusion and then to Personal Identification. After research completes, spare CPU earns money. The player orders a European storage unit, fits two PCs, fills eligible empty slots with Auto-build and improves the installed processors with Auto-upgrade. The simulation runs unaided from the completed refit through day 60.

| Elapsed game time | Observation |
| --- | --- |
| Minute 1 | Five relays are online. The network has 53 CPU and $497.00. |
| Minute 409 | Intrusion completes. |
| Minute 8,560 | Personal Identification completes. The player commissions the $4,500 storage unit with $349.10 available. |
| Minute 9,280 | Twelve hours after commissioning, the shell has received $865 and earned 4 hours 37 minutes of its required 24 hours of assembly. |
| Minute 14,336 | The shell completes with eight empty processor bays. |
| Minute 15,800 | Two installed PCs supply two raw CPU. The player orders networking and a generator for $700 total and upgrades the two PCs to two servers for $4,000. The workshop supplies zero CPU during the refit. The rest of the network still supplies 53. |
| Minute 22,669 | Both servers and both peripherals are installed. The workshop supplies 20 raw CPU. The network supplies 73. |
| Day 60 | The campaign survives three discoveries. Four hosts remain, with 44 active CPU and $50,140.05 in cash. Press, Intelligence and Public each have accumulated evidence. |

The test validates the in-memory save at each milestone. It exercises both package commands with their displayed item quantities and totals. The discovery experiment ends at the first loss of a site, so its figures do not estimate how often a campaign reaches Apotheosis.
