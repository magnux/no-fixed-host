# News and investigations

A world story changes how readily an investigator can discover a host. It adds or subtracts 1,000 basis points from that group’s discovery multiplier. Suspicion itself changes when the group finds evidence. Editorials, field reports, follow-ups and the AI’s private network brief leave these values unchanged.

## The eight world stories

All eight v1.1 rules are global. Their descriptions and shorter log lines are two presentations of the same events. The reference log also records research results, facilities completed, hosts lost to maintenance, discoveries and equipment deliveries. These dispatches come from the player’s actions and their consequences. A research dispatch in No Fixed Host includes the completed topic’s finding. [Reference rules](https://github.com/singularity/singularity/blob/v1.1/singularity/data/events.dat) · [English catalog](https://github.com/singularity/singularity/blob/v1.1/singularity/data/events_str.dat) · [Reference log message types](https://github.com/singularity/singularity/blob/v1.1/singularity/code/logmessage.py)

| Reference story | No Fixed Host headline | Investigator | Change to multiplier | Duration |
| --- | --- | --- | ---: | --- |
| the-plague | Cities open round-the-clock clinics | Public | −10 points | Campaign |
| stranger-than-fiction | Viewers take a machine mystery off-screen | Public | +10 points | Campaign |
| the-watchers | Intelligence offices pool their anomaly reports | Intelligence | +10 points | Campaign |
| politics-as-usual | Inquiry splits an intelligence directorate | Intelligence | −10 points | Campaign |
| lab-ai | A lab invites replication of its machine cognition result | Scientists | +10 points | Campaign |
| discrediting | Retraction stalls machine cognition research | Scientists | −10 points | Campaign |
| scandal | Contracting scandal takes over the front page | Press | −10 points | 21 days, then midnight check |
| investigation | Reporters compare the hidden costs of leased servers | Press | +10 points | 21 days, then midnight check |

The reference checks eligible stories after discoveries and before the daily update. Each has a Poisson intensity of 0.002 per eligible day. With all eight eligible, the mean wait for the first event is about 62.5 days after protection ends. The probability of at least one in the first 30 eligible days is about 38.1%. As permanent stories occur, fewer stories remain eligible. Normal changes opening protection and investigator mechanics. The eight event intensities come directly from the catalog. [Player update](https://github.com/singularity/singularity/blob/v1.1/singularity/code/player.py#L419-L480) · [Poisson interval roll](https://github.com/singularity/singularity/blob/v1.1/singularity/code/chance.py#L28-L45) · [Normal preset](https://github.com/singularity/singularity/blob/v1.1/singularity/data/difficulties.dat#L23-L31)

The browser campaign checks each eligible event once per simulated minute, with probability 1 − exp(−0.002/1440). It stops after the first success for that minute. A temporary story that starts on day 10 at 14:37 ends on day 32 at 00:00. A story starting at midnight also survives the check exactly 21 days later. The event roll happens before expiration, so its earliest recurrence is the following minute. The investigator’s modifier is derived from currently active stories. Saving and reloading preserve its start time and the next random draw. [Reference expiry](https://github.com/singularity/singularity/blob/v1.1/singularity/code/event.py#L102-L125) · [Reference discover effect](https://github.com/singularity/singularity/blob/v1.1/singularity/code/effect.py#L91-L102) · [Browser rules](../src/game/events.js)

## Listening to the campaign

| Broadcast | Publication | What the player sees |
| --- | --- | --- |
| Opening bulletins | Day 1 at 06:00 and day 3 at 00:00 | The night-sky volunteer survey and secondhand server market introduce the world during protection. |
| Public editions | Day 6 at noon, then every four days through day 66 | Sixteen original reports cover everyday computing, orbital radio, machine cognition and local currencies. |
| Follow-up coverage | At 15:00, starting one full day after an active world story | Each of the eight investigative stories has a separate follow-up from the people affected. Each follow-up runs once and leaves the modifier alone. |
| Field reports | At 18:00, when a completed host occupies a previously uncovered remote region | Antarctica, the Ocean, the Moon, the Far Reaches and Transdimensional space have distinct reports. At most one airs per evening. Each airs once per campaign. |
| Private network brief | Day 70 at noon and every four days thereafter | The AI summarizes the network’s current footprint and recent recorded operations. The byline identifies the information as private. |
| Investigation update | Any eligible minute | A dispatch pauses live playback at the minute of a consequential story. A simultaneous discovery or end-of-protection chapter takes priority. Expiration posts a follow-up. |

The dock retains four recent headlines and reserves room for the latest investigation update for up to 22 days. **Coverage** opens the active modifiers and their expiration dates in Activity. The journal can replay a full world story after a reload. News uses a dedicated seeded random stream. Editorial schedules consume no random draws. [News desk](../src/game/news-desk.js) · [Regression cases](../test/events.test.js)
